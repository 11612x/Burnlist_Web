import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Components
import WatchlistChart from "@components/WatchlistChart";
import TickerTable from "@components/TickerTable";
import NotificationBanner from '@components/NotificationBanner';
import EditToggleButton from "@components/EditToggleButton";
import MobileChartWrapper from "@components/MobileChartWrapper";
import DatePicker from "@components/DatePicker";

// Hooks and Utils
import { useTheme } from '../ThemeContext';
import { calculateETFPrice, calculateTWAP, calculatePortfolioBeta } from '../utils/portfolioUtils';
import useNotification from '../hooks/useNotification';
import { logger } from '../utils/logger';

// Import the simple NAV calculator
import simpleNavCalculator from '../data/simpleNavCalculator';

// Import icons
import getIcon from '../assets/get.png';
import editIcon from '../assets/edit.png';

const CRT_GREEN = 'rgb(149,184,163)';
const CRT_GREEN_DARK = 'rgb(120,150,130)';
const CRT_GREEN_LIGHT = 'rgb(180,220,180)';
const CRT_RED = '#e31507';
const CRT_YELLOW = '#FFD700';
const CRT_ORANGE = '#FFA500';

// Utility function to calculate NYC trading days between two dates
const calculateNYCTradingDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Handle case where startDate is after endDate
  if (start > end) {
    return 0;
  }
  
  let tradingDays = 0;
  const current = new Date(start);
  
  // Set time to midnight to ensure consistent date comparison
  current.setHours(0, 0, 0, 0);
  const endDateMidnight = new Date(end);
  endDateMidnight.setHours(0, 0, 0, 0);
  
  while (current <= endDateMidnight) {
    const day = current.getDay();
    // Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5
    // Sunday = 0, Saturday = 6
    if (day >= 1 && day <= 5) {
      tradingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return tradingDays;
};

// Utility function to check if it's NYC trading hours
const isNYCTradingHours = () => {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay();
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const currentTime = hours * 100 + minutes;
  
  // Weekdays only, 9:30 AM - 4:00 PM ET
  if (day === 0 || day === 6) return false;
  if (currentTime < 930 || currentTime >= 1600) return false;
  return true;
};

const WatchlistPage = ({ watchlists, setWatchlists }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isInverted } = useTheme();
  
  // State
  const selectedTimeframe = "MAX"; // Always use MAX timeframe
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bulkSymbols, setBulkSymbols] = useState("");
  const [navData, setNavData] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [canFetch, setCanFetch] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingSymbols, setPendingSymbols] = useState([]);
  
  // Notifications
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();

  // Get current watchlist data
  const watchlist = useMemo(() => {
    if (!watchlists || !slug) return null;
    return Object.values(watchlists).find(w => w.slug === slug) || null;
  }, [watchlists, slug]);

  // Check if we can fetch (3-second cooldown)
  useEffect(() => {
    if (lastFetchTime) {
      const timeSinceLastFetch = Date.now() - lastFetchTime;
      const cooldownPeriod = 3000; // 3 seconds
      
      if (timeSinceLastFetch < cooldownPeriod) {
        setCanFetch(false);
        const remainingTime = cooldownPeriod - timeSinceLastFetch;
        setTimeout(() => setCanFetch(true), remainingTime);
      } else {
        setCanFetch(true);
      }
    }
  }, [lastFetchTime]);

  // Calculate portfolio metrics with NAV data
  const portfolioMetrics = useMemo(() => {
    if (!watchlist?.items || watchlist.items.length === 0) {
      return {
        averageReturn: 0,
        etfPriceData: null,
        twapData: null,
        betaData: null,
        realStockCount: 0,
        inactiveTickers: 0
      };
    }

    try {
      // Use NAV data if available
      let averageReturn = 0;
      if (navData.length > 0) {
        const latestNav = navData[navData.length - 1];
        averageReturn = latestNav.returnPercent || 0;
      }
      
      // Calculate other metrics
      const etfPriceData = calculateETFPrice(watchlist.items, selectedTimeframe);
      const twapData = calculateTWAP(watchlist.items);
      const betaData = calculatePortfolioBeta(watchlist.items, selectedTimeframe);
      
      // Count real stocks
      const realStockCount = watchlist.items.filter(item => item.type === 'real').length;

      return {
        averageReturn,
        etfPriceData,
        twapData,
        betaData,
        realStockCount,
        inactiveTickers: 0
      };
    } catch (error) {
      logger.error('Error calculating portfolio metrics:', error);
      return {
        averageReturn: 0,
        etfPriceData: null,
        twapData: null,
        betaData: null,
        realStockCount: 0,
        inactiveTickers: 0
      };
    }
  }, [watchlist?.items, selectedTimeframe, navData]);

  // Portfolio return data for chart with NAV metadata
  const portfolioReturnData = useMemo(() => {
    if (!watchlist?.items) return [];
    
    return watchlist.items.map(item => ({
      symbol: item.symbol,
      buyDate: item.buyDate,
      buyPrice: item.buyPrice,
      historicalData: item.historicalData,
      timeframe: selectedTimeframe,
      isInactive: false // No inactive tickers in static mode
    }));
  }, [watchlist?.items, selectedTimeframe]);

  // Fetch initial daily data for tickers using backend proxy
  const fetchInitialDailyData = async (symbols, startDate) => {
    try {
      setLoading(true);
      setNotification(`Fetching initial daily data for ${symbols.length} tickers...`, "info");
      
      // Debug: Check what symbols is
      console.log('🔍 fetchInitialDailyData called with symbols:', symbols);
      console.log('🔍 symbols type:', typeof symbols);
      console.log('🔍 symbols is array:', Array.isArray(symbols));
      console.log('🔍 symbols length:', symbols?.length);
      
      // Ensure symbols is an array
      if (!Array.isArray(symbols)) {
        console.error('❌ symbols is not an array:', symbols);
        throw new Error('Symbols must be an array');
      }
      
      // Calculate trading days from start date to now
      const tradingDays = calculateNYCTradingDays(startDate, new Date());
      logger.info(`📊 Trading days from ${startDate} to now: ${tradingDays}`);
      
      // Use backend proxy for historical data
      const symbolString = symbols.join(',');
      const response = await fetch(`/api/twelvedata-historical?symbols=${symbolString}&interval=1day&outputsize=${tradingDays}&start_date=${startDate}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check for API error responses
      if (data.status === 'error') {
        throw new Error(`API Error: ${data.message || 'Unknown error'}`);
      }
      
      const allTickers = [];
      
      // Handle both old and new backend response formats
      let processedData = data;
      
      // If backend returned old format, transform it to new format
      if (data.status === 'ok' && data.historicalData) {
        processedData = {};
        symbols.forEach(symbol => {
          processedData[symbol] = {
            historicalData: data.historicalData.map(item => ({
              price: parseFloat(item.close || item.price),
              close: parseFloat(item.close || item.price),
              open: parseFloat(item.open),
              high: parseFloat(item.high),
              low: parseFloat(item.low),
              timestamp: item.datetime || item.timestamp,
              volume: parseInt(item.volume),
              symbol: symbol
            }))
          };
        });
      }
      
      // Process each symbol
      for (const symbol of symbols) {
        const symbolData = processedData[symbol];
        
        if (symbolData && symbolData.historicalData && symbolData.historicalData.length > 0) {
          const historicalData = symbolData.historicalData;
          const firstPrice = historicalData[0].price; // Most recent price (current)
          const lastPrice = historicalData[historicalData.length - 1].price; // Oldest price (buy)
          
          console.log(`🔍 Historical data for ${symbol}:`, historicalData.slice(0, 3)); // Show first 3 data points
          console.log(`🔍 First price (current): ${firstPrice}, Last price (buy): ${lastPrice}`);
          
          const ticker = {
            symbol: symbol,
            historicalData: historicalData,
            buyPrice: lastPrice, // Oldest price = buy price
            buyDate: startDate,
            currentPrice: firstPrice, // Most recent price = current price
            lastPriceUpdate: new Date().toISOString(),
            type: 'real'
          };
          
          allTickers.push(ticker);
          logger.info(`✅ Added ${symbol} with ${historicalData.length} daily data points`);
        } else {
          logger.error(`❌ No data received for ${symbol}`);
        }
      }
      
      return allTickers;
    } catch (error) {
      logger.error('Error fetching initial daily data:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Manual fetch current prices for all tickers using backend proxy
  const handleManualFetch = async () => {
    if (!watchlist || !canFetch) return;
    
    setLoading(true);
    setLastFetchTime(Date.now());
    
    try {
      console.log('🔄 Manual fetch triggered for', watchlist.items.length, 'tickers');
      const updatedItems = [];
      let hasUpdates = false;
      const isTradingHours = isNYCTradingHours();
      
      // Batch symbols for API call
      const symbols = watchlist.items.map(item => item.symbol);
      const symbolString = symbols.join(',');
      const interval = '1min'; // Always use 1-minute intervals
      
      // Use backend proxy for current prices
      const response = await fetch(`/api/twelvedata-quote?symbols=${symbolString}&interval=${interval}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Check for API error responses
        if (data.status === 'error') {
          throw new Error(`API Error: ${data.message || 'Unknown error'}`);
        }
        
        // Process each ticker
        for (const item of watchlist.items) {
          const symbolData = data[item.symbol];
          
          if (symbolData && symbolData.price) {
            // Create new price point with actual current time
            const now = new Date();
            const timestamp = now.toISOString().split('T')[0] + ' ' + 
              now.getHours().toString().padStart(2, '0') + ':' +
              now.getMinutes().toString().padStart(2, '0') + ':' +
              now.getSeconds().toString().padStart(2, '0');
            
            const newPricePoint = {
              timestamp: timestamp,
              price: symbolData.price,
              volume: symbolData.volume || 0
            };
            
            // Add new price point to historical data
            item.historicalData.push(newPricePoint);
            item.currentPrice = newPricePoint.price;
            item.lastPriceUpdate = new Date().toISOString();
            hasUpdates = true;
            
            console.log(`✅ Updated ${item.symbol} with new price: $${newPricePoint.price} at ${newPricePoint.timestamp}`);
          }
          
          updatedItems.push(item);
        }
      }
      
      if (hasUpdates) {
        console.log('🔄 Updating watchlist with new data');
        // Update watchlist with new data
        const updatedWatchlists = { ...watchlists };
        const watchlistKey = Object.keys(updatedWatchlists).find(
          key => updatedWatchlists[key].slug === slug
        );
        
        if (watchlistKey) {
          updatedWatchlists[watchlistKey].items = updatedItems;
          setWatchlists(updatedWatchlists);
          
          // Calculate NAV with new data
          await calculateNAVFromMatchingTimestamps(updatedItems);
          console.log('✅ NAV calculation completed with new data');
        }
      } else {
        console.log('ℹ️ No new data to update');
      }
      
      setNotification("Prices fetched successfully", "success");
    } catch (error) {
      console.error('❌ Error in manual fetch:', error);
      setNotification("Failed to fetch prices", "error");
    } finally {
      setLoading(false);
    }
  };

  // Calculate NAV using the simple navCalculator
  const calculateNAVFromMatchingTimestamps = useCallback(async (items) => {
    if (!items || items.length === 0) return;
    
    try {
      logger.debug(`[WATCHLIST NAV] Calculating NAV for ${items.length} tickers using simple navCalculator`);
      
      // Show loading state
      setLoading(true);
      
      // Use setTimeout to make calculation asynchronous and prevent UI blocking
      const navDataPoints = await new Promise((resolve) => {
        setTimeout(() => {
          const result = simpleNavCalculator.calculateSimpleNAV(items);
          resolve(result);
        }, 0);
      });
      
      if (!navDataPoints || navDataPoints.length === 0) {
        logger.warn(`[WATCHLIST NAV] No NAV data returned from simple navCalculator`);
        setNavData([]);
        return;
      }
      
      logger.debug(`[WATCHLIST NAV] Simple navCalculator returned ${navDataPoints.length} NAV points`);
      
      // Set the NAV data directly - no transformation needed since output is already clean
      setNavData(navDataPoints);
      logger.debug(`[WATCHLIST NAV] Set ${navDataPoints.length} NAV points for chart`);
      
    } catch (error) {
      logger.error('❌ Error calculating NAV with simple navCalculator:', error);
      setNavData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate NAV when watchlist items change
  useEffect(() => {
    if (watchlist?.items && watchlist.items.length > 0) {
      logger.debug(`[WATCHLIST] Auto-calculating NAV for ${watchlist.items.length} tickers`);
      calculateNAVFromMatchingTimestamps(watchlist.items);
    }
  }, [watchlist?.items, selectedTimeframe, calculateNAVFromMatchingTimestamps]);

  // Handle adding new tickers with start date
  const handleAddTickers = async (symbols = bulkSymbols.split(',').map(s => s.trim()), startDate = watchlist.startDate) => {
    console.log('🔍 handleAddTickers called with symbols:', symbols);
    console.log('🔍 symbols type:', typeof symbols);
    console.log('🔍 symbols is array:', Array.isArray(symbols));
    console.log('🔍 bulkSymbols:', bulkSymbols);
    console.log('🔍 bulkSymbols type:', typeof bulkSymbols);
    
    // Ensure bulkSymbols is a string before splitting
    if (typeof bulkSymbols !== 'string') {
      console.error('❌ bulkSymbols is not a string:', bulkSymbols);
      setNotification('Error: Invalid input format', 'error');
      return;
    }
    
    if (!watchlist || !symbols || symbols.length === 0) return;
    
    try {
      setLoading(true);
      setNotification(`Adding ${symbols.length} tickers with start date ${startDate}...`, "info");
      
      // Fetch initial daily data for all tickers
      const newTickers = await fetchInitialDailyData(symbols, startDate);
      
      if (newTickers.length > 0) {
        const updatedWatchlists = { ...watchlists };
        const watchlistKey = Object.keys(updatedWatchlists).find(
          key => updatedWatchlists[key].slug === slug
        );
        
        if (watchlistKey) {
          updatedWatchlists[watchlistKey].items.push(...newTickers);
          setWatchlists(updatedWatchlists);
          
          // Calculate NAV with new tickers
          await calculateNAVFromMatchingTimestamps(updatedWatchlists[watchlistKey].items);
          
          setNotification(`${newTickers.length} tickers added with daily data`, "success");
        }
      }
    } catch (error) {
      logger.error('Error adding tickers:', error);
      setNotification(`Failed to add tickers: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle ticker operations
  const handleBuyPriceChange = (index, newPrice) => {
    if (!watchlist) return;
    
    const updatedWatchlists = { ...watchlists };
    const watchlistKey = Object.keys(updatedWatchlists).find(
      key => updatedWatchlists[key].slug === slug
    );
    
    if (watchlistKey) {
      updatedWatchlists[watchlistKey].items[index].buyPrice = parseFloat(newPrice);
      setWatchlists(updatedWatchlists);
      
      // Recalculate NAV
      calculateNAVFromMatchingTimestamps(updatedWatchlists[watchlistKey].items);
    }
  };

  const handleDeleteTicker = (index) => {
    if (!watchlist) return;
    
    const updatedWatchlists = { ...watchlists };
    const watchlistKey = Object.keys(updatedWatchlists).find(
      key => updatedWatchlists[key].slug === slug
    );
    
    if (watchlistKey) {
      updatedWatchlists[watchlistKey].items.splice(index, 1);
      setWatchlists(updatedWatchlists);
      
      // Recalculate NAV
      calculateNAVFromMatchingTimestamps(updatedWatchlists[watchlistKey].items);
      setNotification("Ticker removed", "success");
    }
  };

  // Initialize NAV calculation when watchlist changes
  useEffect(() => {
    if (watchlist?.items && watchlist.items.length > 0) {
      console.log('🔄 Initializing NAV calculation for', watchlist.items.length, 'tickers');
      calculateNAVFromMatchingTimestamps(watchlist.items);
    }
  }, [watchlist?.items, calculateNAVFromMatchingTimestamps]);

  // Redirect if watchlist not found
  useEffect(() => {
    if (slug && !watchlist) {
      setNotification("Watchlist not found", "error");
      navigate('/');
    }
  }, [slug, watchlist, navigate, setNotification]);

  if (!watchlist) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: "'Courier New', monospace",
        color: CRT_GREEN,
        background: 'black'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '2rem',
          background: 'black',
          border: `2px solid ${CRT_GREEN}`
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Loading watchlist...</div>
          <div style={{ fontSize: '0.9rem', color: CRT_GREEN_DARK }}>Initializing NAV calculations</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'black',
      color: CRT_GREEN,
      minHeight: '100vh',
      fontFamily: "'Courier New', monospace",
      position: 'relative'
    }}>
      {/* Notification Banner */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10001, 
          display: 'flex', 
          justifyContent: 'center', 
          pointerEvents: 'none'
        }}>
          <div style={{ 
            minWidth: 320, 
            maxWidth: 480, 
            pointerEvents: 'auto'
          }}>
            <NotificationBanner
              message={notification}
              type={notificationType}
              onClose={() => setNotification("")}
            />
          </div>
        </div>
      )}

      {/* Header Section */}
      <div style={{ 
        padding: "20px 20px 0 20px", 
        marginBottom: "30px",
        marginTop: portfolioMetrics.etfPriceData && portfolioMetrics.etfPriceData.averagePrice > 0 ? "50px" : "0px"
      }}>
        
        {/* Watchlist Name on Right */}
        <div style={{
          position: 'absolute',
          top: '-25px',
          right: '20px',
          fontSize: '23px',
          fontWeight: 'bold',
          color: CRT_GREEN,
          fontFamily: "'Courier New', monospace",
          zIndex: 10
        }}>
          {watchlist.name}
        </div>
        
        {/* Back Button on Left */}
        <div style={{
          position: 'absolute',
          top: '-25px',
          left: '20px',
          zIndex: 10
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img 
              src="/src/assets/backbutton.png" 
              alt="Back" 
              style={{ 
                width: '30px', 
                height: '30px',
                filter: 'brightness(0) saturate(100%) invert(85%) sepia(15%) saturate(638%) hue-rotate(86deg) brightness(95%) contrast(87%)'
              }} 
            />
          </button>
        </div>
        
        {/* NAV Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          backgroundColor: 'rgba(0,0,0,0.3)',
          border: `2px solid ${CRT_GREEN}`,
          borderRadius: '6px',
          marginTop: '16px',
          fontFamily: "'Courier New', monospace",
          fontSize: '14px',
          color: CRT_GREEN
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>NAV: 100% confidence</span>
            <span>{watchlist.items?.length || 0}/{watchlist.items?.length || 0} active</span>
          </div>
          <div>
            Last NAV: {lastFetchTime ? new Date(lastFetchTime).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              second: '2-digit',
              hour12: true 
            }) : 'Never'}
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div style={{ 
        padding: "0 20px 20px 20px",
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Chart Header with Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
        </div>

        {/* Chart Container */}
        <div style={{ marginBottom: '24px' }}>
          <MobileChartWrapper height={505}>
            <WatchlistChart
              portfolioReturnData={watchlist.items?.map(item => ({
                symbol: item.symbol,
                buyDate: item.buyDate,
                buyPrice: item.buyPrice,
                historicalData: item.historicalData,
                timeframe: selectedTimeframe
              })) || []}
              watchlistSlug={slug}
              timeframe={selectedTimeframe}
              showBacktestLine={false} 
              height={500}
              showTooltip={true}
              suppressEmptyMessage={true}
              navData={navData}
              navMetadata={{
                confidenceScore: 100,
                validTickers: watchlist.items?.length || 0,
                totalTickers: watchlist.items?.length || 0,
                marketStatus: 'manual'
              }}
            />
          </MobileChartWrapper>
        </div>

        {/* Controls between Chart and Table */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '0 4px'
        }}>
          <button
            onClick={handleManualFetch}
            disabled={loading || !canFetch}
            style={{
              background: 'transparent',
              color: CRT_GREEN,
              border: 'none',
              padding: '8px 16px',
              fontSize: '12px',
              fontFamily: "'Courier New'",
              cursor: (loading || !canFetch) ? 'not-allowed' : 'pointer',
              opacity: (loading || !canFetch) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              height: '40px'
            }}
            onMouseEnter={(e) => {
              if (!loading && canFetch) {
                e.target.style.background = CRT_GREEN;
                e.target.style.color = 'black';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = CRT_GREEN;
            }}
          >
            {loading ? (
              <span style={{ fontSize: '12px' }}>...</span>
            ) : (
              <img 
                src={getIcon} 
                alt="GET" 
                style={{ 
                  width: '20px', 
                  height: '20px',
                  filter: 'brightness(0) saturate(100%) invert(85%) sepia(15%) saturate(638%) hue-rotate(86deg) brightness(95%) contrast(87%)'
                }} 
              />
            )}
          </button>
          
          <EditToggleButton editMode={editMode} setEditMode={setEditMode} />
        </div>

        {/* Ticker Table Container */}
        <div style={{ marginBottom: '24px' }}>
          {Array.isArray(watchlist.items) && watchlist.items.length > 0 ? (
            <TickerTable
              items={watchlist.items}
              selectedTimeframe={selectedTimeframe}
              editMode={editMode}
              handleBuyPriceChange={handleBuyPriceChange}
              handleBuyDateChange={() => {}} // Not used in static mode
              handleRevertBuyDate={() => {}} // Not used in static mode
              handleFetchHistoricalData={() => {}} // Not used in static mode
              handleDelete={handleDeleteTicker}
              handleRefreshPrice={() => {}} // Not used in static mode
              showInactiveBadges={false}
            />
          ) : (
            <div style={{ 
              fontFamily: "'Courier New', monospace", 
              color: CRT_GREEN_DARK, 
              textAlign: "center", 
              padding: "40px 20px",
              fontSize: '1.1rem'
            }}>
              ⚠️ No tickers in this watchlist yet.
            </div>
          )}
        </div>

        {/* Add Ticker Input Container */}
        <div style={{
          display: "flex", 
          justifyContent: "center",
          marginTop: "20px"
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            maxWidth: '400px',
            height: '32px'
          }}>
            <input
              type="text"
              value={bulkSymbols}
              onChange={(e) => setBulkSymbols(e.target.value)}
              placeholder="e.g. SPY, QQQ"
              style={{
                flex: 1,
                height: '32px',
                fontFamily: "'Courier New', monospace",
                backgroundColor: 'black',
                border: `2px solid ${CRT_GREEN}`,
                borderRight: 'none',
                color: CRT_GREEN,
                outline: 'none',
                padding: '0 8px',
                fontSize: '14px',
                margin: '0',
                boxSizing: 'border-box'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddTickers();
                }
              }}
            />
            <button
              onClick={handleAddTickers}
              disabled={loading || !bulkSymbols.trim()}
              style={{
                width: '60px',
                height: '32px',
                fontSize: '14px',
                fontFamily: "'Courier New', monospace",
                backgroundColor: 'transparent',
                color: CRT_GREEN,
                border: `2px solid ${CRT_GREEN}`,
                borderLeft: 'none',
                borderTopLeftRadius: '0',
                borderBottomLeftRadius: '0',
                cursor: (loading || !bulkSymbols.trim()) ? 'not-allowed' : 'pointer',
                opacity: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0',
                margin: '0',
                boxSizing: 'border-box',
                fontWeight: 'bold'
              }}
              onMouseEnter={(e) => {
                if (!loading && bulkSymbols.trim()) {
                  e.target.style.background = CRT_GREEN;
                  e.target.style.color = 'black';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = CRT_GREEN;
              }}
            >
              {loading ? '...' : '+++'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Date Picker Modal */}
      <DatePicker
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onConfirm={async (selectedDate) => {
          // Set the start date for the watchlist
          const updatedWatchlists = { ...watchlists };
          const watchlistKey = Object.keys(updatedWatchlists).find(
            key => updatedWatchlists[key].slug === slug
          );
          
          if (watchlistKey) {
            updatedWatchlists[watchlistKey] = {
              ...updatedWatchlists[watchlistKey],
              startDate: selectedDate
            };
            setWatchlists(updatedWatchlists);
            
            // Add tickers with the selected start date
            await handleAddTickers(pendingSymbols, selectedDate);
          }
        }}
        title="Select Start Date for Watchlist"
      />
    </div>
  );
};

export default WatchlistPage; 