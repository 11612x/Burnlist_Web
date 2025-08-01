import { fetchQuote, fetchBatchQuotes } from '@data/twelvedataAdapter';
import normalizeTicker from '@data/normalizeTicker';
import { logger } from '../utils/logger';

// Merge historical data arrays, removing duplicates and sorting by timestamp
function mergeHistoricalData(existingData, newData) {
  // Create a map of existing data by full timestamp for more granular tracking
  const existingMap = new Map();
  existingData.forEach(point => {
    // Use full timestamp for more precise tracking
    const timestampKey = point.timestamp;
    existingMap.set(timestampKey, point);
  });
  
  // Add new data, keeping the most recent entry for each timestamp
  newData.forEach(point => {
    const timestampKey = point.timestamp;
    const existingPoint = existingMap.get(timestampKey);
    
    // Keep the most recent point for each timestamp (should be the same timestamp)
    if (!existingPoint || new Date(point.timestamp) >= new Date(existingPoint.timestamp)) {
      existingMap.set(timestampKey, point);
    }
  });
  
  // Convert back to array and sort by timestamp
  const merged = Array.from(existingMap.values()).sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  logger.log(`🔍 MERGE DEBUG: Merged ${existingData.length} existing + ${newData.length} new = ${merged.length} total data points`);
  if (merged.length > 0) {
    logger.log(`🔍 MERGE DEBUG: First timestamp: ${merged[0].timestamp}, Last timestamp: ${merged[merged.length - 1].timestamp}`);
    logger.log(`🔍 MERGE DEBUG: Data points over time:`, merged.map(p => `${new Date(p.timestamp).toLocaleString()} - $${p.price}`));
  }
  
  return merged;
}

// Global state to track active fetches per watchlist
const activeFetches = new Map(); // slug -> { status, currentBatch, totalBatches, abortController }

// Per-watchlist request counters
const watchlistRequestCounts = new Map(); // slug -> { count, resetTime }

// Global request counter to track API calls (for logging only)
let globalRequestCount = 0;
let lastResetTime = Date.now();

// Reset global counter every minute (for logging only)
function resetGlobalRequestCounter() {
  const now = Date.now();
  if (now - lastResetTime >= 60000) { // 1 minute
    globalRequestCount = 0;
    lastResetTime = now;
  }
}

// Rate limiting: Allow max 55 requests per minute (Twelve Data API limit)
function canMakeRequest() {
  const now = Date.now();
  const timeSinceLastReset = now - lastResetTime;
  
  // Reset counter every minute
  if (timeSinceLastReset >= 60000) {
    globalRequestCount = 0;
    lastResetTime = now;
    return true;
  }
  
  // Allow max 55 requests per minute (Twelve Data API limit)
  return globalRequestCount < 55;
}

// Increment global request counter (for logging only)
function incrementGlobalRequestCounter() {
  resetGlobalRequestCounter();
  globalRequestCount++;
  logger.log(`📊 Global API Request #${globalRequestCount} (rate limited: ${globalRequestCount}/55 per minute)`);
}

// Get or initialize watchlist request counter
function getWatchlistRequestCounter(slug) {
  if (!watchlistRequestCounts.has(slug)) {
    watchlistRequestCounts.set(slug, { count: 0, resetTime: Date.now() });
  }
  return watchlistRequestCounts.get(slug);
}

// Increment watchlist request counter
function incrementWatchlistRequestCounter(slug) {
  const counter = getWatchlistRequestCounter(slug);
  counter.count++;
  logger.log(`📊 Watchlist ${slug} API Request #${counter.count}`);
}

// Utility: Check if extended trading hours are active (Mon-Fri, 4:00am-8:00pm ET)
function isMarketOpen() {
  const now = new Date();
  // Get NY time (works regardless of user's timezone)
  const nyTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const day = nyTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = nyTime.getHours();
  // Extended trading hours: Mon-Fri, 4:00am-8:00pm ET
  // Includes pre-market (4am-9:30am), regular (9:30am-4pm), after-hours (4pm-8pm)
  if (day === 0 || day === 6) return false; // No weekend trading
  if (hours < 4) return false;  // Before 4:00 AM ET
  if (hours >= 20) return false; // After 8:00 PM ET (>= 20:00)
  return true;
}

