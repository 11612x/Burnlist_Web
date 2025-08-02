import { logger } from '../utils/logger';

class NAVCalculator {
  constructor() {
    // Trading hours for NYC (04:00-20:00 EST)
    this.nycOpenHour = 4; // 04:00 EST
    this.nycCloseHour = 20; // 20:00 EST
  }

  /**
   * Calculate ETF-style NAV performance for a watchlist
   * @param {Array} portfolioData - Array of ticker data with historicalData arrays
   * @param {string} timeframe - Timeframe (D, W, M, YTD, MAX)
   * @returns {Array} Chart data points with timestamp and NAV return percentage
   */
  calculateNAVPerformance(portfolioData, timeframe) {
    // 🔍 SIMPLE DEBUG: NAV Calculator called
    console.log(`🔍 [NAV CALCULATOR] Timeframe: ${timeframe}, Portfolio entries: ${portfolioData?.length || 0}`);
    
    if (!Array.isArray(portfolioData) || portfolioData.length === 0) {
      console.log(`🔍 [NAV CALCULATOR] No portfolio data, returning empty array`);
      return [];
    }

    try {
      // Get sampling schedule for this timeframe
      const samplingSchedule = this.generateSamplingTimestamps(timeframe, portfolioData);
      console.log(`🔍 [NAV CALCULATOR] Sampling schedule: ${samplingSchedule.length} points`);
      
      if (samplingSchedule.length === 0) {
        console.log(`🔍 [NAV CALCULATOR] No sampling schedule, returning empty array`);
        return [];
      }

      // Generate NAV data points
      const navDataPoints = [];
      
      for (let i = 0; i < samplingSchedule.length; i++) {
        const timestamp = samplingSchedule[i];
        const isFirstPoint = i === 0;
        
        let totalReturn = 0;
        let validTickers = 0;
        
        // Calculate each ticker's return at this timestamp
        for (const ticker of portfolioData) {
          try {
            // Get the ticker's price at this timestamp
            const tickerPrice = this.findClosestPricePoint(ticker.historicalData, new Date(timestamp));
            
            if (!tickerPrice || !tickerPrice.price || tickerPrice.price <= 0) {
              continue;
            }

            // Calculate individual ticker's buy price based on timeframe and buy date
            const tickerBuyPrice = this.calculateDynamicBuyPrice(ticker, timeframe);
            
            if (!tickerBuyPrice || tickerBuyPrice <= 0) {
              continue;
            }

            // Check if ticker was added before this timestamp
            const tickerBuyDate = new Date(ticker.buyDate || ticker.historicalData[0]?.timestamp);
            const currentTimestamp = new Date(timestamp);
            
            if (tickerBuyDate > currentTimestamp) {
              continue; // Skip tickers not yet added
            }

            // Calculate ticker's return using its own buy price
            const tickerReturn = ((tickerPrice.price - tickerBuyPrice) / tickerBuyPrice) * 100;
            
            if (Number.isFinite(tickerReturn)) {
              totalReturn += tickerReturn;
              validTickers++;
            }
          } catch (error) {
            console.error(`🔍 [NAV TICKER] Error calculating for ${ticker.symbol}:`, error);
          }
        }
        
        // Calculate average NAV return for this timestamp
        const averageReturn = validTickers > 0 ? totalReturn / validTickers : 0;
        
        navDataPoints.push({
          timestamp: timestamp,
          returnPercent: averageReturn
        });
      }
      
      // 🔍 LEVEL 3 DEBUG: NAV Series Summary
      console.log(`🔍 [NAV SERIES] Generated ${navDataPoints.length} NAV points for timeframe ${timeframe}`);
      if (navDataPoints.length > 0) {
        const firstPoint = navDataPoints[0];
        const lastPoint = navDataPoints[navDataPoints.length - 1];
        console.log(`🔍 [NAV SERIES] Range: ${new Date(firstPoint.timestamp).toISOString()} → ${new Date(lastPoint.timestamp).toISOString()}`);
        console.log(`🔍 [NAV SERIES] NAV change: ${firstPoint.returnPercent.toFixed(2)}% → ${lastPoint.returnPercent.toFixed(2)}%`);
      }
      
      return navDataPoints;
      
    } catch (error) {
      console.error('🔍 [NAV CALCULATOR] Error calculating NAV performance:', error);
      return [];
    }
  }

