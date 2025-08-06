import { findClosestFiveMinutePoint, validateFiveMinuteSpacing } from './historicalDataFetcher';
import historicalDataManager from './historicalDataManager';
import { logger } from '../utils/logger';

/**
 * Live price updater that maintains 5-minute aligned data
 */
class LivePriceUpdater {
  constructor() {
    this.updateQueue = new Map(); // symbol -> { price, timestamp, attempts }
    this.maxRetries = 3;
    this.updateInterval = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Add a new price update to the queue
   * @param {string} symbol - Stock symbol
   * @param {number} price - Current price
   * @param {string} timestamp - ISO timestamp
   */
  addPriceUpdate(symbol, price, timestamp) {
    try {
      // Align timestamp to 5-minute intervals
      const alignedTimestamp = this.alignToFiveMinutes(timestamp);
      
      // Check if we already have a recent update for this symbol
      const existingUpdate = this.updateQueue.get(symbol);
      if (existingUpdate) {
        const timeDiff = Math.abs(new Date(alignedTimestamp).getTime() - new Date(existingUpdate.timestamp).getTime());
        
        // If the new update is within 5 minutes of existing, update it
        if (timeDiff < this.updateInterval) {
          existingUpdate.price = price;
          existingUpdate.timestamp = alignedTimestamp;
          existingUpdate.attempts = 0; // Reset attempts for new data
        } else {
          // Replace with new update
          this.updateQueue.set(symbol, {
            price,
            timestamp: alignedTimestamp,
            attempts: 0
          });
        }
      } else {
        // Add new update
        this.updateQueue.set(symbol, {
          price,
          timestamp: alignedTimestamp,
          attempts: 0
        });
      }
      
      logger.debug(`📊 Added price update for ${symbol}: $${price} at ${alignedTimestamp}`);
    } catch (error) {
      logger.error(`❌ Error adding price update for ${symbol}:`, error);
    }
  }

  /**
   * Align timestamp to 5-minute intervals
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Aligned ISO timestamp
   */
  alignToFiveMinutes(timestamp) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const alignedMinutes = Math.floor(minutes / 5) * 5;
    date.setMinutes(alignedMinutes, 0, 0);
    return date.toISOString();
  }

  /**
   * Process all queued price updates
   */
  async processPriceUpdates() {
    const updates = Array.from(this.updateQueue.entries());
    
    for (const [symbol, update] of updates) {
      try {
        // Check if this update is recent enough (within last 10 minutes)
        const updateTime = new Date(update.timestamp).getTime();
        const now = Date.now();
        const timeDiff = now - updateTime;
        
        if (timeDiff > 10 * 60 * 1000) { // 10 minutes
          logger.warn(`⚠️ Skipping stale update for ${symbol}: ${Math.round(timeDiff / 60000)} minutes old`);
          this.updateQueue.delete(symbol);
          continue;
        }
        
        // Create datapoint
        const datapoint = {
          price: update.price,
          timestamp: update.timestamp,
          symbol: symbol
        };
        
        // Update historical data
        const success = historicalDataManager.updateTickerHistoricalData(symbol, datapoint);
        
        if (success) {
          logger.debug(`✅ Successfully updated ${symbol}: $${update.price} at ${update.timestamp}`);
          this.updateQueue.delete(symbol);
        } else {
          update.attempts++;
          
          if (update.attempts >= this.maxRetries) {
            logger.warn(`⚠️ Max retries reached for ${symbol}, removing from queue`);
            this.updateQueue.delete(symbol);
          } else {
            logger.debug(`⚠️ Failed to update ${symbol}, attempt ${update.attempts}/${this.maxRetries}`);
          }
        }
      } catch (error) {
        logger.error(`❌ Error processing price update for ${symbol}:`, error);
        update.attempts++;
        
        if (update.attempts >= this.maxRetries) {
          this.updateQueue.delete(symbol);
        }
      }
    }
  }

  /**
   * Get current queue status
   * @returns {Object} Queue statistics
   */
  getQueueStatus() {
    const updates = Array.from(this.updateQueue.values());
    const now = Date.now();
    
    const stats = {
      totalUpdates: updates.length,
      recentUpdates: 0,
      staleUpdates: 0,
      averageAge: 0
    };
    
    let totalAge = 0;
    
    updates.forEach(update => {
      const age = now - new Date(update.timestamp).getTime();
      totalAge += age;
      
      if (age < 5 * 60 * 1000) { // 5 minutes
        stats.recentUpdates++;
      } else {
        stats.staleUpdates++;
      }
    });
    
    if (updates.length > 0) {
      stats.averageAge = Math.round(totalAge / updates.length / 60000); // minutes
    }
    
    return stats;
  }

  /**
   * Validate that all tickers in a watchlist have proper 5-minute aligned data
   * @param {Array} tickers - Array of ticker objects
   * @returns {Object} Validation results
   */
  validateWatchlistData(tickers) {
    const results = {
      totalTickers: tickers.length,
      validTickers: 0,
      invalidTickers: 0,
      issues: []
    };
    
    tickers.forEach(ticker => {
      if (!ticker.historicalData || !Array.isArray(ticker.historicalData)) {
        results.invalidTickers++;
        results.issues.push(`${ticker.symbol}: No historical data`);
        return;
      }
      
      if (ticker.historicalData.length === 0) {
        results.invalidTickers++;
        results.issues.push(`${ticker.symbol}: Empty historical data`);
        return;
      }
      
      // Check 5-minute spacing
      if (!validateFiveMinuteSpacing(ticker.historicalData)) {
        results.invalidTickers++;
        results.issues.push(`${ticker.symbol}: Irregular 5-minute spacing`);
        return;
      }
      
      // Check data range (should have at least 1 day of data)
      const firstPoint = ticker.historicalData[0];
      const lastPoint = ticker.historicalData[ticker.historicalData.length - 1];
      const dataRange = new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp);
      const daysOfData = dataRange / (1000 * 60 * 60 * 24);
      
      if (daysOfData < 1) {
        results.invalidTickers++;
        results.issues.push(`${ticker.symbol}: Insufficient data range (${daysOfData.toFixed(1)} days)`);
        return;
      }
      
      results.validTickers++;
    });
    
    return results;
  }

  /**
   * Clean up old data and validate integrity
   */
  cleanup() {
    try {
      // Process any remaining updates
      this.processPriceUpdates();
      
      // Clear old queue entries
      const now = Date.now();
      for (const [symbol, update] of this.updateQueue.entries()) {
        const updateTime = new Date(update.timestamp).getTime();
        if (now - updateTime > 30 * 60 * 1000) { // 30 minutes
          this.updateQueue.delete(symbol);
        }
      }
      
      logger.log(`🧹 Cleaned up live price updater queue`);
    } catch (error) {
      logger.error('❌ Error cleaning up live price updater:', error);
    }
  }
}

// Create singleton instance
const livePriceUpdater = new LivePriceUpdater();

export default livePriceUpdater; 