import { logger } from '../utils/logger';

class NAVCalculator {
  constructor() {
    // Trading hours for NYC (04:00-20:00 EST)
    this.nycOpenHour = 4; // 04:00 EST
    this.nycCloseHour = 20; // 20:00 EST
    
    // Data quality thresholds
    this.MIN_DATA_COVERAGE = 0.7; // 70% minimum ticker coverage
    this.TIMESTAMP_TOLERANCE = 5; // ±5 minutes tolerance
    
    // Real timestamp extraction settings
    this.MIN_TIMESTAMP_COVERAGE = 0.8; // 80% of tickers must have data at timestamp
    this.MAX_TIMESTAMP_GAP = 15; // Maximum gap in minutes between timestamps
    
    // Fallback configuration
    this.fallbackStrategy = 'carry_forward'; // 'carry_forward', 'interpolated', 'bootstrapped'
    this.enableDataQualityScoring = true;
    this.minDataQualityScore = 0.6; // Minimum quality score for ticker inclusion
    
    // Advanced reliability settings
    this.enableAnchoredSampling = true; // Lock ticker set at timeframe start
    this.enableConfidenceScoring = true; // Calculate confidence scores
    this.enableMarketAwareFallback = true; // Market-aware fallback logic
    this.enableAnomalyDetection = true; // Detect statistical anomalies
    
    // Confidence thresholds
    this.MIN_CONFIDENCE_SCORE = 0.5; // Minimum confidence for reliable NAV
    this.HIGH_CONFIDENCE_THRESHOLD = 0.8; // High confidence threshold
    
    // Anomaly detection thresholds
    this.MAX_VOLATILITY_THRESHOLD = 0.15; // 15% max volatility
    this.MIN_COVERAGE_FOR_HIGH_CONFIDENCE = 0.8; // 80% coverage needed for high confidence
    this.MAX_SINGLE_TICKER_WEIGHT = 0.3; // No single ticker > 30% weight
    
    // Cohort-based NAV settings
    this.FULL_WEIGHT = 1.0; // Weight for tickers with valid data
    this.FALLBACK_WEIGHT = 0.5; // Weight for tickers using fallback data
    this.MIN_COHORT_SIZE = 2; // Minimum tickers required for valid cohort
    this.ANOMALY_THRESHOLD = 0.5; // Mark as anomaly if <50% tickers have full weight
    
    // Drift detection settings
    this.DRIFT_WARNING_THRESHOLD = 1.5; // ±1.5% drift threshold for warning
    this.INACTIVE_TICKER_THRESHOLD = 1; // 1 trading day for inactive ticker detection
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
        
        // Calculate unweighted average for drift detection
        const unweightedData = this.calculateUnweightedAverage(portfolioData, timestamp, timeframe);
        
        // Detect drift warning
        const driftAmount = Math.abs(averageReturn - unweightedData.unweightedAverage);
        const driftWarning = driftAmount > this.DRIFT_WARNING_THRESHOLD;
        
        // Calculate confidence score (simplified for this version)
        const dataCoverage = validTickers / portfolioData.length;
        const confidenceScore = Math.min(1.0, dataCoverage * 1.2); // Boost coverage-based confidence
        
        // Detect inactive tickers
        const inactiveTickers = this.getInactiveTickers(portfolioData, timestamp);
        
        navDataPoints.push({
          timestamp: timestamp,
          returnPercent: averageReturn,
          // Enhanced metadata for UI
          confidenceScore: confidenceScore,
          validTickers: validTickers,
          totalTickers: portfolioData.length,
          dataCoverage: dataCoverage,
          fallbackTickers: unweightedData.fallbackCount,
          fullWeightTickers: validTickers - unweightedData.fallbackCount,
          anomaly: confidenceScore < 0.5, // Simple anomaly detection
          marketStatus: this.getMarketStatus(timestamp),
          // Drift detection
          unweightedAverage: unweightedData.unweightedAverage,
          driftWarning: driftWarning,
          driftAmount: driftAmount,
          // Inactive ticker tracking
          inactiveTickers: inactiveTickers,
          tickerResults: unweightedData.tickerResults
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

  /**
   * Calculate unweighted average for drift detection
   * @param {Array} portfolioData - Array of ticker data
   * @param {number} timestamp - Target timestamp
   * @param {string} timeframe - Timeframe
   * @returns {Object} Unweighted calculation results
   */
  calculateUnweightedAverage(portfolioData, timestamp, timeframe) {
    let totalReturn = 0;
    let validTickers = 0;
    let fallbackCount = 0;
    const tickerResults = [];
    
    for (const ticker of portfolioData) {
      try {
        const tickerPrice = this.findClosestPricePoint(ticker.historicalData, new Date(timestamp));
        const tickerBuyPrice = this.calculateDynamicBuyPrice(ticker, timeframe);
        
        if (tickerPrice && tickerPrice.price > 0 && tickerBuyPrice > 0) {
          const tickerReturn = ((tickerPrice.price - tickerBuyPrice) / tickerBuyPrice) * 100;
          if (Number.isFinite(tickerReturn)) {
            totalReturn += tickerReturn;
            validTickers++;
            
            // Track if this ticker is using recent data or fallback
            const dataAge = timestamp - new Date(tickerPrice.timestamp).getTime();
            const isFallback = dataAge > (24 * 60 * 60 * 1000); // >1 day old
            if (isFallback) fallbackCount++;
            
            tickerResults.push({
              symbol: ticker.symbol,
              return: tickerReturn,
              price: tickerPrice.price,
              buyPrice: tickerBuyPrice,
              isFallback: isFallback,
              dataAge: dataAge
            });
          }
        }
      } catch (error) {
        // Skip errored tickers
      }
    }
    
    const unweightedAverage = validTickers > 0 ? totalReturn / validTickers : 0;
    
    return {
      unweightedAverage,
      validTickers,
      fallbackCount,
      tickerResults
    };
  }

  /**
   * Get inactive tickers (no updates in >1 trading day)
   * @param {Array} portfolioData - Array of ticker data
   * @param {number} timestamp - Current timestamp
   * @returns {Array} Array of inactive ticker symbols with last update info
   */
  getInactiveTickers(portfolioData, timestamp) {
    const inactiveTickers = [];
    const oneTradingDay = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    
    for (const ticker of portfolioData) {
      if (!ticker.historicalData || ticker.historicalData.length === 0) continue;
      
      // Find most recent data point
      const sortedData = [...ticker.historicalData].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      const latestDataPoint = sortedData[0];
      
      if (latestDataPoint) {
        const dataAge = timestamp - new Date(latestDataPoint.timestamp).getTime();
        if (dataAge > oneTradingDay) {
          inactiveTickers.push({
            symbol: ticker.symbol,
            lastUpdate: latestDataPoint.timestamp,
            daysInactive: Math.floor(dataAge / oneTradingDay)
          });
        }
      }
    }
    
    return inactiveTickers;
  }

  /**
   * Get market status for timestamp
   * @param {number} timestamp - Target timestamp
   * @returns {string} Market status ('open', 'closed', 'pre_market', 'after_hours')
   */
  getMarketStatus(timestamp) {
    const date = new Date(timestamp);
    const easternTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dayOfWeek = easternTime.getDay();
    const hour = easternTime.getHours();
    const minute = easternTime.getMinutes();
    
    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'closed';
    }
    
    // Market hours: 9:30 AM - 4:00 PM ET
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    const currentTime = hour * 60 + minute;
    
    if (currentTime >= marketOpen && currentTime <= marketClose) {
      return 'open';
    } else if (currentTime < marketOpen) {
      return 'pre_market';
    } else {
      return 'after_hours';
    }
  }

  /**
   * Export NAV series data to JSON
   * @param {Array} navDataPoints - NAV data points
   * @param {string} watchlistSlug - Watchlist identifier
   * @param {string} timeframe - Timeframe
   * @returns {Object} Exportable data structure
   */
  exportNAVSeries(navDataPoints, watchlistSlug, timeframe) {
    return {
      metadata: {
        watchlistSlug: watchlistSlug,
        timeframe: timeframe,
        exportedAt: new Date().toISOString(),
        totalPoints: navDataPoints.length
      },
      navSeries: navDataPoints.map(point => ({
        timestamp: new Date(point.timestamp).toISOString(),
        navValue: Number(point.returnPercent.toFixed(4)),
        confidenceScore: Number((point.confidenceScore || 0).toFixed(3)),
        validTickers: point.validTickers || 0,
        totalCohort: point.totalTickers || 0,
        fallbackCount: point.fallbackTickers || 0,
        anomaly: point.anomaly || false,
        marketStatus: point.marketStatus || 'unknown',
        unweightedAverage: Number((point.unweightedAverage || 0).toFixed(4)),
        driftWarning: point.driftWarning || false,
        driftAmount: Number((point.driftAmount || 0).toFixed(4)),
        inactiveTickerCount: point.inactiveTickers ? point.inactiveTickers.length : 0
      }))
    };
  }
}

// Create singleton instance
const navCalculator = new NAVCalculator();

export default navCalculator; 