  /**
   * Get the shared baseline price for a portfolio (used by both NAV calculator and ticker rows)
   * @param {Array} portfolioData - Array of ticker data
   * @param {string} timeframe - Timeframe
   * @returns {number} Shared baseline price
   */
  getSharedBaselinePrice(portfolioData, timeframe) {
    if (!Array.isArray(portfolioData) || portfolioData.length === 0) {
      return 0;
    }
    try {
      // For MAX timeframe, calculate average of all tickers' earliest available prices
      if (timeframe === 'MAX') {
        let totalBaselinePrice = 0;
        let validBaselineTickers = 0;
        
        for (const ticker of portfolioData) {
          try {
            const buyPrice = this.calculateDynamicBuyPrice(ticker, timeframe);
            if (buyPrice > 0) {
              totalBaselinePrice += buyPrice;
              validBaselineTickers++;
            }
          } catch (error) {
            console.error(`🔍 [SHARED BASELINE] Error finding baseline for ${ticker.symbol}:`, error);
          }
        }
        
        if (validBaselineTickers > 0) {
          const baselinePrice = totalBaselinePrice / validBaselineTickers;
          console.log(`🔍 [SHARED BASELINE] Average baseline price for ${timeframe}: $${baselinePrice.toFixed(2)}`);
          return baselinePrice;
        }
      } else {
        // For other timeframes, use the sampling schedule approach
        const samplingSchedule = this.generateSamplingTimestamps(timeframe, portfolioData);
        if (samplingSchedule.length === 0) {
          return 0;
        }
        const firstTimestamp = samplingSchedule[0];
        let totalBaselinePrice = 0;
        let validBaselineTickers = 0;
        
        for (const ticker of portfolioData) {
          try {
            const pricePoint = this.findClosestPricePoint(ticker.historicalData, new Date(firstTimestamp));
            if (pricePoint && pricePoint.price > 0) {
              totalBaselinePrice += pricePoint.price;
              validBaselineTickers++;
            }
          } catch (error) {
            console.error(`🔍 [SHARED BASELINE] Error finding baseline for ${ticker.symbol}:`, error);
          }
        }
        
        if (validBaselineTickers > 0) {
          const baselinePrice = totalBaselinePrice / validBaselineTickers;
          console.log(`🔍 [SHARED BASELINE] Average baseline price for ${timeframe}: $${baselinePrice.toFixed(2)}`);
          return baselinePrice;
        }
      }
    } catch (error) {
      console.error('🔍 [SHARED BASELINE] Error calculating shared baseline:', error);
    }
    return 0;
  }

  /**
   * Calculate dynamic buy price based on timeframe
   * @param {Object} ticker - Ticker data
   * @param {string} timeframe - Timeframe
   * @returns {number} Buy price
   */
  calculateDynamicBuyPrice(ticker, timeframe) {
    const { historicalData, buyPrice, buyDate } = ticker;
    
    if (!Array.isArray(historicalData) || historicalData.length === 0) {
      return 0;
    }

    // Sort historical data by timestamp
    const sortedData = [...historicalData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const now = new Date();
    const tickerBuyDate = new Date(buyDate || sortedData[0].timestamp);
    let targetDate;

    switch (timeframe) {
      case 'D':
        // Price from exactly 24 hours ago, but not before ticker was added
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        targetDate = new Date(Math.max(dayAgo.getTime(), tickerBuyDate.getTime()));
        break;
      
      case 'W':
        // Price from 7 trading days ago, but not before ticker was added
        const weekAgo = this.getTradingDaysAgo(7);
        targetDate = new Date(Math.max(weekAgo.getTime(), tickerBuyDate.getTime()));
        break;
      
      case 'M':
        // Price from 30 trading days ago, but not before ticker was added
        const monthAgo = this.getTradingDaysAgo(30);
        targetDate = new Date(Math.max(monthAgo.getTime(), tickerBuyDate.getTime()));
        break;
      
      case 'YTD':
        // Price from Jan 1, but not before ticker was added
        const jan1 = new Date(now.getFullYear(), 0, 1);
        targetDate = new Date(Math.max(jan1.getTime(), tickerBuyDate.getTime()));
        break;
      
      case 'MAX':
        // Use the ticker's own earliest available data (its buy date or first data point)
        targetDate = new Date(sortedData[0].timestamp);
        break;
      
      default:
        logger.warn(`⚠️ Unknown timeframe: ${timeframe}`);
        return 0;
    }

    // Find the closest price point to the target date
    const closestPoint = this.findClosestPricePoint(sortedData, targetDate);
    
    if (closestPoint && closestPoint.price > 0) {
      logger.debug(`📊 ${ticker.symbol}: Dynamic buy price for ${timeframe} = ${closestPoint.price} (from ${new Date(closestPoint.timestamp).toISOString()}, buy date: ${tickerBuyDate.toISOString()})`);
      return closestPoint.price;
    }

    logger.warn(`⚠️ No valid buy price found for ${ticker.symbol} in timeframe ${timeframe}`);
    return 0;
  }

  /**
   * Get date N trading days ago (excluding weekends)
   * @param {number} tradingDays - Number of trading days to go back
   * @returns {Date} Date N trading days ago
   */
  getTradingDaysAgo(tradingDays) {
    const now = new Date();
    let currentDate = new Date(now);
    let daysBack = 0;
    
    while (daysBack < tradingDays) {
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        daysBack++;
      }
    }
    
    return currentDate;
  }

