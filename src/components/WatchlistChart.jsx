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

const CRT_GREEN = 'rgb(140,185,162)';

const WatchlistChart = ({ 
  portfolioReturnData, 
  watchlistSlug, 
  height = 300, 
  showTooltip = true, 
  mini = false, 
  suppressEmptyMessage = false 
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const gray = useThemeColor('#888');
  
  // Memoize chart data for performance
  const chartData = useMemo(() => {
    // If we have a watchlist slug, use the new watchlist chart data
    if (watchlistSlug) {
      const watchlistChartData = historicalDataManager.getWatchlistChartData(watchlistSlug);
      
      if (watchlistChartData.length > 0) {
        logger.debug(`📊 Using watchlist chart data for ${watchlistSlug}: ${watchlistChartData.length} datapoints`);
        
        // Convert to chart format
        return watchlistChartData.map((datapoint, index) => ({
          timestampValue: new Date(datapoint.timestamp).getTime(),
          returnPercent: datapoint.averageReturn,
          xIndex: index
        }));
      } else {
        logger.debug(`⚠️ No watchlist chart data found for ${watchlistSlug}, falling back to individual ticker data`);
      }
    }
    
    // Fallback to original individual ticker calculation
    if (!Array.isArray(portfolioReturnData) || portfolioReturnData.length === 0) return [];
    
    logger.debug(`🔍 WatchlistChart: Processing ${portfolioReturnData.length} portfolio entries`);
    
    // 1. For each ticker, slice to the selected timeframe
    const sliced = portfolioReturnData.map(entry => {
      if (!entry || !Array.isArray(entry.historicalData) || entry.historicalData.length === 0) {
        logger.debug(`⚠️ Skipping entry with no historical data:`, entry);
        return null;
      }
      
      const { historicalData, buyDate, buyPrice, symbol, timeframe } = entry;
      logger.debug(`🔍 Processing ${symbol}: ${historicalData.length} historical points, timeframe: ${timeframe}`);
      
      // Debug: Show the date range of available data
      const sortedData = [...historicalData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const firstDate = new Date(sortedData[0].timestamp);
      const lastDate = new Date(sortedData[sortedData.length - 1].timestamp);
      logger.debug(`📅 ${symbol} data range: ${firstDate.toISOString()} to ${lastDate.toISOString()}`);
      
      const validBuyDate = buyDate && new Date(buyDate).toString() !== 'Invalid Date' ? buyDate : null;
      const { startPoint, endPoint } = getSlicedData(historicalData, timeframe, validBuyDate, symbol, buyPrice);
      
      if (!startPoint || !endPoint) {
        logger.debug(`⚠️ No valid start/end points for ${symbol} in timeframe ${timeframe}`);
        return null;
      }
      
      logger.debug(`🔍 ${symbol}: startPoint=${startPoint.timestamp}, endPoint=${endPoint.timestamp}`);
      
      // Only keep points within the timeframe
      const effectiveStart = new Date(startPoint.timestamp).getTime();
      const effectiveEnd = new Date(endPoint.timestamp).getTime();
      let points = historicalData.filter(p => {
        const t = new Date(p.timestamp).getTime();
        return t >= effectiveStart && t <= effectiveEnd;
      }).map(p => ({ ...p, timestampValue: new Date(p.timestamp).getTime() }));
      
      logger.debug(`🔍 ${symbol}: ${points.length} points within timeframe (${effectiveStart} to ${effectiveEnd})`);
      
      // If we have very few points, log the actual timestamps
      if (points.length <= 5) {
        logger.debug(`🔍 ${symbol} timestamps:`, points.map(p => new Date(p.timestamp).toISOString()));
      }
      
      // If no points found, this might be the issue for weekly/monthly
      if (points.length === 0) {
        console.warn(`⚠️ No points found for ${symbol} in timeframe ${timeframe}!`);
        console.warn(`⚠️ This could be why the chart line is not showing.`);
        console.warn(`⚠️ Available data: ${historicalData.length} points from ${firstDate.toISOString()} to ${lastDate.toISOString()}`);
        console.warn(`⚠️ Requested timeframe: ${timeframe} (start: ${new Date(effectiveStart).toISOString()}, end: ${new Date(effectiveEnd).toISOString()})`);
        
        // For debugging: show what the timeframe calculation is doing
        if (timeframe === 'W' || timeframe === 'M') {
          console.warn(`🔍 DEBUG: ${timeframe} timeframe calculation:`);
          console.warn(`🔍 - Buy date: ${validBuyDate}`);
          console.warn(`🔍 - Start point: ${startPoint ? startPoint.timestamp : 'null'}`);
          console.warn(`🔍 - End point: ${endPoint ? endPoint.timestamp : 'null'}`);
          console.warn(`🔍 - Effective start: ${new Date(effectiveStart).toISOString()}`);
          console.warn(`🔍 - Effective end: ${new Date(effectiveEnd).toISOString()}`);
        }
      }
      
      // Insert a synthetic point at the start if needed
      if (points.length > 0 && points[0].timestampValue > effectiveStart) {
        points.unshift({
          ...points[0],
          timestamp: new Date(effectiveStart).toISOString(),
          timestampValue: effectiveStart,
          price: points[0].price
        });
      }
      // Insert a synthetic point at the end if needed
      if (points.length > 0 && points[points.length - 1].timestampValue < effectiveEnd) {
        points.push({
          ...points[points.length - 1],
          timestamp: new Date(effectiveEnd).toISOString(),
          timestampValue: effectiveEnd,
          price: points[points.length - 1].price
        });
      }
      
      // Store startPoint for correct return calculation
      return { symbol, points, timeframe, buyDate, buyPrice, startPoint };
    }).filter(Boolean);
    
    if (sliced.length === 0) {
      logger.debug(`⚠️ No valid sliced data found`);
      return [];
    }
    
    logger.debug(`✅ Sliced data: ${sliced.length} valid entries`);
    
    // 2. Build a unified, sorted list of timestamps across all tickers
    const allTimestamps = Array.from(new Set(sliced.flatMap(t => t.points.map(p => p.timestampValue)))).sort((a, b) => a - b);
    if (allTimestamps.length === 0) {
      logger.debug(`⚠️ No timestamps found after flattening`);
      return [];
    }
    
    logger.debug(`🔍 Total unique timestamps: ${allTimestamps.length}`);
    
    // 3. Downsample to 30 evenly spaced points (or 5 if mini) with minimum time gap
    const maxPoints = mini ? 5 : 30;
    const step = allTimestamps.length <= maxPoints ? 1 : Math.floor(allTimestamps.length / maxPoints);
    const sampledTimestamps = allTimestamps.filter((_, i) => i % step === 0);
    
    // Always include the last point
    if (sampledTimestamps[sampledTimestamps.length - 1] !== allTimestamps[allTimestamps.length - 1]) {
      sampledTimestamps.push(allTimestamps[allTimestamps.length - 1]);
    }
    
    logger.debug(`🔍 After downsampling: ${sampledTimestamps.length} points`);
    
    // 4. Apply minimum time gap to prevent very close timestamps (minimum 1 hour apart)
    // TEMPORARY: Reduce minimum time gap for debugging
    const minTimeGap = 60 * 60 * 1000; // 1 hour in milliseconds
    
    // If we have very few timestamps, don't filter at all
    // FIX: This prevents the chart from showing only 2 datapoints when data is sparse
    if (sampledTimestamps.length <= 5) {
      logger.debug(`🔍 Very few timestamps (${sampledTimestamps.length}), skipping time gap filtering`);
      const filteredTimestamps = sampledTimestamps;
      
      logger.debug(`🔍 Chart data processing: ${allTimestamps.length} total timestamps → ${sampledTimestamps.length} sampled → ${filteredTimestamps.length} filtered`);
      if (filteredTimestamps.length > 0) {
        logger.debug(`🔍 First timestamp: ${new Date(filteredTimestamps[0]).toISOString()}`);
        logger.debug(`🔍 Last timestamp: ${new Date(filteredTimestamps[filteredTimestamps.length - 1]).toISOString()}`);
      }
      
      // 5. Calculate portfolio returns for each timestamp
      const chartData = filteredTimestamps.map((timestamp, index) => {
        let totalReturn = 0;
        let validTickers = 0;
        
        sliced.forEach(ticker => {
          // Check if ticker has valid points
          if (!ticker.points || ticker.points.length === 0) {
            logger.debug(`⚠️ Skipping ${ticker.symbol}: no valid points`);
            return;
          }
          
          // Find the closest price point for this ticker at this timestamp
          const closestPoint = ticker.points.reduce((closest, point) => {
            const currentDiff = Math.abs(point.timestampValue - timestamp);
            const closestDiff = Math.abs(closest.timestampValue - timestamp);
            return currentDiff < closestDiff ? point : closest;
          });
          
          if (closestPoint && closestPoint.price > 0) {
            // Calculate cumulative return from buy price (not time series)
            const returnPercent = ((closestPoint.price - ticker.buyPrice) / ticker.buyPrice) * 100;
            if (Number.isFinite(returnPercent)) {
              totalReturn += returnPercent;
              validTickers++;
            }
          }
        });
        
        const averageReturn = validTickers > 0 ? totalReturn / validTickers : 0;
        
        return {
          timestampValue: timestamp,
          returnPercent: averageReturn,
          xIndex: index
        };
      });
      // Debug log
      logger.debug('Chart data points:', chartData);
      return chartData;
    }
    
    const filteredTimestamps = [];
    for (let i = 0; i < sampledTimestamps.length; i++) {
      const currentTs = sampledTimestamps[i];
      const lastTs = filteredTimestamps[filteredTimestamps.length - 1];
      
      if (i === 0 || !lastTs || (currentTs - lastTs) >= minTimeGap) {
        filteredTimestamps.push(currentTs);
      } else {
        logger.debug(`🔍 Skipping close timestamp: ${new Date(currentTs).toISOString()} (${Math.round((currentTs - lastTs) / 1000)}s after ${new Date(lastTs).toISOString()})`);
      }
    }
    
    logger.debug(`🔍 Chart data processing: ${allTimestamps.length} total timestamps → ${sampledTimestamps.length} sampled → ${filteredTimestamps.length} filtered`);
    if (filteredTimestamps.length > 0) {
      logger.debug(`🔍 First timestamp: ${new Date(filteredTimestamps[0]).toISOString()}`);
      logger.debug(`🔍 Last timestamp: ${new Date(filteredTimestamps[filteredTimestamps.length - 1]).toISOString()}`);
    }
    
    // If we have very few points after filtering, try to be less aggressive
    if (filteredTimestamps.length < 3 && allTimestamps.length > 2) {
      logger.debug(`⚠️ Too few points after filtering (${filteredTimestamps.length}), using all timestamps`);
      return allTimestamps.map((ts, i) => {
        const returns = sliced.map(ticker => {
          // For each ticker, find the closest point <= ts
          const idx = ticker.points.findIndex(p => p.timestampValue >= ts);
          const point = idx === -1 ? ticker.points[ticker.points.length - 1] : ticker.points[idx];
          // Always use the startPoint.price for return calculation
          const start = ticker.startPoint;
          if (!start || !point || start.price === 0) return 0;
          const val = ((point.price - start.price) / start.price) * 100;
          return Number.isFinite(val) ? val : 0;
        });
        const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        return {
          timestampValue: ts,
          returnPercent: Number.isFinite(avgReturn) ? avgReturn : 0,
          xIndex: i
        };
      });
    }
    
    // 5. Calculate portfolio returns for each timestamp
    if (filteredTimestamps.length === 0) {
      logger.debug(`⚠️ No valid timestamps found for chart data`);
      return [];
    }
    
    const chartData = filteredTimestamps.map((timestamp, index) => {
      let totalReturn = 0;
      let validTickers = 0;
      
      sliced.forEach(ticker => {
        // Check if ticker has valid points
        if (!ticker.points || ticker.points.length === 0) {
          console.warn(`⚠️ Skipping ${ticker.symbol}: no valid points`);
          return;
        }
        
        // Find the closest price point for this ticker at this timestamp
        const closestPoint = ticker.points.reduce((closest, point) => {
          const currentDiff = Math.abs(point.timestampValue - timestamp);
          const closestDiff = Math.abs(closest.timestampValue - timestamp);
          return currentDiff < closestDiff ? point : closest;
        });
        
        if (closestPoint && closestPoint.price > 0) {
          let returnPercent = 0;
          
          if (index === 0) {
            // First data point should always show 0% return (baseline)
            returnPercent = 0;
          } else {
            // For subsequent points, calculate return from the first point price
            const firstPoint = ticker.points[0];
            if (firstPoint && firstPoint.price > 0) {
              returnPercent = ((closestPoint.price - firstPoint.price) / firstPoint.price) * 100;
            }
          }
          
          if (Number.isFinite(returnPercent)) {
            totalReturn += returnPercent;
            validTickers++;
          }
        }
      });
      
      const averageReturn = validTickers > 0 ? totalReturn / validTickers : 0;
      
      return {
        timestampValue: timestamp,
        returnPercent: averageReturn,
        xIndex: index
      };
    });
    // Debug log
          logger.debug('Chart data points:', chartData);
    return chartData;
  }, [portfolioReturnData, mini, JSON.stringify(portfolioReturnData.map(item => ({
    symbol: item.symbol,
    buyPrice: item.buyPrice,
    buyDate: item.buyDate,
    timeframe: item.timeframe
  })))]);

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
        backgroundColor: 'transparent',
        titleColor: green,
        bodyColor: green,
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
            return `Return: ${prefix}${returnValue.toFixed(2)}%`;
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
          display: false
        },
        border: {
          display: false // Remove X-axis border
        }
      },
      y: {
        display: !mini,
        grid: {
          display: true,
          color: (context) => {
            // Show only the zero line with low opacity
            return context.tick.value === 0 ? 'rgba(140, 185, 162, 0.3)' : 'transparent';
          },
          lineWidth: 1
        },
        ticks: {
          display: false,
          // Add zero tick to ensure zero line appears
          callback: function(value) {
            return value === 0 ? '0' : '';
          }
        },
        border: {
          display: false // Remove Y-axis border
        },
        min: yMin,
        max: yMax
      }
    },
    elements: {
      point: {
        radius: 0, // Hide all dots
        hoverRadius: 0, // Hide hover dots too
        backgroundColor: green,
        borderColor: black,
        borderWidth: 1
      },
      line: {
        borderColor: green,
        borderWidth: 2,
        tension: 0.4 // Increased tension for more pronounced curves
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  const chartDataConfig = {
    labels: labels,
    datasets: [
      {
        label: 'Portfolio Return',
        data: data,
        borderColor: green,
        backgroundColor: green,
        fill: false,
        tension: 0.4 // Increased tension for more pronounced curves
      }
    ]
  };

  return (
    <div style={{ width: "100%", height, backgroundColor: 'transparent', fontFamily: 'Courier New', overflow: 'hidden' }}>
      <Line data={chartDataConfig} options={chartOptions} />
    </div>
  );
};

export default WatchlistChart;