import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import CustomTooltip from "./CustomTooltip";
import { getSlicedData, getReturnInTimeframe } from '@logic/portfolioUtils';
import { useThemeColor } from '../ThemeContext';
import historicalDataManager from '../data/historicalDataManager';
import navEventEmitter from '../data/navEventEmitter';
import realTimeNavCalculator from '../data/realTimeNavCalculator';
import { logger } from '../utils/logger';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CRT_GREEN = 'rgb(149,184,163)';
const CRT_RED = '#e31507';
const CRT_YELLOW = '#FFD700'; // For fallback points
const CRT_ORANGE = '#FFA500'; // For bootstrapped points
const CRT_PURPLE = '#800080'; // For anomaly points

const WatchlistChart = React.memo(({ 
  portfolioReturnData, 
  watchlistSlug, 
  timeframe = 'W', // Add timeframe prop with default value
  height = 300, 
  showTooltip = true, 
  mini = false, 
  suppressEmptyMessage = false,
  hideAxes = false,
  hideBorder = false,
  navData = [],
  navMetadata = {}
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const gray = useThemeColor('#888');
  
  // Real-time update state
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [isDataStale, setIsDataStale] = useState(false);
  const [updateSource, setUpdateSource] = useState(null);
  const [chartData, setChartData] = useState([]);
  const unsubscribeRef = useRef(null);
  const updateTimerRef = useRef(null);

  // Subscribe to real-time NAV updates
  useEffect(() => {
    if (!watchlistSlug) return;

    logger.debug(`[WATCHLIST CHART] Subscribing to real-time updates for ${watchlistSlug}`);

    // Subscribe to NAV updates
    unsubscribeRef.current = navEventEmitter.subscribe(watchlistSlug, (navData, metadata) => {
      logger.debug(`[WATCHLIST CHART] Received NAV update for ${watchlistSlug}`, metadata);
      
      // Update state with new NAV data
      const processedData = processNavData(navData);
      setChartData(processedData);
      setLastUpdateTime(new Date(metadata.timestamp));
      setUpdateSource(metadata.source);
      setIsDataStale(false);
    });

    // Start stale data timer
    updateTimerRef.current = setInterval(() => {
      const stale = navEventEmitter.isDataStale(watchlistSlug);
      setIsDataStale(stale);
    }, 10000); // Check every 10 seconds

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [watchlistSlug]);

  // Process NAV data for chart display
  const processNavData = (navData) => {
    if (!navData || navData.length === 0) return [];

    // Track quality statistics with cohort information
    const validPoints = navData.filter(p => p.valid).length;
    const fallbackPoints = navData.filter(p => !p.valid).length;
    const bootstrappedPoints = navData.filter(p => p.bootstrapped).length;
    const anomalyPoints = navData.filter(p => p.anomaly).length;
    const totalPoints = navData.length;
    const avgConfidence = navData.reduce((sum, p) => sum + (p.confidenceScore || 0), 0) / totalPoints;
    
    // Calculate cohort statistics
    const avgFullWeightTickers = navData.reduce((sum, p) => sum + (p.fullWeightTickers || 0), 0) / totalPoints;
    const avgFallbackTickers = navData.reduce((sum, p) => sum + (p.fallbackTickers || 0), 0) / totalPoints;
    const cohortSize = navData[0]?.cohortSize || 0;
    
    logger.debug(`[WATCHLIST CHART] NAV Quality: ${validPoints} valid, ${fallbackPoints} fallback, ${bootstrappedPoints} bootstrapped, ${anomalyPoints} anomalies (${((validPoints/totalPoints)*100).toFixed(1)}% quality, avg confidence: ${avgConfidence.toFixed(2)})`);
    logger.debug(`[WATCHLIST CHART] Cohort: ${cohortSize} tickers, avg full weight: ${avgFullWeightTickers.toFixed(1)}, avg fallback: ${avgFallbackTickers.toFixed(1)}`);
    
    // Normalize NAV data to start at 0%
    const baselineValue = navData[0]?.returnPercent || 0;
    logger.debug(`[WATCHLIST CHART] Normalizing NAV data - baseline value: ${baselineValue.toFixed(2)}%`);
    
    return navData.map((datapoint, index) => ({
      timestampValue: new Date(datapoint.timestamp).getTime(),
      returnPercent: datapoint.returnPercent - baselineValue, // Normalize to start at 0%
      etfPrice: datapoint.etfPrice || 0,
      xIndex: index,
      valid: datapoint.valid,
      source: datapoint.source,
      dataCoverage: datapoint.dataCoverage,
      validTickers: datapoint.validTickers,
      totalTickers: datapoint.totalTickers,
      reason: datapoint.reason,
      bootstrapped: datapoint.bootstrapped,
      fallbackStrategy: datapoint.fallbackStrategy,
      confidenceScore: datapoint.confidenceScore,
      anomaly: datapoint.anomaly,
      marketStatus: datapoint.marketStatus,
      volatility: datapoint.volatility,
      cohortSize: datapoint.cohortSize,
      fullWeightTickers: datapoint.fullWeightTickers,
      fallbackTickers: datapoint.fallbackTickers
    }));
  };

  // Memoize portfolio return data for chart
  const memoizedChartData = useMemo(() => {
    // PRIORITY 0: Use navData if provided (from simpleNavCalculator)
    if (navData && navData.length > 0) {
      logger.debug(`[WATCHLIST CHART] Using provided navData: ${navData.length} points`);
      
      // Convert navData to chart format
      return navData.map((datapoint, index) => ({
        timestampValue: new Date(datapoint.timestamp).getTime(),
        returnPercent: datapoint.returnPercent,
        etfPrice: datapoint.etfPrice || 0,
        xIndex: index,
        valid: true,
        source: 'simple-nav',
        dataCoverage: datapoint.validTickers / datapoint.totalTickers,
        validTickers: datapoint.validTickers,
        totalTickers: datapoint.totalTickers,
        confidenceScore: 1.0
      }));
    }
    
    // If we have real-time data, use it
    if (chartData.length > 0) {
      logger.debug(`[WATCHLIST CHART] Using real-time NAV data: ${chartData.length} points`);
      return chartData;
    }
    
    // PRIORITY 1: Use NEW NAV Calculator (cohort-based NAV with confidence scoring)
    if (portfolioReturnData && portfolioReturnData.length > 0) {
      logger.debug(`[WATCHLIST CHART] Using NEW NAV Calculator with ${portfolioReturnData.length} tickers for timeframe ${timeframe}`);
      
      try {
        // Simple fallback: calculate average of individual ticker returns
        let totalReturn = 0;
        let validTickers = 0;
        
        portfolioReturnData.forEach(item => {
          try {
            const buyPrice = item.buyPrice || 0;
            const currentPrice = item.currentPrice || (item.historicalData && item.historicalData.length > 0 ? 
              item.historicalData[0].price : 0); // First element = newest price
            
            if (buyPrice > 0 && currentPrice > 0) {
              const tickerReturn = ((currentPrice - buyPrice) / buyPrice) * 100;
              totalReturn += tickerReturn;
              validTickers++;
            }
          } catch (error) {
            logger.error(`Error calculating return for ${item.symbol}:`, error);
          }
        });
        
        const average = validTickers > 0 ? totalReturn / validTickers : 0;
        logger.debug(`[WATCHLIST CHART] Simple NAV calculation result: ${average.toFixed(2)}%`);
        
        // Return array of NAV data points for chart compatibility
        return [{
          timestampValue: new Date().getTime(),
          returnPercent: average,
          xIndex: 0,
          valid: true,
          source: 'simple',
          dataCoverage: validTickers / portfolioReturnData.length,
          validTickers: validTickers,
          totalTickers: portfolioReturnData.length,
          confidenceScore: 1.0 // Simple calculation has full confidence
        }];
      } catch (error) {
        logger.error(`[WATCHLIST CHART] Error in NAV Calculator for timeframe ${timeframe}:`, error);
      }
    } else {
      logger.warn(`[WATCHLIST CHART] No portfolio data available for timeframe ${timeframe}`);
    }
    
    // PRIORITY 2: Fallback to old watchlist chart data (if available)
    if (watchlistSlug) {
      const watchlistChartData = historicalDataManager.getWatchlistChartData(watchlistSlug);
      
      if (watchlistChartData.length > 0) {
        logger.debug(`[WATCHLIST CHART] Using OLD chart data for ${watchlistSlug}: ${watchlistChartData.length} datapoints`);
        
        // Normalize old chart data to start at 0%
        const baselineValue = watchlistChartData[0]?.averageReturn || 0;
        logger.debug(`[WATCHLIST CHART] Normalizing OLD chart data - baseline value: ${baselineValue.toFixed(2)}%`);
        
        return watchlistChartData.map((datapoint, index) => ({
          timestampValue: new Date(datapoint.timestamp).getTime(),
          returnPercent: datapoint.averageReturn - baselineValue, // Normalize to start at 0%
          xIndex: index,
          valid: true, // Assume old data is valid
          source: 'legacy',
          dataCoverage: 1.0, // Assume full coverage for legacy data
          validTickers: datapoint.tickerCount || 0,
          totalTickers: datapoint.tickerCount || 0,
          confidenceScore: 0.8 // Assume good confidence for legacy data
        }));
      } else {
        logger.warn(`[WATCHLIST CHART] No legacy chart data available for ${watchlistSlug}`);
      }
    }
    
    // PRIORITY 3: Fallback to empty array
    logger.warn(`[WATCHLIST CHART] No data available for timeframe ${timeframe}, returning empty array`);
    return [];
  }, [portfolioReturnData, timeframe, watchlistSlug, chartData]);

  // Format last update time for display
  const formatLastUpdateTime = () => {
    if (!lastUpdateTime) return 'No data';
    
    const now = new Date();
    const timeDiff = now.getTime() - lastUpdateTime.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));
    
    if (minutesDiff < 1) {
      return `${Math.floor(timeDiff / 1000)}s ago`;
    } else if (minutesDiff < 60) {
      return `${minutesDiff}m ago`;
    } else {
      const hoursDiff = Math.floor(minutesDiff / 60);
      return `${hoursDiff}h ago`;
    }
  };

  // Get update status color
  const getUpdateStatusColor = () => {
    if (!lastUpdateTime) return gray;
    if (isDataStale) return CRT_RED;
    if (updateSource === 'realtime') return CRT_GREEN;
    return gray;
  };

  // If no data, show empty chart or nothing if suppressed
  if (!memoizedChartData || memoizedChartData.length === 0) {
    return null;
  }

  // Prepare data for Chart.js - use actual data without padding
  const labels = memoizedChartData.map((_, index) => index);
  const data = memoizedChartData.map(point => point.returnPercent);

  // Calculate Y axis domain with enhanced curve visibility
  const returnPercents = memoizedChartData.map(p => Number.isFinite(p.returnPercent) ? p.returnPercent : 0);
  const minReturn = Math.min(...returnPercents);
  const maxReturn = Math.max(...returnPercents);
  const range = maxReturn - minReturn;
  
  // Enhanced scaling for better curve visibility
  let yMin, yMax;
  
  if (range === 0) {
    // If all values are the same, create a small range around the value
    const value = minReturn;
    const smallRange = Math.max(Math.abs(value) * 0.1, 0.5); // 10% of value or 0.5 minimum
    yMin = value - smallRange;
    yMax = value + smallRange;
  } else {
    // For varying values, use more generous margins to keep line in bounds
    const margin = Math.max(range * 0.1, 1.0); // 10% of range or 1.0 minimum
    yMin = minReturn - margin;
    yMax = maxReturn + margin;
  }
  
  // Ensure we have a reasonable range even for very small variations
  if (Math.abs(yMax - yMin) < 2.0) {
    const center = (yMax + yMin) / 2;
    yMin = center - 1.0;
    yMax = center + 1.0;
  }
  
  // Ensure zero is always included in the range for zero line visibility
  if (yMin > 0) yMin = 0;
  if (yMax < 0) yMax = 0;

  const chartDataConfig = {
    labels: labels,
    datasets: [
      {
        label: 'ETF NAV',
        data: data,
        borderColor: (context) => {
          // Dynamic color based on NAV value, quality, and confidence
          const dataIndex = context.dataIndex;
          if (dataIndex >= 0 && dataIndex < memoizedChartData.length) {
            const point = memoizedChartData[dataIndex];
            const value = point.returnPercent;
            const confidence = point.confidenceScore || 0;
            
            // Color coding based on confidence and anomalies
            if (point.anomaly) {
              return CRT_PURPLE; // Anomaly points in purple
            } else if (confidence < 50) {
              return CRT_YELLOW; // Low confidence in yellow
            } else if (point.driftWarning) {
              return CRT_ORANGE; // Drift warning in orange
            }
            return value >= 0 ? CRT_GREEN : CRT_RED;
          }
          return CRT_GREEN; // Default
        },
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        borderWidth: (context) => {
          // Line thickness based on confidence and quality
          const dataIndex = context.dataIndex;
          if (dataIndex >= 0 && dataIndex < memoizedChartData.length) {
            const point = memoizedChartData[dataIndex];
            const confidence = point.confidenceScore || 0;
            
            if (point.anomaly) {
              return 5; // Thickest for anomalies
            } else if (confidence < 30) {
              return 4; // Thick for very low confidence
            } else if (confidence < 50) {
              return 3; // Thicker for low confidence
            } else if (point.driftWarning) {
              return 3; // Thicker for drift warnings
            }
            return 2; // Normal for high confidence
          }
          return 2;
        }
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: showTooltip && !mini,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0,0,0,0.95)',
        titleColor: (context) => {
          if (!context || !context.tooltipItems || !context.tooltipItems[0] || !context.tooltipItems[0].parsed) {
            return CRT_GREEN;
          }
          const returnValue = context.tooltipItems[0].parsed.y;
          return returnValue >= 0 ? CRT_GREEN : CRT_RED;
        },
        bodyColor: (context) => {
          if (!context || !context.tooltipItems || !context.tooltipItems[0] || !context.tooltipItems[0].parsed) {
            return CRT_GREEN;
          }
          const returnValue = context.tooltipItems[0].parsed.y;
          return returnValue >= 0 ? CRT_GREEN : CRT_RED;
        },
        borderColor: (context) => {
          if (!context || !context.tooltipItems || !context.tooltipItems[0] || !context.tooltipItems[0].parsed) {
            return CRT_GREEN;
          }
          const returnValue = context.tooltipItems[0].parsed.y;
          return returnValue >= 0 ? CRT_GREEN : CRT_RED;
        },
        borderWidth: 2,
        displayColors: false,
        padding: 8,
        cornerRadius: 6,
        titleFont: {
          family: 'Courier New',
          size: 15
        },
        bodyFont: {
          family: 'Courier New',
          size: 12
        },
        callbacks: {
          title: function(context) {
            // Show return and ETF price on top
            if (!context || !context[0] || !context[0].parsed || !memoizedChartData || !memoizedChartData.length) {
              return '';
            }
            
            const dataIndex = context[0].dataIndex;
            
            if (dataIndex < 0 || dataIndex >= memoizedChartData.length) {
              return '';
            }
            
            const point = memoizedChartData[dataIndex];
            const returnValue = context[0].parsed.y;
            const prefix = returnValue >= 0 ? '+' : '';
            
            // Return % and ETF price on top
            let title = `Return: ${prefix}${returnValue.toFixed(2)}%`;
            
            // Add ETF price if available
            if (point && point.etfPrice !== undefined && point.etfPrice > 0) {
              title += ` | ETF: $${point.etfPrice.toFixed(2)}`;
            }
            
            return title;
          },
          label: function(context) {
            // Show the date/time below
            console.log('🔍 Label callback called with context:', context);
            if (!context) {
              console.log('❌ No context');
              return '';
            }
            const dataIndex = context.dataIndex;
            console.log('🔍 Data index:', dataIndex);
            const point = memoizedChartData[dataIndex];
            console.log('🔍 Point data:', point);
            if (point && point.timestampValue) {
              // Use timestampValue (milliseconds) and convert to date
              const date = new Date(point.timestampValue);
              if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = String(date.getFullYear()).slice(-2);
                const time = date.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                });
                const result = `${day}-${month}-${year} ${time}`;
                console.log('✅ Returning date/time:', result);
                return result;
              }
            }
            console.log('❌ No valid timestamp found');
            return 'No date';
          }
        }
      }
    },
    scales: {
      x: {
        display: !mini && !hideAxes,
        grid: {
          display: false
        },
        min: -1,
        max: labels.length,
        ticks: {
          display: false,
          color: '#ffffff',
          font: {
            family: 'Courier New',
            size: 10
          }
        },
        border: {
          display: false
        }
      },
      y: {
        display: !hideAxes,
        grid: {
          display: !hideAxes,
          color: (context) => {
            // Show only the zero line with CRT green color
            return context.tick.value === 0 ? 'rgba(149, 184, 163, 0.3)' : 'transparent';
          },
          lineWidth: 1,
          drawBorder: false,
          drawOnChartArea: true,
          drawTicks: false,
          offset: false,
          borderDash: (context) => {
            // Make zero line dashed
            return context.tick.value === 0 ? [5, 5] : [];
          }
        },
        ticks: {
          display: false,
          color: '#ffffff',
          font: {
            family: 'Courier New',
            size: 10
          },
          callback: function(value) {
            return value === 0 ? '0%' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
          }
        },
        border: {
          display: false
        },
        min: yMin,
        max: yMax
      }
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 0
      },
      line: {
        tension: 0.4
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  return (
    <div style={{ width: "100%", height, backgroundColor: 'transparent', fontFamily: 'Courier New', overflow: 'hidden', position: 'relative' }}>
      {/* Real-time update indicator */}
      {!mini && (
        <div style={{
          position: 'absolute',
          top: 5,
          right: 5,
          fontSize: '10px',
          color: getUpdateStatusColor(),
          opacity: isDataStale ? 0.6 : 1,
          transition: 'opacity 0.3s ease',
          zIndex: 10,
          fontFamily: 'Courier New'
        }}>
          {formatLastUpdateTime()}
          {updateSource && ` (${updateSource})`}
        </div>
      )}
      
      <Line data={chartDataConfig} options={chartOptions} />
    </div>
  );
});

export default WatchlistChart;