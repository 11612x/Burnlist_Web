import { logger } from '../utils/logger';

export function getAverageReturn(historicalSnapshots, timeframe) {
  logger.log('🔍 getAverageReturn called with timeframe:', timeframe, 'snapshots:', historicalSnapshots.length);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  let earliest;

  switch (timeframe) {
    case "D":
      // Daily = previous trading day at midnight (not 24 hours ago)
      earliest = new Date(now.getTime() - 1 * msPerDay);
      earliest.setHours(0, 0, 0, 0);
      break;
    case "W":
      earliest = new Date(now.getTime() - 7 * msPerDay);
      break;
    case "M":
      earliest = new Date(now.getTime() - 30 * msPerDay);
      logger.log(`📅 [OLD getAverageReturn] MONTHLY: 30 days ago = ${earliest.toDateString()}`);
      break;
    case "Y":
      earliest = new Date(now.getTime() - 365 * msPerDay);
      break;
    case "YTD":
      earliest = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      earliest = null;
  }

  let totalReturn = 0;
  let count = 0;

  for (const snapshot of historicalSnapshots) {
    const symbol = snapshot.symbol || "?";
    const historicalData = snapshot.historicalData;
    const buyDate = snapshot.buyDate;
    const buyPrice = snapshot.buyPrice;
    
    logger.log(`[Header Loop] Processing ${symbol}: historicalData length: ${historicalData?.length || 0}, buyDate: ${buyDate}, buyPrice: ${buyPrice}`);

    if (!Array.isArray(historicalData)) {
      continue;
    }

    // Validate buyDate before passing to getSlicedData
    const validBuyDate = buyDate && new Date(buyDate).toString() !== 'Invalid Date' ? buyDate : null;

    const { startPoint, endPoint } = getSlicedData(historicalData, timeframe, validBuyDate, symbol, buyPrice);
    
    logger.debug(`[Header Debug] ${symbol}: startPoint:`, startPoint, 'endPoint:', endPoint);

    if (
      startPoint &&
      endPoint &&
      typeof startPoint.price === "number" &&
      typeof endPoint.price === "number" &&
      startPoint.price > 0
    ) {
      const individualReturn =
        ((endPoint.price - startPoint.price) / startPoint.price) * 100;

      logger.log(`[Header %] ${symbol}:`);
      logger.log("Start Point (header):", startPoint);
      logger.log("End Point (header):", endPoint);
      logger.log("Calculated Return (header):", individualReturn);
      logger.log("Running total:", totalReturn, "count:", count);

      totalReturn += individualReturn;
      count++;
    }
  }

  const finalAverage = count > 0 ? totalReturn / count : 0;
  logger.log(`[Header Final] Total: ${totalReturn}, Count: ${count}, Average: ${finalAverage}%`);
  return finalAverage;
}

