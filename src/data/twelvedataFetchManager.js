import { fetchQuote, fetchBatchQuotes, fetchHistoricalData } from '@data/twelvedataAdapter';
import batchedFetchManager from '@data/batchedFetchManager';
import activeBurnlistManager from '@data/activeBurnlistManager';
import rateLimiter from '@data/rateLimiter';
import notificationManager from '@data/notificationManager';
import normalizeTicker from '@data/normalizeTicker';
import { logger } from '../utils/logger';

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

// Check if we can make a request (rate limit)
function canMakeRequest() {
  return rateLimiter.canMakeAutomaticRequest();
}

// Increment global request counter (for logging only)
function incrementGlobalRequestCounter() {
  resetGlobalRequestCounter();
  globalRequestCount++;
  logger.log(`📊 Global API Request #${globalRequestCount} (Twelve Data)`);
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

// Split tickers into batches of 5 for Twelve Data API
function splitIntoBatches(tickers, batchSize = 5) {
  const batches = [];
  for (let i = 0; i < tickers.length; i += batchSize) {
    batches.push(tickers.slice(i, i + batchSize));
  }
  return batches;
}

export class TwelveDataFetchManager {
  constructor() {
    this.isInitialized = false;
  }

  // Initialize the fetch manager
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // ENABLED: Automatic batched fetching every 3 minutes during market hours
      await batchedFetchManager.start();
      this.isInitialized = true;
      logger.log('✅ Twelve Data Fetch Manager initialized (automatic fetching enabled)');
    } catch (error) {
      logger.error('❌ Error initializing Twelve Data Fetch Manager:', error);
      notificationManager.handleSystemError(error, 'fetch-manager-init');
    }
  }

  // Check if fetch is active for a watchlist
  isFetchActive(slug) {
    const fetchStatus = activeFetches.get(slug);
    return fetchStatus && fetchStatus.status === 'active';
  }

  // Get fetch status for a watchlist
  getFetchStatus(slug) {
    const fetchStatus = activeFetches.get(slug);
    if (!fetchStatus) {
      return { status: 'idle', progress: 0, message: 'No active fetch' };
    }

    const { status, currentBatch, totalBatches, message } = fetchStatus;
    const progress = totalBatches > 0 ? (currentBatch / totalBatches) * 100 : 0;

    return {
      status,
      progress: Math.round(progress),
      currentBatch,
      totalBatches,
      message
    };
  }

  // Cancel active fetch for a watchlist
  cancelFetch(slug) {
    const fetchStatus = activeFetches.get(slug);
    if (fetchStatus && fetchStatus.abortController) {
      fetchStatus.abortController.abort();
      activeFetches.delete(slug);
      logger.log(`❌ Cancelled fetch for ${slug}`);
      return true;
    }
    return false;
  }

  // Pause fetch for a watchlist
  pauseFetch(slug) {
    const fetchStatus = activeFetches.get(slug);
    if (fetchStatus && fetchStatus.status === 'active') {
      fetchStatus.status = 'paused';
      logger.log(`⏸️ Paused fetch for ${slug}`);
      return true;
    }
    return false;
  }

  // Resume fetch for a watchlist
  async resumeFetch(slug, items, updateCallback) {
    const fetchStatus = activeFetches.get(slug);
    if (fetchStatus && fetchStatus.status === 'paused') {
      fetchStatus.status = 'active';
      logger.log(`▶️ Resumed fetch for ${slug}`);
      await this._executeFetch(slug, items, updateCallback, fetchStatus.currentBatch);
      return true;
    }
    return false;
  }

  // Start fetch for a watchlist
  async startFetch(slug, items, updateCallback, isManual = false, bypassMarketClosed = false, timeframe = '1min') {
    // Initialize if not already done
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Register burnlist as active if not manual
    if (!isManual) {
      const tickers = items.map(item => item.symbol);
      activeBurnlistManager.registerActiveBurnlist(slug, tickers);
    }

    // Check market hours unless bypassed
    if (!bypassMarketClosed && !isMarketOpen()) {
      const message = 'Market is closed. Click again to force refresh.';
      logger.log(`⚠️ ${message}`);
      return { success: false, message };
    }

    // Handle manual updates for inactive burnlists
    if (isManual && !activeBurnlistManager.isActiveBurnlist(slug)) {
      return await this._handleManualUpdate(slug, items, updateCallback);
    }

    // Start automatic fetch
    return await this._executeFetch(slug, items, updateCallback, 0, timeframe);
  }

  // Handle manual update for inactive burnlist
  async _handleManualUpdate(slug, items, updateCallback) {
    try {
      logger.log(`📋 Processing manual update for ${slug}`);
      
      // Request manual update
      const queued = activeBurnlistManager.requestManualUpdate(slug);
      if (!queued) {
        return { success: false, message: 'Manual update already queued' };
      }

      // Manual updates are now handled by the batched system - just acknowledge the request
      logger.log(`Manual update requested for ${slug} - will be processed in next batch cycle`);
      
      // Since we're using batched system, we can't provide immediate results
      // But we can indicate the request was accepted
      return { 
        success: true, 
        message: `Manual update queued for ${slug}. Data will be refreshed in next batch cycle.`,
        batchedSystem: true 
      };
    } catch (error) {
      logger.error(`❌ Manual update error for ${slug}:`, error);
      notificationManager.handleSystemError(error, 'manual-update');
      return { success: false, message: error.message };
    }
  }

  // Execute fetch for a watchlist
  async _executeFetch(slug, items, updateCallback, startBatchIndex = 0, timeframe = '1min') {
    const abortController = new AbortController();
    
    // Set up fetch status
    const tickers = items.map(item => item.symbol);
    const batches = splitIntoBatches(tickers, 5);
    const totalBatches = batches.length;
    
    activeFetches.set(slug, {
      status: 'active',
      currentBatch: startBatchIndex,
      totalBatches,
      abortController,
      message: `Processing ${tickers.length} tickers in ${totalBatches} batches`
    });

    logger.log(`🔄 Starting fetch for ${slug}: ${tickers.length} tickers in ${totalBatches} batches`);

    try {
      let processedItems = 0;
      const updatedItems = [...items];

      for (let i = startBatchIndex; i < batches.length; i++) {
        // Check if fetch was cancelled
        if (abortController.signal.aborted) {
          logger.log(`❌ Fetch cancelled for ${slug}`);
          break;
        }

        // Check if fetch was paused
        const fetchStatus = activeFetches.get(slug);
        if (fetchStatus && fetchStatus.status === 'paused') {
          logger.log(`⏸️ Fetch paused for ${slug}`);
          break;
        }

        // Check rate limit
        if (!canMakeRequest()) {
          logger.log(`⏳ Rate limit reached, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          continue;
        }

        const batch = batches[i];
        logger.log(`📦 Processing batch ${i + 1}/${totalBatches} for ${slug}: ${batch.join(', ')}`);

        try {
          // Fetch historical data for each ticker in the batch
          const batchResults = [];
          for (const symbol of batch) {
            try {
              // Get historical data for the last 24 hours to create chart data points
              const endDate = new Date();
              const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
              
              const historicalData = await fetchHistoricalData(
                symbol, 
                startDate.toISOString().split('T')[0], 
                endDate.toISOString().split('T')[0], 
                '1h', 
                24 // Get 24 data points
              );
              
              if (historicalData) {
                batchResults.push(historicalData);
              }
            } catch (error) {
              console.error(`❌ Failed to fetch historical data for ${symbol}:`, error);
            }
          }
          
          incrementGlobalRequestCounter();
          incrementWatchlistRequestCounter(slug);
          rateLimiter.recordAutomaticRequest();

          // Update items with new historical data
          batchResults.forEach(result => {
            const itemIndex = updatedItems.findIndex(item => item.symbol === result.symbol);
            if (itemIndex !== -1) {
              const originalItem = updatedItems[itemIndex];
              
              // PRESERVE the original buy price - don't overwrite it!
              const originalBuyPrice = originalItem.buyPrice;
              const originalBuyDate = originalItem.buyDate;
              
              // Update current price with the latest historical price
              const latestPrice = result.historicalData[result.historicalData.length - 1]?.price;
              if (latestPrice) {
                logger.log(`💰 Setting current price for ${result.symbol}: $${latestPrice} (from historical data)`);
                originalItem.currentPrice = latestPrice;
              }
              
              // Merge new historical data with existing data
              if (!originalItem.historicalData) {
                originalItem.historicalData = [];
              }
              
              // Add new historical data points
              result.historicalData.forEach(newPoint => {
                // Check if we already have this timestamp to avoid duplicates
                const existingPoint = originalItem.historicalData.find(existing => 
                  existing.timestamp === newPoint.timestamp
                );
                
                if (!existingPoint) {
                  originalItem.historicalData.push({
                    price: newPoint.price,
                    timestamp: newPoint.timestamp,
                    fetchTimestamp: new Date().toISOString(),
                    symbol: originalItem.symbol
                  });
                }
              });
              
              // Sort by timestamp to ensure chronological order
              originalItem.historicalData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              
              // Keep only the last 100 data points to prevent memory issues
              if (originalItem.historicalData.length > 100) {
                originalItem.historicalData = originalItem.historicalData.slice(-100);
              }
              
              // RESTORE the original buy price and date
              originalItem.buyPrice = originalBuyPrice;
              originalItem.buyDate = originalBuyDate;
              
              updatedItems[itemIndex] = normalizeTicker(originalItem);
              processedItems++;
            }
          });

          // Update progress
          const progress = Math.round(((i + 1) / totalBatches) * 100);
          activeFetches.set(slug, {
            ...activeFetches.get(slug),
            currentBatch: i + 1,
            message: `Processed ${i + 1}/${totalBatches} batches`
          });

          // Call update callback
          if (updateCallback) {
            updateCallback(updatedItems, progress);
          }

        } catch (error) {
          logger.error(`❌ Batch error for ${slug}:`, error);
          notificationManager.handleSystemError(error, 'batch-processing');
          
          // Continue with next batch
          continue;
        }
      }

      // Mark fetch as completed
      activeFetches.set(slug, {
        status: 'completed',
        currentBatch: totalBatches,
        totalBatches,
        message: `Completed: ${processedItems} tickers updated`
      });

      logger.log(`✅ Fetch completed for ${slug}: ${processedItems} tickers updated`);
      return { success: true, message: `Updated ${processedItems} tickers` };

    } catch (error) {
      logger.error(`❌ Fetch error for ${slug}:`, error);
      notificationManager.handleSystemError(error, 'fetch-execution');
      
      activeFetches.set(slug, {
        status: 'error',
        currentBatch: 0,
        totalBatches,
        message: `Error: ${error.message}`
      });

      return { success: false, message: error.message };
    } finally {
      // Clean up abort controller
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
    }
  }

  // Process batch of tickers
  async _processBatch(batch, allItems, abortController, slug, timeframe) {
    if (abortController.signal.aborted) {
      return [];
    }

    try {
      const batchResults = await fetchBatchQuotes(batch, timeframe);
      return batchResults;
    } catch (error) {
      logger.error(`❌ Batch processing error:`, error);
      return [];
    }
  }

  // Get request status
  getRequestStatus() {
    return {
      globalRequestCount,
      lastResetTime,
      canMakeRequest: canMakeRequest(),
      rateLimitStatus: rateLimiter.getRateLimitStatus(),
      syncStatus: batchedFetchManager.getStatus()
    };
  }

  // Get watchlist request status
  getWatchlistRequestStatus(slug) {
    const counter = getWatchlistRequestCounter(slug);
    return {
      count: counter.count,
      resetTime: counter.resetTime,
      isActive: this.isFetchActive(slug),
      status: this.getFetchStatus(slug)
    };
  }

  // Cleanup
  cleanup() {
    // Cancel all active fetches
    activeFetches.forEach((fetchStatus, slug) => {
      if (fetchStatus.abortController) {
        fetchStatus.abortController.abort();
      }
    });
    activeFetches.clear();

    // Stop sync manager
    batchedFetchManager.stop();

    logger.log('🧹 Twelve Data Fetch Manager cleaned up');
  }

  // Get system statistics
  getSystemStats() {
    return {
      fetchManager: {
        activeFetches: activeFetches.size,
        globalRequestCount,
        lastResetTime
      },
      batchedFetchManager: batchedFetchManager.getStatus(),
      rateLimiter: rateLimiter.getRateLimitStatus(),
      activeBurnlists: activeBurnlistManager.getSystemStatus()
    };
  }
}

// Create singleton instance
const twelvedataFetchManager = new TwelveDataFetchManager();

// Export both default and named export for compatibility
export default twelvedataFetchManager;
export { twelvedataFetchManager as fetchManager }; 