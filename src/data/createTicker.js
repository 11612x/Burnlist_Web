import { fetchQuote } from '@data/finhubAdapter';
import { fetchThreeYearHistoricalData, validateFiveMinuteSpacing } from '@data/historicalDataFetcher';
import { normalizeSymbol } from '@data/tickerUtils';
import normalizeTicker from '@data/normalizeTicker';
import { logger } from '../utils/logger';

export async function createTicker(symbol, type = 'real', customBuyPrice = null, customBuyDate = null) {
  // Input validation
  if (!symbol || typeof symbol !== 'string') {
    logger.error('❌ createTicker: Invalid symbol provided:', symbol);
    return null;
  }

  symbol = normalizeSymbol(symbol);
  const addedAt = new Date().toISOString();

  try {
    // Handle real ticker via API
    logger.log(`🌐 Fetching real ticker data for ${symbol}`);
    
    // NEW: Fetch 3 years of 5-minute historical data immediately
    logger.log(`📊 Fetching 3 years of 5-minute historical data for ${symbol}`);
    const historicalData = await fetchThreeYearHistoricalData(symbol);
    
    if (!historicalData || historicalData.length === 0) {
      logger.warn(`⚠️ No historical data received for ${symbol}`);
      return null;
    }
    
    logger.log(`✅ Received ${historicalData.length} historical data points for ${symbol}`);
    
    // Validate 5-minute spacing
    if (!validateFiveMinuteSpacing(historicalData)) {
      logger.warn(`⚠️ Irregular 5-minute spacing detected for ${symbol}`);
    }
    
    // Get current price from the quote endpoint (most recent available price)
    const latestDataPoint = historicalData[historicalData.length - 1];
    let currentPrice = latestDataPoint.price;
    let currentTimestamp = latestDataPoint.timestamp;
    
    try {
      // Fetch current price from quote endpoint to get the most recent available price
      const { fetchQuote } = await import('@data/twelvedataAdapter');
      const quoteData = await fetchQuote(symbol);
      
      if (quoteData && quoteData.buyPrice) {
        currentPrice = quoteData.buyPrice;
        currentTimestamp = quoteData.buyDate;
        logger.log(`💰 Updated current price for ${symbol}: $${currentPrice} (from quote endpoint)`);
      } else {
        logger.warn(`⚠️ Could not fetch current price for ${symbol}, using historical data: $${currentPrice}`);
      }
    } catch (error) {
      logger.warn(`⚠️ Error fetching current price for ${symbol}, using historical data: $${currentPrice}`, error);
    }
    
    // Create ticker object with comprehensive historical data
    const ticker = {
      symbol: symbol,
      buyPrice: customBuyPrice !== null && !isNaN(Number(customBuyPrice)) 
        ? Number(customBuyPrice) 
        : currentPrice,
      buyDate: customBuyDate && !isNaN(Date.parse(customBuyDate))
        ? customBuyDate
        : currentTimestamp,
      historicalData: historicalData, // Full 3-year dataset
      currentPrice: currentPrice,
      addedAt: addedAt,
      type: 'real'
    };
    
    logger.log(`💰 Buy price for ${symbol}: $${ticker.buyPrice}`);
    logger.log(`📅 Buy date for ${symbol}: ${ticker.buyDate}`);
    logger.log(`📊 Historical data points: ${historicalData.length}`);
    
    // If custom buy price/date provided, ensure we have that point in historical data
    if ((customBuyPrice !== null && !isNaN(Number(customBuyPrice))) || (customBuyDate && !isNaN(Date.parse(customBuyDate)))) {
      const customBuyPoint = {
        price: ticker.buyPrice,
        timestamp: ticker.buyDate,
        symbol: symbol
      };
      
      // Add custom buy point if it doesn't exist in historical data
      const buyPointExists = historicalData.some(point => 
        new Date(point.timestamp).getTime() === new Date(ticker.buyDate).getTime()
      );
      
      if (!buyPointExists) {
        historicalData.push(customBuyPoint);
        // Re-sort to maintain chronological order
        historicalData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        logger.log(`📊 Added custom buy point to historical data for ${symbol}`);
      }
    }
    
    const normalized = normalizeTicker(ticker);
    logger.log("✅ createTicker returning real ticker with 3-year historical data:", {
      symbol: normalized.symbol,
      buyPrice: normalized.buyPrice,
      buyDate: normalized.buyDate,
      historicalDataPoints: normalized.historicalData.length,
      dataRange: `${new Date(normalized.historicalData[0]?.timestamp).toISOString()} to ${new Date(normalized.historicalData[normalized.historicalData.length - 1]?.timestamp).toISOString()}`
    });
    
    return normalized;
  } catch (error) {
    logger.error(`❌ createTicker failed for ${symbol}:`, error);
    return null;
  }
}