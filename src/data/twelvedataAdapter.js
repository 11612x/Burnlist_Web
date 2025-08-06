import axios from 'axios';
import { logger } from '../utils/logger';

// Twelve Data API server endpoint - use main server in development
const TWELVE_DATA_API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api'
  : '/api';

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
    logger.fetch(`Quote fetch for ${symbol}`, `timeframe: ${timeframe}, interval: ${interval}`);
    
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
    
    // Format dates for API - handle both Date objects and ISO strings
    const startDateStr = startDate instanceof Date ? startDate.toISOString() : startDate;
    const endDateStr = endDate ? (endDate instanceof Date ? endDate.toISOString() : endDate) : null;
    
    let url = `${TWELVE_DATA_API_BASE}/twelvedata-historical?symbol=${symbol}&start_date=${startDateStr}&interval=${interval}`;
    if (endDateStr) {
      url += `&end_date=${endDateStr}`;
    }
    if (outputSize && Number.isInteger(outputSize) && outputSize > 0) {
      url += `&outputsize=${outputSize}`;
    }
    // Add cache-busting parameter to force fresh data
    url += `&_t=${Date.now()}`;
    
    logger.fetch(`Historical data fetch for ${symbol}`, `from ${startDateStr} to ${endDateStr || 'now'} (interval: ${interval}${outputSize ? `, outputsize: ${outputSize}` : ''})`);
    
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
    logger.fetch(`Batch quote fetch for ${symbols.length} symbols`, `${symbolString} (interval: ${interval})`);
    
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