// Returns { startPoint, endPoint } for given data and timeframe.
export function getSlicedData(data, timeframe, buyDate, symbol = "?", buyPrice = null) {
  if (!Array.isArray(data) || data.length === 0) return { startPoint: null, endPoint: null };
  const now = new Date();

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
      // Daily = previous trading day (not 24 hours ago, since we have daily data at midnight)
      timeframeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      timeframeStart.setHours(0, 0, 0, 0); // Set to midnight of previous day
      logger.log(`📅 DAILY timeframe: Using previous day at midnight = ${timeframeStart.toISOString()}`);
      break;
    case "W":
      // Weekly = exactly 7 days ago
      timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      logger.log(`📅 WEEKLY timeframe: Using 7 days ago = ${timeframeStart.toISOString()}`);
      break;
    case "M":
      // Monthly = exactly 30 days ago (not 31)
      timeframeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      logger.log(`📅 MONTHLY timeframe: Using 30 days ago = ${timeframeStart.toISOString()}`);
      logger.log(`📅 MONTHLY timeframe: Today is ${now.toISOString()}, 30 days ago is ${timeframeStart.toDateString()}`);
      break;
    case "Y":
      // Yearly = exactly 365 days ago
      timeframeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      logger.log(`📅 YEARLY timeframe: Using 365 days ago = ${timeframeStart.toISOString()}`);
      break;
    case "YTD":
      // YTD = January 1 of current year
      timeframeStart = new Date(now.getFullYear(), 0, 1);
      logger.log(`📅 YTD timeframe: Using Jan 1 = ${timeframeStart.toISOString()}`);
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
      logger.log(`📅 MAX timeframe: Using provided buy price ${startPrice} for ${symbol}`);
    } else {
      // Find historical price closest to buy date (for manual buy date changes)
      const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const startIdx = binarySearchClosestIdx(sortedData, startDate.getTime());
      startPrice = sortedData[startIdx]?.price || 0;
      logger.log(`📅 MAX timeframe: Using historical price ${startPrice} from ${sortedData[startIdx]?.timestamp} for ${symbol} (closest to buy date ${buyDateObj.toISOString()})`);
    }
  } else if (timeframe === 'YTD') {
    // YTD: Use the LATER of January 1st OR buy date
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const effectiveStart = jan1 > buyDateObj ? jan1 : buyDateObj;
    
    const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const firstDataPoint = sortedData[0];
    const firstDataDate = new Date(firstDataPoint?.timestamp);
    
    // Use the effective start, but fallback to first available data if needed
    if (firstDataDate <= effectiveStart) {
      // Data goes back to at least our effective start date
      startDate = effectiveStart;
      const startIdx = binarySearchClosestIdx(sortedData, startDate.getTime());
      startPrice = sortedData[startIdx]?.price || 0;
      
      if (jan1 > buyDateObj) {
        logger.log(`📅 YTD: Using Jan 1st ${jan1.toDateString()} → price: ${startPrice} for ${symbol} (buy date is older)`);
      } else {
        logger.log(`📅 YTD: Using buy date ${buyDateObj.toDateString()} → price: ${startPrice} for ${symbol} (Jan 1st is before buy date)`);
      }
    } else {
      // Data doesn't go back to our effective start, use first available data point
      startDate = firstDataDate;
      startPrice = firstDataPoint?.price || 0;
      logger.log(`📅 YTD: Effective start not available, using first data point ${firstDataDate.toDateString()} → price: ${startPrice} for ${symbol}`);
    }
  } else {
    // All other timeframes: Use the LATER of timeframe start OR buy date
    // This ensures we don't show data from before the stock was actually bought
    const effectiveStart = timeframeStart > buyDateObj ? timeframeStart : buyDateObj;
    startDate = effectiveStart;
    
    // Find the closest data point to the effective start date
    const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const startIdx = binarySearchClosestIdx(sortedData, startDate.getTime());
    startPrice = sortedData[startIdx]?.price || 0;
    
    if (timeframeStart > buyDateObj) {
      logger.log(`📅 ${normalizedTimeframe}: Using timeframe start ${timeframeStart.toISOString()} → price: ${startPrice} for ${symbol} (buy date is older)`);
    } else {
      logger.log(`📅 ${normalizedTimeframe}: Using buy date ${buyDateObj.toISOString()} → price: ${startPrice} for ${symbol} (timeframe would go before buy date)`);
    }
  }
  
  logger.debug(`TIMEFRAME DEBUG ${symbol}: timeframe=${timeframe}`);
  logger.log(`🔍 Buy date: ${buyDateObj.toISOString()}`);
  logger.log(`🔍 Timeframe start: ${timeframeStart?.toISOString() || 'now'}`);
  logger.log(`🔍 Effective start: ${startDate.toISOString()}`);
  logger.log(`🔍 Start price: ${startPrice}`);
  
  // --- Binary search for startPoint ---
  function binarySearchClosestIdx(arr, target) {
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

  let startPoint = null;
  let endPoint = null;
  
  // Sort data by timestamp to ensure we get the actual latest point (ascending: oldest to newest)
  const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Debug: Show the actual data range
  const firstDataPoint = sortedData[0];
  const lastDataPoint = sortedData[sortedData.length - 1];
  logger.debug(`Data range for ${symbol}: ${firstDataPoint?.timestamp} to ${lastDataPoint?.timestamp}`);
  
  // Find the start point data
  const startIdx = binarySearchClosestIdx(sortedData, startDate.getTime());
  startPoint = {
    ...sortedData[startIdx],
    timestamp: startDate.toISOString(),
    price: startPrice
  };
  
  // End point is always the latest available data point (last in sorted array)
  endPoint = sortedData[sortedData.length - 1];
  
  logger.debug(`Return calculation for ${symbol} (${timeframe}):`);
  if (timeframe === 'MAX') {
    logger.log(`✅ Start: Buy date ${buyDateObj.toISOString()} → Buy Price: ${startPoint.price}`);
  } else {
    logger.log(`✅ Buy date: ${buyDateObj.toISOString()}`);
    logger.log(`✅ Timeframe start: ${timeframeStart?.toISOString() || 'now'}`);
    logger.log(`✅ Effective start: ${startDate.toISOString()} → Price: ${startPoint.price}`);
    if (startDate === buyDateObj) {
      logger.log(`✅ Using buy date (more recent than timeframe start)`);
    } else {
      logger.log(`✅ Using timeframe start (buy date is older)`);
    }
  }
  logger.log(`✅ End: ${endPoint?.timestamp} → Price: ${endPoint?.price}`);
  if (startPoint && endPoint && startPoint.price && endPoint.price) {
    const calculatedReturn = ((endPoint.price - startPoint.price) / startPoint.price * 100);
    logger.log(`✅ Return: ${calculatedReturn.toFixed(2)}%`);
    logger.debug(`DEBUG: startPoint.price=${startPoint.price}, endPoint.price=${endPoint.price}, difference=${endPoint.price - startPoint.price}`);
    logger.debug(`TIMESTAMP DEBUG: startPoint.timestamp=${startPoint.timestamp}, endPoint.timestamp=${endPoint.timestamp}`);
  }

  if (!startPoint) {
    logger.warn(`⛔ No valid startPoint found for ${symbol}`);
    return { startPoint: null, endPoint: null };
  }

  if (!endPoint) {
    logger.warn(`⛔ No valid endPoint found for ${symbol}`);
    return { startPoint: null, endPoint: null };
  }

  logger.log(`Filtered ${sortedData.length} → start = ${startPoint?.price} @ ${startPoint?.timestamp}, end = ${endPoint?.price} @ ${endPoint?.timestamp}, buyDate = ${buyDateObj.toISOString()}`);

  return { startPoint, endPoint };
}

// Returns the percentage change between start and end point in a given timeframe
export function getReturnInTimeframe(data, timeframe, buyDate = null, symbol = "?") {
  const { startPoint, endPoint } = getSlicedData(data, timeframe, buyDate, symbol);
  if (!buyDate) {
    logger.warn(`⚠️ [getReturnInTimeframe] No buyDate passed for ${symbol}. Defaulting to timeframe start.`);
  }

  if (
    startPoint &&
    endPoint &&
    typeof startPoint.price === "number" &&
    typeof endPoint.price === "number" &&
    startPoint.price > 0
  ) {
    const percentChange = ((endPoint.price - startPoint.price) / startPoint.price) * 100;

    logger.log(`[Return %] ${symbol}:`);
    logger.log("Start Point (return %):", startPoint);
    logger.log("End Point (return %):", endPoint);
    logger.log("Calculated Return (return %):", percentChange);

    return percentChange;
  } else {
    logger.warn(`[Return %] Incomplete data for ${symbol}. Returning 0.`);
    return 0;
  }
}

