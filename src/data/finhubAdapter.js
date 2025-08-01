import axios from 'axios';
import { logger } from '../utils/logger';

// Use environment variable for API key
const API_KEY = import.meta.env.VITE_FINHUB_API_KEY || 'd1leaapr01qt4thfm1a0d1leaapr01qt4thfm1ag'; // Fallback for development

export async function fetchQuote(symbol, timeframe = 'd') {
  try {
    symbol = symbol.toUpperCase();
    
    logger.info(`🌐 Requesting Finnhub quote for symbol: ${symbol}`);
    
    // Get current quote only
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
    const quoteResponse = await axios.get(quoteUrl);
    const quoteData = quoteResponse.data;
    
    if (!quoteData || typeof quoteData.c !== 'number' || typeof quoteData.t !== 'number') {
      logger.warn(`❗ Invalid quote data for ${symbol}:`, quoteData);
      return null;
    }
    
    const currentPrice = Number(quoteData.c);
    const marketTimestamp = new Date(Number(quoteData.t) * 1000).toISOString();
    const fetchTimestamp = new Date().toISOString();
    
    logger.info(`📡 fetchQuote → ${symbol}: $${currentPrice} @ ${marketTimestamp}`);
    
    // Create a more detailed historical data point with additional context
    const historicalDataPoint = {
      price: currentPrice,
      timestamp: marketTimestamp,
      fetchTimestamp: fetchTimestamp,
      symbol: symbol,
      volume: quoteData.v || 0,
      high: quoteData.h || currentPrice,
      low: quoteData.l || currentPrice,
      open: quoteData.o || currentPrice,
      previousClose: quoteData.pc || currentPrice
    };
    
    return {
      symbol,
      buyPrice: currentPrice,
      buyDate: marketTimestamp,
      historicalData: [historicalDataPoint]
    };
  } catch (error) {
    // Rate limiting (429) is expected, log as debug
    if (error.response && error.response.status === 429) {
      logger.debug(`⏳ Rate limited for ${symbol} (429) - this is expected`);
    } else {
      logger.error(`❌ fetchQuote error for ${symbol}:`, error);
      if (error.response) {
        logger.error(`❌ Server error for ${symbol}:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        logger.error(`❌ Network error for ${symbol}:`, error.request);
      } else {
        logger.error(`❌ Other error for ${symbol}:`, error.message);
      }
    }
    return null;
  }
}

export async function fetchHistoricalData(symbol, from, to) {
  // This function is kept for compatibility but returns null
  // Historical data should only come from manual entries
  logger.log(`⚠️ fetchHistoricalData called for ${symbol} - historical data should be manual only`);
  return null;
}
