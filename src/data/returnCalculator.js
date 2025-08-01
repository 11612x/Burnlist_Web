import { logger } from '../utils/logger';

class ReturnCalculator {
  constructor() {
    this.notificationCallback = null;
  }

  // Set notification callback for UI updates
  setNotificationCallback(callback) {
    this.notificationCallback = callback;
  }

  // Calculate average return for an entire watchlist using timeframe-based logic
  calculateWatchlistReturn(items, timeframe = 'MAX') {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        return null;
      }

      let totalReturn = 0;
      let validItems = 0;

      items.forEach(item => {
        // Basic validation - ensure we have historical data and buy price
        if (!item.historicalData || !Array.isArray(item.historicalData) || item.historicalData.length === 0) {
          logger.warn(`⚠️ Skipping ${item.symbol}: no historical data`);
          return;
        }
        
        if (!item.buyPrice || item.buyPrice <= 0) {
          logger.warn(`⚠️ Skipping ${item.symbol}: invalid buy price`);
          return;
        }

        // Use the same clean logic as TickerTable
        const validBuyDate = item.buyDate && new Date(item.buyDate).toString() !== 'Invalid Date' ? item.buyDate : null;
        
        let startPoint, endPoint;
        
        if (timeframe === 'MAX') {
          // MAX timeframe: Always use stored buyPrice vs current price (investment logic)
          const { startPoint: sp, endPoint: ep } = this.getSlicedDataLocal(item.historicalData, timeframe, validBuyDate, item.symbol, item.buyPrice);
          startPoint = sp;
          endPoint = ep;
        } else {
          // Other timeframes: Always use timeframe start price, ignore custom buy dates (performance window logic)
          const { startPoint: sp, endPoint: ep } = this.getSlicedDataLocal(item.historicalData, timeframe, null, item.symbol, null);
          startPoint = sp;
          endPoint = ep;
        }
        
        if (!startPoint || !endPoint || typeof startPoint.price !== "number" || startPoint.price <= 0) {
          logger.warn(`⚠️ Skipping ${item.symbol}: invalid price points`);
          return;
        }

        // Use currentPrice if available (from auto-fetch), otherwise use endPoint price
        // NEVER fall back to buyPrice as current price - that makes no sense!
        let currentPrice;
        if (typeof item.currentPrice === 'number') {
          currentPrice = item.currentPrice;
        } else if (endPoint && typeof endPoint.price === 'number') {
          currentPrice = endPoint.price;
        } else {
          logger.warn(`⚠️ No valid current price found for ${item.symbol}, skipping from watchlist average`);
          return; // Skip this ticker
        }
        
        // Calculate return percentage using same logic as individual ticker calculations
        let referencePrice;
        if (timeframe === 'MAX') {
          // MAX timeframe: Always use stored buyPrice as reference
          referencePrice = item.buyPrice;
        } else {
          // Other timeframes: Use timeframe start price as reference
          referencePrice = startPoint.price;
        }
        const returnPercent = ((currentPrice - referencePrice) / referencePrice) * 100;
        
        if (Number.isFinite(returnPercent)) {
          totalReturn += returnPercent;
          validItems++;
          logger.debug(`[Watchlist Calc] ${item.symbol}: referencePrice=${referencePrice}, currentPrice=${currentPrice}, return=${returnPercent.toFixed(2)}% (timeframe: ${timeframe})`);
        } else {
          logger.warn(`⚠️ Skipping ${item.symbol}: invalid return calculation`);
        }
      });

      if (validItems === 0) {
        logger.warn('⚠️ No valid items for watchlist return calculation');
        return null;
      }

      const averageReturn = totalReturn / validItems;
      logger.debug(`Watchlist average return (${timeframe}): ${averageReturn.toFixed(2)}% (${validItems}/${items.length} valid tickers)`);
      
