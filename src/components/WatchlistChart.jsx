import React, { useMemo } from "react";
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
import navCalculator from '../data/navCalculator';
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

const WatchlistChart = ({ 
  portfolioReturnData, 
  watchlistSlug, 
  timeframe = 'W', // Add timeframe prop with default value
  height = 300, 
  showTooltip = true, 
  mini = false, 
  suppressEmptyMessage = false 
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const gray = useThemeColor('#888');
  
  // Memoize chart data for performance using ETF-style NAV calculation
  const chartData = useMemo(() => {
    // 🔍 SIMPLE DEBUG: WatchlistChart memo triggered
    console.log(`🔍 [WATCHLIST CHART MEMO] portfolioReturnData length: ${portfolioReturnData?.length || 0}`);
    console.log(`🔍 [WATCHLIST CHART MEMO] timeframe: ${timeframe}`);
    console.log(`🔍 [WATCHLIST CHART MEMO] watchlistSlug: ${watchlistSlug}`);
    
    // PRIORITY 1: Use NEW NAV Calculator (ETF-style NAV)
    if (portfolioReturnData && portfolioReturnData.length > 0) {
      console.log(`🔍 [WATCHLIST CHART] Using NEW NAV Calculator with ${portfolioReturnData.length} tickers`);
      
      try {
        const navData = navCalculator.calculateNAVPerformance(portfolioReturnData, timeframe);
        console.log(`🔍 [WATCHLIST CHART] NAV Calculator returned ${navData?.length || 0} data points`);
        
        if (navData && navData.length > 0) {
          // Normalize NAV data to start at 0%
          const baselineValue = navData[0]?.returnPercent || 0;
          console.log(`🔍 [WATCHLIST CHART] Normalizing NAV data - baseline value: ${baselineValue.toFixed(2)}%`);
          
          return navData.map((datapoint, index) => ({
            timestampValue: new Date(datapoint.timestamp).getTime(),
            returnPercent: datapoint.returnPercent - baselineValue, // Normalize to start at 0%
            xIndex: index
          }));
        }
      } catch (error) {
        console.error('🔍 [WATCHLIST CHART] Error in NAV Calculator:', error);
      }
    }
    
    // PRIORITY 2: Fallback to old watchlist chart data (if available)
    if (watchlistSlug) {
      const watchlistChartData = historicalDataManager.getWatchlistChartData(watchlistSlug);
      
      if (watchlistChartData.length > 0) {
        console.log(`🔍 [WATCHLIST CHART] Using OLD chart data for ${watchlistSlug}: ${watchlistChartData.length} datapoints`);
        logger.debug(`📊 Using watchlist chart data for ${watchlistSlug}: ${watchlistChartData.length} datapoints`);
        
        // Normalize old chart data to start at 0%
        const baselineValue = watchlistChartData[0]?.averageReturn || 0;
        console.log(`🔍 [WATCHLIST CHART] Normalizing OLD chart data - baseline value: ${baselineValue.toFixed(2)}%`);
        
        return watchlistChartData.map((datapoint, index) => ({
          timestampValue: new Date(datapoint.timestamp).getTime(),
          returnPercent: datapoint.averageReturn - baselineValue, // Normalize to start at 0%
          xIndex: index
        }));
      }
    }
    
    // PRIORITY 3: Fallback to empty array
    console.log(`🔍 [WATCHLIST CHART] No data available, returning empty array`);
    return [];
  }, [portfolioReturnData, timeframe, watchlistSlug]);

  // If no data, show empty chart or nothing if suppressed
  if (!chartData || chartData.length === 0) {
    if (suppressEmptyMessage) return null;
    return (
      <div style={{ textAlign: "center", padding: 40, color: green, fontFamily: "'Courier New'", background: black }}>
        No valid data to display yet.
      </div>
    );
  }

  // Prepare data for Chart.js
  const labels = chartData.map((_, index) => index);
  const data = chartData.map(point => point.returnPercent);

  // Calculate Y axis domain with enhanced curve visibility
  const returnPercents = chartData.map(p => Number.isFinite(p.returnPercent) ? p.returnPercent : 0);
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

  const chartDataConfig = {
    labels: labels,
    datasets: [
      {
        label: 'ETF NAV',
        data: data,
        borderColor: (context) => {
          // Dynamic color based on NAV value
          const dataIndex = context.dataIndex;
          const value = data[dataIndex];
          return value >= 0 ? CRT_GREEN : CRT_RED;
        },
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: showTooltip && !mini,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0,0,0,0.9)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        displayColors: false,
        titleFont: {
          family: 'Courier New',
          size: 12
        },
        bodyFont: {
          family: 'Courier New',
          size: 11
        },
        callbacks: {
          title: function(context) {
            // Show the date for the data point
            if (!context || !context[0]) return '';
            const dataIndex = context[0].dataIndex;
            const point = chartData[dataIndex];
            if (point && point.timestampValue) {
              const date = new Date(point.timestampValue);
              // Format as DD-MM-YY (European format)
              const day = String(date.getDate()).padStart(2, '0');
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const year = String(date.getFullYear()).slice(-2);
              const time = date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              });
              return `${day}-${month}-${year} ${time}`;
            }
            return '';
          },
          label: function(context) {
            if (!context || !context.parsed) return '';
            const returnValue = context.parsed.y;
            const prefix = returnValue >= 0 ? '+' : '';
            return `NAV: ${prefix}${returnValue.toFixed(2)}%`;
          },
          afterLabel: function(context) {
            if (!context || !context[0]) return '';
            const dataIndex = context[0].dataIndex;
            const point = chartData[dataIndex];
            if (point && point.xIndex !== undefined) {
              return `Point ${point.xIndex + 1}`;
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        display: !mini,
        grid: {
          display: false
        },
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
        display: false,
        grid: {
          display: true,
          color: (context) => {
            // Show only the zero line with low opacity
            return context.tick.value === 0 ? 'rgba(255, 255, 255, 0.3)' : 'transparent';
          },
          lineWidth: 1
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
    <div style={{ width: "100%", height, backgroundColor: 'transparent', fontFamily: 'Courier New', overflow: 'hidden' }}>
      <Line data={chartDataConfig} options={chartOptions} />
    </div>
  );
};

export default WatchlistChart;