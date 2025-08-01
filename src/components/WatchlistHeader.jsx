import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchManager } from '@data/twelvedataFetchManager';
import NotificationBanner from '@components/NotificationBanner';
import { useThemeColor } from '../ThemeContext';
import backButton from '../assets/backbutton.png';
import { useTheme } from '../ThemeContext';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(140,185,162)';

const WatchlistHeader = ({ name, averageReturn, selected, setWatchlists, notification, onNotificationClose, onRefresh, realStockCount: propRealStockCount, etfPriceData, twapData }) => {
  const { isInverted } = useTheme();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const orange = useThemeColor('#FFA500');
  const gray = useThemeColor('#888');
  // Debug: Log the precomputed average return passed as prop
  logger.debug("📊 WatchlistHeader received averageReturn:", averageReturn);
  const returnPercent = Number.isFinite(averageReturn) ? averageReturn : null;
  if (returnPercent === null) {
    logger.debug("⚠️ averageReturn is invalid:", averageReturn);
  }

  // Use props for name and realStockCount
  const realStockCount = propRealStockCount || 0;
  const { slug } = useParams();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [fetchProgress, setFetchProgress] = useState(null);
  const [tempNotification, setTempNotification] = useState("");
  const [apiStatus, setApiStatus] = useState(null);



  // Track API request status for this specific watchlist
  useEffect(() => {
    const updateApiStatus = () => {
      const status = fetchManager.getWatchlistRequestStatus(slug);
      setApiStatus(status);
    };

    updateApiStatus();
    const interval = setInterval(updateApiStatus, 1000);
    return () => clearInterval(interval);
  }, [slug]);

  // Track fetch progress
  useEffect(() => {
    const updateProgress = () => {
      const status = fetchManager.getFetchStatus(slug);
      // Get the last progress details from the fetchManager if available
      if (status && status.status === 'active') {
        const fetchObj = fetchManager.activeFetches?.get?.(slug);
        let tickersFetched = null;
        let totalTickers = null;
        if (fetchObj && fetchObj.lastProgress) {
          tickersFetched = fetchObj.lastProgress.tickersFetched;
          totalTickers = fetchObj.lastProgress.totalTickers;
        }
        setFetchProgress({
          tickersFetched,
          totalTickers
        });
        setIsRefreshing(true);
      } else {
        setFetchProgress(null);
        setIsRefreshing(false);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [slug]);

  // Patch fetchManager to store last progress for UI
  useEffect(() => {
    // Monkey-patch updateCallback to store last progress
    const origStartFetch = fetchManager.startFetch;
    fetchManager.startFetch = async function(slug, items, updateCallback, isManual) {
      return origStartFetch.call(this, slug, items, (updatedItems, progress) => {
        if (this.activeFetches && this.activeFetches.get(slug)) {
          this.activeFetches.get(slug).lastProgress = progress;
        }
        if (typeof updateCallback === 'function') {
          updateCallback(updatedItems, progress);
        }
      }, isManual);
    };
    return () => {
      fetchManager.startFetch = origStartFetch;
    };
  }, []);

  const handleRefresh = async () => {
    // Check if there's already an active fetch
    const fetchStatus = fetchManager.getFetchStatus(slug);
    if (fetchStatus && fetchStatus.status === 'active') {
      // Cancel the active fetch
      fetchManager.cancelFetch(slug);
      setTempNotification('Fetch cancelled');
      setTimeout(() => setTempNotification(''), 3000);
      return;
    }
    
    // Call the parent's refresh function if provided
    if (onRefresh && typeof onRefresh === 'function') {
      console.log("🔄 Refresh requested from header - calling parent");
      onRefresh();
    } else {
      console.log("🔄 Refresh requested from header - no parent handler");
    }
  };

  useEffect(() => {
    // Count real stocks in the watchlist
    if (name && Array.isArray(name.items)) {
      const realStocks = name.items.filter(item => 
        item.type === 'real'
      );
      setRealStockCount(realStocks.length);
      console.log("📊 Real stocks count:", realStocks.length);
    }
  }, [name]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 10000
      }}
    >
      {notification && (
        <NotificationBanner notification={notification} handleNotificationClose={onNotificationClose} />
      )}
      {tempNotification && (
        <NotificationBanner notification={tempNotification} handleNotificationClose={() => setTempNotification('')} />
      )}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1.5rem 2rem",
        backgroundColor: black,
        color: green,
        fontFamily: "'Courier New', Courier, monospace",
        width: "100%"
      }}>
        {/* Left: Back Home Button */}
        <div style={{}}>
          <a href="/" style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            border: 'none',
            background: 'none',
            padding: 0,
            gap: 0,
            minHeight: '44px', // Touch-friendly
          }} aria-label="back to home">
            <img 
              src={backButton} 
              alt="back" 
              style={{ 
                width: 22, 
                height: 22, 
                filter: isInverted ? 'invert(1)' : 'none'
              }} 
            />
          </a>
        </div>
        {/* Right: Watchlist Name and Return */}
        <div style={{ 
          textAlign: "right", 
          paddingRight: "3.5rem", 
          maxWidth: "60%"
        }}>
          <h1
            style={{
              margin: 0,
              marginTop: '8px',
              fontSize: "2rem",
              whiteSpace: "nowrap",
              color: green,
              cursor: 'pointer', // Make it look clickable
              textDecoration: 'underline', // Visual cue for clickability
              textUnderlineOffset: '4px',
              transition: 'color 0.2s',
              minHeight: '44px', // Touch-friendly
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={handleRefresh}
            title={isRefreshing ? 'Cancel refresh' : 'Refresh watchlist'}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleRefresh(); }}
            role="button"
            aria-pressed={isRefreshing}
          >
            {name || "Untitled Watchlist"}
          </h1>


          {/* API Request Status - only show when actively fetching this watchlist */}
          {fetchProgress && apiStatus && (
            <div 
              style={{ 
                marginTop: "0.5rem", 
                fontSize: "0.8rem", 
                color: apiStatus.current > 0 ? orange : gray,
                cursor: apiStatus.current > 0 ? "help" : "default"
              }}
              title={apiStatus.current > 0 ? "API requests in progress - waiting 1 minute between batches" : ""}
            >
              {apiStatus.current}/{realStockCount} ({Math.round((apiStatus.current / realStockCount) * 100)}%)
            </div>
          )}
          {/* Progress indicator */}
          <div style={{ 
            marginTop: "0.5rem", 
            fontSize: "0.8rem"
          }}>
            {fetchProgress && typeof fetchProgress.tickersFetched === 'number' && typeof fetchProgress.totalTickers === 'number' && (
              <span style={{ color: red, fontWeight: "bold" }}>
                {fetchProgress.tickersFetched}/{fetchProgress.totalTickers}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchlistHeader;