import { fetchBatchQuotes } from './twelvedataAdapter';
import rateLimiter from './rateLimiter';
import activeBurnlistManager from './activeBurnlistManager';
import historicalDataManager from './historicalDataManager';
import returnCalculator from './returnCalculator';
import notificationManager from './notificationManager';
import navCalculator from './navCalculator';
import { logger } from '../utils/logger';

class TwelveDataSyncManager {
  constructor() {
    this.isRunning = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastError: null
    };
  }

  // Start the sync system
  async start() {
    if (this.isRunning) {
      logger.log('⚠️ Sync manager already running');
      return;
    }

    this.isRunning = true;
    logger.log('🚀 Starting Twelve Data sync manager');

    // Set up notification callbacks
    returnCalculator.setNotificationCallback((type, data) => {
      if (type === 'return-changes') {
        notificationManager.handleReturnChanges(data);
      }
    });

    // Start automatic sync
    await this.startAutomaticSync();
  }

  // Stop the sync system
  stop() {
    this.isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    logger.log('🛑 Stopped Twelve Data sync manager');
  }

  // Start automatic sync with dynamic intervals
  async startAutomaticSync() {
    if (!this.isRunning) return;

    try {
      await this.processAutomaticSync();
      
      // Calculate next sync interval
      const totalTickers = activeBurnlistManager.getAllUniqueTickers().length;
      const interval = rateLimiter.calculateRefreshInterval(totalTickers);
      
      logger.log(`⏰ Next sync in ${interval/1000}s (${totalTickers} tickers)`);
      
      // Schedule next sync
      this.syncInterval = setTimeout(() => {
        this.startAutomaticSync();
      }, interval);
      
    } catch (error) {
      logger.error('❌ Error in automatic sync:', error);
      notificationManager.handleSystemError(error, 'automatic-sync');
      
      // Retry after 30 seconds on error
      setTimeout(() => {
        this.startAutomaticSync();
      }, 30000);
    }
  }

  // Process automatic sync for active burnlists
  async processAutomaticSync() {
    const activeBurnlists = activeBurnlistManager.getActiveBurnlists();
    const allTickers = activeBurnlistManager.getAllUniqueTickers();
    
    if (allTickers.length === 0) {
      logger.log('📭 No active tickers to sync');
      return;
    }

    logger.log(`🔄 Starting automatic sync for ${allTickers.length} tickers across ${activeBurnlists.length} burnlists`);

    // Create batches of 5 symbols
    const batches = this.createBatches(allTickers, 5);
    const prioritizedBatches = this.prioritizeBatches(batches, activeBurnlists);
    
    let processedBatches = 0;
    let processedTickers = 0;
    
    // Collect all price updates before creating chart datapoints
    const allPriceUpdates = [];
    const processedSymbols = new Set();

    for (const batch of prioritizedBatches) {
      if (!this.isRunning) break;

      // Check rate limit
      if (!rateLimiter.canMakeAutomaticRequest()) {
        logger.log('⏳ Rate limit reached, waiting...');
        await rateLimiter.waitForRateLimit('automatic');
      }

      try {
        const prices = await fetchBatchQuotes(batch.symbols);
        rateLimiter.recordAutomaticRequest();
        
        if (prices.length > 0) {
          // Collect all price updates but don't update returns yet
          prices.forEach(priceData => {
            // Save to historical data immediately
            historicalDataManager.updateTickerHistoricalData(priceData.symbol, priceData);
            
            // Track processed symbols
            processedSymbols.add(priceData.symbol);
            allPriceUpdates.push(priceData);
          });
          
          processedTickers += prices.length;
        }
        
        processedBatches++;
        
      } catch (error) {
        logger.error('❌ Batch processing error:', error);
        notificationManager.handleSystemError(error, 'batch-processing');
      }
    }

    // Only create chart datapoints after ALL tickers have been fetched
    if (allPriceUpdates.length > 0) {
      logger.log(`📊 Creating chart datapoints for ${allPriceUpdates.length} tickers after complete sync`);
      
      // Group price updates by burnlist and update returns
      const burnlistUpdates = {};
      
      allPriceUpdates.forEach(priceData => {
        const affectedBurnlists = activeBurnlistManager.getBurnlistsForTicker(priceData.symbol);
        affectedBurnlists.forEach(slug => {
          if (!burnlistUpdates[slug]) {
            burnlistUpdates[slug] = [];
          }
          burnlistUpdates[slug].push(priceData);
        });
      });
      
      // Update returns for each burnlist with complete data
      Object.entries(burnlistUpdates).forEach(([slug, priceUpdates]) => {
        this.updateBurnlistReturns(slug, priceUpdates);
      });
      
      // Create chart datapoints for each active burnlist
      activeBurnlists.forEach(slug => {
        const burnlist = activeBurnlistManager.getBurnlistData(slug);
        if (burnlist && burnlist.items) {
          // NEW NAV CALCULATION: Use NAV calculator for average return
          try {
            const navData = navCalculator.calculateNAVPerformance(burnlist.items, 'MAX');
            
            if (navData && navData.length > 0) {
              const latestNav = navData[navData.length - 1];
              const watchlistReturn = latestNav.returnPercent;
              
              // Save chart datapoint for this watchlist
              if (watchlistReturn !== null) {
                historicalDataManager.saveWatchlistDatapoint(slug, {
                  timestamp: Date.now(),
                  averageReturn: watchlistReturn,
                  tickerCount: burnlist.items.length
                });
              }
            } else {
              // Fallback to old calculation
              const watchlistReturn = returnCalculator.calculateWatchlistReturn(burnlist.items);
              
              if (watchlistReturn !== null) {
                historicalDataManager.saveWatchlistDatapoint(slug, {
                  timestamp: Date.now(),
                  averageReturn: watchlistReturn,
                  tickerCount: burnlist.items.length
                });
              }
            }
          } catch (error) {
            logger.error(`❌ Error in NEW NAV calculation for ${slug}:`, error);
            
            // Fallback to old calculation
            const watchlistReturn = returnCalculator.calculateWatchlistReturn(burnlist.items);
            
            if (watchlistReturn !== null) {
              historicalDataManager.saveWatchlistDatapoint(slug, {
                timestamp: Date.now(),
                averageReturn: watchlistReturn,
                tickerCount: burnlist.items.length
              });
            }
          }
        }
      });
    }

    this.lastSyncTime = Date.now();
    this.syncStats.totalSyncs++;
    this.syncStats.successfulSyncs++;

    logger.log(`✅ Automatic sync completed: ${processedTickers} tickers in ${processedBatches} batches`);
    notificationManager.handleSyncStatus('completed', {
      tickers: processedTickers,
      batches: processedBatches,
      burnlists: activeBurnlists.length
    });
  }

  // Process manual update for inactive burnlist
  async processManualUpdate(slug) {
    try {
      // Check if rate limit allows manual update
      if (!rateLimiter.canMakeManualRequest()) {
        logger.log('⏳ Rate limit reached for manual update');
        return { success: false, message: 'Rate limit reached. Try again later.' };
      }

      // Get burnlist data
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      const burnlist = Object.values(watchlists).find(w => w.slug === slug);
      
      if (!burnlist || !burnlist.items) {
        return { success: false, message: 'Burnlist not found' };
      }

      const tickers = burnlist.items.map(item => item.symbol);
      if (tickers.length === 0) {
        return { success: false, message: 'No tickers in burnlist' };
      }

      logger.log(`📋 Processing manual update for ${slug}: ${tickers.length} tickers`);

      // Mark as processing
      activeBurnlistManager.markManualUpdateProcessing(slug);
      notificationManager.handleManualUpdateStatus(slug, 'processing');

      // Create batches and process
      const batches = this.createBatches(tickers, 5);
      let processedTickers = 0;
      
      // Collect all price updates before creating chart datapoints
      const allPriceUpdates = [];

      for (const batch of batches) {
        if (!rateLimiter.canMakeManualRequest()) {
          await rateLimiter.waitForRateLimit('manual');
        }

        try {
          const prices = await fetchBatchQuotes(batch.symbols);
          rateLimiter.recordManualRequest();
          
          if (prices.length > 0) {
            // Collect all price updates but don't update returns yet
            prices.forEach(priceData => {
              historicalDataManager.updateTickerHistoricalData(priceData.symbol, priceData);
              allPriceUpdates.push(priceData);
            });
            
            processedTickers += prices.length;
          }
          
        } catch (error) {
          logger.error('❌ Manual update batch error:', error);
          notificationManager.handleSystemError(error, 'manual-update');
        }
      }

      // Only create chart datapoints after ALL tickers have been fetched
      if (allPriceUpdates.length > 0) {
        logger.log(`📊 Creating chart datapoint for ${slug} after complete manual update`);
        
        // Update burnlist returns with complete data
        this.updateBurnlistReturns(slug, allPriceUpdates);
        
        // Get updated burnlist data
        const updatedWatchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
        const updatedBurnlist = Object.values(updatedWatchlists).find(w => w.slug === slug);
        
        if (updatedBurnlist && updatedBurnlist.items) {
          // NEW NAV CALCULATION: Use NAV calculator for average return
          try {
            const navData = navCalculator.calculateNAVPerformance(updatedBurnlist.items, 'MAX');
            
            if (navData && navData.length > 0) {
              const latestNav = navData[navData.length - 1];
              const watchlistReturn = latestNav.returnPercent;
              
              // Save chart datapoint for this watchlist
              if (watchlistReturn !== null) {
                historicalDataManager.saveWatchlistDatapoint(slug, {
                  timestamp: Date.now(),
                  averageReturn: watchlistReturn,
                  tickerCount: updatedBurnlist.items.length
                });
              }
            } else {
              // Fallback to old calculation
              const watchlistReturn = returnCalculator.calculateWatchlistReturn(updatedBurnlist.items);
              
              if (watchlistReturn !== null) {
                historicalDataManager.saveWatchlistDatapoint(slug, {
                  timestamp: Date.now(),
                  averageReturn: watchlistReturn,
                  tickerCount: updatedBurnlist.items.length
                });
              }
            }
          } catch (error) {
            logger.error(`❌ Error in NEW NAV calculation for ${slug}:`, error);
            
            // Fallback to old calculation
            const watchlistReturn = returnCalculator.calculateWatchlistReturn(updatedBurnlist.items);
            
            if (watchlistReturn !== null) {
              historicalDataManager.saveWatchlistDatapoint(slug, {
                timestamp: Date.now(),
                averageReturn: watchlistReturn,
                tickerCount: updatedBurnlist.items.length
              });
            }
          }
        }
      }

      // Mark as completed
      activeBurnlistManager.markManualUpdateCompleted(slug);
      notificationManager.handleManualUpdateStatus(slug, 'completed');

      logger.log(`✅ Manual update completed for ${slug}: ${processedTickers} tickers`);
      return { 
        success: true, 
        message: `Updated ${processedTickers} tickers`,
        tickers: processedTickers 
      };

    } catch (error) {
      logger.error('❌ Manual update error:', error);
      activeBurnlistManager.markManualUpdateCompleted(slug);
      notificationManager.handleManualUpdateStatus(slug, 'error');
      return { success: false, message: 'Update failed' };
    }
  }

  // Create batches of symbols
  createBatches(symbols, batchSize = 5) {
    const batches = [];
    for (let i = 0; i < symbols.length; i += batchSize) {
      batches.push(symbols.slice(i, i + batchSize));
    }
    return batches;
  }

  // Prioritize batches based on burnlist activity
  prioritizeBatches(batches, activeBurnlists) {
    return batches.map(batch => ({
      symbols: batch,
      priority: this.calculateBatchPriority(batch, activeBurnlists)
    })).sort((a, b) => b.priority - a.priority);
  }

  // Calculate batch priority based on burnlist activity
  calculateBatchPriority(batch, activeBurnlists) {
    let priority = 0;
    
    batch.forEach(symbol => {
      activeBurnlists.forEach((burnlist, index) => {
        if (burnlist.tickers.includes(symbol)) {
          // Higher priority for recently opened burnlists
          priority += (activeBurnlists.length - index);
        }
      });
    });
    
    return priority;
  }

  // Update burnlist returns in localStorage
  updateBurnlistReturns(slug, newPrices) {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      const burnlistKey = Object.keys(watchlists).find(key => watchlists[key].slug === slug);
      
      if (burnlistKey) {
        const updatedBurnlist = returnCalculator.calculateReturnsForBurnlist(watchlists[burnlistKey], newPrices);
        watchlists[burnlistKey] = updatedBurnlist;
        localStorage.setItem('burnlist_watchlists', JSON.stringify(watchlists));
      }
    } catch (error) {
      logger.error(`❌ Error updating burnlist returns for ${slug}:`, error);
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      syncStats: this.syncStats,
      rateLimitStatus: rateLimiter.getRateLimitStatus(),
      activeBurnlists: activeBurnlistManager.getSystemStatus(),
      apiStatus: notificationManager.getApiStatus()
    };
  }

  // Get system statistics
  getSystemStats() {
    return {
      sync: this.getSyncStatus(),
      historical: historicalDataManager.getHistoricalDataStats(),
      notifications: notificationManager.getNotificationStats()
    };
  }

  // Clean up old data
  cleanup() {
    try {
      historicalDataManager.cleanupOldData();
      activeBurnlistManager.cleanupOldManualUpdates();
      notificationManager.clearOldNotifications();
      logger.log('🧹 System cleanup completed');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  }

  // Export system data for debugging
  exportSystemData() {
    return {
      timestamp: new Date().toISOString(),
      syncStatus: this.getSyncStatus(),
      historicalData: historicalDataManager.exportHistoricalData(),
      notifications: notificationManager.exportNotifications(),
      activeBurnlists: activeBurnlistManager.getActiveBurnlists(),
      manualUpdateQueue: activeBurnlistManager.getManualUpdateQueue()
    };
  }
}

// Create singleton instance
const twelvedataSyncManager = new TwelveDataSyncManager();

export default twelvedataSyncManager; 