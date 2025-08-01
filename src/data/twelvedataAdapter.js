import axios from 'axios';
import { logger } from '../utils/logger';

// Twelve Data API server endpoint - use same domain in production
const TWELVE_DATA_API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api'
  : 'http://localhost:3002/api';

// Map timeframe to Twelve Data interval format
function mapTimeframeToInterval(timeframe) {
  const mapping = {
    'd': '1day',
    'w': '1week', 
    'm': '1month',
    '1min': '1min',
    '5min': '5min',
    '15min': '15min',
    '30min': '30min',
    '1h': '1h',
    '1day': '1day',
    '1week': '1week',
    '1month': '1month'
  };
  return mapping[timeframe] || '1min';
}

export async function fetchQuote(symbol, timeframe = '1min') {
  try {
    symbol = symbol.toUpperCase();
    const interval = mapTimeframeToInterval(timeframe);
    const url = `${TWELVE_DATA_API_BASE}/twelvedata-quote?symbols=${symbol}&interval=${interval}`;
    logger.info(`🌐 Requesting Twelve Data quote for symbol: ${symbol} (interval: ${interval}, original timeframe: ${timeframe})`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    logger.log(`📥 Raw Twelve Data data for ${symbol}:`, data);
    logger.log(`📊 Data length: ${data.length} records`);
    if (data.length > 0) {
      logger.log(`📊 First record:`, data[0]);
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      logger.warn(`❗ No data received for ${symbol}:`, data);
      return null;
    }

    // Get the first (and should be only) result for this symbol
    const symbolData = data.find(item => item.symbol === symbol);
    if (!symbolData) {
      logger.warn(`❗ No data found for ${symbol} in response`);
      return null;
    }

    logger.log(`📡 fetchQuote → ${symbol}: $${symbolData.price} @ ${symbolData.timestamp}`);

    // Return ticker with historical data point
    return {
      symbol,
      buyPrice: symbolData.price, // Current market price as default
      buyDate: symbolData.timestamp, // Market timestamp as default
      historicalData: [{
        price: symbolData.price,
        timestamp: symbolData.timestamp,
        fetchTimestamp: symbolData.fetchTimestamp,
        symbol: symbol
      }]
    };
  } catch (error) {
    logger.error(`❌ fetchQuote error for ${symbol}:`, error);
    
    // Log more details about the error
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
    
    return null;
  }
}

// Fetch historical data for a symbol with date range
export async function fetchHistoricalData(symbol, startDate, endDate = null, interval = '1h', outputSize = null) {
  try {
    symbol = symbol.toUpperCase();
    
    // Format dates for API
    const startDateStr = new Date(startDate).toISOString();
    const endDateStr = endDate ? new Date(endDate).toISOString() : null;
    
    let url = `${TWELVE_DATA_API_BASE}/twelvedata-historical?symbol=${symbol}&start_date=${startDateStr}&interval=${interval}`;
    if (endDateStr) {
      url += `&end_date=${endDateStr}`;
    }
    if (outputSize && Number.isInteger(outputSize) && outputSize > 0) {
      url += `&outputsize=${outputSize}`;
    }
    
    logger.info(`🌐 Requesting Twelve Data historical data for symbol: ${symbol} from ${startDateStr} to ${endDateStr || 'now'} (interval: ${interval}${outputSize ? `, outputsize: ${outputSize}` : ''})`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    logger.log(`📥 Raw Twelve Data historical data for ${symbol}:`, data);
    
    if (!data || data.status !== 'ok' || !data.historicalData) {
      logger.warn(`❗ No historical data received for ${symbol}:`, data);
      return null;
    }

    logger.log(`📡 fetchHistoricalData → ${symbol}: ${data.historicalData.length} datapoints`);
    
    // Log the latest price from historical data
    if (data.historicalData.length > 0) {
      const latestPoint = data.historicalData[data.historicalData.length - 1];
      logger.log(`💰 Latest Historical Data for ${symbol}:`, {
        price: latestPoint.price,
        close: latestPoint.close,
        open: latestPoint.open,
        high: latestPoint.high,
        low: latestPoint.low,
        timestamp: latestPoint.timestamp,
        fullPoint: latestPoint
      });
    }

    // Return ticker with historical data (but don't set buyPrice - let the caller handle that)
    return {
      symbol,
      // Don't set buyPrice here - let the caller preserve the original
      historicalData: data.historicalData.map(item => {
        // Use close price if available, otherwise fall back to price
        const priceToUse = item.close || item.price;
        return {
          price: priceToUse,
          timestamp: item.timestamp,
          fetchTimestamp: new Date().toISOString(),
          symbol: symbol
        };
      })
    };
  } catch (error) {
    logger.error(`❌ fetchHistoricalData error for ${symbol}:`, error);
    
    // Log more details about the error
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
    
    return null;
  }
}

// Fetch multiple symbols in a single API call
export async function fetchBatchQuotes(symbols, timeframe = '1min') {
  try {
    const symbolString = symbols.map(s => s.toUpperCase()).join(', ');
    const interval = mapTimeframeToInterval(timeframe);
    const url = `${TWELVE_DATA_API_BASE}/twelvedata-quote?symbols=${symbolString}&interval=${interval}`;
    logger.log(`🌐 Requesting Twelve Data batch quote for symbols: ${symbolString} (interval: ${interval}, original timeframe: ${timeframe})`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    logger.log(`📥 Raw Twelve Data batch data:`, data);
    logger.log(`📊 Data length: ${data.length} records`);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      logger.warn(`❗ No batch data received:`, data);
      return [];
    }

    // Convert to ticker format
    const results = data.map(symbolData => {
      logger.log(`💰 API Response for ${symbolData.symbol}:`, {
        symbol: symbolData.symbol,
        price: symbolData.price,
        close: symbolData.close,
        open: symbolData.open,
        high: symbolData.high,
        low: symbolData.low,
        timestamp: symbolData.timestamp,
        fullResponse: symbolData
      });
      
      // Use close price if available, otherwise fall back to price
      const priceToUse = symbolData.close || symbolData.price;
      
      return {
        symbol: symbolData.symbol,
        buyPrice: priceToUse,
        buyDate: symbolData.timestamp,
        historicalData: [{
          price: priceToUse,
          timestamp: symbolData.timestamp,
          fetchTimestamp: symbolData.fetchTimestamp,
          symbol: symbolData.symbol
        }]
      };
    });

    logger.log(`📡 fetchBatchQuotes → ${results.length} symbols processed`);
    return results;
  } catch (error) {
    logger.error(`❌ fetchBatchQuotes error:`, error);
    
    if (error.response) {
      logger.error(`❌ Server error:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      logger.error(`❌ Network error:`, error.request);
    } else {
      logger.error(`❌ Other error:`, error.message);
    }
    
    return [];
  }
} 