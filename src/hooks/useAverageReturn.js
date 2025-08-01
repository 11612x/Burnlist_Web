import { useMemo, useRef, useEffect } from 'react';
import { getAverageReturn } from '@logic/portfolioUtils';
import returnCalculator from '../data/returnCalculator';
import { logger } from '../utils/logger';

// Hook to calculate the average return (%) across a list of normalized ticker items
export function useAverageReturn(items, timeframe = 'MAX') {
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  return useMemo(() => {
    logger.debug('useAverageReturn called with items:', items);
    items.forEach((item, index) => {
      const hasHist = Array.isArray(item.historicalData) && item.historicalData.length > 0;
      const hasPrice = !isNaN(Number(item.buyPrice));
      if (!hasHist || !hasPrice) {
        logger.warn(`⚠️ Item ${index} is malformed:`, {
          symbol: item.symbol,
          buyPrice: item.buyPrice,
          historicalData: item.historicalData,
        });
      }
    });
    logger.debug(`[useAverageReturn] Calculating for timeframe: ${timeframe}`);
    logger.debug(`[useAverageReturn] Input items:`, items.length);

    if (!Array.isArray(items) || items.length === 0) {
      if (hasMounted.current) {
        logger.warn('⚠️ useAverageReturn received invalid or empty items');
      }
      return 0;
    }

    const hasMissingBuyDates = items.some(item => !item.buyDate);
    if (hasMissingBuyDates) {
      logger.warn('⚠️ Some items are missing buyDate. This may cause invalid return calculations.');
    }

    const validItems = items.filter((item, index) => {
      const hasHist = Array.isArray(item.historicalData) && item.historicalData.length >= 1;
      const hasPrice = !isNaN(Number(item.buyPrice)) && Number(item.buyPrice) > 0;
      const hasBuyDate = !!item.buyDate && new Date(item.buyDate).toString() !== 'Invalid Date';
      if (!hasHist) {
        logger.warn(`⚠️ Skipping item ${index} (${item.symbol}): insufficient historicalData`, item.historicalData);
        return false;
      }
      if (!hasPrice) {
        logger.warn(`⚠️ Skipping item ${index} (${item.symbol}): invalid buyPrice`, item.buyPrice);
        return false;
      }
      if (!hasBuyDate) {
        logger.warn(`⚠️ Skipping item ${index} (${item.symbol}): invalid buyDate`, item.buyDate);
        return false;
      }
      return true;
    });

    logger.debug(`Proceeding with ${validItems.length} valid items (filtered ${items.length - validItems.length})`);

    // Use the new timeframe-based return calculator
    const averageReturn = returnCalculator.calculateWatchlistReturn(validItems, timeframe);
    
    if (averageReturn === null) {
      logger.warn('⚠️ useAverageReturn: No valid return calculated');
      return 0;
    }

    // Display with 2 decimal places as per user preference  
    const displayReturn = parseFloat(averageReturn.toFixed(2));
    logger.debug(`useAverageReturn result (${timeframe}): ${displayReturn}%`);
    
    return Number.isFinite(displayReturn) ? displayReturn : 0;
  }, [items, timeframe, items.map(item => item.buyPrice).join(','), JSON.stringify({ timeframe, itemsLength: items.length })]); // More comprehensive dependency
}