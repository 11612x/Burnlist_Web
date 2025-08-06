import axios from 'axios';
import { logger } from '../utils/logger';

// Finviz API server endpoint - use Render.com API in production
const FINVIZ_API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://burnlist-api.onrender.com/api'
  : 'http://localhost:3001/api';

export async function fetchQuote(symbol, timeframe = 'd') {
  try {
    symbol = symbol.toUpperCase();
    const url = `${FINVIZ_API_BASE}/finviz-quote?ticker=${symbol}&timeframe=${timeframe}`;
    logger.fetch(`Finviz quote fetch for ${symbol}`, `timeframe: ${timeframe}`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    console.log(`📥 Raw Finviz data for ${symbol}:`, data);
    console.log(`📊 Data length: ${data.length} records`);
    if (data.length > 0) {
      console.log(`📊 First record:`, data[0]);
      console.log(`📊 Last record:`, data[data.length - 1]);
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(`❗ No data received for ${symbol}:`, data);
      return null;
    }

    // Convert Finviz CSV data to our format and only keep the latest data point
    const historicalData = data.map(row => {
      const date = row.Date || row.date;
      const price = parseFloat(row.Close || row.close || row.Price || row.price);
      
      if (!date || isNaN(price) || price <= 0) {
        console.warn(`⚠️ Invalid data point for ${symbol}:`, row);
        return null;
      }
      
      // Create timestamp with fetch time included
      const fetchTimestamp = new Date();
      const dataTimestamp = new Date(date);
      
      return {
        price: price,
        timestamp: dataTimestamp.toISOString(),
        fetchTimestamp: fetchTimestamp.toISOString(), // Track when this data was fetched
        symbol: symbol
      };
    }).filter(point => point !== null);

    if (historicalData.length === 0) {
      console.warn(`⚠️ No valid historical data for ${symbol}`);
      return null;
    }

    // Get the most recent data point (current market data)
    const currentPrice = historicalData[historicalData.length - 1].price;
    const marketTimestamp = historicalData[historicalData.length - 1].timestamp;
    
    console.log(`📡 fetchQuote → ${symbol}: $${currentPrice} @ ${marketTimestamp} (${historicalData.length} data points)`);

    // Return ticker with ALL historical data
    return {
      symbol,
      buyPrice: currentPrice, // Current market price as default
      buyDate: marketTimestamp, // Market timestamp as default
      historicalData: historicalData // ALL historical data points
    };
  } catch (error) {
    console.error(`❌ fetchQuote error for ${symbol}:`, error);
    
    // Log more details about the error
    if (error.response) {
      console.error(`❌ Server error for ${symbol}:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      console.error(`❌ Network error for ${symbol}:`, error.request);
    } else {
      console.error(`❌ Other error for ${symbol}:`, error.message);
    }
    
    return null;
  }
}

// Additional function to get historical data for different timeframes
export async function fetchHistoricalData(symbol, timeframe = 'd') {
  try {
    symbol = symbol.toUpperCase();
    const url = `${FINVIZ_API_BASE}/finviz-quote?ticker=${symbol}&timeframe=${timeframe}`;
    logger.fetch(`Finviz historical data fetch for ${symbol}`, `timeframe: ${timeframe}`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(`❗ No historical data received for ${symbol}:`, data);
      return null;
    }

    // Convert to our format
    const historicalData = data.map(row => {
      const date = row.Date || row.date;
      const price = parseFloat(row.Close || row.close || row.Price || row.price);
      
      if (!date || isNaN(price) || price <= 0) {
        return null;
      }
      
      // Create timestamp with fetch time included
      const fetchTimestamp = new Date();
      const dataTimestamp = new Date(date);
      
      return {
        price: price,
        timestamp: dataTimestamp.toISOString(),
        fetchTimestamp: fetchTimestamp.toISOString(), // Track when this data was fetched
        symbol: symbol
      };
    }).filter(point => point !== null);

    return historicalData;
  } catch (error) {
    console.error(`❌ fetchHistoricalData error for ${symbol}:`, error);
    return null;
  }
} 