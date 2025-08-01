import { generatePortfolioTimeSeries } from "./portfolioUtils";
import { useMemo } from "react";
import { logger } from '../utils/logger';

function usePortfolioTimeSeries(tickers, timeframe) {
  return useMemo(() => {
    if (!Array.isArray(tickers) || tickers.length === 0) {
      logger.warn("📉 usePortfolioTimeSeries: No valid tickers provided.");
      return [];
    }

    const result = generatePortfolioTimeSeries(tickers, timeframe);
    logger.log(`📈 usePortfolioTimeSeries → Generated ${result.length} points for timeframe: ${timeframe}`);
    return result;
  }, [tickers, timeframe]);
}

export { usePortfolioTimeSeries };