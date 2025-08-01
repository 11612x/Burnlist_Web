import { logger } from './logger';

/**
 * Calculate ETF-like average price for a watchlist
 * This function normalizes prices across different purchase dates to create a meaningful average
 * @param {Array} items - Array of ticker items with buyPrice, buyDate, and historicalData
 * @param {string} baseDate - Optional base date to normalize prices to (defaults to most recent date)
 * @returns {Object} - Object containing average price and metadata
 */
export function calculateETFPrice(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      averagePrice: 0,
      totalValue: 0,
      itemCount: 0,
      priceRange: { min: 0, max: 0 },
      dateRange: { earliest: null, latest: null }
    };
  }

  // Filter valid items with prices and dates
  const validItems = items.filter(item => 
    item && 
    Number(item.buyPrice) > 0 && 
    item.buyDate && 
    Array.isArray(item.historicalData) && 
    item.historicalData.length > 0
  );

  if (validItems.length === 0) {
    return {
      averagePrice: 0,
      totalValue: 0,
      itemCount: 0,
      priceRange: { min: 0, max: 0 },
      dateRange: { earliest: null, latest: null }
    };
  }

  // Find the most recent date across all items to use as normalization base
  const allDates = validItems.flatMap(item => 
    item.historicalData.map(data => new Date(data.timestamp))
  );
  const latestDate = new Date(Math.max(...allDates));

  // Calculate normalized prices (what each stock would be worth at the latest date)
  const normalizedPrices = validItems.map(item => {
    const buyDate = new Date(item.buyDate);
    const buyPrice = Number(item.buyPrice);
    
    // Find the price at the latest date for this stock
    let currentPrice = buyPrice; // fallback to buy price
    
    // Use currentPrice field if available (from auto-fetch), otherwise use latest historical price
    if (typeof item.currentPrice === 'number' && item.currentPrice > 0) {
      currentPrice = item.currentPrice;
    } else if (item.historicalData && item.historicalData.length > 0) {
      // Find the most recent price in historical data
      const sortedData = [...item.historicalData].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      if (sortedData.length > 0) {
        currentPrice = Number(sortedData[0].price);
      }
    }

    // For P&L calculation, use the actual buy price that should be used for returns
    // This handles manually changed buy dates where buyPrice reflects the historical price from that date
    const effectiveBuyPrice = buyPrice;
    
    return {
      symbol: item.symbol,
      buyPrice,
      buyDate,
      currentPrice,
      normalizedPrice: currentPrice, // For now, use current price as normalized
      priceChange: currentPrice - effectiveBuyPrice,
      priceChangePercent: effectiveBuyPrice > 0 ? ((currentPrice - effectiveBuyPrice) / effectiveBuyPrice) * 100 : 0
    };
  });

  // Calculate weighted average based on current market values
  const totalValue = normalizedPrices.reduce((sum, item) => sum + item.currentPrice, 0);
  const averagePrice = totalValue / normalizedPrices.length;

  // Calculate price range
  const prices = normalizedPrices.map(item => item.currentPrice);
  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };

  // Calculate date range
  const dates = validItems.map(item => new Date(item.buyDate));
  const dateRange = {
    earliest: new Date(Math.min(...dates)),
    latest: new Date(Math.max(...dates))
  };

  return {
    averagePrice: Number(averagePrice.toFixed(2)),
    totalValue: Number(totalValue.toFixed(2)),
    itemCount: validItems.length,
    priceRange,
    dateRange,
    normalizedPrices,
    // Additional metrics
    totalBuyValue: normalizedPrices.reduce((sum, item) => sum + item.buyPrice, 0),
    totalGainLoss: normalizedPrices.reduce((sum, item) => sum + item.priceChange, 0),
    averageGainLossPercent: normalizedPrices.reduce((sum, item) => sum + item.priceChangePercent, 0) / normalizedPrices.length
  };
}

/**
 * Calculate a time-weighted average price (TWAP) for the watchlist
 * This gives more weight to stocks purchased more recently
 * @param {Array} items - Array of ticker items
 * @returns {Object} - TWAP calculation results
 */
export function calculateTWAP(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { twap: 0, weightedPrices: [] };
  }

  const validItems = items.filter(item => 
    item && Number(item.buyPrice) > 0 && item.buyDate
  );

  if (validItems.length === 0) {
    return { twap: 0, weightedPrices: [] };
  }

  const now = new Date();
  const weightedPrices = validItems.map(item => {
    const buyDate = new Date(item.buyDate);
    const daysSincePurchase = (now - buyDate) / (1000 * 60 * 60 * 24);
    const weight = Math.max(1, daysSincePurchase); // More recent purchases get higher weight
    
    return {
      symbol: item.symbol,
      buyPrice: Number(item.buyPrice),
      buyDate,
      weight,
      weightedPrice: Number(item.buyPrice) * weight
    };
  });

  const totalWeightedPrice = weightedPrices.reduce((sum, item) => sum + item.weightedPrice, 0);
  const totalWeight = weightedPrices.reduce((sum, item) => sum + item.weight, 0);
  const twap = totalWeight > 0 ? totalWeightedPrice / totalWeight : 0;

  return {
    twap: Number(twap.toFixed(2)),
    weightedPrices
  };
}