// Fetch batch historical data for multiple symbols
export async function fetchBatchHistoricalData(symbols, startDate, endDate = null, interval = '1day', outputSize = null) {
  try {
    const symbolString = symbols.map(s => s.toUpperCase()).join(', ');
    
    // Format dates for API - handle both Date objects and ISO strings
    const startDateStr = startDate instanceof Date ? startDate.toISOString() : startDate;
    const endDateStr = endDate ? (endDate instanceof Date ? endDate.toISOString() : endDate) : null;
    
    let url = `${TWELVE_DATA_API_BASE}/twelvedata-historical?symbols=${symbolString}&start_date=${startDateStr}&interval=${interval}`;
    if (endDateStr) {
      url += `&end_date=${endDateStr}`;
    }
    if (outputSize && Number.isInteger(outputSize) && outputSize > 0) {
      url += `&outputsize=${outputSize}`;
    }
    // Add cache-busting parameter to force fresh data
    url += `&_t=${Date.now()}`;
    
    logger.info(`🌐 Requesting Twelve Data batch historical data for symbols: ${symbolString} from ${startDateStr} to ${endDateStr || 'now'} (interval: ${interval}${outputSize ? `, outputsize: ${outputSize}` : ''})`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    logger.log(`📥 Raw Twelve Data batch historical data:`, data);
    
    if (!data || data.status !== 'ok' || !data.historicalData) {
      logger.warn(`❗ No batch historical data received:`, data);
      return {};
    }

    logger.log(`📡 fetchBatchHistoricalData → ${symbols.length} symbols processed`);
    
    // Group historical data by symbol
    const groupedData = {};
    data.historicalData.forEach(item => {
      if (!groupedData[item.symbol]) {
        groupedData[item.symbol] = [];
      }
      groupedData[item.symbol].push({
        price: item.close || item.price,
        timestamp: item.timestamp,
        fetchTimestamp: new Date().toISOString(),
        symbol: item.symbol
      });
    });

    return groupedData;
  } catch (error) {
    logger.error(`❌ fetchBatchHistoricalData error:`, error);
    
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
    
    return {};
  }
}

// Fetch combined batch data (quotes + historical) for multiple symbols
export async function fetchBatchMarketData(symbols, startDate, endDate = null, interval = '1day', outputSize = null) {
  try {
    const symbolString = symbols.map(s => s.toUpperCase()).join(', ');
    
    // Format dates for API - handle both Date objects and ISO strings
    const startDateStr = startDate instanceof Date ? startDate.toISOString() : startDate;
    const endDateStr = endDate ? (endDate instanceof Date ? endDate.toISOString() : endDate) : null;
    
    let url = `${TWELVE_DATA_API_BASE}/twelvedata-market-data?symbols=${symbolString}&start_date=${startDateStr}&interval=${interval}`;
    if (endDateStr) {
      url += `&end_date=${endDateStr}`;
    }
    if (outputSize && Number.isInteger(outputSize) && outputSize > 0) {
      url += `&outputsize=${outputSize}`;
    }
    // Add cache-busting parameter to force fresh data
    url += `&_t=${Date.now()}`;
    
    logger.info(`🌐 Requesting Twelve Data market data for symbols: ${symbolString} from ${startDateStr} to ${endDateStr || 'now'} (interval: ${interval}${outputSize ? `, outputsize: ${outputSize}` : ''})`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    logger.log(`📥 Raw Twelve Data market data:`, data);
    
    if (!data || data.status !== 'ok') {
      logger.warn(`❗ No market data received:`, data);
      return { quotes: {}, historical: {} };
    }

    logger.log(`📡 fetchBatchMarketData → ${symbols.length} symbols processed`);
    
    // Historical data is already organized by symbol from the server
    const historical = data.historicalData || {};

    return { quotes: data.quotes || {}, historicalData: historical };
  } catch (error) {
    logger.error(`❌ fetchBatchMarketData error:`, error);
    
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
    
    return { quotes: {}, historical: {} };
  }
} 

// Fetch market overview data for major indices using NAV-style logic, but always use latest quote for current price
export async function fetchMarketOverview(timeframe = '1day') {
  try {
    const indices = [
      { symbol: 'SPY', name: 'SP500' },
      { symbol: 'QQQ', name: 'NASDAQ' },
      { symbol: 'DIA', name: 'DOW' },
      { symbol: 'UVXY', name: 'VIX' }
    ];

    // Map timeframe to days back
    const timeframeMap = {
      '1day': 1,
      '1week': 7,
      '1month': 30,
      '3month': 90,
      '6month': 180,
      '1year': 365
    };
    const daysBack = timeframeMap[timeframe] || 1;

    const now = new Date();
    let startDate;
    
    // Helper function to get the last trading day (weekdays only, excluding major holidays)
    const getLastTradingDay = (date) => {
      const tradingDay = new Date(date);
      const dayOfWeek = tradingDay.getDay();
      
      // If it's weekend, go back to Friday
      if (dayOfWeek === 0) { // Sunday
        tradingDay.setDate(tradingDay.getDate() - 2);
      } else if (dayOfWeek === 6) { // Saturday
        tradingDay.setDate(tradingDay.getDate() - 1);
      }
      
      // Set to market close time (4 PM EST = 9 PM UTC)
      tradingDay.setUTCHours(21, 0, 0, 0);
      return tradingDay;
    };
    
    // Get current trading day as reference point
    const currentTradingDay = getLastTradingDay(now);
    let lastTradingDay = currentTradingDay; // Default end date
    
    if (timeframe === 'yearToDate') {
      // YTD: Start from January 1st of current year
      startDate = new Date(now.getFullYear(), 0, 1); // January 1st
    } else if (timeframe === '1day') {
      // For daily data, use previous trading day as start
      const previousTradingDay = new Date(currentTradingDay);
      previousTradingDay.setDate(previousTradingDay.getDate() - 1);
      startDate = getLastTradingDay(previousTradingDay);
      // Ensure we have different start and end dates
      if (startDate.getTime() === lastTradingDay.getTime()) {
        // If they're the same, go back one more day
        const twoDaysAgo = new Date(currentTradingDay);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        startDate = getLastTradingDay(twoDaysAgo);
      }
    } else if (timeframe === '1week') {
      // Week: Go back ~10 calendar days to ensure 7 trading days
      const weekAgo = new Date(currentTradingDay.getTime() - (10 * 24 * 60 * 60 * 1000));
      startDate = getLastTradingDay(weekAgo);
    } else if (timeframe === '1month') {
      // Month: Go back ~32 calendar days to ensure 22 trading days
      const monthAgo = new Date(currentTradingDay.getTime() - (32 * 24 * 60 * 60 * 1000));
      startDate = getLastTradingDay(monthAgo);
    } else if (timeframe === '3month') {
      // Quarter: Go back ~95 calendar days to ensure 65 trading days
      const quarterAgo = new Date(currentTradingDay.getTime() - (95 * 24 * 60 * 60 * 1000));
      startDate = getLastTradingDay(quarterAgo);
    } else {
      // Default: Calculate days back from current trading day
      const calculatedDate = new Date(currentTradingDay.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      startDate = getLastTradingDay(calculatedDate);
    }
    
    // Ensure start and end dates are different
    if (startDate.getTime() === lastTradingDay.getTime()) {
      logger.warn(`⚠️ Start and end dates are the same, adjusting start date`);
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
      startDate = getLastTradingDay(adjustedStartDate);
    }
    
    logger.info(`📅 Date calculation debug:`);
    logger.info(`  - Now: ${now.toISOString()}`);
    logger.info(`  - Current trading day: ${currentTradingDay.toISOString()}`);
    logger.info(`  - Timeframe: ${timeframe}, daysBack: ${daysBack}`);
    logger.info(`  - Start date: ${startDate.toISOString()}`);
    logger.info(`  - End date: ${lastTradingDay.toISOString()}`);
    logger.info(`  - Date range: ${Math.round((lastTradingDay - startDate) / (1000 * 60 * 60 * 24))} days`);
    logger.info(`  - Expected period: ${timeframe === 'yearToDate' ? 'YTD' : timeframe === '1day' ? '1 day' : `${daysBack} days`}`);

    const marketData = {};

    // Single batch fetch for all market data (quotes + historical)
    const symbols = indices.map(index => index.symbol);
    
    // Use appropriate outputsize based on timeframe
    let outputSize;
    if (timeframe === 'yearToDate') {
      outputSize = 180; // Safe buffer for YTD
    } else if (timeframe === '1day') {
      outputSize = 2; // Just need start and end
    } else if (timeframe === '1week') {
      outputSize = 7; // 7 trading days
    } else if (timeframe === '1month') {
      outputSize = 22; // ~22 trading days
    } else if (timeframe === '3month') {
      outputSize = 65; // ~65 trading days
    } else {
      outputSize = 10; // Default
    }
    
    logger.log(`🌐 Batch fetching market data for symbols: ${symbols.join(', ')}`);
    const batchMarketData = await fetchBatchMarketData(
      symbols,
      startDate.toISOString(),
      lastTradingDay.toISOString(),
      '1day',
      outputSize
    );

    // Process each index with batched data
    for (const index of indices) {
      try {
        // Get current price from batch quotes
        const currentPriceData = batchMarketData.quotes[index.symbol] || { price: 0, timestamp: null };
        const currentPrice = currentPriceData.price;
        const currentTimestamp = currentPriceData.timestamp;
        
        logger.log(`🔍 Debug ${index.symbol}:`, {
          symbol: index.symbol,
          currentPriceData,
          currentPrice,
          currentTimestamp,
          quotesKeys: Object.keys(batchMarketData.quotes || {})
        });
        
        // Get historical data for this symbol from batch
        const historicalData = batchMarketData.historicalData[index.symbol] || [];
        
        logger.log(`📊 ${index.symbol} quote data:`);
        logger.log(`  - Quote price: $${currentPrice} at ${currentTimestamp}`);
        
        // Get start price based on timeframe
        let startPrice = null;
        let startTimestamp = null;
        
        if (historicalData.length >= 1) {
          // Use last entry as start price (beginning of period) - API returns newest first
          startPrice = historicalData[historicalData.length - 1].price;
          startTimestamp = historicalData[historicalData.length - 1].timestamp;
          
          logger.log(`📊 ${index.symbol} period data (${historicalData.length} entries):`);
          logger.log(`  - First entry (start): $${startPrice} at ${startTimestamp}`);
          logger.log(`  - Last entry (current): $${currentPrice} at ${currentTimestamp}`);
          logger.log(`  - Return calculation: (${currentPrice} - ${startPrice}) / ${startPrice} × 100`);
        } else {
          // No historical data - use current price for both
          startPrice = currentPrice;
          startTimestamp = currentTimestamp;
          logger.warn(`⚠️ No historical data for ${index.symbol}, using current price for both start and current`);
        }
        
        // Ensure prices are numbers
        const startPriceNum = parseFloat(startPrice) || 0;
        const currentPriceNum = parseFloat(currentPrice) || 0;
        
        const priceChange = currentPriceNum - startPriceNum;
        const percentageChange = startPriceNum !== 0 ? ((currentPriceNum - startPriceNum) / startPriceNum) * 100 : 0;
        
        // Debug logging
        logger.log(`📊 ${index.name} calculation:`);
        logger.log(`  - Start price: $${startPriceNum} (${typeof startPriceNum})`);
        logger.log(`  - Current price: $${currentPriceNum} (${typeof currentPriceNum})`);
        logger.log(`  - Price change: $${priceChange}`);
        logger.log(`  - Percentage change: ${percentageChange}%`);
        logger.log(`  - Calculation: ((${currentPriceNum} - ${startPriceNum}) / ${startPriceNum}) * 100 = ${percentageChange}%`);
        
        // Validate data before returning
        if (currentPriceNum === 0 || startPriceNum === 0) {
          logger.warn(`⚠️ Invalid price data for ${index.symbol}: current=${currentPriceNum}, start=${startPriceNum}`);
        }
        
        marketData[index.name.toLowerCase()] = {
          name: index.name,
          symbol: index.symbol,
          price: currentPriceNum, // Always the current/latest price
          change: priceChange,
          changePercent: percentageChange,
          timestamp: currentTimestamp,
          startPrice: startPriceNum,
          startTimestamp
        };
      } catch (error) {
        logger.error(`❌ Error fetching NAV-style data for ${index.symbol}:`, error);
      }
    }
    return marketData;
  } catch (error) {
    logger.error(`❌ fetchMarketOverview error:`, error);
    return {};
  }
} 