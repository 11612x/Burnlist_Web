import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import WatchlistChart from '@components/WatchlistChart';
import { randomNames } from '@data/randomNames';
import { v4 as uuidv4 } from 'uuid';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { fetchManager } from '@data/twelvedataFetchManager';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import NavigationBar from '@components/NavigationBar';
import logo from '../assets/logo.png';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import logoblack from '../assets/logoblack.png';
import { useTheme, useThemeColor } from '../ThemeContext';
import useNotification from '../hooks/useNotification';

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const CRT_GREEN = 'rgb(140,185,162)';

const HomePage = ({ watchlists = {}, setWatchlists }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState('terminal'); // 'graph' or 'terminal'
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();
  const [editMode, setEditMode] = useState(false);
  const [justClicked, setJustClicked] = useState(false);
  // Always use MAX timeframe
  const selectedTimeframe = 'MAX';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isInverted, toggleTheme } = useTheme();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');

  // Calculate unique real tickers across all watchlists (move this up)
  const uniqueRealTickers = useMemo(() => {
    const all = Object.values(watchlists)
      .flatMap(wl => (wl.items || []).map(item => item.symbol))
      .filter(sym => sym && typeof sym === 'string' && !sym.startsWith('#'));
    return Array.from(new Set(all.map(s => s.toUpperCase())));
  }, [watchlists]);

  // Fetch counter state
  const [fetchCount, setFetchCount] = useState(() => {
    return storage.getFetchCount();
  });

  // Utility: Check if it's 9:29am ET (reset time)
  function isResetTimeNY() {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return nyTime.getHours() === 9 && nyTime.getMinutes() === 29;
  }

  // Reset fetch count at 9:29am ET
  useEffect(() => {
    const interval = setInterval(() => {
      if (isResetTimeNY()) {
            setFetchCount(0);
    storage.setFetchCount(0);
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, []);



  // Helper to increment fetch count
  const incrementFetchCount = () => {
    setFetchCount(prev => {
      const next = prev + 1;
      storage.setFetchCount(next);
      return next;
    });
  };

  // Helper function to create detailed tooltip content for watchlist cards
  const createWatchlistTooltip = (type, data) => {
    const CRT_GREEN = 'rgb(140,185,162)';
    const red = '#e31507';
    
    switch (type) {
      case 'name':
        return `Watchlist: ${data.name}\nStocks: ${data.stockCount}\nCreated: ${data.createdAt || 'Unknown'}`;
      case 'return':
        const returnColor = data.return >= 0 ? CRT_GREEN : red;
        const prefix = data.return >= 0 ? '+' : '';
        return `Return: ${prefix}${data.return.toFixed(2)}%\nTimeframe: ${data.timeframe || 'MAX'}\nPerformance`;
      case 'risk':
        return `Risk Level: ${data.risk}\nBest: ${data.bestPerformer || 'N/A'}\nWorst: ${data.worstPerformer || 'N/A'}`;
      case 'lastUpdate':
        return `Last Update: ${data.lastUpdate}\nData Age: ${data.age || 'Unknown'}\nRefresh Status`;
      default:
        return '';
    }
  };

  // Get formatted creation date
  const getFormattedCreationDate = (createdAt) => {
    if (!createdAt) return 'Unknown';
    try {
      const date = new Date(createdAt);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    } catch {
      return 'Unknown';
    }
  };

  // Auto-refresh logic using fetch manager
  // Remove auto-fetching from homepage - only manual refresh
  useEffect(() => {
    // Clean up any active fetch for homepage when component unmounts
    return () => {
      fetchManager.cancelFetch('homepage');
    };
  }, []);



  const handleCreateWatchlist = () => {
    setJustClicked(true);
    setTimeout(() => setJustClicked(false), 150);
    const name = randomNames[Math.floor(Math.random() * randomNames.length)];
    const slug = slugify(name);
    // Check if name already exists (case-insensitive)
    const exists = Object.values(watchlists).some(w => w.name && w.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setNotification('⚠️ Name already exists');
      setNotificationType('error');
      return;
    }
    const newList = {
      id: uuidv4(),
      name,
      slug,
      items: [],
      reason: '',
      startDate: null,
      createdAt: new Date().toISOString()
    };
    const updated = { ...watchlists, [newList.id]: newList };
    setWatchlists(updated);
    storage.setWatchlists(updated);
    setNotification(`Created watchlist: ${name}`);
  };

  const handleDeleteWatchlist = (id) => {
    // Find the correct key in the watchlists object that matches this id
    const keyToDelete = Object.keys(watchlists).find(key => watchlists[key].id === id);
    
    if (!keyToDelete) {
      logger.log('🗑️ Could not find watchlist with id:', id);
      return;
    }
    
    const { [keyToDelete]: deleted, ...remaining } = watchlists;
    setWatchlists(remaining);
    storage.setWatchlists(remaining);
    if (deleted) {
      logger.log('🗑️ Deleted watchlist:', deleted.name);
    } else {
      logger.log('🗑️ Deleted watchlist with id:', id);
    }
  };

  const handleUpdateWatchlistName = useCallback((id, newName) => {
    // Prevent duplicate names (case-insensitive, except for current)
    const duplicate = Object.values(watchlists).some(w => w.id !== id && w.name && w.name.toLowerCase() === newName.toLowerCase());
    if (duplicate) {
      setNotification('⚠️ Name already exists');
      setNotificationType('error');
      return;
    }
    setWatchlists((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = { ...updated[id], name: newName, slug: slugify(newName) };
      }
      storage.setWatchlists(updated);
      return updated;
    });
  }, [setWatchlists, watchlists]);

  const handleUpdateWatchlistReason = useCallback((id, newReason) => {
    const updated = {
      ...watchlists,
      [id]: {
        ...watchlists[id],
        reason: newReason
      }
    };
    setWatchlists(updated);
    storage.setWatchlists(updated);
  }, [setWatchlists, watchlists]);

  // Export all localStorage data to JSON file
  const handleExportData = () => {
    try {
      // Get ALL storage data
      const allStorageData = {
        watchlists: storage.getWatchlists(),
        universes: storage.getUniverses(),
        screeners: storage.getScreeners(),
        screenerSettings: storage.get(STORAGE_KEYS.SCREENER_SETTINGS, {}),
        tradeJournal: storage.getTradeJournal(),
        fetchCount: storage.getFetchCount()
      };
      
      const exportData = {
        storage: allStorageData,
        exportInfo: {
          timestamp: new Date().toISOString(),
          totalKeys: Object.keys(allStorageData).length,
          keys: Object.keys(allStorageData)
        }
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `burnlist_complete_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      setNotification(`✅ All storage data exported (${Object.keys(allStorageData).length} keys)`, 'success');
    } catch (error) {
      logger.error('Export error:', error);
      setNotification('❌ Export failed', 'error');
    }
  };

  // Import data from JSON file
  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Check if this is the new complete backup format
        if (importedData.localStorage && importedData.exportInfo) {
          // Import ALL localStorage data
          const localStorageData = importedData.localStorage;
          let importedCount = 0;
          
          Object.keys(localStorageData).forEach(key => {
            try {
              const value = localStorageData[key];
              if (typeof value === 'string') {
                localStorage.setItem(key, value);
              } else {
                localStorage.setItem(key, JSON.stringify(value));
              }
              importedCount++;
            } catch (error) {
              logger.warn(`Could not import localStorage key: ${key}`, error);
            }
          });
          
          // Update watchlists state if it was imported
          if (localStorageData.burnlist_watchlists) {
            try {
              const watchlistsData = typeof localStorageData.burnlist_watchlists === 'string' 
                ? JSON.parse(localStorageData.burnlist_watchlists)
                : localStorageData.burnlist_watchlists;
              setWatchlists(watchlistsData);
            } catch (error) {
              logger.warn('Could not parse watchlists data', error);
            }
          }
          
          // Update fetch count if it was imported
          if (localStorageData.burnlist_fetch_count) {
            try {
              const fetchCountData = typeof localStorageData.burnlist_fetch_count === 'string'
                ? parseInt(localStorageData.burnlist_fetch_count)
                : localStorageData.burnlist_fetch_count;
              setFetchCount(fetchCountData);
            } catch (error) {
              logger.warn('Could not parse fetch count data', error);
            }
          }
          
          setNotification(`✅ Complete backup imported (${importedCount} keys)`, 'success');
        } else {
          // Handle old format for backward compatibility
          if (!importedData.watchlists || typeof importedData.watchlists !== 'object') {
            throw new Error('Invalid data format: missing watchlists');
          }

          // Import watchlists
          setWatchlists(importedData.watchlists);
          storage.setWatchlists(importedData.watchlists);

          // Import fetch count if available
          if (importedData.fetchCount !== undefined) {
            setFetchCount(importedData.fetchCount);
            storage.setFetchCount(importedData.fetchCount);
          }

          // Import trade journal data if available
          if (importedData.tradeJournalTrades && Array.isArray(importedData.tradeJournalTrades)) {
            storage.setTradeJournal(importedData.tradeJournalTrades);
          }

          setNotification('✅ Legacy data imported successfully', 'success');
        }
      } catch (error) {
        logger.error('Import error:', error);
        setNotification('❌ Import failed: Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  // Track editing state and previous name for each watchlist
  const [editingNames, setEditingNames] = useState({}); // { [id]: { value, prev } }

  // When entering edit mode, initialize editingNames
  useEffect(() => {
    if (editMode) {
      const initial = {};
      Object.values(watchlists).forEach(wl => {
        initial[wl.id] = { value: wl.name, prev: wl.name };
      });
      setEditingNames(initial);
    } else {
      setEditingNames({});
    }
  }, [editMode, watchlists]);

  // Handler for input change (just update local state)
  const handleEditNameInput = (id, value) => {
    setEditingNames(prev => ({ ...prev, [id]: { ...prev[id], value } }));
  };

  // Handler for blur or 'Done' (validate and commit)
  const commitEditName = (id) => {
    const newName = editingNames[id]?.value || '';
    // Prevent duplicate names (case-insensitive, except for current)
    const duplicate = Object.values(watchlists).some(w => w.id !== id && w.name && w.name.toLowerCase() === newName.toLowerCase());
    if (duplicate) {
      setNotification('⚠️ Name already exists');
      setNotificationType('error');
      // Revert to previous name
      setEditingNames(prev => ({ ...prev, [id]: { ...prev[id], value: prev[id].prev } }));
      return;
    }
    // Commit the name change
    setWatchlists((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = { ...updated[id], name: newName, slug: slugify(newName) };
      }
      storage.setWatchlists(updated);
      return updated;
    });
    setEditingNames(prev => ({ ...prev, [id]: { ...prev[id], prev: newName } }));
  };

  const sortedWatchlists = useMemo(() => Object.values(watchlists), [watchlists]);
  // Memoize lastReturn for each watchlist
  const lastReturns = useMemo(() => {
    return sortedWatchlists.map(wl => {
      const tickers = wl.items || [];
      if (!tickers.length) return 0;
      const last = tickers.map(t => {
        const data = t.historicalData;
        if (!Array.isArray(data) || data.length < 2) return 0;
        const start = data[0]?.price;
        const end = data[data.length - 1]?.price;
        if (typeof start !== 'number' || typeof end !== 'number' || start === 0) return 0;
        return ((end - start) / start) * 100;
      });
      return last.reduce((a, b) => a + b, 0) / last.length;
    });
  }, [sortedWatchlists]);

  const importInputRef = useRef(null);

  return (
    <div style={{
      fontFamily: 'Courier New',
      color: green,
      backgroundColor: black,
      minHeight: '100vh',
      padding: '0',
      transition: 'background 0.3s, color 0.3s'
    }}>
      {/* Main Content */}
      <div style={{
        padding: '32px'
      }}>
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
        }}
        title="Test tooltip - hover to see if tooltips work">
          <button
            onClick={toggleTheme}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              minHeight: '44px', // Touch-friendly
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
          <span style={{ color: red, fontWeight: 'bold', fontSize: 12 }}>{uniqueRealTickers.length}</span>
          <span style={{ color: green, fontWeight: 'bold', fontSize: 12 }}>{fetchCount}</span>
          <span 
            onClick={() => {
              const data = storage.getWatchlists();
              logger.log('🧪 Current storage watchlists:', data);
            }}
            style={{ cursor: 'pointer', color: green }}
          >
            ACCOUNT: local
          </span>
        </div>
      </div>

      <NavigationBar />

      {/* Centralized Notification Banner */}
      {notification && (
        <div style={{ 
          position: 'fixed', 
          top: 24, 
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
              onClose={() => setNotification('')}
            />
          </div>
        </div>
      )}

      {/* Loading and error banners */}
      {isLoading && (
        <NotificationBanner 
          message="Loading watchlists..." 
          type="loading" 
        />
      )}
      {error && (
        <NotificationBanner 
          message={error} 
          type="error" 
          onClose={() => setError(null)} 
        />
      )}

      {Object.keys(watchlists).length === 0 && <p>No watchlists found.</p>}

      {/* Responsive Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(252px, 252px))',
        rowGap: '20px',
        columnGap: '20px',
        margin: '70px 0 1px 0',
        justifyContent: 'center',
        alignItems: 'start'
      }}>
      {sortedWatchlists.map((item, idx, arr) => {
        const tickers = item.items || [];
        const lastReturn = lastReturns[idx];
        const isPositive = lastReturn >= 0;
        const chartColor = isPositive ? CRT_GREEN : '#e31507';
        const returnColor = chartColor;
        // Calculate best/worst performer and risk indicator
        let bestPerformer = null;
        let worstPerformer = null;
        let riskIndicator = tickers.length === 0 ? 'None' : 'LOW';
        
        if (tickers.length > 0) {
          const performances = tickers.map(t => {
            const data = t.historicalData;
            if (!Array.isArray(data) || data.length < 2) return { symbol: t.symbol, return: 0 };
            const start = data[0]?.price;
            const end = data[data.length - 1]?.price;
            if (typeof start !== 'number' || typeof end !== 'number' || start === 0) return { symbol: t.symbol, return: 0 };
            const returnPercent = ((end - start) / start) * 100;
            return { symbol: t.symbol, return: returnPercent };
          });
          
          bestPerformer = performances.reduce((best, current) => 
            current.return > best.return ? current : best, performances[0]);
          worstPerformer = performances.reduce((worst, current) => 
            current.return < worst.return ? current : worst, performances[0]);
          
          // Simple risk indicator: HIGH if any stock >20% loss, MEDIUM if any >10% loss, LOW otherwise
          const maxLoss = Math.min(...performances.map(p => p.return));
          const maxGain = Math.max(...performances.map(p => p.return));
          const volatility = maxGain - maxLoss;
          
          if (maxLoss < -20 || volatility > 50) riskIndicator = 'HIGH';
          else if (maxLoss < -10 || volatility > 30) riskIndicator = 'MED';
          else riskIndicator = 'LOW';
        }
        
        // Get last update time (use the most recent timestamp from historical data)
        let lastUpdate = 'Unknown';
        if (tickers.length > 0) {
          const timestamps = tickers.flatMap(t => 
            t.historicalData?.map(d => new Date(d.timestamp).getTime()) || []
          );
          if (timestamps.length > 0) {
            const latest = Math.max(...timestamps);
            const now = Date.now();
            const diffHours = Math.floor((now - latest) / (1000 * 60 * 60));
            if (diffHours < 1) lastUpdate = 'Just now';
            else if (diffHours < 24) lastUpdate = `${diffHours}h ago`;
            else lastUpdate = `${Math.floor(diffHours / 24)}d ago`;
          }
        }
                    const cardContent = (
              <div style={{
                width: '100%',
                maxWidth: 252,
                height: editMode ? 160 : (view === 'graph' ? 200 : 120),
                fontFamily: 'Courier New',
                background: 'transparent',
                padding: '10px 8px',
                margin: 0,
                border: `1px solid ${green}`,
                borderRadius: 0,
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                position: 'relative',
                boxSizing: 'border-box',
                overflow: 'hidden'
                
                
              }}>
            {/* Name (editable) */}
            {editMode ? (
              <input
                value={editingNames[item.id]?.value ?? item.name}
                onChange={e => handleEditNameInput(item.id, e.target.value)}
                onBlur={() => commitEditName(item.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitEditName(item.id);
                  }
                }}
                style={{
                  fontFamily: 'Courier New',
                  fontSize: 16,
                  color: green,
                  background: 'transparent',
                  border: `1px solid ${green}`,
                  marginBottom: 2,
                  padding: '2px 4px',
                  width: '100%',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minHeight: '24px'
                  
                  
                }}
              />
            ) : (
              <div style={{ 
                fontSize: 18, 
                color: green, 
                fontWeight: 'bold', 
                marginBottom: 4, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                cursor: 'pointer'
                
                
              }}
              title={`Watchlist: ${item.name || `PORTFOLIO ${idx + 1}`} | Stocks: ${tickers.length} | Created: ${getFormattedCreationDate(item.createdAt)}`}
              onClick={() => navigate(`/burn/${item.slug}`)}
              >
                {item.name || `PORTFOLIO ${idx + 1}`}
              </div>
            )}
            {/* Delete button (only in edit mode) */}
            {editMode && (
              <button
                onClick={() => handleDeleteWatchlist(item.id)}
                style={{
                  backgroundColor: 'transparent',
                  color: red,
                  border: `1px solid ${red}`,
                  padding: '1px 4px',
                  marginBottom: 2,
                  fontSize: 9,
                  width: '100%',
                  fontWeight: 'bold',
                  fontFamily: 'Courier New',
                  cursor: 'pointer',
                  minHeight: '16px'
                  
                  
                }}
                title="Delete this watchlist"
              >
                DELETE
              </button>
            )}
            {/* Reason (editable) */}
            {editMode ? (
              <input
                value={item.reason || ''}
                onChange={e => handleUpdateWatchlistReason(item.id, e.target.value)}
                  style={{
                    fontFamily: 'Courier New',
                  fontSize: 12,
                  color: green,
                  background: 'transparent',
                  border: `1px solid ${green}`,
                  marginBottom: 2,
                  padding: '1px 3px',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minHeight: '18px'
                  
                  
                }}
                placeholder="Reason..."
              />
            ) : (
              view !== 'graph' && (
                <div style={{ 
                  fontSize: 14, 
                  color: green, 
                  marginBottom: 4, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap'
                  
                  
                }}>
                  {item.reason || 'N/A'}
                </div>
              )
            )}
            {/* Portfolio info */}
            <div style={{ 
              fontSize: 13, 
              color: green, 
              marginBottom: 2,
              cursor: 'help'
              
              
            }}
            title={`Risk Level: ${riskIndicator} | Best: ${bestPerformer?.symbol || 'N/A'} | Worst: ${worstPerformer?.symbol || 'N/A'}`}>
              {tickers.length} stocks | Risk: {riskIndicator}
            </div>
            {/* Last update */}
            <div style={{ 
              fontSize: 11, 
              color: gray, 
              marginBottom: 2,
              cursor: 'help'
              
              
            }}
            title={`Last Update: ${lastUpdate} | Data Age: ${lastUpdate}`}>
              {lastUpdate}
            </div>
            {/* Return percent in terminal view */}
            {view !== 'graph' && tickers.length > 0 && (
              <div style={{ 
                fontSize: 19, 
                color: isPositive ? green : red, 
                fontWeight: 'bold',
                cursor: 'help'
                
                
              }}
              title={`Return: ${lastReturn >= 0 ? '+' : ''}${lastReturn.toFixed(2)}% | Timeframe: MAX`}>
                {lastReturn >= 0 ? '+' : ''}{lastReturn.toFixed(2)}%
              </div>
            )}
            {/* Sparkline with frame only in graph view */}
            {view === 'graph' && tickers.length > 0 && (
              <>
                {/* Return (moved just above chart) */}
                <div style={{ 
                  fontSize: 19, 
                  color: isPositive ? green : red, 
                  fontWeight: 'bold', 
                  marginBottom: 2
                  
                  
                }}>
                  {lastReturn >= 0 ? '+' : ''}{lastReturn.toFixed(2)}%
                </div>
                <div style={{
                  width: '100%',
                  maxWidth: 180,
                  height: 94,
                  alignSelf: 'flex-end',
                  border: `1.5px solid ${green}`,
                  borderRadius: 0,
                  background: 'transparent',
                  padding: 1,
                  marginTop: 2,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'flex-end'
                  
                  
                }}>
                  <WatchlistChart 
                    portfolioReturnData={tickers.map(t => ({
                      symbol: t.symbol,
                      buyDate: t.buyDate,
                      historicalData: t.historicalData,
                      timeframe: selectedTimeframe
                    }))}
                    showBacktestLine={false}
                    height={94}
                    lineColor={isPositive ? green : red}
                    hideAxes={true}
                    hideBorder={true}
                    showTooltip={false}
                    mini={true}
                  />
                </div>
              </>
            )}
          </div>
        );
        return (
          <div key={item.id} style={{ margin: 0 }}>
            {editMode ? cardContent : (
              <Link to={`/watchlist/${item.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {cardContent}
              </Link>
            )}
          </div>
        );
      })}
      </div>

      {/* Import/Export/Edit Buttons - Bottom Right */}
      <div className="action-buttons-container">
        <style>
          {`
            .action-buttons-container {
              position: fixed;
              bottom: 20px;
              right: 20px;
              display: flex;
              gap: 8px;
              z-index: 1000;
            }
            
            @media (max-width: 768px) {
              .action-buttons-container {
                position: fixed;
                top: 50%;
                right: 10px;
                transform: translateY(-50%);
                flex-direction: column;
                gap: 8px;
              }
            }
            
            @media (max-width: 480px) {
              .action-buttons-container {
                position: fixed;
                top: 50%;
                right: 8px;
                transform: translateY(-50%);
                flex-direction: column;
                gap: 6px;
              }
            }
            
            .action-button {
              background: ${black};
              color: ${green};
              border: 1px solid ${green};
              font-size: 12px;
              padding: 6px 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              min-height: 32px;
              font-family: 'Courier New', monospace;
              cursor: pointer;
              text-decoration: none;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            @media (max-width: 768px) {
              .action-button {
                font-size: 10px;
                padding: 6px 8px;
                min-height: 32px;
                width: 60px;
              }
            }
            
            @media (max-width: 480px) {
              .action-button {
                font-size: 9px;
                padding: 4px 6px;
                min-height: 28px;
                width: 50px;
              }
            }
          `}
        </style>
        <button
          onClick={handleCreateWatchlist}
          className="action-button"
          style={{
            backgroundColor: green,
            color: black,
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'all 0.2s ease-in-out',
            padding: '8px 16px'
          }}
        >
          +++
        </button>
        <button
          onClick={() => {
            setEditMode(!editMode);
            logger.log('🛠️ Edit mode:', !editMode);
          }}
          className="action-button"
          style={{
            textTransform: 'lowercase',
            fontWeight: 400,
            letterSpacing: 1
          }}
        >
          {editMode ? 'done' : 'edit'}
        </button>
        <input
          type="file"
          accept=".json"
          onChange={handleImportData}
          style={{ display: 'none' }}
          ref={importInputRef}
        />
        <button
          onClick={() => importInputRef.current && importInputRef.current.click()}
          className="action-button"
          style={{
            textTransform: 'lowercase',
            fontWeight: 400,
            letterSpacing: 1
          }}
        >
          import
        </button>
        <button
          onClick={handleExportData}
          className="action-button"
          style={{
            textTransform: 'lowercase',
            fontWeight: 400,
            letterSpacing: 1
          }}
        >
          export
        </button>
      </div>
      </div>
    </div>
  );
};

export default HomePage;