/**
 * Calculate portfolio beta relative to market (S&P 500)
 * @param {Array} items - Array of ticker items with historicalData
 * @param {string} timeframe - Timeframe for calculation ('D', 'W', 'M', 'Y')
 * @returns {Object} - Beta calculation results
 */
export function calculatePortfolioBeta(items, timeframe = 'D') {
  if (!Array.isArray(items) || items.length === 0) {
    return { beta: 0, confidence: 0, marketCorrelation: 0 };
  }

  const validItems = items.filter(item => 
    item && 
    Array.isArray(item.historicalData) && 
    item.historicalData.length > 0
  );

  if (validItems.length === 0) {
    return { beta: 0, confidence: 0, marketCorrelation: 0 };
  }

  // For now, we'll use a simplified approach since we don't have S&P 500 data
  // In a real implementation, you'd fetch S&P 500 historical data
  // For demo purposes, we'll calculate beta based on portfolio volatility vs average stock volatility
  
  try {
    // Calculate individual stock returns for the timeframe
    const stockReturns = validItems.map(item => {
      const sortedData = [...item.historicalData].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      if (sortedData.length < 2) return null;
      
      // Calculate returns based on timeframe
      let returns = [];
      const timeframeDays = {
        'D': 1,
        'W': 7,
        'M': 30,
        'Y': 365
      };
      
      const daysToLookBack = timeframeDays[timeframe] || 1;
      
      for (let i = daysToLookBack; i < sortedData.length; i++) {
        const currentPrice = Number(sortedData[i].price);
        const previousPrice = Number(sortedData[i - daysToLookBack].price);
        if (previousPrice > 0) {
          const return_pct = ((currentPrice - previousPrice) / previousPrice) * 100;
          returns.push(return_pct);
        }
      }
      
      return {
        symbol: item.symbol,
        returns: returns,
        avgReturn: returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0,
        volatility: returns.length > 0 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - (returns.reduce((a, b) => a + b, 0) / returns.length), 2), 0) / returns.length) : 0
      };
    }).filter(item => item !== null);

    if (stockReturns.length === 0) {
      return { beta: 0, confidence: 0, marketCorrelation: 0 };
    }

    // Calculate portfolio volatility (weighted average of stock volatilities)
    const totalValue = validItems.reduce((sum, item) => {
      const currentPrice = Number(item.historicalData[item.historicalData.length - 1]?.price || 0);
      return sum + currentPrice;
    }, 0);

    const portfolioVolatility = validItems.reduce((sum, item, index) => {
      const currentPrice = Number(item.historicalData[item.historicalData.length - 1]?.price || 0);
      const weight = totalValue > 0 ? currentPrice / totalValue : 0;
      const stockReturn = stockReturns.find(sr => sr.symbol === item.symbol);
      return sum + (weight * (stockReturn?.volatility || 0));
    }, 0);

    // Calculate average market volatility (simplified - in reality you'd use S&P 500 data)
    const avgMarketVolatility = stockReturns.reduce((sum, sr) => sum + sr.volatility, 0) / stockReturns.length;
    
    // Calculate beta as portfolio volatility relative to market volatility
    const beta = avgMarketVolatility > 0 ? portfolioVolatility / avgMarketVolatility : 1;
    
    // Calculate confidence based on data quality
    const avgDataPoints = stockReturns.reduce((sum, sr) => sum + sr.returns.length, 0) / stockReturns.length;
    const confidence = Math.min(100, Math.max(0, (avgDataPoints / 30) * 100)); // 30 data points = 100% confidence
    
    // Calculate market correlation (simplified)
    const marketCorrelation = Math.min(1, Math.max(-1, beta * 0.8)); // Simplified correlation

    return {
      beta: Number(beta.toFixed(2)),
      confidence: Number(confidence.toFixed(0)),
      marketCorrelation: Number(marketCorrelation.toFixed(2)),
      portfolioVolatility: Number(portfolioVolatility.toFixed(2)),
      avgMarketVolatility: Number(avgMarketVolatility.toFixed(2))
    };
    
  } catch (error) {
    logger.error('Error calculating portfolio beta:', error);
    return { beta: 0, confidence: 0, marketCorrelation: 0 };
  }
} 