// Split tickers into batches
function splitIntoBatches(tickers, batchSize = 5) {
  const batches = [];
  for (let i = 0; i < tickers.length; i += batchSize) {
    batches.push(tickers.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Fetch manager that supports pausing, cancelling, and resuming from the middle of a batch
 */
export class FetchManager {
  constructor() {
    this.activeFetches = new Map();
  }

  /**
   * Check if a fetch is currently active for a watchlist
   */
  isFetchActive(slug) {
    const fetch = this.activeFetches.get(slug);
    return fetch && fetch.status === 'active';
  }

  /**
   * Get the current fetch status for a watchlist
   */
  getFetchStatus(slug) {
    const fetch = this.activeFetches.get(slug);
    if (!fetch) return null;
    
    return {
      status: fetch.status,
      currentBatch: fetch.currentBatch,
      totalBatches: fetch.totalBatches,
      progress: fetch.totalBatches > 0 ? `${fetch.currentBatch}/${fetch.totalBatches}` : null
    };
  }

  /**
   * Cancel any active fetch for a watchlist
   */
  cancelFetch(slug) {
    const fetch = this.activeFetches.get(slug);
    if (fetch && fetch.abortController) {
      fetch.abortController.abort();
      fetch.status = 'cancelled';
      // Reset watchlist request counter when fetch is cancelled
      watchlistRequestCounts.delete(slug);
    }
  }

  /**
   * Pause any active fetch for a watchlist (store current state)
   */
  pauseFetch(slug) {
    const fetch = this.activeFetches.get(slug);
    if (fetch && fetch.status === 'active') {
      fetch.status = 'paused';
      if (fetch.abortController) {
        fetch.abortController.abort();
      }
    }
  }

  /**
   * Resume a paused fetch for a watchlist
   */
  async resumeFetch(slug, items, updateCallback) {
    const fetch = this.activeFetches.get(slug);
    if (!fetch || fetch.status !== 'paused') return;

    // Resume from the current batch
    await this._executeFetch(slug, items, updateCallback, fetch.currentBatch);
  }

  /**
   * Start a new fetch or resume a paused one
   */
  async startFetch(slug, items, updateCallback, isManual = false, bypassMarketClosed = false, timeframe = 'D') {
    logger.info(`🚀 Starting fetch for ${slug} with ${items.length} items (manual: ${isManual}, timeframe: ${timeframe})`);
    
    // Check if market is closed for automatic fetches only
    if (!isManual && !bypassMarketClosed && !isMarketOpen()) {
      logger.log(`⏰ Market is closed. Skipping automatic fetch for ${slug} (manual fetches allowed anytime)`);
      return { success: false, message: 'Market is closed - automatic fetches paused' };
    }
    
    // Manual fetches are always allowed (add ticker, edit buy date, click header)
    if (isManual) {
      logger.log(`✅ Manual fetch allowed for ${slug} (bypassing market hours check)`);
    }

    // Cancel any existing fetch for this slug
    this.cancelFetch(slug);

    // Initialize fetch status
    this.activeFetches.set(slug, {
      status: 'active',
      currentBatch: 0,
      totalBatches: Math.ceil(items.length / 100),
      abortController: new AbortController(),
      timeframe: timeframe // Store timeframe for this fetch
    });

    try {
      const result = await this._executeFetch(slug, items, updateCallback, 0, timeframe);
      return result;
    } catch (error) {
      logger.error(`❌ Fetch failed for ${slug}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Execute the actual fetch process
   */
  async _executeFetch(slug, items, updateCallback, startBatchIndex = 0, timeframe = 'D') {
    const fetch = this.activeFetches.get(slug);
    if (!fetch) {
      throw new Error('No active fetch found');
    }

    const { abortController } = fetch;
    const batches = splitIntoBatches(items, 100);
    let updatedItems = [...items];

    try {
      for (let i = startBatchIndex; i < batches.length; i++) {
        // Check for cancellation
        if (abortController.signal.aborted) {
          throw new Error('Fetch cancelled');
        }

        // Update fetch status
        fetch.currentBatch = i;
        fetch.totalBatches = batches.length;

        logger.log(`📦 Processing batch ${i + 1}/${batches.length} for ${slug}`);

        // Process this batch
        const batchResult = await this._processBatch(batches[i], updatedItems, abortController, slug, timeframe);
        updatedItems = batchResult;

        // Call update callback with current progress
        if (updateCallback && typeof updateCallback === 'function') {
          const progress = {
            tickersFetched: (i + 1) * 100,
            totalTickers: items.length,
            batch: i + 1,
            totalBatches: batches.length
          };
          updateCallback(updatedItems, progress);
        }

        // Rate limiting: Wait 1 second between batches to respect API limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Mark fetch as complete
      fetch.status = 'completed';
      logger.info(`✅ Fetch completed for ${slug}`);

      return { success: true, message: null };
    } catch (error) {
      fetch.status = 'error';
      throw error;
    }
  }

  /**
   * Process a single batch of tickers
   */
  async _processBatch(batch, allItems, abortController, slug, timeframe) {
    logger.log(`🔄 Processing batch of ${batch.length} items`);
    
    // Initialize updatedItems with a copy of allItems
    const updatedItems = [...allItems];
    
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      
      if (abortController.signal.aborted) {
        logger.log('🛑 Batch processing aborted');
        break;
      }

      try {
        logger.log(`📊 Processing item ${i + 1}/${batch.length}: ${item.symbol}`);
        
        // Rate limiting: Check if we can make a request
        if (!canMakeRequest()) {
          logger.warn(`⚠️ Rate limit reached, waiting 60 seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, 60000)); // Wait full minute
        }
        
        // Add delay between requests to prevent rate limiting
        if (i > 0) {
          logger.log(`⏳ Waiting 3 seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        const finvizTimeframe = {
          'D': 'd', 'W': 'w', 'M': 'm', 'Y': 'y', 'YTD': 'ytd', 'MAX': 'max'
        }[timeframe] || 'd';
        
        // Increment request counter before making the request
        incrementGlobalRequestCounter();
        
        const newTicker = await fetchQuote(item.symbol, finvizTimeframe); // Pass timeframe
        
        // Check for rate limit errors
        if (!newTicker && globalRequestCount >= 50) {
          logger.warn(`⚠️ Rate limit approaching (${globalRequestCount}/55), stopping batch processing`);
          break; // Stop processing this batch
        }
        
        // Validate that we got a proper ticker object
        if (!newTicker || typeof newTicker !== 'object' || !newTicker.historicalData || newTicker.historicalData.length === 0) {
          logger.debug(`⚠️ Skipping ${item.symbol} due to invalid ticker object:`, newTicker);
          continue;
        }

        // Get ALL historical data from Finviz
        const newHistoricalData = newTicker.historicalData;
        
        if (!newHistoricalData || newHistoricalData.length === 0) {
          logger.warn(`⚠️ Skipping ${item.symbol} due to no historical data`);
          continue;
        }

        // Merge new historical data with existing data
        const existingHistoricalData = item.historicalData || [];
        const mergedHistoricalData = mergeHistoricalData(existingHistoricalData, newHistoricalData);
        
        logger.log(`📊 ${item.symbol}: Merged ${existingHistoricalData.length} existing + ${newHistoricalData.length} new = ${mergedHistoricalData.length} total data points`);
        logger.log(`📈 ${item.symbol}: Historical data timeline:`, mergedHistoricalData.map(p => 
          `${new Date(p.timestamp).toLocaleString()} - $${p.price}`
        ));

        // Filter out any data points before the buy date
        const buyDate = new Date(item.buyDate);
        const filteredHistoricalData = mergedHistoricalData.filter(point => {
          const pointDate = new Date(point.timestamp);
          return pointDate >= buyDate;
        });

        // Update the ticker with appended data
        const updatedTicker = {
          ...item,
          historicalData: filteredHistoricalData,
        };

        // Get the latest price from the updated historical data
        const latestDataPoint = filteredHistoricalData[filteredHistoricalData.length - 1];
        const currentPrice = latestDataPoint ? latestDataPoint.price : item.buyPrice;

        const normalized = {
          ...normalizeTicker(updatedTicker),
          buyPrice: item.buyPrice, // Keep original buy price
          buyDate: item.buyDate,   // Keep original buy date
          type: item.type,
  
          addedAt: item.addedAt,
          currentPrice: currentPrice, // Add current market price
        };

        // Update the item in the array
        const itemIndex = updatedItems.findIndex(i => i.symbol === item.symbol);
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = normalized;
        }

        // Rate limiting applied above
      } catch (err) {
        logger.error(`❌ Error refreshing ${item.symbol}:`, err);
      }
    }

    return updatedItems;
  }

  /**
   * Get current global request count status
   */
  getRequestStatus() {
    resetGlobalRequestCounter();
    return {
      current: globalRequestCount,
      limit: 'unlimited',
      remaining: 'unlimited',
      resetIn: 0
    };
  }

  /**
   * Get current request count status for a specific watchlist
   */
  getWatchlistRequestStatus(slug) {
    const counter = getWatchlistRequestCounter(slug);
    return {
      current: counter.count,
      resetTime: counter.resetTime
    };
  }

  /**
   * Clean up all active fetches (call on app unmount)
   */
  cleanup() {
    for (const [slug, fetch] of this.activeFetches) {
      if (fetch.abortController) {
        fetch.abortController.abort();
      }
    }
    this.activeFetches.clear();
  }
}

// Export a singleton instance (DISABLED - using twelvedataFetchManager instead)
// export const fetchManager = new FetchManager(); 