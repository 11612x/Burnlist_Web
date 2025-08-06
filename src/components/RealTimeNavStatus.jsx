import React, { useState, useEffect } from 'react';
import { useThemeColor } from '../ThemeContext';
import navEventEmitter from '../data/navEventEmitter';
import realTimeNavCalculator from '../data/realTimeNavCalculator';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(149,184,163)';
const CRT_RED = '#e31507';
const CRT_YELLOW = '#FFD700';
const CRT_ORANGE = '#FFA500';

const RealTimeNavStatus = ({ watchlistSlug, timeframe = 'MAX' }) => {
  const green = useThemeColor(CRT_GREEN);
  const red = useThemeColor(CRT_RED);
  const yellow = useThemeColor(CRT_YELLOW);
  const orange = useThemeColor(CRT_ORANGE);
  const gray = useThemeColor('#888');
  
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [isDataStale, setIsDataStale] = useState(false);
  const [updateSource, setUpdateSource] = useState(null);
  const [nextBoundaryTime, setNextBoundaryTime] = useState(null);
  const [timeUntilNextBoundary, setTimeUntilNextBoundary] = useState(0);
  const [isNearBoundary, setIsNearBoundary] = useState(false);

  // Subscribe to NAV updates
  useEffect(() => {
    if (!watchlistSlug) return;

    logger.debug(`[REAL-TIME NAV STATUS] Subscribing to updates for ${watchlistSlug}`);

    const unsubscribe = navEventEmitter.subscribe(watchlistSlug, (navData, metadata) => {
      logger.debug(`[REAL-TIME NAV STATUS] Received update for ${watchlistSlug}`, metadata);
      
      setLastUpdateTime(new Date(metadata.timestamp));
      setUpdateSource(metadata.source);
      setIsDataStale(false);
    });

    // Update boundary timer
    const boundaryTimer = setInterval(() => {
      const status = realTimeNavCalculator.getStatus();
      setNextBoundaryTime(status.nextBoundaryTime);
      setTimeUntilNextBoundary(status.timeUntilNextBoundary);
      setIsNearBoundary(status.isNearBoundary);
    }, 1000);

    // Stale data timer
    const staleTimer = setInterval(() => {
      const stale = navEventEmitter.isDataStale(watchlistSlug);
      setIsDataStale(stale);
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(boundaryTimer);
      clearInterval(staleTimer);
    };
  }, [watchlistSlug]);

  // Format time until next boundary
  const formatTimeUntilBoundary = () => {
    if (timeUntilNextBoundary <= 0) return 'Now';
    
    const minutes = Math.floor(timeUntilNextBoundary / 60000);
    const seconds = Math.floor((timeUntilNextBoundary % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format last update time
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

  // Get status color
  const getStatusColor = () => {
    if (!lastUpdateTime) return gray;
    if (isDataStale) return red;
    if (updateSource === 'realtime') return green;
    if (updateSource === 'aligned') return orange;
    return gray;
  };

  // Get boundary color
  const getBoundaryColor = () => {
    if (isNearBoundary) return yellow;
    return gray;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: gray,
      padding: '4px 8px',
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderRadius: '4px',
      border: `1px solid ${gray}20`
    }}>
      {/* Last Update */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Last Update:</span>
        <span style={{
          color: getStatusColor(),
          opacity: isDataStale ? 0.6 : 1,
          transition: 'opacity 0.3s ease'
        }}>
          {formatLastUpdateTime()}
          {updateSource && ` (${updateSource})`}
        </span>
      </div>

      {/* Next Boundary */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Next 5-min:</span>
        <span style={{
          color: getBoundaryColor(),
          fontWeight: isNearBoundary ? 'bold' : 'normal'
        }}>
          {formatTimeUntilBoundary()}
        </span>
      </div>

      {/* Status Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Status:</span>
        <span style={{
          color: getStatusColor(),
          fontSize: '9px',
          textTransform: 'uppercase'
        }}>
          {!lastUpdateTime ? 'No Data' : 
           isDataStale ? 'Stale' : 
           updateSource === 'realtime' ? 'Live' :
           updateSource === 'aligned' ? 'Aligned' : 'Updated'}
        </span>
      </div>
    </div>
  );
};

export default RealTimeNavStatus; 