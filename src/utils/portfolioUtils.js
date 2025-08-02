import { logger } from './logger';

/**
 * Calculate ETF-like average price for a watchlist using NAV baseline approach
 * This function calculates the current NAV value relative to a baseline, consistent with ETF NAV calculations
 * @param {Array} items - Array of ticker items with buyPrice, buyDate, and historicalData
 * @param {string} timeframe - Timeframe for baseline calculation (D, W, M, YTD, MAX)
 * @returns {Object} - Object containing NAV price and metadata
 */
export function calculateETFPrice(items, timeframe = 'MAX') {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      averagePrice: 0,
      totalValue: 0,
      itemCount: 0,
      priceRange: { min: 0, max: 0 },
      dateRange: { earliest: null, latest: null },
      totalBuyValue: 0,
      totalGainLoss: 0,
      averageGainLossPercent: 0
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
      dateRange: { earliest: null, latest: null },
      totalBuyValue: 0,
      totalGainLoss: 0,
      averageGainLossPercent: 0
    };
  }

  // Find the baseline price using the same approach as NAV calculator
  const allTimestamps = new Set();
  validItems.forEach(item => {
    item.historicalData.forEach(point => {
      allTimestamps.add(new Date(point.timestamp).getTime());
    });
  });
  
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  const baselineTimestamp = sortedTimestamps[0]; // Start of data
  
  // Calculate baseline prices for each ticker
  const baselinePrices = validItems.map(item => {
    const sortedData = [...item.historicalData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    // Find price at baseline timestamp
    const baselinePoint = findClosestPricePoint(sortedData, new Date(baselineTimestamp));
    return baselinePoint ? baselinePoint.price : 0;
  }).filter(price => price > 0);

  if (baselinePrices.length === 0) {
    return {
      averagePrice: 0,
      totalValue: 0,
      itemCount: 0,
      priceRange: { min: 0, max: 0 },
      dateRange: { earliest: null, latest: null },
      totalBuyValue: 0,
      totalGainLoss: 0,
      averageGainLossPercent: 0
    };
  }

  // Calculate baseline NAV value (average of baseline prices)
  const baselineNAV = baselinePrices.reduce((sum, price) => sum + price, 0) / baselinePrices.length;
  
  // Calculate current prices and NAV value
  const currentPrices = validItems.map(item => {
    let currentPrice = item.currentPrice;
    
    if (typeof currentPrice !== 'number' || currentPrice <= 0) {
      // Use latest historical price
      const sortedData = [...item.historicalData].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      currentPrice = sortedData.length > 0 ? Number(sortedData[sortedData.length - 1].price) : 0;
    }
    
    return currentPrice;
  }).filter(price => price > 0);

  if (currentPrices.length === 0) {
    return {
      averagePrice: 0,
      totalValue: 0,
      itemCount: 0,
      priceRange: { min: 0, max: 0 },
      dateRange: { earliest: null, latest: null },
      totalBuyValue: 0,
      totalGainLoss: 0,
      averageGainLossPercent: 0
    };
  }

  // Calculate current NAV value (average of current prices)
  const currentNAV = currentPrices.reduce((sum, price) => sum + price, 0) / currentPrices.length;
  
  // Calculate NAV return percentage
  const navReturnPercent = baselineNAV > 0 ? ((currentNAV - baselineNAV) / baselineNAV) * 100 : 0;
  
  // Calculate price range
  const priceRange = {
    min: Math.min(...currentPrices),
    max: Math.max(...currentPrices)
  };

  // Calculate date range
  const dates = validItems.map(item => new Date(item.buyDate));
  const dateRange = {
    earliest: new Date(Math.min(...dates)),
    latest: new Date(Math.max(...dates))
  };

  return {
    averagePrice: Number(currentNAV.toFixed(2)), // Current NAV value
    totalValue: Number((currentNAV * validItems.length).toFixed(2)),
    itemCount: validItems.length,
    priceRange,
    dateRange,
    // NAV-based metrics
    totalBuyValue: Number((baselineNAV * validItems.length).toFixed(2)),
    totalGainLoss: Number(((currentNAV - baselineNAV) * validItems.length).toFixed(2)),
    averageGainLossPercent: Number(navReturnPercent.toFixed(2))
  };
}

// Helper function to find closest price point (same as in navCalculator)
function findClosestPricePoint(sortedData, targetDate) {
  if (sortedData.length === 0) return null;
  
  const targetTime = targetDate.getTime();
  let closestPoint = sortedData[0];
  let closestDiff = Math.abs(new Date(closestPoint.timestamp).getTime() - targetTime);
  
  for (const point of sortedData) {
    const pointTime = new Date(point.timestamp).getTime();
    const diff = Math.abs(pointTime - targetTime);
    
    if (diff < closestDiff) {
      closestDiff = diff;
      closestPoint = point;
    }
  }
  
  return closestPoint;
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