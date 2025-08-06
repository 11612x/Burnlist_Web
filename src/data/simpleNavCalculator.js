import { logger } from '../utils/logger';

/**
 * Simple NAV Calculator - Clean, synchronized averaging without sophisticated features
 * 
 * @param {Array} portfolioData - Array of ticker objects with historicalData arrays
 * @returns {Array} Array of NAV points with timestamp and return percentage
 */
export function calculateSimpleNAV(portfolioData) {
  if (!Array.isArray(portfolioData) || portfolioData.length === 0) {
    logger.debug('[SIMPLE NAV] No portfolio data, returning empty array');
    return [];
  }

  try {
    logger.debug(`[SIMPLE NAV] Calculating NAV for ${portfolioData.length} tickers`);
    logger.debug(`[SIMPLE NAV] First ticker data:`, portfolioData[0]);
    
    // OPTIMIZATION: For single ticker, just calculate current return
    if (portfolioData.length === 1) {
      logger.debug(`[SIMPLE NAV] Using single ticker fast path`);
      const ticker = portfolioData[0];
      
      logger.debug(`[SIMPLE NAV] Ticker has historicalData:`, !!ticker.historicalData);
      logger.debug(`[SIMPLE NAV] HistoricalData is array:`, Array.isArray(ticker.historicalData));
      logger.debug(`[SIMPLE NAV] HistoricalData length:`, ticker.historicalData?.length);
      
      if (!ticker.historicalData || !Array.isArray(ticker.historicalData) || ticker.historicalData.length === 0) {
        logger.warn('[SIMPLE NAV] Single ticker has no historical data');
        return [];
      }
      
      // Get buy price (oldest) and current price (newest)
      const buyPrice = ticker.historicalData[ticker.historicalData.length - 1].price;
      const currentPrice = ticker.historicalData[0].price;
      
      logger.debug(`[SIMPLE NAV] Buy price: ${buyPrice}, Current price: ${currentPrice}`);
      
      if (buyPrice <= 0 || currentPrice <= 0) {
        logger.warn('[SIMPLE NAV] Invalid prices for single ticker');
        return [];
      }
      
      // Calculate simple return
      const returnPercent = ((currentPrice - buyPrice) / buyPrice) * 100;
      
      logger.debug(`[SIMPLE NAV] Single ticker ${ticker.symbol}: ${currentPrice} vs ${buyPrice} = ${returnPercent.toFixed(2)}%`);
      
      const result = [{
        timestamp: new Date().toISOString().split('T')[0] + ' ' + 
          new Date().getHours().toString().padStart(2, '0') + ':' +
          new Date().getMinutes().toString().padStart(2, '0') + ':' +
          new Date().getSeconds().toString().padStart(2, '0'),
        returnPercent: returnPercent,
        etfPrice: currentPrice,
        validTickers: 1,
        totalTickers: 1
      }];
      
      // Normalize to start at 0% for single ticker
      const baselineValue = result[0].returnPercent;
      result[0].returnPercent = 0; // Start at 0%
      logger.debug(`[SIMPLE NAV] Single ticker normalized: baseline ${baselineValue.toFixed(2)}%, chart starts at 0%`);
      
      logger.debug(`[SIMPLE NAV] Returning result:`, result);
      return result;
    }
    
    logger.debug(`[SIMPLE NAV] Using multi-ticker path`);
    // Step 1: Pre-process tickers for efficiency (multi-ticker scenario)
    const processedTickers = [];
    let maxTimestampsPerTicker = 0;
    
    for (const ticker of portfolioData) {
      if (!ticker.historicalData || !Array.isArray(ticker.historicalData) || ticker.historicalData.length === 0) {
        continue;
      }
      
      // Track max timestamps per ticker for sampling decision
      maxTimestampsPerTicker = Math.max(maxTimestampsPerTicker, ticker.historicalData.length);
      
      // Get buy price (oldest price = last element since data is newest first)
      const buyPrice = ticker.historicalData[ticker.historicalData.length - 1].price;
      
      if (buyPrice <= 0) continue;
      
      // Create price map for O(1) lookup
      const priceMap = new Map();
      for (const point of ticker.historicalData) {
        if (point.timestamp && point.price > 0) {
          priceMap.set(point.timestamp, point.price);
        }
      }
      
      processedTickers.push({
        symbol: ticker.symbol,
        buyPrice: buyPrice,
        priceMap: priceMap
      });
    }
    
    if (processedTickers.length === 0) {
      logger.warn('[SIMPLE NAV] No valid tickers found');
      return [];
    }
    
    // Step 2: Determine sampling strategy based on max timestamps per ticker
    let samplingInterval = 1; // Use all timestamps
    if (maxTimestampsPerTicker > 100) {
      samplingInterval = 20; // Use every 20th timestamp
      logger.debug(`[SIMPLE NAV] Large dataset (${maxTimestampsPerTicker} timestamps per ticker), sampling every 20th`);
    } else if (maxTimestampsPerTicker > 20) {
      samplingInterval = 5; // Use every 5th timestamp
      logger.debug(`[SIMPLE NAV] Medium dataset (${maxTimestampsPerTicker} timestamps per ticker), sampling every 5th`);
    } else {
      logger.debug(`[SIMPLE NAV] Small dataset (${maxTimestampsPerTicker} timestamps per ticker), using all timestamps`);
    }
    
    // Step 3: Get all unique timestamps efficiently with sampling
    const allTimestamps = new Set();
    for (const ticker of processedTickers) {
      const timestamps = Array.from(ticker.priceMap.keys()).sort();
      
      logger.debug(`[SIMPLE NAV] Ticker ${ticker.symbol} has ${timestamps.length} timestamps:`, timestamps.slice(-5)); // Show last 5 timestamps
      
      // Apply sampling
      for (let i = 0; i < timestamps.length; i += samplingInterval) {
        allTimestamps.add(timestamps[i]);
      }
      // Always include the buy date (oldest timestamp)
      if (timestamps.length > 0) {
        allTimestamps.add(timestamps[timestamps.length - 1]);
      }
    }
    
    if (allTimestamps.size === 0) {
      logger.warn('[SIMPLE NAV] No valid timestamps found');
      return [];
    }
    
    // Step 4: Sort timestamps chronologically
    const sortedTimestamps = Array.from(allTimestamps).sort();
    logger.debug(`[SIMPLE NAV] Processing ${sortedTimestamps.length} sampled timestamps for ${processedTickers.length} tickers`);
    logger.debug(`[SIMPLE NAV] Last 5 timestamps:`, sortedTimestamps.slice(-5));
    
    // Step 5: Calculate NAV for each timestamp (optimized)
    const navPoints = [];
    
    for (let i = 0; i < sortedTimestamps.length; i++) {
      const timestamp = sortedTimestamps[i];
      let totalReturn = 0;
      let validTickers = 0;
      let totalPrice = 0;
      
      // Calculate each ticker's % return at this timestamp
      for (const ticker of processedTickers) {
        const currentPrice = ticker.priceMap.get(timestamp);
        
        if (currentPrice && currentPrice > 0) {
          // Calculate % return: (currentPrice - buyPrice) / buyPrice * 100
          const returnPercent = ((currentPrice - ticker.buyPrice) / ticker.buyPrice) * 100;
          
          if (Number.isFinite(returnPercent)) {
            totalReturn += returnPercent;
            totalPrice += currentPrice;
            validTickers++;
          }
        }
      }
      
      // Calculate average return and ETF price
      const averageReturn = validTickers > 0 ? totalReturn / validTickers : 0;
      const etfPrice = validTickers > 0 ? totalPrice / validTickers : 0;
      
      // Format timestamp as actual time (not hardcoded to 4:00 PM)
      const formattedTimestamp = timestamp; // Use the actual timestamp from data
      
      navPoints.push({
        timestamp: formattedTimestamp,
        returnPercent: averageReturn,
        etfPrice: etfPrice,
        validTickers: validTickers,
        totalTickers: processedTickers.length
      });
    }
    
    logger.debug(`[SIMPLE NAV] Calculated ${navPoints.length} NAV points with sampling interval ${samplingInterval}`);
    
    // Ensure first point is 0% (buy price to buy price = 0% return)
    if (navPoints.length > 0) {
      const firstPointReturn = navPoints[0].returnPercent;
      logger.debug(`[SIMPLE NAV] First point return: ${firstPointReturn.toFixed(2)}%, normalizing to 0%`);
      
      // Normalize all points to start at 0%
      navPoints.forEach(point => {
        point.returnPercent = point.returnPercent - firstPointReturn;
      });
      
      logger.debug(`[SIMPLE NAV] Multi-ticker normalized: chart starts at 0%`);
    }
    
    return navPoints;
    
  } catch (error) {
    logger.error('[SIMPLE NAV] Error calculating simple NAV:', error);
    return [];
  }
}

export default {
  calculateSimpleNAV
}; 