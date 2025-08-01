class HistoricalDataManager {
  constructor() {
    this.maxDataPoints = 100; // Keep last 100 datapoints per ticker
    this.cleanupDays = 30;    // Remove data older than 30 days
  }

  // Save a watchlist datapoint (created after all tickers updated)
  saveWatchlistDatapoint(slug, datapoint) {
    try {
      const key = `burnlist_chart_data_${slug}`;
      let chartData = JSON.parse(localStorage.getItem(key) || '[]');
      
      // Add new datapoint
      chartData.push({
        timestamp: datapoint.timestamp,
        averageReturn: datapoint.averageReturn,
        tickerCount: datapoint.tickerCount,
        fetchTimestamp: new Date().toISOString()
      });
      
      // Keep only last 100 datapoints
      if (chartData.length > this.maxDataPoints) {
        chartData = chartData.slice(-this.maxDataPoints);
      }
      
      localStorage.setItem(key, JSON.stringify(chartData));
      console.log(`📊 Saved watchlist datapoint for ${slug}: ${datapoint.averageReturn.toFixed(2)}% (${datapoint.tickerCount} tickers)`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error saving watchlist datapoint for ${slug}:`, error);
      return false;
    }
  }

  // Get chart data for a watchlist
  getWatchlistChartData(slug, limit = 100) {
    try {
      const key = `burnlist_chart_data_${slug}`;
      const chartData = JSON.parse(localStorage.getItem(key) || '[]');
      return chartData.slice(-limit);
    } catch (error) {
      console.error(`❌ Error getting chart data for ${slug}:`, error);
      return [];
    }
  }

  // Save a new price datapoint for a ticker
  savePriceDatapoint(symbol, twelveDataResponse) {
    const { meta, values, status } = twelveDataResponse;
    
    if (status !== 'ok' || !values || values.length === 0) {
      console.warn(`Invalid Twelve Data response for ${symbol}`);
      return null;
    }
    
    const latestData = values[0];
    const timestamp = this.convertTwelveDataDateTime(latestData.datetime, meta.exchange_timezone);
    
    // Only store close price for datapoints
    const datapoint = {
      price: parseFloat(latestData.close),
      timestamp: timestamp,
      fetchTimestamp: new Date().toISOString()
    };
    
    return datapoint;
  }

  // Update historical data for a ticker across all watchlists
  updateTickerHistoricalData(symbol, newDatapoint) {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      let updated = false;
      
      Object.values(watchlists).forEach(watchlist => {
        if (watchlist.items) {
          const ticker = watchlist.items.find(item => item.symbol === symbol);
          if (ticker) {
            // Add new datapoint (close price only)
            if (!ticker.historicalData) {
              ticker.historicalData = [];
            }
            
            ticker.historicalData.push(newDatapoint);
            
            // Keep only last 100 datapoints
            if (ticker.historicalData.length > this.maxDataPoints) {
              ticker.historicalData = ticker.historicalData.slice(-this.maxDataPoints);
            }
            
            // Update current price for return calculations
            ticker.currentPrice = newDatapoint.price;
            
            updated = true;
          }
        }
      });
      
      if (updated) {
        localStorage.setItem('burnlist_watchlists', JSON.stringify(watchlists));
        console.log(`💾 Updated historical data for ${symbol} across all watchlists`);
      }
      
      return updated;
    } catch (error) {
      console.error(`❌ Error updating historical data for ${symbol}:`, error);
      return false;
    }
  }

  // Convert Twelve Data datetime to ISO timestamp
  convertTwelveDataDateTime(datetime, timezone = 'America/New_York') {
    try {
      const date = new Date(datetime);
      return date.toISOString();
    } catch (error) {
      console.error('Error converting datetime:', error);
      return new Date().toISOString();
    }
  }

  // Get historical data for a specific ticker
  getHistoricalData(symbol, limit = 100) {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      
      for (const watchlist of Object.values(watchlists)) {
        if (watchlist.items) {
          const ticker = watchlist.items.find(item => item.symbol === symbol);
          if (ticker && ticker.historicalData) {
            return ticker.historicalData.slice(-limit);
          }
        }
      }
      
      return [];
    } catch (error) {
      console.error(`❌ Error getting historical data for ${symbol}:`, error);
      return [];
    }
  }

  // Calculate average return for a ticker over a timeframe
  calculateAverageReturn(symbol, timeframe = '1D') {
    try {
      const historicalData = this.getHistoricalData(symbol);
      if (historicalData.length < 2) {
        return null;
      }

      // Get first and last datapoint
      const firstPoint = historicalData[0];
      const lastPoint = historicalData[historicalData.length - 1];
      
      if (!firstPoint || !lastPoint) {
        return null;
      }

      const startPrice = firstPoint.price;
      const endPrice = lastPoint.price;
      
      if (startPrice <= 0) {
        return null;
      }

      const returnPercent = ((endPrice - startPrice) / startPrice) * 100;
      
      return {
        symbol,
        startPrice,
        endPrice,
        returnPercent,
        timeframe,
        dataPoints: historicalData.length
      };
    } catch (error) {
      console.error(`❌ Error calculating average return for ${symbol}:`, error);
      return null;
    }
  }

  // Clean up old historical data
  cleanupOldData() {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.cleanupDays);
      
      let cleanedCount = 0;
      
      Object.values(watchlists).forEach(watchlist => {
        if (watchlist.items) {
          watchlist.items.forEach(ticker => {
            if (ticker.historicalData) {
              const initialLength = ticker.historicalData.length;
              
              // Remove datapoints older than cleanupDays
              ticker.historicalData = ticker.historicalData.filter(datapoint => {
                const datapointDate = new Date(datapoint.timestamp);
                return datapointDate > cutoffDate;
              });
              
              cleanedCount += initialLength - ticker.historicalData.length;
            }
          });
        }
      });
      
      if (cleanedCount > 0) {
        localStorage.setItem('burnlist_watchlists', JSON.stringify(watchlists));
        console.log(`🧹 Cleaned up ${cleanedCount} old datapoints`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error cleaning up old data:', error);
      return 0;
    }
  }

  // Get statistics about historical data
  getHistoricalDataStats() {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      const stats = {
        totalTickers: 0,
        tickersWithHistoricalData: 0,
        totalDataPoints: 0,
        averageDataPointsPerTicker: 0,
        oldestDataPoint: null,
        newestDataPoint: null
      };
      
      let oldestTimestamp = Date.now();
      let newestTimestamp = 0;
      
      Object.values(watchlists).forEach(watchlist => {
        if (watchlist.items) {
          watchlist.items.forEach(ticker => {
            stats.totalTickers++;
            
            if (ticker.historicalData && ticker.historicalData.length > 0) {
              stats.tickersWithHistoricalData++;
              stats.totalDataPoints += ticker.historicalData.length;
              
              // Find oldest and newest timestamps
              ticker.historicalData.forEach(datapoint => {
                const timestamp = new Date(datapoint.timestamp).getTime();
                if (timestamp < oldestTimestamp) {
                  oldestTimestamp = timestamp;
                  stats.oldestDataPoint = datapoint.timestamp;
                }
                if (timestamp > newestTimestamp) {
                  newestTimestamp = timestamp;
                  stats.newestDataPoint = datapoint.timestamp;
                }
              });
            }
          });
        }
      });
      
      if (stats.tickersWithHistoricalData > 0) {
        stats.averageDataPointsPerTicker = Math.round(stats.totalDataPoints / stats.tickersWithHistoricalData);
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting historical data stats:', error);
      return null;
    }
  }

  // Export historical data for backup
  exportHistoricalData() {
    try {
      const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
      const exportData = {
        timestamp: new Date().toISOString(),
        watchlists: {},
        stats: this.getHistoricalDataStats()
      };
      
      Object.entries(watchlists).forEach(([key, watchlist]) => {
        exportData.watchlists[key] = {
          name: watchlist.name,
          slug: watchlist.slug,
          items: watchlist.items.map(item => ({
            symbol: item.symbol,
            buyPrice: item.buyPrice,
            buyDate: item.buyDate,
            historicalDataCount: item.historicalData ? item.historicalData.length : 0,
            historicalData: item.historicalData || []
          }))
        };
      });
      
      return exportData;
    } catch (error) {
      console.error('❌ Error exporting historical data:', error);
      return null;
    }
  }
}

// Create singleton instance
const historicalDataManager = new HistoricalDataManager();

export default historicalDataManager; 