      return Number.isFinite(averageReturn) ? averageReturn : null;
    } catch (error) {
      logger.error('❌ Error calculating watchlist return:', error);
      return null;
    }
  }

  // Get the start time for a given timeframe (matching specification)
  getTimeframeStartTime(timeframe, now = new Date()) {
    switch (timeframe) {
      case 'D':
        // Daily = previous trading day at midnight (not 24 hours ago)
        const prevDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        prevDay.setHours(0, 0, 0, 0);
        return prevDay;
      case 'W':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'M':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'YTD':
        return new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
      case 'MAX':
      default:
        return null; // Use buy date
    }
  }

  // Find historical price closest to target time
  findClosestHistoricalPrice(historicalData, targetTime) {
    if (!historicalData || historicalData.length === 0) {
      return null;
    }

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

    return closestPoint;
  }

  // Calculate returns for a burnlist with new prices
  calculateReturnsForBurnlist(burnlist, newPrices) {
    try {
      const updatedItems = burnlist.items.map(item => {
        const newPrice = newPrices.find(price => price.symbol === item.symbol);
        
        if (newPrice) {
          // Update current price
          item.currentPrice = newPrice.price;
          
          // Calculate return percentage using close price
          if (item.buyPrice && item.buyPrice > 0) {
            item.returnPercent = ((newPrice.price - item.buyPrice) / item.buyPrice) * 100;
            item.returnDollar = newPrice.price - item.buyPrice;
          }
          
          // Add close price datapoint to historical data
          if (!item.historicalData) {
            item.historicalData = [];
          }
          
          item.historicalData.push({
            price: newPrice.price,  // Close price only
            timestamp: newPrice.timestamp,
            fetchTimestamp: newPrice.fetchTimestamp
          });
          
          // Keep only last 100 datapoints
          if (item.historicalData.length > 100) {
            item.historicalData = item.historicalData.slice(-100);
          }
        }
        
        return item;
      });
      
      return { ...burnlist, items: updatedItems };
    } catch (error) {
      logger.error('❌ Error calculating returns for burnlist:', error);
      return burnlist;
    }
  }

  // Calculate average return across all items in a burnlist
  calculateAverageReturn(items, timeframe = '1D') {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        return 0;
      }

      let totalReturn = 0;
      let validItems = 0;

      items.forEach(item => {
        if (item.buyPrice && item.buyPrice > 0 && item.currentPrice) {
          const returnPercent = ((item.currentPrice - item.buyPrice) / item.buyPrice) * 100;
          totalReturn += returnPercent;
          validItems++;
        }
      });

      return validItems > 0 ? totalReturn / validItems : 0;
    } catch (error) {
      logger.error('❌ Error calculating average return:', error);
      return 0;
    }
  }

  // Calculate individual ticker return
  calculateTickerReturn(ticker) {
    try {
      if (!ticker.buyPrice || ticker.buyPrice <= 0 || !ticker.currentPrice) {
        return null;
      }

      const returnPercent = ((ticker.currentPrice - ticker.buyPrice) / ticker.buyPrice) * 100;
      const returnDollar = ticker.currentPrice - ticker.buyPrice;

      return {
        symbol: ticker.symbol,
        buyPrice: ticker.buyPrice,
        currentPrice: ticker.currentPrice,
        returnPercent,
        returnDollar,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`❌ Error calculating return for ${ticker.symbol}:`, error);
      return null;
    }
  }

  // Update returns for all tickers in a burnlist
  updateBurnlistReturns(burnlist) {
    try {
      const updatedItems = burnlist.items.map(item => {
        const returnData = this.calculateTickerReturn(item);
        if (returnData) {
          item.returnPercent = returnData.returnPercent;
          item.returnDollar = returnData.returnDollar;
        }
        return item;
      });

      return { ...burnlist, items: updatedItems };
    } catch (error) {
      logger.error('❌ Error updating burnlist returns:', error);
      return burnlist;
    }
  }

  // Get return statistics for a burnlist
  getReturnStats(burnlist) {
    try {
      const stats = {
        totalTickers: 0,
        tickersWithReturns: 0,
        averageReturn: 0,
        totalReturn: 0,
        bestPerformer: null,
        worstPerformer: null,
        positiveReturns: 0,
        negativeReturns: 0
      };

      if (!burnlist.items || !Array.isArray(burnlist.items)) {
        return stats;
      }

      const returns = [];

      burnlist.items.forEach(item => {
        stats.totalTickers++;
        
        if (item.returnPercent !== undefined && item.returnPercent !== null) {
          stats.tickersWithReturns++;
          stats.totalReturn += item.returnPercent;
          returns.push({
            symbol: item.symbol,
            returnPercent: item.returnPercent,
            returnDollar: item.returnDollar
          });

          if (item.returnPercent > 0) {
            stats.positiveReturns++;
          } else if (item.returnPercent < 0) {
            stats.negativeReturns++;
          }
        }
      });

      if (stats.tickersWithReturns > 0) {
        stats.averageReturn = stats.totalReturn / stats.tickersWithReturns;
      }

      // Find best and worst performers
      if (returns.length > 0) {
        returns.sort((a, b) => b.returnPercent - a.returnPercent);
        stats.bestPerformer = returns[0];
        stats.worstPerformer = returns[returns.length - 1];
      }

      return stats;
    } catch (error) {
      logger.error('❌ Error getting return stats:', error);
      return null;
    }
  }

  // Calculate portfolio performance over time
  calculatePortfolioPerformance(burnlist, timeframe = '1D') {
    try {
      if (!burnlist.items || !Array.isArray(burnlist.items)) {
        return null;
      }

      const performance = {
        timeframe,
        startDate: null,
        endDate: null,
        totalValue: 0,
        currentValue: 0,
        totalReturn: 0,
        returnPercent: 0,
        tickerPerformance: []
      };

      let totalBuyValue = 0;
      let totalCurrentValue = 0;

      burnlist.items.forEach(item => {
        if (item.buyPrice && item.buyPrice > 0 && item.currentPrice) {
          const buyValue = item.buyPrice;
          const currentValue = item.currentPrice;
          
          totalBuyValue += buyValue;
          totalCurrentValue += currentValue;

          performance.tickerPerformance.push({
            symbol: item.symbol,
            buyPrice: item.buyPrice,
            currentPrice: item.currentPrice,
            returnPercent: ((currentValue - buyValue) / buyValue) * 100,
            returnDollar: currentValue - buyValue
          });
        }
      });

      if (totalBuyValue > 0) {
        performance.totalValue = totalBuyValue;
        performance.currentValue = totalCurrentValue;
        performance.totalReturn = totalCurrentValue - totalBuyValue;
        performance.returnPercent = ((totalCurrentValue - totalBuyValue) / totalBuyValue) * 100;
      }

      return performance;
    } catch (error) {
      logger.error('❌ Error calculating portfolio performance:', error);
      return null;
    }
  }

  // Notify about significant return changes
  notifyReturnChanges(burnlist, previousReturns = {}) {
    try {
      if (!this.notificationCallback) return;

      const significantChanges = [];
      const threshold = 2.0; // 2% change threshold

      burnlist.items.forEach(item => {
        if (item.symbol && item.returnPercent !== undefined) {
          const previousReturn = previousReturns[item.symbol] || 0;
          const change = Math.abs(item.returnPercent - previousReturn);

          if (change >= threshold) {
            significantChanges.push({
              symbol: item.symbol,
              previousReturn,
              currentReturn: item.returnPercent,
              change: item.returnPercent - previousReturn
            });
          }
        }
      });

      if (significantChanges.length > 0) {
        this.notificationCallback('return-changes', significantChanges);
      }
    } catch (error) {
      logger.error('❌ Error notifying return changes:', error);
    }
  }

  // Export return data for analysis
  exportReturnData(burnlist) {
    try {
      const exportData = {
        burnlistName: burnlist.name,
        burnlistSlug: burnlist.slug,
        exportDate: new Date().toISOString(),
        stats: this.getReturnStats(burnlist),
        performance: this.calculatePortfolioPerformance(burnlist),
        tickers: burnlist.items.map(item => ({
          symbol: item.symbol,
          buyPrice: item.buyPrice,
          buyDate: item.buyDate,
          currentPrice: item.currentPrice,
          returnPercent: item.returnPercent,
          returnDollar: item.returnDollar,
          historicalDataCount: item.historicalData ? item.historicalData.length : 0
        }))
      };

      return exportData;
    } catch (error) {
      logger.error('❌ Error exporting return data:', error);
      return null;
    }
  }

  // Local copy of getSlicedData logic to ensure consistency with TickerTable calculations
  getSlicedDataLocal(data, timeframe, buyDate, symbol = "?", buyPrice = null) {
    if (!Array.isArray(data) || data.length === 0) return { startPoint: null, endPoint: null };
    const now = new Date();

    // Sort data by timestamp first (ascending: oldest to newest)
    const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const normalizedTimeframe = {
      D: "D",
      W: "W", 
      M: "M",
      Y: "Y",
      YTD: "YTD",
      MAX: "MAX"
    }[timeframe] || timeframe;

    let timeframeStart;
    switch (normalizedTimeframe) {
      case "D":
        // Daily = previous trading day at midnight (not 24 hours ago)
        timeframeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        timeframeStart.setHours(0, 0, 0, 0);
        break;
      case "W":
        // Weekly = exactly 7 days ago
        timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "M":
        // Monthly = exactly 30 days ago (not 31)
        timeframeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        logger.log(`📅 [ReturnCalculator] MONTHLY: Today is ${now.toDateString()}, 30 days ago is ${timeframeStart.toDateString()}`);
        break;
      case "Y":
        // Yearly = exactly 365 days ago
        timeframeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "YTD":
        // YTD = January 1 of current year
        timeframeStart = new Date(now.getFullYear(), 0, 1);
        break;
      case "MAX":
      default:
        timeframeStart = null;
    }

    // For MAX timeframe: use buy date and buy price
    // For all other timeframes: use longest valid slice available within timeframe
    const buyDateObj = new Date(buyDate || data[0]?.timestamp || now);
    
    let startDate;
    let startPrice;
    
    if (timeframe === 'MAX') {
      // MAX timeframe: use buy date and determine price from historical data at that date
      startDate = buyDateObj;
      
      if (buyPrice && !isNaN(buyPrice)) {
        // Use provided buy price
        startPrice = Number(buyPrice);
      } else {
        // Find historical price closest to buy date (for manual buy date changes)
        const startIdx = this.binarySearchClosestIdx(sortedData, startDate.getTime());
        startPrice = sortedData[startIdx]?.price || 0;
      }
    } else if (timeframe === 'YTD') {
      // YTD: Use the LATER of January 1st OR buy date
      const jan1 = new Date(now.getFullYear(), 0, 1);
      const effectiveStart = jan1 > buyDateObj ? jan1 : buyDateObj;
      
      const firstDataPoint = sortedData[0];
      const firstDataDate = new Date(firstDataPoint?.timestamp);
      
      // Use the effective start, but fallback to first available data if needed
      if (firstDataDate <= effectiveStart) {
        // Data goes back to at least our effective start date
        startDate = effectiveStart;
        const startIdx = this.binarySearchClosestIdx(sortedData, startDate.getTime());
        startPrice = sortedData[startIdx]?.price || 0;
        
        if (jan1 > buyDateObj) {
          logger.log(`📅 [ReturnCalculator] YTD: Using Jan 1st ${jan1.toDateString()} → price: ${startPrice} for ${symbol} (buy date is older)`);
        } else {
          logger.log(`📅 [ReturnCalculator] YTD: Using buy date ${buyDateObj.toDateString()} → price: ${startPrice} for ${symbol} (Jan 1st is before buy date)`);
        }
      } else {
        // Data doesn't go back to our effective start, use first available data point
        startDate = firstDataDate;
        startPrice = firstDataPoint?.price || 0;
        logger.log(`📅 [ReturnCalculator] YTD: Effective start not available, using first data point ${firstDataDate.toDateString()} → price: ${startPrice} for ${symbol}`);
      }
    } else {
      // All other timeframes: Use the LATER of timeframe start OR buy date
      // This ensures we don't show data from before the stock was actually bought
      const effectiveStart = timeframeStart > buyDateObj ? timeframeStart : buyDateObj;
      startDate = effectiveStart;
      
      // Find the closest data point to the effective start date
      const startIdx = this.binarySearchClosestIdx(sortedData, startDate.getTime());
      startPrice = sortedData[startIdx]?.price || 0;
      
      if (timeframeStart > buyDateObj) {
        logger.log(`📅 [ReturnCalculator] ${normalizedTimeframe}: Using timeframe start ${timeframeStart.toISOString()} → price: ${startPrice} for ${symbol} (buy date is older)`);
      } else {
        logger.log(`📅 [ReturnCalculator] ${normalizedTimeframe}: Using buy date ${buyDateObj.toISOString()} → price: ${startPrice} for ${symbol} (timeframe would go before buy date)`);
      }
    }
    
    // Find the start point data
    const startIdx = this.binarySearchClosestIdx(sortedData, startDate.getTime());
    const startPoint = {
      ...sortedData[startIdx],
      timestamp: startDate.toISOString(),
      price: startPrice
    };
    
    // End point is always the latest available data point
    const endPoint = sortedData[sortedData.length - 1];

    return { startPoint, endPoint };
  }

  // Binary search helper for finding closest timestamp
  binarySearchClosestIdx(arr, target) {
    let left = 0;
    let right = arr.length - 1;
    let bestIdx = 0;
    let bestDiff = Math.abs(new Date(arr[0].timestamp) - target);
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = new Date(arr[mid].timestamp).getTime();
      const diff = Math.abs(midTime - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = mid;
      }
      if (midTime < target) {
        left = mid + 1;
      } else if (midTime > target) {
        right = mid - 1;
      } else {
        return mid;
      }
    }
    return bestIdx;
  }
}

// Create singleton instance
const returnCalculator = new ReturnCalculator();

export default returnCalculator; 