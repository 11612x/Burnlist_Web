import React, { useState, useEffect, useRef, useMemo } from "react";
import { fetchManager } from '@data/twelvedataFetchManager';
import normalizeTicker from "@data/normalizeTicker";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import WatchlistHeader from "@components/WatchlistHeader";
import WatchlistChart from "@components/WatchlistChart";
import TimeframeSelector from "@components/TimeframeSelector";
import TickerTable from "@components/TickerTable";
import AddTickerInput from "@components/AddTickerInput";

import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import NavigationBar from '@components/NavigationBar';
import EditToggleButton from "@components/EditToggleButton";
import MobileChartWrapper from "@components/MobileChartWrapper";
import { useTheme } from '../ThemeContext';
import { calculateETFPrice, calculateTWAP, calculatePortfolioBeta } from '../utils/portfolioUtils';
import useNotification from '../hooks/useNotification';
import { logger } from '../utils/logger';

import realTimeNavCalculator from '../data/realTimeNavCalculator';
import navEventEmitter from '../data/navEventEmitter';
import RealTimeNavStatus from '../components/RealTimeNavStatus';

const CRT_GREEN = 'rgb(149,184,163)';

// Helper function to convert confidence percentage to descriptive label
const getConfidenceLabel = (confidence) => {
  if (confidence >= 90) return 'excellent';
  if (confidence >= 75) return 'good';
  if (confidence >= 50) return 'fair';
  if (confidence >= 25) return 'poor';
  return 'unreliable';
};

// Utility: Check if extended trading hours are active (Mon-Fri, 4:00am-8:00pm ET)
function isMarketOpen() {
  const now = new Date();
  // Get NY time (works regardless of user's timezone)
  const nyTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const day = nyTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = nyTime.getHours();
  // Extended trading hours: Mon-Fri, 4:00am-8:00pm ET
  // Includes pre-market (4am-9:30am), regular (9:30am-4pm), after-hours (4pm-8pm)
  if (day === 0 || day === 6) return false; // No weekend trading
  if (hours < 4) return false;  // Before 4:00 AM ET
  if (hours >= 20) return false; // After 8:00 PM ET (>= 20:00)
  return true;
}

const BurnPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // FIX: Changed from 'D' to 'W' to get more data points for the chart
  // 'D' (daily) timeframe was too restrictive and filtered out most historical data
  const [selectedTimeframe, setSelectedTimeframe] = useState("W");
  
  // Debug timeframe changes
  useEffect(() => {
    logger.log("🎯 [BURN PAGE] selectedTimeframe changed to:", selectedTimeframe);
  }, [selectedTimeframe]);

  const [watchlist, setWatchlist] = useState(null);
  const [watchlists, setWatchlists] = useState({});
  const [bulkSymbols, setBulkSymbols] = useState("");
  const [buyPrice, setBuyPrice] = useState(null);
  const [buyDate, setBuyDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();
  const [editMode, setEditMode] = useState(false);
  const { isInverted } = useTheme();
  const [countdown, setCountdown] = useState(null);

  // Add debugging for timeframe changes - MOVED AFTER VARIABLE DECLARATIONS
  useEffect(() => {
    logger.log(`🔍 [TIMEFRAME CHANGE DEBUG] selectedTimeframe changed to: ${selectedTimeframe}`);
    logger.log(`🔍 [TIMEFRAME CHANGE DEBUG] watchlist items count: ${watchlist?.items?.length || 0}`);
    
    if (watchlist?.items && watchlist.items.length > 0) {
      logger.log(`🔍 [TIMEFRAME CHANGE DEBUG] First item: ${watchlist.items[0].symbol}`);
      logger.log(`🔍 [TIMEFRAME CHANGE DEBUG] Historical data points: ${watchlist.items[0].historicalData?.length || 0}`);
      
      // Test NAV calculation for first item
      try {
        const firstItem = watchlist.items[0];
        logger.log(`🔍 [TIMEFRAME CHANGE DEBUG] First item: ${firstItem.symbol}`);
      } catch (error) {
        logger.error(`🔍 [TIMEFRAME CHANGE DEBUG] Error testing first item:`, error);
      }
      
      // Special debug for D timeframe
      if (selectedTimeframe === 'D') {
        logger.log(`🔍 [D TIMEFRAME DEBUG] Testing D timeframe data availability...`);
        
        // Inspect actual historical data
        logger.log(`🔍 [D TIMEFRAME DEBUG] Watchlist items: ${watchlist.items.length}`);
        watchlist.items.forEach((item, index) => {
          logger.log(`🔍 [D TIMEFRAME DEBUG] Item ${index}: ${item.symbol}`);
          logger.log(`🔍 [D TIMEFRAME DEBUG]   - Historical data points: ${item.historicalData?.length || 0}`);
          if (item.historicalData && item.historicalData.length > 0) {
            const firstPoint = item.historicalData[0];
            const lastPoint = item.historicalData[item.historicalData.length - 1];
            logger.log(`🔍 [D TIMEFRAME DEBUG]   - First point: ${firstPoint.timestamp} @ $${firstPoint.price}`);
            logger.log(`🔍 [D TIMEFRAME DEBUG]   - Last point: ${lastPoint.timestamp} @ $${lastPoint.price}`);
            
            // Check how many points are from today (last 24 hours)
            const now = new Date().getTime();
            const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
            const todayPoints = item.historicalData.filter(point => {
              const pointTime = new Date(point.timestamp).getTime();
              return pointTime >= twentyFourHoursAgo;
            });
            logger.log(`🔍 [D TIMEFRAME DEBUG]   - Points from last 24h: ${todayPoints.length}`);
          }
        });
      }
    }
  }, [selectedTimeframe, watchlist]);

  // NEW NAV CALCULATION: Calculate average return using simple logic
  const averageReturn = useMemo(() => {
    if (!watchlist?.items || watchlist.items.length === 0) return 0;
    
    try {
      // Simple fallback: calculate average of individual ticker returns
      let totalReturn = 0;
      let validTickers = 0;
      
      watchlist.items.forEach(item => {
        try {
          // Get the buy price from the last element of historical data (oldest price = start date)
          const buyPrice = item.historicalData && item.historicalData.length > 0 ? 
            item.historicalData[item.historicalData.length - 1].price : 0;
          // Get current price from the first element of historical data (most recent price)
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
      logger.log(`🔍 [BURN PAGE NAV DEBUG] Average return: ${average.toFixed(2)}%`);
      return average;
      
    } catch (error) {
      logger.error('Error calculating average return:', error);
      return 0;
    }
  }, [watchlist?.items, selectedTimeframe]);
  
  // Calculate ETF-like average price for the watchlist
  const etfPriceData = calculateETFPrice(watchlist?.items || [], selectedTimeframe);
  const twapData = calculateTWAP(watchlist?.items || []);
  const betaData = calculatePortfolioBeta(watchlist?.items || [], selectedTimeframe);

  // Memoize portfolio return data for chart
  const portfolioReturnData = useMemo(() => {
    const data = watchlist?.items?.map(item => ({
      symbol: item.symbol,
      buyDate: item.buyDate,
      buyPrice: item.buyPrice,
      historicalData: item.historicalData,
      timeframe: selectedTimeframe
    })) || [];
    
    // 🔍 LEVEL 1 DEBUG: Portfolio Data Creation
    logger.debug(`[PORTFOLIO DATA DEBUG] Timeframe: ${selectedTimeframe}`);
    logger.debug(`  - Watchlist items: ${watchlist?.items?.length || 0}`);
    logger.debug(`  - Portfolio data entries: ${data.length}`);
    
    if (data.length > 0) {
      const firstItem = data[0];
      logger.debug(`  - First item: ${firstItem.symbol}`);
      logger.debug(`  - Historical data points: ${firstItem.historicalData?.length || 0}`);
      logger.debug(`  - Buy price: $${firstItem.buyPrice}`);
      logger.debug(`  - Buy date: ${firstItem.buyDate}`);
    }
    
    return data;
  }, [watchlist?.items, selectedTimeframe]);

  // Calculate real stock count for header
  const realStockCount = Array.isArray(watchlist?.items)
    ? watchlist.items.filter(item => item.type === 'real').length
    : 0;

  // Countdown timer for next auto-refresh (3 minutes cycle)
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      
      // Simple 3-minute repeating cycle based on current time
      // Create cycles every 3 minutes: 0:00, 3:00, 6:00, 9:00, etc.
      const CYCLE_DURATION = 3 * 60 * 1000; // 3 minutes in milliseconds
      const timeSinceEpoch = now;
      const timeInCurrentCycle = timeSinceEpoch % CYCLE_DURATION;
      const timeUntilNext = CYCLE_DURATION - timeInCurrentCycle;
      
      const minutes = Math.floor(timeUntilNext / (1000 * 60));
      const seconds = Math.floor((timeUntilNext % (1000 * 60)) / 1000);
      
      setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize fetch manager and register watchlist for automatic fetching
  useEffect(() => {
    const initializeFetching = async () => {
          logger.debug('Starting initializeFetching...');
    logger.debug('watchlist:', watchlist);
    logger.debug('slug:', slug);
      
      await fetchManager.initialize();
              logger.debug('fetchManager initialized');
      
      // Register this watchlist as active if it has items
      if (watchlist && Array.isArray(watchlist.items) && watchlist.items.length > 0 && slug) {
        const tickers = watchlist.items.map(item => item.symbol);
        logger.debug('About to register tickers:', tickers);
        
        const { default: activeBurnlistManager } = await import('../data/activeBurnlistManager');
        activeBurnlistManager.registerActiveBurnlist(slug, tickers);
                  logger.debug(`Successfully registered ${slug} as active burnlist with ${tickers.length} tickers: ${tickers.join(', ')}`);
        
        // Verify registration worked
        const activeBurnlists = activeBurnlistManager.getActiveBurnlists();
        const allTickers = activeBurnlistManager.getAllUniqueTickers();
        console.log('🔧 DEBUG: Active burnlists:', activeBurnlists);
        console.log('🔧 DEBUG: All unique tickers:', allTickers);
      } else {
        console.log('🔧 DEBUG: Not registering - conditions not met');
        console.log('🔧 DEBUG: watchlist exists:', !!watchlist);
        console.log('🔧 DEBUG: items is array:', Array.isArray(watchlist?.items));
        console.log('🔧 DEBUG: items length:', watchlist?.items?.length);
        console.log('🔧 DEBUG: slug exists:', !!slug);
      }
    };
    
    initializeFetching();
  }, [watchlist, slug]);

  // Ref for interval
  const intervalRef = useRef(null);

  // Fetch function using the new fetch manager
  const fetchWatchlistData = async (manual = false, bypassMarketClosed = false) => {
    if (!watchlist || !Array.isArray(watchlist.items)) return;
    
    if (manual) {
      logger.fetch(`Watchlist data fetch for ${slug}`, `${watchlist.items.length} items, manual: ${manual}, bypass: ${bypassMarketClosed}`);
    }
    
    const result = await fetchManager.startFetch(slug, watchlist.items, (updatedItems, progress) => {
      // Update callback - called after each batch
      const updatedWatchlist = { ...watchlist, items: updatedItems };
      const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
      if (key) {
        const updated = { ...watchlists, [key]: updatedWatchlist };
        handleSetWatchlists(updated);
      }
    }, manual, bypassMarketClosed, selectedTimeframe);

    if (result.success) {
      // Record the last refresh time for countdown timer
      localStorage.setItem(`burnlist_last_refresh_${slug}`, new Date().toISOString());
    } else if (result.message) {
      setNotification(result.message);
      setNotificationType("info");
    }
  };

  // Check if this watchlist fetch is active
  const watchlistFetchStatus = fetchManager.getFetchStatus(slug);
  const isWatchlistFetching = watchlistFetchStatus && watchlistFetchStatus.status === 'active';

  // Subscribe to real-time NAV updates
  useEffect(() => {
    if (!slug) return;

    logger.debug(`[BURN PAGE] Subscribing to real-time NAV updates for ${slug}`);

    // Subscribe to NAV updates
    const unsubscribe = navEventEmitter.subscribe(slug, (navData, metadata) => {
      logger.debug(`[BURN PAGE] Received NAV update for ${slug}`, metadata);
      
      // Force re-render of chart component
      setWatchlist(prev => {
        if (!prev) return prev;
        return { ...prev, lastUpdate: metadata.timestamp };
      });
    });

    return () => {
      unsubscribe();
    };
  }, [slug]);

  // Trigger immediate NAV calculation when tickers are updated
  const triggerImmediateNavCalculation = async () => {
    if (!watchlist || !watchlist.items || watchlist.items.length === 0) return;

    try {
      logger.debug(`[BURN PAGE] Triggering immediate NAV calculation for ${slug}`);
      await realTimeNavCalculator.triggerImmediateCalculation(slug, watchlist.items, selectedTimeframe);
    } catch (error) {
      logger.error(`[BURN PAGE] Error triggering immediate NAV calculation:`, error);
    }
  };

  // Enhanced refresh function with real-time NAV
  const handleManualRefresh = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setNotification('Refreshing data...', 'loading');

      // Manual refresh is always allowed (bypassing market hours)
      const result = await fetchWatchlistData(true, true);
      
      if (result.success) {
        setNotification('Manual refresh allowed outside market hours', 'info');
        logger.fetch(`Manual refresh for ${slug}`, `bypassing market hours check`);
        
        // Trigger immediate NAV calculation after refresh
        await triggerImmediateNavCalculation();
      } else {
        setNotification(result.message || 'Refresh failed', 'error');
      }
    } catch (error) {
      console.error('Manual refresh error:', error);
      setNotification('Refresh failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load watchlist data on mount and listen for updates
  useEffect(() => {
    const loadWatchlistData = () => {
      try {
        const saved = localStorage.getItem("burnlist_watchlists");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setWatchlists(parsed);
            const found = Object.values(parsed).find(w => w.slug === slug);
            if (found) {
              found.items = found.items?.map(normalizeTicker);
              found.items = found.items?.filter(item => {
                // Temporarily disable strict validation to allow NAV calculation
                const isValid = item && Number(item.buyPrice) > 0 && Array.isArray(item.historicalData);
                if (!isValid) {
                  logger.warn("🧨 Invalid item detected during hydration:", item);
                }
                return isValid;
              });
            }
            setWatchlist(found || null);
            console.log('📊 DEBUG: Loaded/reloaded watchlist data');
          } catch (e) {
            localStorage.removeItem("burnlist_watchlists");
            setWatchlist(null);
          }
        }
      } catch (error) {
        setWatchlist(null);
      }
    };

    // Load initially
    loadWatchlistData();

    // Listen for storage events (triggered by batchedFetchManager updates)
                  const handleStorageChange = (event) => {
                console.log('🔧 DEBUG: Storage event received:', event.key);
                if (event.key === 'burnlist_watchlists') {
                  console.log('🔄 DEBUG: Storage event received, reloading watchlist data');
                  loadWatchlistData();
                }
              };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [slug]);

  // Automatic fetches every 3 minutes (only during market hours)
  useEffect(() => {
    if (!watchlist || !Array.isArray(watchlist.items)) return;
    
    // DISABLED: All automatic fetching to prevent spam loops
    // const fetchStatus = fetchManager.getFetchStatus(slug);
    // if (!fetchStatus || fetchStatus.status !== 'active') {
    //   if (isMarketOpen()) {
    //     fetchWatchlistData();
    //   } else {
    //     logger.log(`⏰ Market is closed, skipping initial automatic fetch for ${slug}`);
    //   }
    // }
    
    // DISABLED: Auto-refresh interval to prevent spam loops
    // intervalRef.current = setInterval(() => {
    //   if (isMarketOpen()) {
    //     fetchWatchlistData();
    //   } else {
    //     logger.log(`⏰ Market is closed, skipping automatic fetch for ${slug}`);
    //   }
    // }, 10 * 60 * 1000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [watchlist, slug]);

  // Pause/resume fetch on navigation
  useEffect(() => {
    // When component unmounts (user navigates away)
    return () => {
      // Pause any active fetch for this watchlist
      fetchManager.pauseFetch(slug);
    };
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(timeout);
  }, [selectedTimeframe, watchlist]);

  const handleSetWatchlists = (updatedLists) => {
    if (!updatedLists || typeof updatedLists !== "object" || Array.isArray(updatedLists)) return;
    try {
      const newList = Object.values(updatedLists).find(w => w.slug === slug);
      if (newList) {
        setWatchlist(newList);
      }
      const stringified = JSON.stringify(updatedLists);
      localStorage.setItem("burnlist_watchlists", stringified);
      setWatchlists(updatedLists);
    } catch (err) {}
  };

  // Handler to change buy price
  const handleBuyPriceChange = (index, newPrice) => {
    setWatchlist(prev => {
      if (!prev || !Array.isArray(prev.items)) return prev;
      const updatedItems = prev.items.map((item, i) => i === index ? { ...item, buyPrice: newPrice } : item);
      const updated = { ...prev, items: updatedItems };
      // Also update in watchlists and localStorage
      setWatchlists(watchlists => {
        const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
        if (!key) return watchlists;
        const updatedWatchlists = { ...watchlists, [key]: updated };
        localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedWatchlists));
        return updatedWatchlists;
      });
      return updated;
    });
  };

  // Calculate dynamic API parameters for historical data fetching
  const calculateHistoricalDataParams = (daysDiff) => {
    let interval, outputSize;
    
    // Target: ~200-300 data points for good chart resolution
    const targetPoints = 250;
    
    if (daysDiff <= 7) {
      // Within 7 days: Request 5min intervals with exactly targetPoints
      interval = '5min';
      outputSize = Math.min(targetPoints, daysDiff * 78); // Max ~78 5min intervals per trading day
    } else if (daysDiff <= 30) {
      // Within 30 days: Request 15min intervals with exactly targetPoints  
      interval = '15min';
      outputSize = targetPoints; // API will give us exactly 250 points spread across 30 days
    } else if (daysDiff <= 90) {
      // Within 90 days: Request 1h intervals with exactly targetPoints
      interval = '1h';
      outputSize = targetPoints; // API will give us exactly 250 points spread across 90 days
    } else if (daysDiff <= 365) {
      // Within 1 year: Request 1day intervals with calculated points
      interval = '1day';
      outputSize = Math.min(250, daysDiff); // Up to 250 daily points, or one per day if less
    } else {
      // Beyond 1 year: Request 1week intervals
      interval = '1week';
      outputSize = Math.min(250, Math.ceil(daysDiff / 7)); // Weekly points, max 250
    }
    
    logger.log(`📊 Requesting exactly ${outputSize} data points for ${daysDiff} days using ${interval} intervals`);
    
    return { interval, outputSize };
  };

  // Find the actual trading day for a given date (fallback for weekends/holidays)
  const findTradingDayFallback = async (symbol, targetDate) => {
    console.log('🚨 [FIND TRADING DAY] Starting for', symbol, 'date:', targetDate);
    const { fetchHistoricalData } = await import('../data/twelvedataAdapter.js');
    
    // Try the target date first
    console.log(`🔍 [HISTORICAL FETCH] Checking if ${targetDate} is a trading day for ${symbol}`);
    console.log(`🔍 [HISTORICAL FETCH] Using direct twelvedataAdapter - no market hours validation`);
    
    // Look back up to 7 days to find a valid trading day, respecting user intent
    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(targetDate);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateStr = checkDate.toISOString().slice(0, 10);
      
      try {
        console.log(`🔍 [FALLBACK] Day ${i}: Trying exact date ${checkDateStr}...`);
        
        // Fetch data without end_date to let API return available data from that date
        const testData = await fetchHistoricalData(symbol, checkDateStr, null, '1day');
        
        if (testData && testData.historicalData && testData.historicalData.length > 0) {
          const priceData = testData.historicalData[0];
          console.log(`💰 [FALLBACK] Found price data for ${checkDateStr}: $${priceData.price}`);
          
          if (i === 0) {
            console.log(`✅ Found data for user's exact date: ${checkDateStr}`);
          } else {
            console.log(`✅ Found nearest trading day: ${checkDateStr} (${i} day${i > 1 ? 's' : ''} before user's date)`);
          }
          
          const result = {
            actualDate: checkDateStr,
            fallbackDays: i,
            price: priceData.price
          };
          
          console.log('🚨 [FIND TRADING DAY] Returning result:', result);
          return result;
        }
      } catch (error) {
        console.log(`⏭️ ${checkDateStr} - no market data available:`, error.message);
      }
    }
    
    throw new Error(`No valid market data found near selected buy date. Please choose an earlier date (tried ${targetDate} and 7 days prior).`);
  };

  // Handler to change buy date with sophisticated historical data fetching
  // Handler to revert buy date to original (when ticker was added to watchlist)
  // Handler to manually fetch historical data for current buy date
  const handleFetchHistoricalData = async (index) => {
    const ticker = watchlist?.items?.[index];
    if (!ticker || !ticker.symbol || !ticker.buyDate) {
      logger.warn('⚠️ Cannot fetch historical data: missing ticker, symbol, or buy date');
      setNotification('Cannot fetch historical data: missing required information');
      setNotificationType('warning');
      return;
    }

    logger.fetch(`Manual historical data fetch for ${ticker.symbol}`, `from ${ticker.buyDate}`);
    
    // Use the existing handleBuyDateChange logic but with current buy date
    await handleBuyDateChange(index, ticker.buyDate.slice(0, 10));
  };

  const handleRevertBuyDate = async (index) => {
    const ticker = watchlist?.items?.[index];
    if (!ticker || !ticker.symbol) {
      logger.warn('⚠️ Cannot revert buy date: missing ticker or symbol');
      return;
    }

    // Check if we have the original buy date metadata
    const originalDate = ticker.buyDateMetadata?.originalBuyDate || ticker.addedAt;
    const originalPrice = ticker.buyDateMetadata?.originalBuyPrice;

    if (!originalDate) {
      setNotification(`No original buy date found for ${ticker.symbol}`);
      setNotificationType('warning');
      return;
    }

    logger.log(`🔄 Reverting ${ticker.symbol} to original buy date: ${originalDate}`);
    
    setWatchlist(prev => {
      if (!prev || !Array.isArray(prev.items)) return prev;
      const updatedItems = prev.items.map((item, i) => 
        i === index ? {
          ...item,
          buyDate: originalDate,
          buyPrice: originalPrice || item.buyPrice,
          // Remove custom metadata to indicate we're back to original
          buyDateMetadata: undefined
        } : item
      );
      const updated = { ...prev, items: updatedItems };
      
      // Save to localStorage
      setWatchlists(watchlists => {
        const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
        if (!key) return watchlists;
        const updatedWatchlists = { ...watchlists, [key]: updated };
        localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedWatchlists));
        return updatedWatchlists;
      });
      
      return updated;
    });

    setNotification(`Reverted ${ticker.symbol} to original buy date: ${originalDate}`);
    setNotificationType('success');
  };

  const handleBuyDateChange = async (index, newDate) => {
    console.log('🚨 [BUY DATE CHANGE TRIGGERED]', { index, newDate });
    
    // Check for special revert command
    if (newDate === 'REVERT_TO_ORIGINAL') {
      await handleRevertBuyDate(index);
      return;
    }

    // Only allow dates in the past (not future)
    const today = new Date().toISOString().slice(0, 10);
    if (newDate > today) {
      setNotification('Buy date cannot be in the future');
      setNotificationType('warning');
      return;
    }

    // Note: Manual buy date changes should always be allowed regardless of market hours
    // since we're fetching historical data, not live data

    const ticker = watchlist?.items?.[index];
    if (!ticker || !ticker.symbol) {
      logger.warn('⚠️ Cannot change buy date: missing ticker or symbol');
      return;
    }

    console.log('🚨 [CURRENT TICKER STATE]', {
      symbol: ticker.symbol,
      currentBuyPrice: ticker.buyPrice,
      currentBuyDate: ticker.buyDate,
      currentPrice: ticker.currentPrice,
      historicalDataLength: ticker.historicalData?.length
    });

    // Store original values for potential revert
    const originalBuyDate = ticker.buyDate;
    const originalBuyPrice = ticker.buyPrice;
    const originalHistoricalData = ticker.historicalData;

    logger.log(`📅 [BUY DATE CHANGE] Starting: ${ticker.symbol} from ${originalBuyDate} to ${newDate}`);
    logger.log(`📅 [BUY DATE CHANGE] This should bypass all market hours validation`);
    setLoading(true);
    setNotification(`Fetching historical data for ${ticker.symbol}...`);
    setNotificationType('info');

    try {
      const { fetchHistoricalData } = await import('../data/twelvedataAdapter.js');
      const buyDate = new Date(newDate);
      const now = new Date();
      const daysDiff = Math.floor((now - buyDate) / (1000 * 60 * 60 * 24));

      // Validate date is not too far in the past (basic validation)
      if (daysDiff > 3650) { // ~10 years
        throw new Error('Buy date is too far in the past. Most assets may not have data from that period.');
      }

      // Step 1: Find actual trading day and get buy price
      logger.log(`🔍 Step 1: Finding actual trading day for ${newDate}`);
      const tradingDayResult = await findTradingDayFallback(ticker.symbol, newDate);
      const actualBuyDate = tradingDayResult.actualDate;
      const actualBuyPrice = tradingDayResult.price;
      
      logger.log(`🔍 [TRADING DAY RESULT] for ${ticker.symbol}:`);
      logger.log(`  - Requested date: ${newDate}`);
      logger.log(`  - Actual trading date: ${actualBuyDate}`);
      logger.log(`  - Buy price from that date: $${actualBuyPrice}`);
      logger.log(`  - Fallback days: ${tradingDayResult.fallbackDays}`);

      if (tradingDayResult.fallbackDays > 0) {
        logger.log(`📅 Using fallback trading day: ${actualBuyDate} (${tradingDayResult.fallbackDays} days before ${newDate})`);
      }

      // Step 2: Calculate dynamic parameters for time series data
      const { interval, outputSize } = calculateHistoricalDataParams(daysDiff);

      // Step 3: Fetch time series data from actual buy date to present
      logger.log(`📡 [HISTORICAL FETCH] Step 2: Fetching time series data from ${actualBuyDate} with interval=${interval}, outputSize=${outputSize}`);
      logger.log(`📡 [HISTORICAL FETCH] Using direct twelvedataAdapter - bypassing ALL market validation`);
      
      let historicalData;
      try {
        // Use the most recent available trading day instead of today
        const mostRecentTradingDay = new Date();
        // If today is weekend or holiday, go back to Friday
        const dayOfWeek = mostRecentTradingDay.getDay();
        if (dayOfWeek === 0) { // Sunday
          mostRecentTradingDay.setDate(mostRecentTradingDay.getDate() - 2); // Go back to Friday
        } else if (dayOfWeek === 6) { // Saturday
          mostRecentTradingDay.setDate(mostRecentTradingDay.getDate() - 1); // Go back to Friday
        }
        const endDate = mostRecentTradingDay.toISOString().split('T')[0]; // Just the date part
        
        // Always use calculated outputsize for precise data point control
        historicalData = await fetchHistoricalData(ticker.symbol, actualBuyDate, endDate, interval, outputSize);
        logger.log(`✅ [HISTORICAL FETCH] API call successful - requested exactly ${outputSize} points with ${interval} interval from ${actualBuyDate} to ${endDate}`);
      } catch (apiError) {
        logger.warn(`⚠️ [HISTORICAL FETCH] API call failed with ${interval}, trying with 1day fallback:`, apiError);
        // Fallback with conservative daily data
        const mostRecentTradingDay = new Date();
        const dayOfWeek = mostRecentTradingDay.getDay();
        if (dayOfWeek === 0) {
          mostRecentTradingDay.setDate(mostRecentTradingDay.getDate() - 2);
        } else if (dayOfWeek === 6) {
          mostRecentTradingDay.setDate(mostRecentTradingDay.getDate() - 1);
        }
        const endDate = mostRecentTradingDay.toISOString().split('T')[0];
        historicalData = await fetchHistoricalData(ticker.symbol, actualBuyDate, endDate, '1day', Math.min(daysDiff, 100));
      }

      if (!historicalData || !historicalData.historicalData || historicalData.historicalData.length === 0) {
        throw new Error(`No historical data found for ${ticker.symbol} from ${actualBuyDate}. This date may predate the asset's trading history.`);
      }

      // Use exactly what the API returned (should match our requested outputSize)
      let finalHistoricalData = historicalData.historicalData;
      
      logger.log(`📊 Received exactly ${finalHistoricalData.length} data points as requested (target was ${outputSize})`);
      
      // DEBUG: Log the actual timestamps to verify even distribution
      if (finalHistoricalData.length > 0) {
        const firstPoint = finalHistoricalData[0];
        const lastPoint = finalHistoricalData[finalHistoricalData.length - 1];
        logger.log(`📅 API Data Range: ${firstPoint.timestamp} → ${lastPoint.timestamp}`);
        
        // Show first few and last few timestamps to verify distribution
        const samplePoints = [
          ...finalHistoricalData.slice(0, 3),
          ...(finalHistoricalData.length > 6 ? ['...'] : []),
          ...finalHistoricalData.slice(-3)
        ];
        logger.log(`📊 Sample timestamps:`, samplePoints.map(p => p === '...' ? '...' : `${p.timestamp} ($${p.price})`));
      }

      logger.log(`📊 Received ${historicalData.historicalData.length} points, using ${finalHistoricalData.length} for chart`);

      // Step 4: Create unified time-series array (don't replace existing live data)
      logger.log(`🔧 Creating unified time-series for ${ticker.symbol}`);
      logger.log(`📊 Fetched historical data: ${finalHistoricalData.length} points from ${actualBuyDate} to present`);
      logger.log(`📊 Existing live data: ${ticker.historicalData?.length || 0} points`);
      
      // Create unified timeline: historical data + existing live data (if any)
      let unifiedHistoricalData = [...finalHistoricalData];
      
      // If there's existing live data from 3-minute fetches, merge it
      if (ticker.historicalData && ticker.historicalData.length > 0) {
        const existingLiveData = ticker.historicalData;
        
        // Find the cutoff point: where historical data ends and live data begins
        const historicalEndTime = new Date(finalHistoricalData[finalHistoricalData.length - 1]?.timestamp).getTime();
        
        // Only add live data that's newer than historical data (avoid duplicates)
        const newLiveData = existingLiveData.filter(livePoint => {
          const liveTime = new Date(livePoint.timestamp).getTime();
          return liveTime > historicalEndTime;
        });
        
        if (newLiveData.length > 0) {
          unifiedHistoricalData = [...finalHistoricalData, ...newLiveData];
          logger.log(`🔗 Merged ${newLiveData.length} live data points with historical data`);
        }
      }
      
      // Sort the unified array by timestamp (oldest to newest)
      unifiedHistoricalData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      logger.log(`✅ Unified time-series created: ${unifiedHistoricalData.length} total points`);
      logger.log(`📅 Timeline: ${unifiedHistoricalData[0]?.timestamp} → ${unifiedHistoricalData[unifiedHistoricalData.length - 1]?.timestamp}`);

      // Get the latest price from the unified historical data
      const latestPrice = unifiedHistoricalData.length > 0 ? 
        unifiedHistoricalData[unifiedHistoricalData.length - 1].price : 
        ticker.currentPrice;
      
      logger.log(`💰 [BUY DATE CHANGE] Price Summary for ${ticker.symbol}:`);
      logger.log(`  - Original buy price: $${originalBuyPrice}`);
      logger.log(`  - New buy price: $${actualBuyPrice}`);
      logger.log(`  - Original current price: $${ticker.currentPrice}`);
      logger.log(`  - New current price: $${latestPrice}`);
      logger.log(`  - Historical data points: ${unifiedHistoricalData.length}`);
      
      const updatedTicker = {
        ...ticker,
        buyDate: actualBuyDate, // Use actual trading day
        buyPrice: actualBuyPrice, // Use price from actual trading day
        currentPrice: latestPrice, // Update current price to latest from historical data
        historicalData: unifiedHistoricalData, // Unified timeline (historical + live)
        // Store metadata about the buy date change
        buyDateMetadata: {
          originalUserDate: newDate,
          actualTradingDate: actualBuyDate,
          fallbackDays: tradingDayResult.fallbackDays,
          originalBuyDate: originalBuyDate,
          originalBuyPrice: originalBuyPrice,
          dataFetchedAt: new Date().toISOString(),
          dataPoints: unifiedHistoricalData.length,
          interval: interval,
          mergedLiveData: ticker.historicalData?.length || 0
        }
      };

      // Step 5: Update state and localStorage
      console.log('🚨 [ABOUT TO UPDATE STATE]', {
        newBuyPrice: actualBuyPrice,
        newBuyDate: actualBuyDate,
        newCurrentPrice: latestPrice,
        historicalDataLength: unifiedHistoricalData.length
      });
      
    setWatchlist(prev => {
      if (!prev || !Array.isArray(prev.items)) return prev;
        const updatedItems = prev.items.map((item, i) => 
          i === index ? updatedTicker : item
        );
      const updated = { ...prev, items: updatedItems };
        
        // Save to localStorage
      setWatchlists(watchlists => {
        const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
        if (!key) return watchlists;
        const updatedWatchlists = { ...watchlists, [key]: updated };
        localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedWatchlists));
        return updatedWatchlists;
      });
        
      console.log('🚨 [STATE UPDATED]', {
        updatedTicker: updatedTicker,
        newBuyPrice: updatedTicker.buyPrice,
        newCurrentPrice: updatedTicker.currentPrice
      });
        
      return updated;
    });

      // Step 6: Success notification
      let successMessage;
      if (tradingDayResult.fallbackDays === 0) {
        successMessage = `✅ Updated ${ticker.symbol}: buy date ${actualBuyDate}, buy price $${actualBuyPrice.toFixed(2)}`;
      } else {
        successMessage = `✅ Updated ${ticker.symbol}: buy date ${actualBuyDate} (${tradingDayResult.fallbackDays} day${tradingDayResult.fallbackDays > 1 ? 's' : ''} before your selected date), buy price $${actualBuyPrice.toFixed(2)}`;
      }
      
      const mergedLiveData = ticker.historicalData?.length || 0;
      if (mergedLiveData > 0) {
        successMessage += `, unified ${unifiedHistoricalData.length} total datapoints (${finalHistoricalData.length} historical + ${mergedLiveData} existing live)`;
      } else {
        successMessage += `, ${finalHistoricalData.length} historical datapoints`;
      }
      
      logger.log(`✅ ${successMessage}`);
      setNotification(successMessage);
      setNotificationType('success');

    } catch (error) {
      logger.error(`❌ Error changing buy date for ${ticker.symbol}:`, error);
      
      // Revert to original values on error
      setWatchlist(prev => {
        if (!prev || !Array.isArray(prev.items)) return prev;
        const revertedItems = prev.items.map((item, i) => 
          i === index ? {
            ...item,
            buyDate: originalBuyDate,
            buyPrice: originalBuyPrice,
            historicalData: originalHistoricalData
          } : item
        );
        return { ...prev, items: revertedItems };
      });

      setNotification(`Failed to update buy date for ${ticker.symbol}: ${error.message}`);
      setNotificationType('error');
    } finally {
      setLoading(false);
    }
  };
  // Handler to refresh a ticker's buy price based on historical data
  const handleRefreshTickerPrice = async (index) => {
    if (!watchlist || !Array.isArray(watchlist.items)) return;
    
    const ticker = watchlist.items[index];
    if (!ticker || !ticker.symbol || !ticker.buyDate) {
      logger.warn('⚠️ Cannot refresh: missing symbol or buy date');
      return;
    }

    try {
      logger.fetch(`Price refresh for ${ticker.symbol}`, `buy date: ${ticker.buyDate}`);
      
      // Fetch historical data from Twelve Data API
      logger.log(`📡 Fetching historical data for ${ticker.symbol} from Twelve Data...`);
      const { fetchHistoricalData } = await import('../data/twelvedataAdapter.js');
      
      const buyDate = new Date(ticker.buyDate);
      const now = new Date();
      const daysDiff = Math.floor((now - buyDate) / (1000 * 60 * 60 * 24));
      
      let allHistoricalData = [];
      
      if (daysDiff <= 50) {
        // Recent data: fetch daily data for the entire period
        logger.log(`📅 Buy date is ${daysDiff} days ago, fetching daily data for entire period`);
        logger.log(`🔍 API Call: ${ticker.symbol} from ${ticker.buyDate} to ${now.toISOString()} (1day)`);
        const dailyData = await fetchHistoricalData(ticker.symbol, ticker.buyDate, now.toISOString(), '1day');
        logger.log(`📥 Daily data result:`, dailyData);
        if (dailyData && dailyData.historicalData) {
          allHistoricalData = dailyData.historicalData;
        }
      } else {
        // Old data: fetch weekly data for older period + daily data for recent 50 days
        logger.log(`📅 Buy date is ${daysDiff} days ago, fetching weekly + daily data`);
        
        // Calculate the cutoff date (50 days ago)
        const cutoffDate = new Date(now.getTime() - (50 * 24 * 60 * 60 * 1000));
        logger.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);
        
        // Fetch weekly data for older period (buy date to cutoff)
        logger.log(`🔍 Weekly API Call: ${ticker.symbol} from ${ticker.buyDate} to ${cutoffDate.toISOString()} (1week)`);
        const weeklyData = await fetchHistoricalData(ticker.symbol, ticker.buyDate, cutoffDate.toISOString(), '1week');
        logger.log(`📥 Weekly data result:`, weeklyData);
        
        // Fetch daily data for recent period (cutoff to now)
        logger.log(`🔍 Daily API Call: ${ticker.symbol} from ${cutoffDate.toISOString()} to ${now.toISOString()} (1day)`);
        const dailyData = await fetchHistoricalData(ticker.symbol, cutoffDate.toISOString(), now.toISOString(), '1day');
        logger.log(`📥 Daily data result:`, dailyData);
        
        // Combine the data (weekly first, then daily)
        if (weeklyData && weeklyData.historicalData) {
          allHistoricalData = [...weeklyData.historicalData];
          logger.log(`📊 Added ${weeklyData.historicalData.length} weekly data points`);
        }
        if (dailyData && dailyData.historicalData) {
          allHistoricalData = [...allHistoricalData, ...dailyData.historicalData];
          logger.log(`📊 Added ${dailyData.historicalData.length} daily data points`);
        }
      }
      
      logger.log(`📊 Total historical data points: ${allHistoricalData.length}`);
      
      if (allHistoricalData.length === 0) {
        logger.warn(`⚠️ No historical data found for ${ticker.symbol}`);
        logger.error(`❌ Debug info:`, {
          symbol: ticker.symbol,
          buyDate: ticker.buyDate,
          daysDiff: daysDiff,
          interval: daysDiff <= 50 ? '1day' : '1week+1day'
        });
        setNotification(`No historical data found for ${ticker.symbol}`, 'error');
        return;
      }

      // Find the price at the buy date
      let historicalPrice = null;
      let closestDate = null;
      let minDiff = Infinity;

      logger.log(`🔍 Looking for price on ${buyDate.toISOString().split('T')[0]} for ${ticker.symbol}`);
      logger.log(`📊 Historical data points: ${allHistoricalData.length}`);

      // First try to find exact date match (using date part only)
      for (const dataPoint of allHistoricalData) {
        const dataDate = new Date(dataPoint.timestamp);
        const buyDateOnly = buyDate.toISOString().split('T')[0];
        const dataDateOnly = dataDate.toISOString().split('T')[0];
        
        logger.log(`🔍 Comparing: ${dataDateOnly} vs ${buyDateOnly}`);
        
        if (dataDateOnly === buyDateOnly) {
          historicalPrice = dataPoint.price;
          closestDate = dataPoint.timestamp;
          logger.log(`✅ Found exact date match for ${ticker.symbol}: ${historicalPrice} at ${closestDate}`);
          break;
        }
        
        // Track closest date if no exact match
        const diff = Math.abs(dataDate.getTime() - buyDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          historicalPrice = dataPoint.price;
          closestDate = dataPoint.timestamp;
          logger.log(`📌 Closest match so far: ${historicalPrice} at ${closestDate} (diff: ${diff}ms)`);
        }
      }

      if (historicalPrice === null) {
        logger.warn(`⚠️ No historical price found for ${ticker.symbol} at ${ticker.buyDate}`);
        setNotification(`No historical price found for ${ticker.symbol} at ${ticker.buyDate}`, 'error');
        return;
      }

      // Log if we're using a closest match instead of exact match
      const buyDateOnly = buyDate.toISOString().split('T')[0];
      const closestDateOnly = new Date(closestDate).toISOString().split('T')[0];
      
      if (buyDateOnly !== closestDateOnly) {
        logger.log(`⚠️ No exact date match found for ${ticker.symbol}`);
        logger.log(`📅 Buy date: ${buyDateOnly}, Closest available: ${closestDateOnly}`);
        logger.log(`💰 Using closest price: ${historicalPrice} (from ${closestDate})`);
        setNotification(`Using closest available price for ${ticker.symbol} (${closestDateOnly})`, 'info');
      }

      logger.log(`📊 Updating ${ticker.symbol} buy price from ${ticker.buyPrice} to ${historicalPrice} (date: ${closestDate})`);

      // Update the ticker with the historical price and new historical data
      logger.log(`💾 Saving ${allHistoricalData.length} historical data points for ${ticker.symbol}`);
      logger.log(`📊 First data point:`, allHistoricalData[0]);
      logger.log(`📊 Last data point:`, allHistoricalData[allHistoricalData.length - 1]);
      
      setWatchlist(prev => {
        if (!prev || !Array.isArray(prev.items)) return prev;
        const updatedItems = prev.items.map((item, i) => 
          i === index 
            ? { 
                ...item, 
                buyPrice: historicalPrice,
                historicalData: allHistoricalData // Replace with combined historical data
              } 
            : item
        );
        const updated = { ...prev, items: updatedItems };
        
        logger.log(`✅ Updated watchlist item for ${ticker.symbol}:`, updatedItems[index]);
        logger.log(`📊 Historical data length after update:`, updatedItems[index].historicalData.length);
        
        // Update in watchlists and localStorage
        setWatchlists(watchlists => {
          const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
          if (!key) return watchlists;
          const updatedWatchlists = { ...watchlists, [key]: updated };
          
          logger.log(`💾 Saving to localStorage with key: ${key}`);
          logger.log(`📊 Updated watchlist items count:`, updated.items.length);
          
          localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedWatchlists));
          
          // Verify the save worked
          const saved = localStorage.getItem("burnlist_watchlists");
          const parsed = JSON.parse(saved);
          const savedItem = parsed[key].items[index];
          logger.log(`✅ Verification - Saved historical data length:`, savedItem.historicalData.length);
          
          return updatedWatchlists;
        });
        
        return updated;
      });

      setNotification(`Updated ${ticker.symbol} buy price to $${historicalPrice.toFixed(2)}`, 'success');
      
    } catch (error) {
      logger.error(`❌ Error refreshing price for ${ticker.symbol}:`, error);
      setNotification(`Failed to refresh price for ${ticker.symbol}`, 'error');
    }
  };

  // Handler to delete a ticker
  const handleDeleteTicker = (index) => {
    setWatchlist(prev => {
      if (!prev || !Array.isArray(prev.items)) return prev;
      const updatedItems = prev.items.filter((_, i) => i !== index);
      const updated = { ...prev, items: updatedItems };
      setWatchlists(watchlists => {
        const key = Object.keys(watchlists).find(k => watchlists[k].slug === slug);
        if (!key) return watchlists;
        const updatedWatchlists = { ...watchlists, [key]: updated };
        localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedWatchlists));
        return updatedWatchlists;
      });
      return updated;
    });
  };

  if (!watchlist) {
    return (
      <div style={{ backgroundColor: isInverted ? 'rgb(140,185,162)' : '#000000', color: isInverted ? '#000000' : '#ffffff', padding: '20px' }}>
        <h2 style={{ color: '#e31507', fontFamily: "'Courier New', monospace" }}>⚠️ Watchlist not found.</h2>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: isInverted ? 'rgb(140,185,162)' : 'transparent', 
      minHeight: '100vh', 
      color: isInverted ? '#000000' : '#ffffff',
      padding: '0',
      paddingBottom: '80px' // Account for mobile navigation
    }}>
      <NavigationBar />
      
      {/* ETF Price Banner - Top of Screen */}
      {etfPriceData && etfPriceData.averagePrice > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10002,
          backgroundColor: 'rgba(0,0,0,0.9)',
          borderBottom: `2px solid ${CRT_GREEN}`,
          padding: '8px 20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
            fontFamily: "'Courier New', monospace",
            fontSize: '14px',
            color: CRT_GREEN
          }}>
            <div style={{ fontWeight: 'bold' }}>
              ETF Price: ${etfPriceData.averagePrice.toFixed(2)}
            </div>
            <div style={{ color: CRT_GREEN, fontWeight: 'bold' }}>
              Next Fetch: {countdown || "–:–"}
            </div>
            <div style={{ color: '#888' }}>
              {Number.isFinite(averageReturn) ? `${averageReturn.toFixed(2)}%` : "–%"} ({selectedTimeframe?.toUpperCase() || "N/A"})
            </div>
            <div style={{ 
              color: averageReturn >= 0 ? CRT_GREEN : '#e31507',
              fontWeight: 'bold'
            }}>
              P&L: ${etfPriceData.totalGainLoss.toFixed(2)} ({averageReturn.toFixed(2)}%)
            </div>
          </div>
        </div>
      )}
      
      {/* Centralized Notification Banner */}
      {notification && (
        <div style={{ 
          position: 'fixed', 
          top: etfPriceData && etfPriceData.averagePrice > 0 ? 60 : 24, 
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
        marginBottom: "50px",
        marginTop: etfPriceData && etfPriceData.averagePrice > 0 ? "50px" : "0px"
      }}>
        <WatchlistHeader
          name={watchlist.name}
          averageReturn={averageReturn}
          selected={selectedTimeframe}
          notification={loading ? "Calculating returns and updating chart..." : null}
          onNotificationClose={() => setLoading(false)}
          onRefresh={handleManualRefresh}
          realStockCount={realStockCount}
          etfPriceData={etfPriceData}
          twapData={twapData}
        />

      </div>
      

      
      {/* Main Content Section - starts after header */}
      <div style={{ 
  padding: "5px 20px 10px 20px" // top right bottom left
}}>
        {/* Chart Header with Real-time Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TimeframeSelector selected={selectedTimeframe} onChange={setSelectedTimeframe} />
            <EditToggleButton editMode={editMode} setEditMode={setEditMode} />
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              style={{
                background: 'transparent',
                color: CRT_GREEN,
                border: `1px solid ${CRT_GREEN}`,
                padding: '4px 8px',
                fontSize: '10px',
                fontFamily: "'Courier New'",
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          {/* Real-time NAV Status */}
          <RealTimeNavStatus watchlistSlug={slug} timeframe={selectedTimeframe} />
        </div>

        <MobileChartWrapper height={505} style={{}}>
          <WatchlistChart 
            portfolioReturnData={portfolioReturnData} 
            watchlistSlug={slug}
            timeframe={selectedTimeframe}
            showBacktestLine={false} 
            height={500}
            suppressEmptyMessage={true}
          />
        </MobileChartWrapper>
      {Array.isArray(watchlist.items) && watchlist.items.length > 0 ? (
        <TickerTable
          items={watchlist.items}
          selectedTimeframe={selectedTimeframe}
          editMode={editMode}
          handleBuyPriceChange={handleBuyPriceChange}
          handleBuyDateChange={handleBuyDateChange}
          handleRevertBuyDate={handleRevertBuyDate}
          handleFetchHistoricalData={handleFetchHistoricalData}
          handleDelete={handleDeleteTicker}
          handleRefreshPrice={handleRefreshTickerPrice}
        />
      ) : null}
      {/* Only show this message ONCE, below the chart and above AddTickerInput */}
      {(!Array.isArray(watchlist.items) || watchlist.items.length === 0) && (
        <div style={{ 
          fontFamily: "'Courier New', monospace", 
          color: "#999", 
          textAlign: "center", 
          marginTop: "20px"
        }}>
          ⚠️ No valid data to display yet.
        </div>
      )}
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        marginTop: "30px"
      }}>
        <AddTickerInput
          watchlists={watchlists}
          setWatchlists={handleSetWatchlists}
          currentSlug={slug}
          bulkSymbols={bulkSymbols}
          setBulkSymbols={setBulkSymbols}
          buyPrice={buyPrice}
          setBuyPrice={setBuyPrice}
          buyDate={buyDate}
          setBuyDate={setBuyDate}
          setNotification={setNotification}
          setNotificationType={setNotificationType}
          handleBulkAdd={async (tickerObjects) => {
            if (!tickerObjects || tickerObjects.length === 0) return;
            try {
              const saved = localStorage.getItem("burnlist_watchlists");
              if (!saved || saved === "undefined") return;
              const parsed = JSON.parse(saved);
              const currentSlug = slug;
              const current = Object.values(parsed).find(w => w.slug === currentSlug);
              if (!current || !Array.isArray(current.items)) return;
              const validTickers = tickerObjects.filter(
                t => t && t.symbol && typeof t.symbol === 'string' && Array.isArray(t.historicalData)
              );
              const existingSymbols = new Set((current.items || []).map(item => item.symbol));
              const newUniqueTickers = validTickers.filter(t => !existingSymbols.has(t.symbol));
              const safeTickers = newUniqueTickers.filter(t => Array.isArray(t.historicalData) && t.historicalData.length > 0);
              current.items.push(...safeTickers);
              const updated = { ...parsed };
              const matchingKey = Object.keys(updated).find(k => updated[k].slug === currentSlug);
              if (matchingKey) {
                updated[matchingKey] = current;
              } else {
                return;
              }
              localStorage.setItem("burnlist_watchlists", JSON.stringify(updated));
              setWatchlists(updated);
            } catch (error) {}
          }}
        />
        </div>
      </div>
    </div>
  );
};

export default BurnPage;