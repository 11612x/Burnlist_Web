import { fetchQuote } from '@data/finhubAdapter';
import { logger } from '../utils/logger';
import normalizeTicker from '@data/normalizeTicker';

// Merge historical data arrays, removing duplicates and sorting by timestamp
function mergeHistoricalData(existingData, newData) {
  // Create a map of existing data by timestamp for quick lookup
  const existingMap = new Map();
  existingData.forEach(point => {
    const key = new Date(point.timestamp).toISOString().split('T')[0]; // Date only
    existingMap.set(key, point);
  });
  
  // Add new data, overwriting existing entries with same date
  newData.forEach(point => {
    const key = new Date(point.timestamp).toISOString().split('T')[0]; // Date only
    existingMap.set(key, point);
  });
  
  // Convert back to array and sort by timestamp
  const merged = Array.from(existingMap.values()).sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  return merged;
}

/**
 * Refreshes all real tickers in a watchlist by fetching their latest price
 * and appending it to historicalData.
 *
 * @param {Array} items - Array of ticker objects
 * @param {Function} updateFn - Function to call with updated items (e.g., setWatchlists or setItems)
 */
export async function refreshWatchlistData(items, updateFn) {
  const updatedItems = await Promise.all(
    items.map(async (item) => {
      if (item.type !== 'real') return item;

      try {
        const newTicker = await fetchQuote(item.symbol);
        logger.log(`📡 Raw quote from API for ${item.symbol}:`, newTicker);
        
        // Validate that we got a proper ticker object
        if (!newTicker || typeof newTicker !== 'object' || !newTicker.historicalData || newTicker.historicalData.length === 0) {
          logger.debug(`⚠️ Skipping ${item.symbol} due to invalid ticker object:`, newTicker);
          return item;
        }

        // Get ALL historical data from Finviz
        const newHistoricalData = newTicker.historicalData;
        
        if (!newHistoricalData || newHistoricalData.length === 0) {
          logger.warn(`⚠️ Skipping ${item.symbol} due to no historical data`);
          return item;
        }

        // Merge new historical data with existing data
        const existingHistoricalData = item.historicalData || [];
        const mergedHistoricalData = mergeHistoricalData(existingHistoricalData, newHistoricalData);
        
        logger.log(`📊 ${item.symbol}: Merged ${existingHistoricalData.length} existing + ${newHistoricalData.length} new = ${mergedHistoricalData.length} total data points`);

        // Filter out any data points before the buy date
        const buyDate = new Date(item.buyDate);
        const filteredHistoricalData = mergedHistoricalData.filter(point => {
          const pointDate = new Date(point.timestamp);
          return pointDate >= buyDate;
        });

        const updatedTicker = {
          ...item,
          historicalData: filteredHistoricalData,
        };

        const normalized = {
          ...normalizeTicker(updatedTicker),
          buyPrice: item.buyPrice,
          buyDate: item.buyDate,
          type: item.type,
  
          addedAt: item.addedAt,
        };
        logger.log(`✅ Final normalized item for ${item.symbol}:`, normalized);
        return normalized;
      } catch (err) {
        logger.error(`❌ Error refreshing ${item.symbol}:`, err);
        return item;
      }
    })
  );

  if (typeof updateFn === 'function') {
    updateFn(updatedItems);
  } else {
    return updatedItems;
  }
}
