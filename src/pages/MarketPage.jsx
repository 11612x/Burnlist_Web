import React, { useState, useEffect, useMemo } from "react";
import { useTheme, useThemeColor } from '../ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import NavigationBar from '@components/NavigationBar';
import greenflag from '../assets/greenflag.png';
import yellowflag from '../assets/yellowflag.png';
import redflag from '../assets/redflag.png';
import backbutton from '../assets/backbutton.png';
import useNotification from '../hooks/useNotification';
import { getCachedExchange } from '../utils/exchangeDetector';
import { loadSectorDataFromFile, calculateSectorStats, getTopPerformers, getWorstPerformers } from '../utils/sectorDataLoader.js';
import { fetchMarketOverview } from '../data/twelvedataAdapter';
import { logger } from '../utils/logger';

import logo from '../assets/logo.png';
import logoblack from '../assets/logoblack.png';
import DetailedSectorCharts from '../components/DetailedSectorCharts';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

const CRT_GREEN = 'rgb(140,185,162)';

const MarketPage = () => {
  const { isInverted, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');

  // Market data state
  const [marketData, setMarketData] = useState({
    sp500: { name: 'SP500', price: 0, change: 0, changePercent: 0 },
    nasdaq: { name: 'NASDAQ', price: 0, change: 0, changePercent: 0 },
    dow: { name: 'DOW', price: 0, change: 0, changePercent: 0 },
    vix: { name: 'VIX', price: 0, change: 0, changePercent: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Sector performance data
  const [sectorData, setSectorData] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('YearToDate');
  const [sectorStats, setSectorStats] = useState({});
  const [topPerformers, setTopPerformers] = useState([]);
  const [worstPerformers, setWorstPerformers] = useState([]);

  // Load market data on mount and when timeframe changes
  useEffect(() => {
    loadMarketData();
  }, [selectedTimeframe]);

  // Recalculate top/worst performers when timeframe changes
  useEffect(() => {
    if (sectorData.length > 0) {
      const timeframeKey = selectedTimeframe.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
      const topPerformersList = getTopPerformers(sectorData, timeframeKey, 3);
      const worstPerformersList = getWorstPerformers(sectorData, timeframeKey, 3);
      setTopPerformers(topPerformersList);
      setWorstPerformers(worstPerformersList);
    }
  }, [selectedTimeframe, sectorData]);

  const loadMarketData = async () => {
    setIsLoading(true);
    try {
      // Map selected timeframe to Twelve Data format
      const timeframeMap = {
        'day': '1day',
        'week': '1week', 
        'month': '1month',
        'quarter': '3month',
        'yeartodate': 'yearToDate'
      };
      
      // Handle the special case for YearToDate
      const timeframeKey = selectedTimeframe === 'YearToDate' ? 'yeartodate' : selectedTimeframe.toLowerCase();
      const twelveDataTimeframe = timeframeMap[timeframeKey] || '1day';
      
      // Fetch real market data using Twelve Data API
      const marketOverviewData = await fetchMarketOverview(twelveDataTimeframe);
      
      // Debug log the returned data
      logger.log('📊 Market Overview Data:', marketOverviewData);
      
      // Transform the data to match our expected format
      const transformedData = {
        sp500: marketOverviewData.sp500 || { name: 'SP500', price: 0, change: 0, changePercent: 0 },
        nasdaq: marketOverviewData.nasdaq || { name: 'NASDAQ', price: 0, change: 0, changePercent: 0 },
        dow: marketOverviewData.dow || { name: 'DOW', price: 0, change: 0, changePercent: 0 },
        vix: marketOverviewData.vix || { name: 'VIX', price: 0, change: 0, changePercent: 0 }
      };
      
      // Ensure all data has the required properties
      Object.keys(transformedData).forEach(key => {
        if (!transformedData[key].name) {
          transformedData[key].name = key.toUpperCase();
        }
        if (typeof transformedData[key].price !== 'number') {
          transformedData[key].price = 0;
        }
        if (typeof transformedData[key].change !== 'number') {
          transformedData[key].change = 0;
        }
        if (typeof transformedData[key].changePercent !== 'number') {
          transformedData[key].changePercent = 0;
        }
      });
      
      logger.log('📊 Transformed Data:', transformedData);
      
      setMarketData(transformedData);
      setNotification("Market data loaded successfully", "success");
      
      // Try to load sector data from CSV file
      let sectorData = await loadSectorDataFromFile('/sector-data.csv');
      
      // If CSV loading fails, use mock data
      if (!sectorData || sectorData.length === 0) {
        logger.warn('Failed to load CSV data, using mock data');
        sectorData = [
          { 
            symbol: 'AAPL', name: 'Apple Inc.', price: 178.90,
            week: -4.63, month: -3.34, quarter: 5.66, half_year: 2.72, year: 0.70, year_to_date: 9.90,
            analyst_recom: 2.04, avg_volume: 709328.16, relative_volume: 1.08, change: -0.48, volume: 766214341.00
          },
          { 
            symbol: 'MSFT', name: 'Microsoft Corp.', price: 345.67,
            week: -0.52, month: 1.43, quarter: 15.71, half_year: 3.20, year: 29.72, year_to_date: 11.56,
            analyst_recom: 1.60, avg_volume: 638713.19, relative_volume: 1.11, change: -1.59, volume: 711595174.00
          },
          { 
            symbol: 'GOOGL', name: 'Alphabet Inc.', price: 134.56,
            week: -4.67, month: -1.62, quarter: 8.57, half_year: -7.38, year: 15.19, year_to_date: -2.57,
            analyst_recom: 1.82, avg_volume: 1448328.31, relative_volume: 1.10, change: -3.08, volume: 1593523147.00
          },
          { 
            symbol: 'AMZN', name: 'Amazon.com Inc.', price: 145.23,
            week: -1.60, month: -2.46, quarter: -1.23, half_year: 1.28, year: 7.31, year_to_date: 4.41,
            analyst_recom: 2.00, avg_volume: 503732.57, relative_volume: 1.01, change: 0.48, volume: 508926113.00
          },
          { 
            symbol: 'TSLA', name: 'Tesla Inc.', price: 245.67,
            week: -1.28, month: -1.36, quarter: 7.26, half_year: -3.27, year: -4.25, year_to_date: 1.80,
            analyst_recom: 1.94, avg_volume: 765347.41, relative_volume: 0.91, change: -1.39, volume: 695800246.00
          },
          { 
            symbol: 'NVDA', name: 'NVIDIA Corp.', price: 890.12,
            week: -3.69, month: -1.55, quarter: 8.10, half_year: 3.08, year: 20.15, year_to_date: 10.30,
            analyst_recom: 2.06, avg_volume: 1435291.89, relative_volume: 1.16, change: -1.63, volume: 1667379359.00
          },
          { 
            symbol: 'META', name: 'Meta Platforms Inc.', price: 456.78,
            week: -4.50, month: -3.82, quarter: -5.35, half_year: -13.07, year: -14.67, year_to_date: -7.35,
            analyst_recom: 1.86, avg_volume: 1364870.92, relative_volume: 1.32, change: 0.47, volume: 1795722275.00
          },
          { 
            symbol: 'AMD', name: 'Advanced Micro Devices', price: 156.78,
            week: -3.23, month: 1.16, quarter: 14.30, half_year: 6.26, year: 15.41, year_to_date: 12.00,
            analyst_recom: 2.04, avg_volume: 970235.49, relative_volume: 1.10, change: -1.44, volume: 1066111094.00
          },
          { 
            symbol: 'NFLX', name: 'Netflix Inc.', price: 567.89,
            week: -3.13, month: -1.07, quarter: 0.25, half_year: -2.14, year: -2.25, year_to_date: -0.41,
            analyst_recom: 1.93, avg_volume: 510249.51, relative_volume: 1.19, change: -0.26, volume: 606765936.00
          },
          { 
            symbol: 'CRM', name: 'Salesforce Inc.', price: 234.56,
            week: -2.14, month: 1.27, quarter: 20.66, half_year: 10.28, year: 25.44, year_to_date: 10.15,
            analyst_recom: 1.67, avg_volume: 2583026.34, relative_volume: 0.97, change: -2.22, volume: 2496969869.00
          },
          { 
            symbol: 'ORCL', name: 'Oracle Corp.', price: 123.45,
            week: 1.07, month: 4.86, quarter: 7.86, half_year: 10.18, year: 19.05, year_to_date: 13.99,
            analyst_recom: 2.12, avg_volume: 230278.34, relative_volume: 1.00, change: 0.06, volume: 230236110.00
          }
        ];
      }

      // Calculate statistics and rankings
      const stats = calculateSectorStats(sectorData);
      const topPerformersList = getTopPerformers(sectorData, 'year_to_date', 3);
      const worstPerformersList = getWorstPerformers(sectorData, 'year_to_date', 3);

      setSectorData(sectorData);
      setSectorStats(stats);
      setTopPerformers(topPerformersList);
      setWorstPerformers(worstPerformersList);
      setLastUpdated(new Date());
      setNotification("Market data loaded successfully", "success");
    } catch (error) {
      logger.error("Error loading market data:", error);
      setNotification("Failed to load market data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (change) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  const formatChangePercent = (changePercent) => {
    const sign = changePercent >= 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(2)}%`;
  };

  const getChangeColor = (change) => {
    return change >= 0 ? green : red;
  };

  const handleRefresh = () => {
    loadMarketData();
  };

  const handleTickerClick = async (symbol) => {
    if (!symbol) return;
    
    try {
      const exchange = await getCachedExchange(symbol);
      const encodedSymbol = encodeURIComponent(`${exchange}:${symbol.toUpperCase()}`);
      const chartUrl = `https://www.tradingview.com/chart/i0seCgVv/?symbol=${encodedSymbol}`;
      window.open(chartUrl, '_blank');
    } catch (error) {
      logger.warn(`⚠️ Error opening chart for ${symbol}:`, error);
      const encodedSymbol = encodeURIComponent(`NASDAQ:${symbol.toUpperCase()}`);
      const chartUrl = `https://www.tradingview.com/chart/i0seCgVv/?symbol=${encodedSymbol}`;
      window.open(chartUrl, '_blank');
    }
  };

  // Chart configurations
  const performanceChartData = useMemo(() => {
    const labels = sectorData.map(sector => sector.name);
    const timeframeKey = selectedTimeframe.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
    const data = sectorData.map(sector => sector[timeframeKey] || 0);
    
    return {
      labels,
      datasets: [
        {
          label: `${selectedTimeframe.replace(/([A-Z])/g, ' $1').trim()} Performance (%)`,
          data,
          backgroundColor: data.map(value => value >= 0 ? green : red),
          borderColor: data.map(value => value >= 0 ? green : red),
          borderWidth: 2,
          borderRadius: 4,
        }
      ]
    };
  }, [sectorData, selectedTimeframe, green, red]);

  const volumeChartData = useMemo(() => {
    const labels = sectorData.map(sector => sector.name);
    const volumeData = sectorData.map(sector => sector.volume / 1000000); // Convert to millions
    
    return {
      labels,
      datasets: [
        {
          label: 'Trading Volume (Millions)',
          data: volumeData,
          backgroundColor: green + '40',
          borderColor: green,
          borderWidth: 2,
          borderRadius: 4,
        }
      ]
    };
  }, [sectorData, green]);

  const analystChartData = useMemo(() => {
    const labels = sectorData.map(sector => sector.name);
    const analystData = sectorData.map(sector => sector.analyst_recom || 0);
    
    return {
      labels,
      datasets: [
        {
          label: 'Analyst Recommendation Score',
          data: analystData,
          backgroundColor: sectorData.map(sector => {
            const score = sector.analyst_recom || 0;
            if (score <= 1.5) return green;
            if (score <= 2.0) return yellowflag;
            return red;
          }),
          borderColor: sectorData.map(sector => {
            const score = sector.analyst_recom || 0;
            if (score <= 1.5) return green;
            if (score <= 2.0) return yellowflag;
            return red;
          }),
          borderWidth: 2,
          borderRadius: 4,
        }
      ]
    };
  }, [sectorData, green, red]);

  const relativeVolumeChartData = useMemo(() => {
    const labels = sectorData.map(sector => sector.name);
    const relativeVolumeData = sectorData.map(sector => sector.relative_volume || 0);
    
    return {
      labels,
      datasets: [
        {
          label: 'Relative Volume',
          data: relativeVolumeData,
          backgroundColor: relativeVolumeData.map(value => 
            value > 1.2 ? green : value > 0.8 ? yellowflag : red
          ),
          borderColor: relativeVolumeData.map(value => 
            value > 1.2 ? green : value > 0.8 ? yellowflag : red
          ),
          borderWidth: 2,
          borderRadius: 4,
        }
      ]
    };
  }, [sectorData, green, red]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#ffffff',
          font: {
            family: "'Courier New', monospace",
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: '#000000',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: green,
        borderWidth: 2,
        cornerRadius: 0,
        displayColors: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#ffffff',
          font: {
            family: "'Courier New', monospace",
            size: 10
          }
        },
        grid: {
          color: gray + '30'
        }
      },
      y: {
        ticks: {
          color: '#ffffff',
          font: {
            family: "'Courier New', monospace",
            size: 10
          }
        },
        grid: {
          color: gray + '30'
        }
      }
    }
  };

  const timeframes = [
    { key: 'day', label: 'D' },
    { key: 'week', label: 'W' },
    { key: 'month', label: 'M' },
    { key: 'quarter', label: '3M' },
    { key: 'yearToDate', label: 'YTD' }
  ];


  return (
    <div style={{
      minHeight: '100vh',
      background: isInverted ? '#ffffff' : '#000000',
      color: isInverted ? '#000000' : '#ffffff',
      fontFamily: "'Courier New', monospace"
    }}>
      
      <div style={{ padding: '32px' }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: 12
          }}>
            <button
              onClick={toggleTheme}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                minHeight: '44px',
              }}
              aria-label="Toggle theme"
            >
              <img 
                src={isInverted ? logoblack : logo} 
                alt="Burnlist Logo" 
                style={{ 
                  width: 44, 
                  height: 44, 
                  marginRight: 10, 
                  transition: 'filter 0.3s'
                }} 
              />
            </button>
            <strong style={{ 
              fontSize: '170%', 
              lineHeight: '44px', 
              display: 'inline-block',
              color: green,
              height: '44px'
            }}>BURNLIST v1.1</strong>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10
          }}>
            <span style={{ color: red, fontWeight: 'bold', fontSize: 12 }}>0</span>
            <span style={{ color: green, fontWeight: 'bold', fontSize: 12 }}>0</span>
            <span style={{ color: green }}>
              ACCOUNT: local
            </span>
          </div>
        </div>

        <NavigationBar />

        {/* Timeframe Selector and Refresh Button */}
        <div style={{ marginBottom: 24, paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            flexWrap: 'wrap' 
          }}>
            {timeframes.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedTimeframe(key === 'yearToDate' ? 'YearToDate' : key.charAt(0).toUpperCase() + key.slice(1))}
                style={{
                  padding: '8px 16px',
                  border: `2px solid ${selectedTimeframe.toLowerCase() === key ? green : gray}`,
                  background: selectedTimeframe.toLowerCase() === key ? green : '#000000',
                  color: selectedTimeframe.toLowerCase() === key ? '#000000' : '#ffffff',
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontFamily: "'Courier New', monospace",
                  fontSize: 12
                }}
              >
                {label}
              </button>
            ))}
          </div>
          
          <CustomButton
            onClick={handleRefresh}
            disabled={isLoading}
            style={{
              backgroundColor: green,
              color: '#000000',
              padding: '8px 16px',
              border: 'none',
              borderRadius: 0,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: "'Courier New', monospace",
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </CustomButton>
        </div>

        {/* Market Overview Cards */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ color: green, marginBottom: 16 }}>MARKET OVERVIEW</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16 
          }}>
            {Object.entries(marketData).map(([key, data]) => {
              // Debug log each card's data
              logger.log(`📊 Market Card ${key}:`, data);
              return (
                <div key={key} style={{
                  background: '#000000',
                  padding: 16,
                  borderRadius: 0,
                  border: `2px solid ${gray}`
                }}>
                  <div style={{ fontSize: 12, color: gray, marginBottom: 4 }}>
                    {data.name}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4, color: '#ffffff' }}>
                    {isLoading ? 'Loading...' : `$${formatPrice(data.price)}`}
                  </div>
                  <div style={{ fontSize: 14, color: getChangeColor(data.changePercent) }}>
                    {isLoading ? '---' : `${formatChange(data.change)} (${formatChangePercent(data.changePercent)})`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performers & Statistics */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ color: green, marginBottom: 16 }}>MARKET LEADERS</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: 16 
          }}>
            {/* Top Performers */}
            <div style={{
              background: '#000000',
              padding: 16,
              borderRadius: 0,
              border: `2px solid ${green}`
            }}>
              <h4 style={{ color: green, marginBottom: 12 }}>TOP PERFORMERS ({selectedTimeframe.replace(/([A-Z])/g, ' $1').trim()})</h4>
              {topPerformers.map((stock, index) => {
                const timeframeKey = selectedTimeframe.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
                const value = stock[timeframeKey] || 0;
                return (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: index < topPerformers.length - 1 ? `1px solid ${gray}20` : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleTickerClick(stock.symbol)}
                  title={`Click to open ${stock.symbol} chart`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 'bold', color: green }}>{stock.symbol}</span>
                      <span style={{ fontSize: 11, color: gray }}>{stock.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        color: getChangeColor(value),
                        fontWeight: 'bold',
                        fontSize: 14
                      }}>
                        {value.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: 11, color: gray }}>
                        ${stock.price?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Worst Performers */}
            <div style={{
              background: '#000000',
              padding: 16,
              borderRadius: 0,
              border: `2px solid ${green}`
            }}>
              <h4 style={{ color: green, marginBottom: 12 }}>WORST PERFORMERS ({selectedTimeframe.replace(/([A-Z])/g, ' $1').trim()})</h4>
              {worstPerformers.map((stock, index) => {
                const timeframeKey = selectedTimeframe.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
                const value = stock[timeframeKey] || 0;
                return (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: index < worstPerformers.length - 1 ? `1px solid ${gray}20` : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleTickerClick(stock.symbol)}
                  title={`Click to open ${stock.symbol} chart`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 'bold', color: green }}>{stock.symbol}</span>
                      <span style={{ fontSize: 11, color: gray }}>{stock.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        color: getChangeColor(value),
                        fontWeight: 'bold',
                        fontSize: 14
                      }}>
                        {value.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: 11, color: gray }}>
                        ${stock.price?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>


          </div>
        </div>



        {/* Analyst Recommendations */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ color: green, marginBottom: 16 }}>ANALYST RECOMMENDATIONS</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: 16 
          }}>
            {/* Buy Recommendations */}
            <div style={{
              background: '#000000',
              padding: 16,
              borderRadius: 0,
              border: `2px solid ${green}`
            }}>
              <h4 style={{ color: green, marginBottom: 12 }}>BUY RECOMMENDATIONS</h4>
              {sectorData
                .filter(stock => stock.analyst_recom <= 2.0)
                .slice(0, 5)
                .map((stock, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: index < 4 ? `1px solid ${gray}20` : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleTickerClick(stock.symbol)}
                  title={`Click to open ${stock.symbol} chart`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 'bold', color: green }}>{stock.symbol}</span>
                      <span style={{ fontSize: 11, color: gray }}>{stock.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        color: stock.analyst_recom <= 1.5 ? green : yellowflag,
                        fontWeight: 'bold',
                        fontSize: 14
                      }}>
                        {stock.analyst_recom?.toFixed(2) || '0.00'}
                      </div>
                      <div style={{ fontSize: 11, color: gray }}>
                        ${stock.price?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Sell Recommendations */}
            <div style={{
              background: '#000000',
              padding: 16,
              borderRadius: 0,
              border: `2px solid ${green}`
            }}>
              <h4 style={{ color: green, marginBottom: 12 }}>SELL RECOMMENDATIONS</h4>
              {sectorData
                .filter(stock => stock.analyst_recom > 2.0)
                .slice(0, 5)
                .map((stock, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: index < 4 ? `1px solid ${gray}20` : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleTickerClick(stock.symbol)}
                  title={`Click to open ${stock.symbol} chart`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 'bold', color: green }}>{stock.symbol}</span>
                      <span style={{ fontSize: 11, color: gray }}>{stock.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        color: red,
                        fontWeight: 'bold',
                        fontSize: 14
                      }}>
                        {stock.analyst_recom?.toFixed(2) || '0.00'}
                      </div>
                      <div style={{ fontSize: 11, color: gray }}>
                        ${stock.price?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Relative Volume */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ color: green, marginBottom: 16 }}>RELATIVE VOLUME</h3>
          <div style={{ background: '#000000', padding: 16, borderRadius: 0, border: `2px solid ${green}` }}>
            {sectorData.slice(0, 10).map((stock, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < 9 ? `1px solid ${gray}20` : 'none',
                cursor: 'pointer'
              }}
              onClick={() => handleTickerClick(stock.symbol)}
              title={`Click to open ${stock.symbol} chart`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 'bold', color: green }}>{stock.symbol}</span>
                  <span style={{ fontSize: 11, color: gray }}>{stock.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    color: stock.relative_volume > 1.2 ? green : stock.relative_volume > 0.8 ? yellowflag : red,
                    fontWeight: 'bold',
                    fontSize: 14
                  }}>
                    {stock.relative_volume?.toFixed(2) || '0.00'}
                  </div>
                  <div style={{ fontSize: 11, color: gray }}>
                    ${stock.price?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Sector Charts */}
        <div style={{ marginBottom: 32 }}>
  
          <DetailedSectorCharts selectedTimeframe={selectedTimeframe} />
        </div>



        {lastUpdated && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: 16, 
            fontSize: 12, 
            color: gray 
          }}>
            Last updated: {lastUpdated.toLocaleString()}
          </div>
        )}
      </div>

      <NotificationBanner
        notification={notification}
        notificationType={notificationType}
        setNotification={setNotification}
        setNotificationType={setNotificationType}
      />
    </div>
  );
};

export default MarketPage; 