import { fetchQuote } from '@data/finhubAdapter';

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
    const ticker = await fetchQuote(symbol);
    logger.log(`📥 fetchQuote result for ${symbol}:`, ticker ? 'success' : 'failed');
    
    if (!ticker || typeof ticker !== 'object' || !ticker.symbol || !ticker.historicalData) {
      logger.warn(`⚠️ Skipping ${symbol}: malformed ticker object`, ticker);
      return null;
    }
    
    logger.log(`✅ Valid ticker data received for ${symbol}, historicalData length: ${ticker.historicalData.length}`);
    
    // Set buy price: use custom price if provided, otherwise use current market price
    if (customBuyPrice !== null && !isNaN(Number(customBuyPrice))) {
      ticker.buyPrice = Number(customBuyPrice);
      logger.log(`💰 Using custom buy price for ${symbol}: $${ticker.buyPrice}`);
    } else {
      // Use current market price as buy price
      const latestDataPoint = ticker.historicalData[ticker.historicalData.length - 1];
      ticker.buyPrice = latestDataPoint.price;
      logger.log(`💰 Using current market price as buy price for ${symbol}: $${ticker.buyPrice}`);
    }
    
    // Set buy date: use custom date if provided, otherwise use current market date
    if (customBuyDate && !isNaN(Date.parse(customBuyDate))) {
      ticker.buyDate = customBuyDate;
      logger.log(`📅 Using custom buy date for ${symbol}: ${ticker.buyDate}`);
    } else {
      // Use current market date as buy date
      const latestDataPoint = ticker.historicalData[ticker.historicalData.length - 1];
      ticker.buyDate = latestDataPoint.timestamp;
      logger.log(`📅 Using current market date as buy date for ${symbol}: ${ticker.buyDate}`);
    }
    
    // Only create additional historical data points when custom buy price/date is provided
    if ((customBuyPrice !== null && !isNaN(Number(customBuyPrice))) || (customBuyDate && !isNaN(Date.parse(customBuyDate)))) {
      // Add buy point as first data point
      const buyPoint = {
        price: ticker.buyPrice,
        timestamp: ticker.buyDate,
        fetchTimestamp: new Date().toISOString(),
        symbol: symbol
      };
      
      // Current market point as second data point
      const currentPoint = ticker.historicalData[ticker.historicalData.length - 1];
      
      // Create historical data with both points
      ticker.historicalData = [buyPoint, currentPoint];
      logger.log(`📊 Created 2-point historical data for ${symbol}:`, ticker.historicalData);
    }
    // Otherwise, keep the single API data point as is
    
    ticker.addedAt = addedAt;
    ticker.type = 'real';
    const normalized = normalizeTicker(ticker);
    logger.log("✅ createTicker returning real:", normalized);
    return normalized;
  } catch (error) {
    logger.error(`❌ createTicker failed for ${symbol}:`, error);
    return null;
  }
}