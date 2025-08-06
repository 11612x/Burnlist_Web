import navEventEmitter from './navEventEmitter';
import { logger } from '../utils/logger';

/**
 * Real-time NAV Calculator with 5-minute market interval alignment
 */
class RealTimeNavCalculator {
  constructor() {
    this.isRunning = false;
    this.alignmentTimer = null;
    this.lastAlignedTime = null;
    this.pendingUpdates = new Map(); // watchlistSlug -> { items, timeframe }
    this.updateInterval = 5 * 60 * 1000; // 5 minutes
    this.alignmentTolerance = 30 * 1000; // 30 seconds tolerance
  }

  /**
   * Start real-time NAV calculation system
   */
  start() {
    if (this.isRunning) {
      logger.warn('[REAL-TIME NAV] Already running');
      return;
    }

    this.isRunning = true;
    logger.log('[REAL-TIME NAV] Starting real-time NAV calculator');
    
    // Align to next 5-minute interval
    this.alignToNextInterval();
  }

  /**
   * Stop real-time NAV calculation system
   */
  stop() {
    this.isRunning = false;
    
    if (this.alignmentTimer) {
      clearTimeout(this.alignmentTimer);
      this.alignmentTimer = null;
    }
    
    logger.log('[REAL-TIME NAV] Stopped real-time NAV calculator');
  }

  /**
   * Align to the next 5-minute market interval
   */
  alignToNextInterval() {
    if (!this.isRunning) return;

    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentMilliseconds = now.getMilliseconds();

    // Calculate minutes until next 5-minute boundary
    const minutesToNext = 5 - (currentMinutes % 5);
    const secondsToNext = minutesToNext * 60 - currentSeconds;
    const millisecondsToNext = secondsToNext * 1000 - currentMilliseconds;

    logger.debug(`[REAL-TIME NAV] Current time: ${now.toISOString()}`);
    logger.debug(`[REAL-TIME NAV] Minutes to next 5-min boundary: ${minutesToNext}`);
    logger.debug(`[REAL-TIME NAV] Waiting ${millisecondsToNext}ms until next interval`);

    // Schedule next calculation at exact 5-minute boundary
    this.alignmentTimer = setTimeout(() => {
      this.performAlignedCalculation();
    }, millisecondsToNext);
  }

  /**
   * Perform NAV calculation at aligned 5-minute interval
   */
  async performAlignedCalculation() {
    if (!this.isRunning) return;

    const alignedTime = new Date();
    this.lastAlignedTime = alignedTime;
    
    logger.log(`[REAL-TIME NAV] Performing aligned calculation at ${alignedTime.toISOString()}`);

    // Process all pending updates
    const promises = Array.from(this.pendingUpdates.entries()).map(async ([watchlistSlug, update]) => {
      try {
        await this.calculateAndEmitNAV(watchlistSlug, update.items, update.timeframe, 'aligned');
      } catch (error) {
        logger.error(`[REAL-TIME NAV] Error calculating NAV for ${watchlistSlug}:`, error);
      }
    });

    await Promise.all(promises);

    // Clear processed updates
    this.pendingUpdates.clear();

    // Schedule next aligned calculation
    this.alignToNextInterval();
  }

  /**
   * Queue NAV calculation for next aligned interval
   * @param {string} watchlistSlug - Watchlist identifier
   * @param {Array} items - Ticker items
   * @param {string} timeframe - Timeframe for calculation
   */
  queueAlignedCalculation(watchlistSlug, items, timeframe = 'MAX') {
    if (!this.isRunning) {
      logger.warn('[REAL-TIME NAV] System not running, cannot queue calculation');
      return;
    }

    this.pendingUpdates.set(watchlistSlug, { items, timeframe });
    logger.debug(`[REAL-TIME NAV] Queued aligned calculation for ${watchlistSlug}`);
  }

  /**
   * Calculate and emit NAV immediately (for real-time updates)
   * @param {string} watchlistSlug - Watchlist identifier
   * @param {Array} items - Ticker items
   * @param {string} timeframe - Timeframe for calculation
   * @param {string} source - Source of calculation
   */
  async calculateAndEmitNAV(watchlistSlug, items, timeframe = 'MAX', source = 'realtime') {
    if (!items || items.length === 0) {
      logger.warn(`[REAL-TIME NAV] No items provided for ${watchlistSlug}`);
      return;
    }

    try {
      logger.debug(`[REAL-TIME NAV] Calculating NAV for ${watchlistSlug} (${items.length} items, ${timeframe})`);

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
        source: source,
        validTickers: validTickers,
        totalTickers: items.length
      }];
      
      if (navData && navData.length > 0) {
        // Emit the NAV update event
        navEventEmitter.emit(watchlistSlug, navData, source);
        
        logger.debug(`[REAL-TIME NAV] Emitted NAV update for ${watchlistSlug} (${navData.length} points)`);
      } else {
        logger.warn(`[REAL-TIME NAV] No NAV data generated for ${watchlistSlug}`);
      }
    } catch (error) {
      logger.error(`[REAL-TIME NAV] Error calculating NAV for ${watchlistSlug}:`, error);
    }
  }

  /**
   * Trigger immediate NAV calculation (for single ticker updates)
   * @param {string} watchlistSlug - Watchlist identifier
   * @param {Array} items - Ticker items
   * @param {string} timeframe - Timeframe for calculation
   */
  async triggerImmediateCalculation(watchlistSlug, items, timeframe = 'MAX') {
    if (!this.isRunning) {
      logger.warn('[REAL-TIME NAV] System not running, cannot trigger immediate calculation');
      return;
    }

    logger.debug(`[REAL-TIME NAV] Triggering immediate calculation for ${watchlistSlug}`);
    await this.calculateAndEmitNAV(watchlistSlug, items, timeframe, 'realtime');
  }

  /**
   * Check if current time is close to a 5-minute boundary
   * @returns {boolean} True if close to boundary
   */
  isNearBoundary() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    // Check if within 30 seconds of a 5-minute boundary
    const minutesFromBoundary = minutes % 5;
    const totalSecondsFromBoundary = minutesFromBoundary * 60 + seconds;
    
    return totalSecondsFromBoundary <= 30 || totalSecondsFromBoundary >= 270; // Within 30s of boundary
  }

  /**
   * Get next 5-minute boundary time
   * @returns {Date} Next boundary time
   */
  getNextBoundaryTime() {
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const minutesToNext = 5 - (currentMinutes % 5);
    
    const nextBoundary = new Date(now);
    nextBoundary.setMinutes(now.getMinutes() + minutesToNext, 0, 0);
    
    return nextBoundary;
  }

  /**
   * Get time until next boundary
   * @returns {number} Milliseconds until next boundary
   */
  getTimeUntilNextBoundary() {
    const now = new Date();
    const nextBoundary = this.getNextBoundaryTime();
    return nextBoundary.getTime() - now.getTime();
  }

  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    const now = new Date();
    const nextBoundary = this.getNextBoundaryTime();
    const timeUntilNext = this.getTimeUntilNextBoundary();
    const isNearBoundary = this.isNearBoundary();
    
    return {
      isRunning: this.isRunning,
      lastAlignedTime: this.lastAlignedTime,
      nextBoundaryTime: nextBoundary,
      timeUntilNextBoundary: timeUntilNext,
      isNearBoundary,
      pendingUpdates: this.pendingUpdates.size,
      currentTime: now.toISOString()
    };
  }
}

// Create singleton instance
const realTimeNavCalculator = new RealTimeNavCalculator();

export default realTimeNavCalculator; 