  /**
   * Find the closest price point to a target date
   * @param {Array} sortedData - Sorted historical data
   * @param {Date} targetDate - Target date
   * @returns {Object|null} Closest price point
   */
  findClosestPricePoint(sortedData, targetDate) {
    if (sortedData.length === 0) return null;
    
    const targetTime = targetDate.getTime();
    let closestPoint = sortedData[0];
    let closestDiff = Math.abs(new Date(closestPoint.timestamp).getTime() - targetTime);
    
    for (const point of sortedData) {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTime);
      
      if (diff < closestDiff) {
        closestDiff = diff;
        closestPoint = point;
      }
    }
    
    return closestPoint;
  }

  /**
   * Generate sampling timestamps based on timeframe rules
   * @param {string} timeframe - Timeframe
   * @param {Array} tickers - Ticker data
   * @returns {Array} Array of timestamps
   */
  generateSamplingTimestamps(timeframe, tickers) {
    // Get the date range from all tickers
    const allTimestamps = new Set();
    tickers.forEach(ticker => {
      ticker.historicalData.forEach(point => {
        allTimestamps.add(new Date(point.timestamp).getTime());
      });
    });
    
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    if (sortedTimestamps.length === 0) {
      return [];
    }

    const earliestDataTime = sortedTimestamps[0];
    const latestDataTime = sortedTimestamps[sortedTimestamps.length - 1];
    
    switch (timeframe) {
      case 'D':
        return this.generateDailySampling(earliestDataTime, latestDataTime);
      
      case 'W':
        return this.generateWeeklySampling(earliestDataTime, latestDataTime);
      
      case 'M':
        return this.generateMonthlySampling(earliestDataTime, latestDataTime);
      
      case 'YTD':
        // YTD should start from January 1 of current year
        const currentYear = new Date().getFullYear();
        const ytdStartTime = new Date(currentYear, 0, 1).getTime(); // January 1st
        return this.generateDailyTradingSampling(ytdStartTime, latestDataTime);
      
      case 'MAX':
        // MAX uses earliest available data
        return this.generateDailyTradingSampling(earliestDataTime, latestDataTime);
      
      default:
        logger.warn(`⚠️ Unknown timeframe for sampling: ${timeframe}`);
        return [];
    }
  }

  /**
   * Generate daily sampling: one point every 3 minutes during NYC extended hours (04:00-20:00 EST)
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array} Sampling timestamps
   */
  generateDailySampling(startTime, endTime) {
    const timestamps = [];
    const threeMinutesMs = 3 * 60 * 1000;
    
    // Use the actual data range for daily sampling
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    // For daily timeframe, use the last 24 hours of data
    const dailyStart = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    const currentDate = new Date(Math.max(dailyStart.getTime(), startDate.getTime()));
    
    while (currentDate <= endDate) {
      // Check if within NYC trading hours (04:00-20:00 EST)
      const hour = currentDate.getHours();
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      if (!isWeekend && hour >= this.nycOpenHour && hour < this.nycCloseHour) {
        timestamps.push(currentDate.getTime());
      }
      
      currentDate.setTime(currentDate.getTime() + threeMinutesMs);
    }
    
    return timestamps;
  }

  /**
   * Generate weekly sampling: 3 points per trading day (open, mid, close) over last 7 market days
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array} Sampling timestamps
   */
  generateWeeklySampling(startTime, endTime) {
    const timestamps = [];
    const endDate = new Date(endTime);
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const currentDate = new Date(Math.max(startDate.getTime(), startTime));
    
    while (currentDate <= endDate) {
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      if (!isWeekend) {
        // Add open (9:30 AM), mid (12:30 PM), close (4:00 PM) EST
        const openTime = new Date(currentDate);
        openTime.setHours(9, 30, 0, 0);
        
        const midTime = new Date(currentDate);
        midTime.setHours(12, 30, 0, 0);
        
        const closeTime = new Date(currentDate);
        closeTime.setHours(16, 0, 0, 0);
        
        timestamps.push(openTime.getTime(), midTime.getTime(), closeTime.getTime());
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return timestamps.filter(ts => ts >= startTime && ts <= endTime);
  }

  /**
   * Generate monthly sampling: 2 points per day over 30 trading days (open and close)
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array} Sampling timestamps
   */
  generateMonthlySampling(startTime, endTime) {
    const timestamps = [];
    const endDate = new Date(endTime);
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    const currentDate = new Date(Math.max(startDate.getTime(), startTime));
    let tradingDays = 0;
    
    while (currentDate <= endDate && tradingDays < 30) {
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      if (!isWeekend) {
        // Add open (9:30 AM) and close (4:00 PM) EST
        const openTime = new Date(currentDate);
        openTime.setHours(9, 30, 0, 0);
        
        const closeTime = new Date(currentDate);
        closeTime.setHours(16, 0, 0, 0);
        
        timestamps.push(openTime.getTime(), closeTime.getTime());
        tradingDays++;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return timestamps.filter(ts => ts >= startTime && ts <= endTime);
  }

  /**
   * Generate daily trading sampling: one point per trading day
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array} Sampling timestamps
   */
  generateDailyTradingSampling(startTime, endTime) {
    const timestamps = [];
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      if (!isWeekend) {
        // Use close time (4:00 PM EST)
        const closeTime = new Date(currentDate);
        closeTime.setHours(16, 0, 0, 0);
        
        timestamps.push(closeTime.getTime());
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return timestamps.filter(ts => ts >= startTime && ts <= endTime);
  }

  /**
   * Calculate NAV at a specific timestamp with carry-forward fallback
   * @param {Array} tickers - Ticker data with dynamic buy prices
   * @param {number} timestamp - Target timestamp
   * @param {boolean} isFirstPoint - Whether this is the first data point
   * @returns {number} NAV return percentage
   */
  calculateNAVAtTimestamp(tickers, timestamp, isFirstPoint) {
    let totalReturn = 0;
    let validTickers = 0;
    let skippedTickers = 0;
    
    //  LEVEL 2 DEBUG: NAV Calculation Loop
    logger.log(`🔍 [NAV CALCULATION DEBUG] Timestamp: ${new Date(timestamp).toISOString()}`);
    logger.log(`  - Processing ${tickers.length} tickers`);
    
    tickers.forEach((ticker, index) => {
      // Sort historical data by timestamp for efficient searching
      const sortedData = [...ticker.historicalData].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      // Find the closest price point for this ticker at this timestamp
      let pricePoint = this.findClosestPricePoint(sortedData, new Date(timestamp));
      
      // Carry-forward logic: if no data at timestamp or invalid price, use most recent before it
      if (!pricePoint || !pricePoint.price || pricePoint.price <= 0) {
        pricePoint = this.findMostRecentPriceBefore(sortedData, timestamp);
        if (pricePoint) {
          logger.log(`  - ${ticker.symbol}: Carry-forward used - ${new Date(pricePoint.timestamp).toISOString()} → $${pricePoint.price}`);
        }
      }
      
      if (pricePoint && pricePoint.price > 0 && ticker.dynamicBuyPrice > 0) {
        // Calculate return using dynamic buy price
        const returnPercent = ((pricePoint.price - ticker.dynamicBuyPrice) / ticker.dynamicBuyPrice) * 100;
        
        if (Number.isFinite(returnPercent)) {
          totalReturn += returnPercent;
          validTickers++;
          
          logger.log(`  - ${ticker.symbol}: $${pricePoint.price} vs $${ticker.dynamicBuyPrice} = ${returnPercent.toFixed(2)}%`);
        } else {
          logger.warn(`  - ${ticker.symbol}: Invalid return calculation (${returnPercent})`);
          skippedTickers++;
        }
      } else {
        logger.warn(`  - ${ticker.symbol}: No valid price data (price: ${pricePoint?.price}, buyPrice: ${ticker.dynamicBuyPrice})`);
        skippedTickers++;
      }
    });
    
    // Return 0% for first point (baseline) or average return
    if (isFirstPoint) {
      logger.log(`  - First point: NAV = 0% (baseline)`);
      return 0;
    }
    
    const navValue = validTickers > 0 ? totalReturn / validTickers : 0;
    
    //  LEVEL 2 DEBUG: NAV Summary for this timestamp
    logger.log(`  - NAV Summary: ${validTickers} valid, ${skippedTickers} skipped, NAV = ${navValue.toFixed(2)}%`);
    
    return navValue;
  }
}

// Create singleton instance
const navCalculator = new NAVCalculator();

export default navCalculator; 