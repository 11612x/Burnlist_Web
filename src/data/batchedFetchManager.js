import { fetchHistoricalData } from './twelvedataAdapter';
import activeBurnlistManager from './activeBurnlistManager';
import historicalDataManager from './historicalDataManager';
import returnCalculator from './returnCalculator';
import notificationManager from './notificationManager';
import realTimeNavCalculator from './realTimeNavCalculator';
import navEventEmitter from './navEventEmitter';
import { logger } from '../utils/logger';

/**
 * Batched Fetch Manager for Twelve Data API
 * 
 * Specification:
 * - ~100 tickers to fetch using 55 credits per minute
 * - Each ticker costs 1 credit, up to 5 tickers per API call
 * - Split tickers into 20 batches of 5
 * - Space evenly across 3-minute loop (one batch every 9 seconds)
 * - Never exceed 11 batches (55 credits) in a single minute
 */
class BatchedFetchManager {
  constructor() {
    this.isRunning = false;
    this.cycleTimeouts = [];
    this.currentCycleStartTime = null;
    this.batchesInCurrentMinute = 0;
    this.lastMinuteTimestamp = 0;
    
    // Configuration - Twelve Data API Rate Limiting
    this.BATCH_SIZE = 5; // 5 tickers per batch (1 credit per ticker)
    this.BATCHES_PER_CYCLE = 20; // 20 batches = 100 tickers
    this.CYCLE_DURATION_MS = 3 * 60 * 1000; // 3 minutes
    this.BATCH_INTERVAL_MS = 9 * 1000; // 9 seconds (20 batches × 9s = 180s = 3min)
    this.MAX_BATCHES_PER_MINUTE = 11; // 11 batches × 5 tickers = 55 credits (max per minute)
    
    // State tracking
    this.stats = {
      totalCycles: 0,
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      lastError: null,
      lastCycleTime: null
    };
  }

