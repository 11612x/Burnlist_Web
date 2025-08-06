import axios from 'axios';
import { logger } from '../utils/logger';

// Twelve Data API server endpoint
const TWELVE_DATA_API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api'
  : '/api';

/**
 * Fetch 3 years of historical data at 5-minute intervals for trading hours only
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Array>} Array of {timestamp, price} objects
 */
export async function fetchThreeYearHistoricalData(symbol) {
  try {
    symbol = symbol.toUpperCase();
    logger.log(`🌐 Fetching 3 years of 5-minute historical data for ${symbol}`);
    
    // Calculate date range: 3 years ago to now
    const now = new Date();
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    
    // Format dates for API
    const startDate = threeYearsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    const url = `${TWELVE_DATA_API_BASE}/twelvedata-historical?symbol=${symbol}&start_date=${startDate}&end_date=${endDate}&interval=5min&outputsize=5000`;
    
    logger.log(`📡 Requesting historical data: ${symbol} from ${startDate} to ${endDate} (5min intervals)`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (!data || data.status !== 'ok' || !data.historicalData) {
      logger.warn(`❗ No historical data received for ${symbol}:`, data);
      return [];
    }

    logger.log(`📥 Raw historical data for ${symbol}: ${data.historicalData.length} datapoints`);
    
    // Temporarily disable trading hours filter for debugging
    const tradingHoursData = data.historicalData.map(point => ({
      timestamp: point.timestamp,
      price: parseFloat(point.close || point.price),
      symbol: point.symbol
    }));
    
    logger.log(`📊 Processed ${tradingHoursData.length} datapoints for ${symbol} (trading hours filter disabled)`);
    
    return tradingHoursData;
  } catch (error) {
    logger.error(`❌ fetchThreeYearHistoricalData error for ${symbol}:`, error);
    return [];
  }
}

/**
 * Filter data to include only trading hours (9:30 AM - 4:00 PM ET, Mon-Fri)
 * @param {Array} historicalData - Raw historical data from API
 * @returns {Array} Filtered data with only trading hours
 */
function filterTradingHoursOnly(historicalData) {
  const tradingHoursData = [];
  
  historicalData.forEach(point => {
    const timestamp = new Date(point.timestamp);
    
    // Convert to Eastern Time
    const easternTime = new Date(timestamp.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dayOfWeek = easternTime.getDay();
    const hour = easternTime.getHours();
    const minute = easternTime.getMinutes();
    
    // Check if it's a trading day (Monday = 1, Friday = 5)
    const isTradingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    // Check if it's during trading hours (9:30 AM - 4:00 PM ET)
    const isTradingHour = (hour === 9 && minute >= 30) || (hour >= 10 && hour < 16) || (hour === 16 && minute === 0);
    
    if (isTradingDay && isTradingHour) {
      // Accept any 5-minute interval data (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
      const minuteOfDay = hour * 60 + minute;
      if (minuteOfDay % 5 === 0) {
        tradingHoursData.push({
          timestamp: point.timestamp,
          price: parseFloat(point.close || point.price),
          symbol: point.symbol
        });
      }
    }
  });
  
  // Sort by timestamp to ensure chronological order
  tradingHoursData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Remove duplicates based on timestamp
  const uniqueData = [];
  const seenTimestamps = new Set();
  
  tradingHoursData.forEach(point => {
    const timestampKey = point.timestamp;
    if (!seenTimestamps.has(timestampKey)) {
      seenTimestamps.add(timestampKey);
      uniqueData.push(point);
    }
  });
  
  logger.log(`🔍 Filtered ${historicalData.length} raw points to ${uniqueData.length} unique trading hours points`);
  
  return uniqueData;
}

/**
 * Validate that data points are properly spaced at 5-minute intervals
 * @param {Array} historicalData - Historical data array
 * @returns {boolean} True if data is properly spaced
 */
export function validateFiveMinuteSpacing(historicalData) {
  if (historicalData.length < 2) return true;
  
  for (let i = 1; i < historicalData.length; i++) {
    const prevTime = new Date(historicalData[i - 1].timestamp);
    const currTime = new Date(historicalData[i].timestamp);
    const diffMinutes = (currTime - prevTime) / (1000 * 60);
    
    // Allow for small variations (4-6 minutes) due to market data timing
    if (diffMinutes < 4 || diffMinutes > 6) {
      logger.warn(`⚠️ Irregular spacing detected: ${diffMinutes.toFixed(1)} minutes between points ${i-1} and ${i}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Find the closest 5-minute timestamp within tolerance window
 * @param {Array} historicalData - Sorted historical data array
 * @param {Date} targetTime - Target timestamp
 * @param {number} toleranceMinutes - Tolerance window in minutes (default: 5)
 * @returns {Object|null} Closest data point or null if outside tolerance
 */
export function findClosestFiveMinutePoint(historicalData, targetTime, toleranceMinutes = 5) {
  if (!historicalData || historicalData.length === 0) return null;
  
  const targetTimestamp = targetTime.getTime();
  let closestPoint = null;
  let smallestDiff = Infinity;
  
  historicalData.forEach(point => {
    const pointTime = new Date(point.timestamp).getTime();
    const diff = Math.abs(pointTime - targetTimestamp);
    
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestPoint = point;
    }
  });
  
  // Check if the closest point is within tolerance
  const diffMinutes = smallestDiff / (1000 * 60);
  if (diffMinutes <= toleranceMinutes) {
    return closestPoint;
  }
  
  return null; // Outside tolerance window
}

/**
 * Generate 5-minute aligned timestamps for a given timeframe
 * @param {string} timeframe - Timeframe (D, W, M, YTD, MAX)
 * @param {Date} now - Current time
 * @returns {Array} Array of 5-minute aligned timestamps
 */
export function generateFiveMinuteTimestamps(timeframe, now = new Date()) {
  const timestamps = [];
  const fiveMinutesMs = 5 * 60 * 1000;
  
  let startTime, endTime;
  
  switch (timeframe) {
    case 'D':
      // Last 24 hours of trading data
      endTime = new Date(now);
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'W':
      // Last 7 days of trading data
      endTime = new Date(now);
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'M':
      // Last 30 days of trading data
      endTime = new Date(now);
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'YTD':
      // Year to date
      endTime = new Date(now);
      startTime = new Date(now.getFullYear(), 0, 1); // January 1st
      break;
    case 'MAX':
      // Use all available data
      endTime = new Date(now);
      startTime = new Date(now.getFullYear() - 3, 0, 1); // 3 years ago
      break;
    default:
      return [];
  }
  
  // Align to 5-minute intervals
  const alignedStartTime = new Date(Math.floor(startTime.getTime() / fiveMinutesMs) * fiveMinutesMs);
  const alignedEndTime = new Date(Math.floor(endTime.getTime() / fiveMinutesMs) * fiveMinutesMs);
  
  let currentTime = new Date(alignedStartTime);
  
  while (currentTime <= alignedEndTime) {
    // Only include trading hours (9:30 AM - 4:00 PM ET)
    const easternTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dayOfWeek = easternTime.getDay();
    const hour = easternTime.getHours();
    const minute = easternTime.getMinutes();
    
    const isTradingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isTradingHour = (hour === 9 && minute >= 30) || (hour >= 10 && hour < 16) || (hour === 16 && minute === 0);
    
    if (isTradingDay && isTradingHour) {
      timestamps.push(currentTime.getTime());
    }
    
    currentTime.setTime(currentTime.getTime() + fiveMinutesMs);
  }
  
  return timestamps;
} 