  /**
   * Start the batched fetching system
   */
  async start() {
    console.log('🔧 DEBUG: batchedFetchManager.start() called');
    
    if (this.isRunning) {
      console.log('⚠️ Batched fetch manager already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting batched fetch manager (3-minute cycles, 9-second intervals)');
    
    // Start real-time NAV calculator
    realTimeNavCalculator.start();
    
    // Verify rate limiting compliance
    this.verifyRateLimitCompliance();
    
    // Start the first cycle immediately
    await this.startNewCycle();
  }

  /**
   * Stop the batched fetching system
   */
  stop() {
    this.isRunning = false;
    
    // Stop real-time NAV calculator
    realTimeNavCalculator.stop();
    
    // Clear all pending timeouts
    this.cycleTimeouts.forEach(timeout => clearTimeout(timeout));
    this.cycleTimeouts = [];
    
    console.log('🛑 Stopped batched fetch manager');
  }

  /**
   * Start a new 3-minute fetch cycle
   */
  async startNewCycle() {
    console.log('🔧 DEBUG: startNewCycle called');
    console.log('🔧 DEBUG: isRunning:', this.isRunning);
    
    if (!this.isRunning) {
      console.log('🔧 DEBUG: Not running, returning');
      return;
    }

    // Check if market is open for automatic fetches (extended NYC hours: Mon-Fri, 4:00 AM - 8:00 PM ET)
    const marketOpen = this.isMarketOpen();
    console.log('🔧 DEBUG: Market open check:', marketOpen);
    
    if (!marketOpen) {
      console.log(`⏰ Market is closed (extended NYC hours: Mon-Fri, 4:00 AM - 8:00 PM ET). Skipping automatic fetch cycle.`);
      console.log(`⏰ Manual fetches (add ticker, edit buy date, click header) are still allowed anytime.`);
      this.scheduleNextCycle();
      return;
    }

    this.currentCycleStartTime = Date.now();
    this.stats.totalCycles++;
    this.stats.lastCycleTime = new Date().toISOString();
    
    console.log(`🔄 Starting fetch cycle #${this.stats.totalCycles} (extended NYC market hours)`);

    // Get all unique tickers from active watchlists
    const allTickers = activeBurnlistManager.getAllUniqueTickers();
    console.log('🔧 DEBUG: All tickers found:', allTickers);
    
    if (allTickers.length === 0) {
      console.log('📭 No active tickers to fetch, scheduling next cycle');
      this.scheduleNextCycle();
      return;
    }

    console.log(`📊 Processing ${allTickers.length} tickers in ${this.BATCHES_PER_CYCLE} batches`);

    // Split tickers into batches of 5
    const batches = this.createBatches(allTickers, this.BATCH_SIZE);
    
    // Truncate to maximum 20 batches per cycle
    const limitedBatches = batches.slice(0, this.BATCHES_PER_CYCLE);
    
    if (batches.length > this.BATCHES_PER_CYCLE) {
      console.log(`⚠️ Limited to ${this.BATCHES_PER_CYCLE} batches, ${batches.length - this.BATCHES_PER_CYCLE} batches will be processed in next cycle`);
    }

    // Schedule each batch with strict 9-second intervals
    limitedBatches.forEach((batch, index) => {
      const delay = index * this.BATCH_INTERVAL_MS;
      
      console.log(`⏰ Scheduling batch ${index + 1}/${limitedBatches.length} in ${delay/1000}s`);
      
      const timeout = setTimeout(async () => {
        await this.processBatch(batch, index + 1, limitedBatches.length);
      }, delay);
      
      this.cycleTimeouts.push(timeout);
    });

    // After processing all batches, compute watchlist averages and schedule next cycle
    const allBatchesDelay = limitedBatches.length * this.BATCH_INTERVAL_MS + 1000; // +1s buffer
    const finalTimeout = setTimeout(async () => {
      await this.completeCycle();
      this.scheduleNextCycle();
    }, allBatchesDelay);
    
    this.cycleTimeouts.push(finalTimeout);
  }

  /**
   * Create batches of tickers
   */
  createBatches(tickers, batchSize) {
    const batches = [];
    for (let i = 0; i < tickers.length; i += batchSize) {
      batches.push(tickers.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a single batch of tickers
   */
  async processBatch(batch, batchNumber, totalBatches) {
    if (!this.isRunning) return;

    // Check rate limit per minute
    const currentMinute = Math.floor(Date.now() / 60000);
    if (currentMinute !== this.lastMinuteTimestamp) {
      this.lastMinuteTimestamp = currentMinute;
      this.batchesInCurrentMinute = 0;
    }

    if (this.batchesInCurrentMinute >= this.MAX_BATCHES_PER_MINUTE) {
      console.warn(`⚠️ Rate limit reached: ${this.batchesInCurrentMinute} batches in current minute, skipping batch ${batchNumber}`);
      this.stats.failedBatches++;
      return;
    }

    this.batchesInCurrentMinute++;
    this.stats.totalBatches++;

    logger.fetch(`Batch fetch ${batchNumber}/${totalBatches}`, `[${batch.join(', ')}] (${this.batchesInCurrentMinute}/${this.MAX_BATCHES_PER_MINUTE} this minute, ${batch.length} credits)`);

    try {
      // Fetch historical data for each ticker in the batch
      const results = [];
      for (const symbol of batch) {
        try {
          // Get historical data for the last 6 hours to create chart data points
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - (6 * 60 * 60 * 1000)); // 6 hours ago
          
          const historicalData = await fetchHistoricalData(
            symbol, 
            startDate.toISOString().split('T')[0], 
            endDate.toISOString().split('T')[0], 
            '5min', 
            72 // Get 72 data points (6 hours * 12 per hour)
          );
          
          if (historicalData) {
            results.push(historicalData);
          }
        } catch (error) {
          console.error(`❌ Failed to fetch historical data for ${symbol}:`, error);
        }
      }
      
      if (results && results.length > 0) {
        console.log(`✅ Batch ${batchNumber} successful: ${results.length} historical datasets received`);
        this.stats.successfulBatches++;
        
        // Update prices in active burnlists
        this.updateBurnlistPrices(results);
      } else {
        console.warn(`❌ Batch ${batchNumber} failed: no data received`);
        this.stats.failedBatches++;
      }
    } catch (error) {
      console.error(`❌ Batch ${batchNumber} error:`, error);
      this.stats.failedBatches++;
      this.stats.lastError = error.message;
    }
  }

  /**
   * Update prices in active burnlists with new data
   */
  updateBurnlistPrices(newPrices) {
    const activeBurnlists = activeBurnlistManager.getActiveBurnlists();
    
    activeBurnlists.forEach(burnlistSlug => {
      // Update the burnlist with new prices
      const updatedItems = this.updateWatchlistItems(burnlistSlug, newPrices);
      
      if (updatedItems.length > 0) {
        console.log(`📊 Updated ${updatedItems.length} items in watchlist ${burnlistSlug}`);
        
        // Queue real-time NAV calculation for this burnlist
        const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
        const watchlistKey = Object.keys(watchlists).find(key => watchlists[key].slug === burnlistSlug);
        
        if (watchlistKey && watchlists[watchlistKey].items) {
          const items = watchlists[watchlistKey].items;
          realTimeNavCalculator.queueAlignedCalculation(burnlistSlug, items, 'MAX');
        }
      }
    });
  }

  /**
   * Update individual watchlist items with new price data
   */
  updateWatchlistItems(burnlistSlug, newPrices) {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      const watchlistKey = Object.keys(watchlists).find(key => watchlists[key].slug === burnlistSlug);
      
      if (!watchlistKey || !watchlists[watchlistKey].items) {
        return [];
      }

      const watchlist = watchlists[watchlistKey];
      const updatedItems = [];

      // Update items with new historical data
      watchlist.items.forEach(item => {
        const newHistoricalData = newPrices.find(price => price.symbol === item.symbol);
        
        if (newHistoricalData) {
          console.log('🔧 DEBUG: Processing', item.symbol);
          console.log('🔧 DEBUG: Original buy price:', item.buyPrice);
          console.log('🔧 DEBUG: Original buy date:', item.buyDate);
          console.log('🔧 DEBUG: New historical data:', newHistoricalData);
          
          // PRESERVE the original buy price - don't overwrite it!
          const originalBuyPrice = item.buyPrice;
          const originalBuyDate = item.buyDate;
          
          // Update current price with the latest historical price
          const latestPrice = newHistoricalData.historicalData[newHistoricalData.historicalData.length - 1]?.price;
          
          if (latestPrice) {
            logger.log(`💰 Setting current price for ${item.symbol}: $${latestPrice} (from historical data)`);
            item.currentPrice = latestPrice;
          }
          
          // Merge new historical data with existing data
          if (!item.historicalData) {
            item.historicalData = [];
          }
          
          // Add new historical data points
          newHistoricalData.historicalData.forEach(newPoint => {
            // Check if we already have this timestamp to avoid duplicates
            const existingPoint = item.historicalData.find(existing => 
              existing.timestamp === newPoint.timestamp
            );
            
            if (!existingPoint) {
              item.historicalData.push({
                price: newPoint.price,
                timestamp: newPoint.timestamp,
                fetchTimestamp: new Date().toISOString(),
                symbol: item.symbol
              });
            }
          });
          
          // Sort by timestamp to ensure chronological order
          item.historicalData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          // Keep only the last 100 data points to prevent memory issues
          if (item.historicalData.length > 100) {
            item.historicalData = item.historicalData.slice(-100);
          }
          
          // RESTORE the original buy price and date
          item.buyPrice = originalBuyPrice;
          item.buyDate = originalBuyDate;
          
          console.log('🔧 DEBUG: Final buy price after restore:', item.buyPrice);
          console.log('🔧 DEBUG: Final current price:', item.currentPrice);
          
          updatedItems.push(item);
        }
      });

      // Save updated watchlist
      if (updatedItems.length > 0) {
        localStorage.setItem('burnlist_watchlists', JSON.stringify(watchlists));
        
        // Trigger a storage event to notify React components of the update
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'burnlist_watchlists',
          newValue: JSON.stringify(watchlists),
          storageArea: localStorage
        }));
        
        console.log(`💾 Updated localStorage and triggered storage event for ${burnlistSlug}`);
      }

      return updatedItems;
    } catch (error) {
      console.error(`❌ Error updating watchlist items for ${burnlistSlug}:`, error);
      return [];
    }
  }

  /**
   * Complete the current cycle by computing watchlist averages
   */
  async completeCycle() {
    if (!this.isRunning) return;

    console.log(`🏁 Completing fetch cycle #${this.stats.totalCycles}`);

    // Get all active burnlists and compute their average returns
    const activeBurnlists = activeBurnlistManager.getActiveBurnlists();
    
    for (const burnlistSlug of activeBurnlists) {
      await this.computeAndSaveWatchlistAverage(burnlistSlug);
    }

    const cycleTime = Date.now() - this.currentCycleStartTime;
    console.log(`✨ Cycle #${this.stats.totalCycles} completed in ${(cycleTime / 1000).toFixed(1)}s`);
  }

  /**
   * Compute and save watchlist average return using NEW NAV calculator
   */
  async computeAndSaveWatchlistAverage(burnlistSlug) {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      const watchlistKey = Object.keys(watchlists).find(key => watchlists[key].slug === burnlistSlug);
      
      if (!watchlistKey || !watchlists[watchlistKey].items) {
        return;
      }

      const watchlist = watchlists[watchlistKey];
      const items = watchlist.items;

      // NEW NAV CALCULATION: Use NAV calculator for timeframe-based returns
      try {
        // Simple NAV calculation: calculate average of individual ticker returns
        let totalReturn = 0;
        let validTickers = 0;
        
        items.forEach(item => {
          try {
            // Get the buy price from the last element of historical data (oldest price = start date)
            const buyPrice = item.historicalData && item.historicalData.length > 0 ? 
              item.historicalData[item.historicalData.length - 1].price : 0;
            // Get current price from the first element of historical data (most recent price)
            const currentPrice = item.currentPrice || (item.historicalData && item.historicalData.length > 0 ? 
              item.historicalData[0].price : 0); // First element = newest price
            
            if (buyPrice > 0 && currentPrice > 0) {
              const tickerReturn = ((currentPrice - buyPrice) / buyPrice) * 100;
              totalReturn += tickerReturn;
              validTickers++;
            }
          } catch (error) {
            logger.error(`Error calculating return for ${item.symbol}:`, error);
          }
        });
        
        const average = validTickers > 0 ? totalReturn / validTickers : 0;
        
        // Create simple NAV data structure
        const navData = [{
          timestamp: new Date().toISOString(),
          returnPercent: average,
          valid: true,
          source: 'batched',
          validTickers: validTickers,
          totalTickers: items.length
        }];
        
        if (navData && navData.length > 0) {
          // Get the latest NAV value
          const latestNav = navData[navData.length - 1];
          const averageReturn = latestNav.returnPercent;
          
          // Save as timestamped datapoint for the chart
          const datapoint = {
            timestamp: new Date().toISOString(),
            averageReturn: parseFloat(averageReturn.toFixed(5)), // Store with 5 decimal places internally
            tickerCount: items.length,
            timeframe: 'MAX'
          };

          const saved = historicalDataManager.saveWatchlistDatapoint(burnlistSlug, datapoint);
          
          if (saved) {
            console.log(`💾 Saved NEW NAV datapoint for ${burnlistSlug}: ${averageReturn.toFixed(2)}% (${items.length} tickers)`);
          }

          // Emit real-time NAV update event
          navEventEmitter.emit(burnlistSlug, navData, 'batch');
          console.log(`📡 Emitted real-time NAV update for ${burnlistSlug}`);
        } else {
          console.log(`⚠️ No NAV data generated for ${burnlistSlug}`);
        }
      } catch (error) {
        console.error(`❌ Error in NEW NAV calculation for ${burnlistSlug}:`, error);
        
        // Fallback to old calculation method
        const averageReturn = this.calculateTimeframeBasedReturn(items, 'MAX');
        
        if (averageReturn !== null) {
          const datapoint = {
            timestamp: new Date().toISOString(),
            averageReturn: parseFloat(averageReturn.toFixed(5)),
            tickerCount: items.length,
            timeframe: 'MAX'
          };

          const saved = historicalDataManager.saveWatchlistDatapoint(burnlistSlug, datapoint);
          
          if (saved) {
            console.log(`💾 Saved FALLBACK datapoint for ${burnlistSlug}: ${averageReturn.toFixed(2)}% (${items.length} tickers)`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error computing watchlist average for ${burnlistSlug}:`, error);
    }
  }

  /**
   * Calculate timeframe-based average return for a watchlist
   * Uses new specification: Daily=24h ago, Weekly=7d ago, Monthly=30d ago, YTD=Jan 1, Max=buy date
   */
  calculateTimeframeBasedReturn(items, timeframe = 'MAX') {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    let totalReturn = 0;
    let validItems = 0;
    const now = new Date();

    items.forEach(item => {
      if (!item.currentPrice || !item.buyPrice || item.buyPrice <= 0) {
        return; // Skip invalid items
      }

      let startPrice = item.buyPrice;
      let useTimeframeLogic = false;

      // Determine start price based on timeframe
      if (timeframe !== 'MAX' && item.historicalData && item.historicalData.length > 0) {
        const timeframeStartTime = this.getTimeframeStartTime(timeframe, now);
        
        if (timeframeStartTime) {
          // Find price closest to timeframe start (but only if ticker was added before timeframe start)
          const buyDate = new Date(item.buyDate);
          
          if (buyDate <= timeframeStartTime) {
            // Ticker existed at timeframe start, use timeframe logic
            const closestPoint = this.findClosestHistoricalPrice(item.historicalData, timeframeStartTime);
            if (closestPoint) {
              startPrice = closestPoint.price;
              useTimeframeLogic = true;
            }
          } else {
            // Ticker was added after timeframe start, use longest available slice
            const oldestPoint = item.historicalData[0];
            if (oldestPoint && oldestPoint.price > 0) {
              startPrice = oldestPoint.price;
              useTimeframeLogic = true;
            }
          }
        }
      }

      // Calculate return percentage
      const returnPercent = ((item.currentPrice - startPrice) / startPrice) * 100;
      
      if (Number.isFinite(returnPercent)) {
        totalReturn += returnPercent;
        validItems++;
      }
    });

    if (validItems === 0) {
      return null;
    }

    return totalReturn / validItems;
  }

  /**
   * Get the start time for a given timeframe
   */
  getTimeframeStartTime(timeframe, now = new Date()) {
    switch (timeframe) {
      case 'D':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'W':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'M':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'YTD':
        return new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
      case 'MAX':
      default:
        return null; // Use buy date
    }
  }

  /**
   * Find historical price closest to target time
   */
  findClosestHistoricalPrice(historicalData, targetTime) {
    if (!historicalData || historicalData.length === 0) {
      return null;
    }

    const targetTimestamp = targetTime.getTime();
    
    let closestPoint = null;
    let smallestDiff = Infinity;

    historicalData.forEach(point => {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTimestamp);
      
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestPoint = point;
      }
    });

    return closestPoint;
  }

  /**
   * Schedule the next cycle
   */
  scheduleNextCycle() {
    if (!this.isRunning) return;

    const nextCycleDelay = this.CYCLE_DURATION_MS;
    
    console.log(`⏰ Next fetch cycle in ${(nextCycleDelay / 1000).toFixed(1)}s`);
    
    const timeout = setTimeout(() => {
      this.startNewCycle();
    }, nextCycleDelay);
    
    this.cycleTimeouts.push(timeout);
  }

  /**
   * Check if extended NYC market hours are active (Mon-Fri, 4:00 AM - 8:00 PM ET)
   */
  isMarketOpen() {
    const now = new Date();
    // Get NY time (works regardless of user's timezone)
    const nyTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const day = nyTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = nyTime.getHours();
    
    // Extended trading hours: Mon-Fri, 4:00 AM - 8:00 PM ET
    // Includes pre-market (4am-9:30am), regular (9:30am-4pm), after-hours (4pm-8pm)
    if (day === 0 || day === 6) return false; // No weekend trading
    if (hours < 4) return false;  // Before 4:00 AM ET
    if (hours >= 20) return false; // After 8:00 PM ET (>= 20:00)
    return true;
  }

  /**
   * Verify rate limiting compliance
   */
  verifyRateLimitCompliance() {
    const status = this.getStatus();
    const { configuration, currentCycle } = status;
    
    // Calculate expected values
    const expectedBatchesPerCycle = Math.ceil(100 / configuration.batchSize); // ~100 tickers
    const expectedCycleDuration = expectedBatchesPerCycle * configuration.batchIntervalMs;
    const maxCreditsPerMinute = configuration.maxBatchesPerMinute * configuration.batchSize;
    
    const compliance = {
      batchSize: configuration.batchSize === 5,
      batchesPerCycle: configuration.batchesPerCycle === 20,
      cycleDuration: Math.abs(configuration.cycleDurationMs - 180000) < 1000, // 3 minutes ±1s
      batchInterval: configuration.batchIntervalMs === 9000, // 9 seconds
      maxBatchesPerMinute: configuration.maxBatchesPerMinute === 11,
      maxCreditsPerMinute: maxCreditsPerMinute === 55,
      marketHoursCheck: this.isMarketOpen !== undefined
    };
    
    const allCompliant = Object.values(compliance).every(Boolean);
    
    console.log(`🔍 Rate Limit Compliance Check:`);
    console.log(`  ✅ Batch size (5 tickers): ${compliance.batchSize}`);
    console.log(`  ✅ Batches per cycle (20): ${compliance.batchesPerCycle}`);
    console.log(`  ✅ Cycle duration (3min): ${compliance.cycleDuration}`);
    console.log(`  ✅ Batch interval (9s): ${compliance.batchInterval}`);
    console.log(`  ✅ Max batches/min (11): ${compliance.maxBatchesPerMinute}`);
    console.log(`  ✅ Max credits/min (55): ${compliance.maxCreditsPerMinute}`);
    console.log(`  ✅ Market hours check: ${compliance.marketHoursCheck}`);
    console.log(`  ${allCompliant ? '✅' : '❌'} Overall compliance: ${allCompliant ? 'PASS' : 'FAIL'}`);
    
    return { compliance, allCompliant };
  }

  /**
   * Get current status and statistics
   */
  getStatus() {
    const uptime = this.currentCycleStartTime ? Date.now() - this.currentCycleStartTime : 0;
    
    return {
      isRunning: this.isRunning,
      stats: { ...this.stats },
      currentCycle: {
        startTime: this.currentCycleStartTime,
        uptime: uptime,
        batchesInCurrentMinute: this.batchesInCurrentMinute
      },
      configuration: {
        batchSize: this.BATCH_SIZE,
        batchesPerCycle: this.BATCHES_PER_CYCLE,
        cycleDurationMs: this.CYCLE_DURATION_MS,
        batchIntervalMs: this.BATCH_INTERVAL_MS,
        maxBatchesPerMinute: this.MAX_BATCHES_PER_MINUTE
      },
      marketHours: {
        isOpen: this.isMarketOpen(),
        currentNYTime: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
      },
      realTimeNav: realTimeNavCalculator.getStatus()
    };
  }
}

// Export singleton instance
const batchedFetchManager = new BatchedFetchManager();
export default batchedFetchManager;