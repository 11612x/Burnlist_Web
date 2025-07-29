import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import WatchlistChart from '@components/WatchlistChart';
import { randomNames } from '@data/randomNames';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { generateFixedMockWatchlist } from '@data/mockTickerGenerator';
import { fetchManager } from '@data/fetchManager';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import logo from '../assets/logo.png';
import logoblack from '../assets/logoblack.png';
import { useTheme, useThemeColor } from '../ThemeContext';

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
  const [view, setView] = useState('terminal'); // 'graph' or 'terminal'
  const [notification, setNotification] = useState('');
  const [notificationType, setNotificationType] = useState('info');
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
    const stored = localStorage.getItem('burnlist_fetch_count');
    return stored ? parseInt(stored, 10) : 0;
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
        localStorage.setItem('burnlist_fetch_count', '0');
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, []);

  // Helper to increment fetch count
  const incrementFetchCount = () => {
    setFetchCount(prev => {
      const next = prev + 1;
      localStorage.setItem('burnlist_fetch_count', String(next));
      return next;
    });
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
      createdAt: new Date().toISOString(),
    };
    const updated = { ...watchlists, [newList.id]: newList };
    setWatchlists(updated);
    localStorage.setItem('burnlist_watchlists', JSON.stringify(updated));
    setNotification('');
  };

  const handleDeleteWatchlist = (id) => {
    // Find the correct key in the watchlists object that matches this id
    const keyToDelete = Object.keys(watchlists).find(key => watchlists[key].id === id);
    
    if (!keyToDelete) {
      console.log('🗑️ Could not find watchlist with id:', id);
      return;
    }
    
    const { [keyToDelete]: deleted, ...remaining } = watchlists;
    setWatchlists(remaining);
    localStorage.setItem('burnlist_watchlists', JSON.stringify(remaining));
    if (deleted) {
      console.log('🗑️ Deleted watchlist:', deleted.name);
    } else {
      console.log('🗑️ Deleted watchlist with id:', id);
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
        // If the new name starts with '!', inject mock data and overwrite items
        if (typeof newName === 'string' && newName.startsWith('!')) {
          const mock = generateFixedMockWatchlist({ numTickers: 4, days: 130 });
          updated[id].items = mock.items;
        }
      }
      localStorage.setItem('burnlist_watchlists', JSON.stringify(updated));
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
    localStorage.setItem('burnlist_watchlists', JSON.stringify(updated));
  }, [setWatchlists, watchlists]);

  // Export all localStorage data to JSON file
  const handleExportData = () => {
    try {
      const allData = {
        watchlists: watchlists,
        fetchCount: fetchCount,
        tradeJournalTrades: JSON.parse(localStorage.getItem('trade_journal_trades') || '[]'),
        timestamp: new Date().toISOString()
      };
      
      const dataStr = JSON.stringify(allData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `burnlist_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      setNotification('✅ Data exported successfully');
      setNotificationType('success');
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setNotification('❌ Export failed');
      setNotificationType('error');
      setTimeout(() => setNotification(''), 3000);
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
        
        // Validate the imported data structure
        if (!importedData.watchlists || typeof importedData.watchlists !== 'object') {
          throw new Error('Invalid data format: missing watchlists');
        }

        // Import watchlists
        setWatchlists(importedData.watchlists);
        localStorage.setItem('burnlist_watchlists', JSON.stringify(importedData.watchlists));

        // Import fetch count if available
        if (importedData.fetchCount !== undefined) {
          setFetchCount(importedData.fetchCount);
          localStorage.setItem('burnlist_fetch_count', String(importedData.fetchCount));
        }

        // Import trade journal data if available
        if (importedData.tradeJournalTrades && Array.isArray(importedData.tradeJournalTrades)) {
          localStorage.setItem('trade_journal_trades', JSON.stringify(importedData.tradeJournalTrades));
        }

        setNotification('✅ Data imported successfully');
        setNotificationType('success');
        setTimeout(() => setNotification(''), 3000);
      } catch (error) {
        console.error('Import error:', error);
        setNotification('❌ Import failed: Invalid file format');
        setNotificationType('error');
        setTimeout(() => setNotification(''), 3000);
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
        if (typeof newName === 'string' && newName.startsWith('!')) {
          const mock = generateFixedMockWatchlist({ numTickers: 4, days: 130 });
          updated[id].items = mock.items;
        }
      }
      localStorage.setItem('burnlist_watchlists', JSON.stringify(updated));
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
      padding: '32px',
      transition: 'background 0.3s, color 0.3s',
      /* Mobile responsive padding */
      '@media (max-width: 768px)': {
        padding: '16px',
        paddingBottom: '80px', // Account for mobile navigation
      },
      '@media (max-width: 480px)': {
        padding: '12px',
        paddingBottom: '80px', // Account for mobile navigation
      }
    }}>
      {/* Header Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: '12px',
        '@media (max-width: 768px)': {
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginBottom: 16,
        }
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          '@media (max-width: 480px)': {
            gap: 8,
          }
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
              minHeight: '44px', // Touch-friendly
            }}
            aria-label="Toggle theme"
          >
            <img 
              src={isInverted ? logoblack : logo} 
              alt="Burnlist Logo" 
              style={{ 
                width: 40, 
                height: 40, 
                marginRight: 10, 
                transition: 'filter 0.3s',
                '@media (max-width: 480px)': {
                  width: 32,
                  height: 32,
                  marginRight: 8,
                }
              }} 
            />
          </button>
          <strong style={{ 
            fontSize: '170%', 
            lineHeight: '40px', 
            display: 'inline-block', 
            color: green,
            '@media (max-width: 768px)': {
              fontSize: '140%',
              lineHeight: '32px',
            },
            '@media (max-width: 480px)': {
              fontSize: '120%',
              lineHeight: '28px',
            }
          }}>BURNLIST v1.1</strong>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10,
          '@media (max-width: 768px)': {
            alignSelf: 'flex-end',
          }
        }}>
          <span style={{ color: red, fontWeight: 'bold', fontSize: 12 }}>{uniqueRealTickers.length}</span>
          <span style={{ color: green, fontWeight: 'bold', fontSize: 12 }}>{fetchCount}</span>
          <span 
            onClick={() => {
              const data = JSON.parse(localStorage.getItem('burnlist_watchlists'));
              console.log('🧪 Current localStorage burnlist_watchlists:', data);
            }}
            style={{ cursor: 'pointer', color: green }}
          >
            ACCOUNT: local
          </span>
        </div>
      </div>

      {/* Navigation Buttons - Hidden on mobile since they're in bottom nav */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 16, 
        gap: 12,
        flexWrap: 'wrap',
      }} className="desktop-nav-buttons">
        <style>
          {`
            .clicked-button {
              background-color: black !important;
              color: ${CRT_GREEN} !important;
            }
            
            .desktop-nav-buttons {
              display: flex;
            }
            
            @media (max-width: 768px) {
              .desktop-nav-buttons {
                display: none !important;
              }
            }
          `}
        </style>
        <Link to="/universes" style={{ textDecoration: 'none' }}>
          <CustomButton
            mobile={true}
            style={{
              backgroundColor: black,
              color: green,
              border: `1px solid ${green}`,
              padding: '4px 18px',
              fontSize: '15px',
              '@media (max-width: 480px)': {
                fontSize: '12px',
                padding: '8px 12px',
              }
            }}
          >
            UNIVERSE
          </CustomButton>
        </Link>
        <Link to="/journal" style={{ textDecoration: 'none' }}>
          <CustomButton
            mobile={true}
            style={{
              backgroundColor: black,
              color: green,
              border: `1px solid ${green}`,
              padding: '4px 18px',
              fontSize: '15px',
              '@media (max-width: 480px)': {
                fontSize: '12px',
                padding: '8px 12px',
              }
            }}
          >
            DASHBOARD
          </CustomButton>
        </Link>
        <CustomButton
          mobile={true}
          onClick={() => {
            setView(view === 'terminal' ? 'graph' : 'terminal');
            console.log('🖥️ View toggled to:', view === 'terminal' ? 'graph' : 'terminal');
          }}
          style={{ 
            backgroundColor: black,
            color: green,
            border: `1px solid ${green}`,
            padding: '4px 18px',
            fontSize: '15px',
            '@media (max-width: 480px)': {
              fontSize: '12px',
              padding: '8px 12px',
            }
          }}
        >
          {view === 'terminal' ? 'GRAPH VIEW' : 'TERMINAL VIEW'}
        </CustomButton>
      </div>

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
          pointerEvents: 'none',
          '@media (max-width: 480px)': {
            top: 12,
          }
        }}>
          <div style={{ 
            minWidth: 320, 
            maxWidth: 480, 
            pointerEvents: 'auto',
            '@media (max-width: 480px)': {
              minWidth: '90vw',
              maxWidth: '90vw',
            }
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(252px, 1fr))',
        rowGap: '20px',
        columnGap: '20px',
        margin: '70px 0 1px 0',
        justifyContent: 'center',
        alignItems: 'start',
        '@media (max-width: 768px)': {
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          rowGap: '16px',
          columnGap: '16px',
          margin: '40px 0 1px 0',
        },
        '@media (max-width: 480px)': {
          gridTemplateColumns: '1fr',
          rowGap: '12px',
          columnGap: '12px',
          margin: '20px 0 1px 0',
        }
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
                overflow: 'hidden',
                '@media (max-width: 768px)': {
                  height: editMode ? 120 : (view === 'graph' ? 160 : 90),
                  padding: '6px 4px',
                },
                '@media (max-width: 480px)': {
                  height: editMode ? 110 : (view === 'graph' ? 140 : 70),
                  padding: '4px 3px',
                }
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
                  minHeight: '24px',
                  '@media (max-width: 768px)': {
                    fontSize: 14,
                    padding: '1px 3px',
                    minHeight: '20px',
                  },
                  '@media (max-width: 480px)': {
                    fontSize: 12,
                    padding: '1px 2px',
                    minHeight: '18px',
                  }
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
                '@media (max-width: 768px)': {
                  fontSize: 14,
                  marginBottom: 2,
                },
                '@media (max-width: 480px)': {
                  fontSize: 12,
                  marginBottom: 1,
                }
              }}>
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
                  minHeight: '16px',
                  '@media (max-width: 768px)': {
                    fontSize: 8,
                    padding: '1px 3px',
                    minHeight: '14px',
                  },
                  '@media (max-width: 480px)': {
                    fontSize: 7,
                    padding: '1px 2px',
                    minHeight: '12px',
                  }
                }}
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
                  minHeight: '18px',
                  '@media (max-width: 768px)': {
                    fontSize: 10,
                    padding: '1px 2px',
                    minHeight: '16px',
                  },
                  '@media (max-width: 480px)': {
                    fontSize: 9,
                    padding: '1px 2px',
                    minHeight: '14px',
                  }
                }}
                placeholder="Reason..."
              />
            ) : (
              <div style={{ 
                fontSize: 14, 
                color: green, 
                marginBottom: 4, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                '@media (max-width: 768px)': {
                  fontSize: 11,
                  marginBottom: 2,
                },
                '@media (max-width: 480px)': {
                  fontSize: 9,
                  marginBottom: 1,
                }
              }}>
                {item.reason || 'N/A'}
              </div>
            )}
            {/* Portfolio info */}
            <div style={{ 
              fontSize: 13, 
              color: green, 
              marginBottom: 2,
              '@media (max-width: 768px)': {
                fontSize: 10,
                marginBottom: 1,
              },
              '@media (max-width: 480px)': {
                fontSize: 8,
                marginBottom: 1,
              }
            }}>
              {tickers.length} stocks | Risk: {riskIndicator}
            </div>
            {/* Last update */}
            <div style={{ 
              fontSize: 11, 
              color: gray, 
              marginBottom: 2,
              '@media (max-width: 768px)': {
                fontSize: 9,
                marginBottom: 1,
              },
              '@media (max-width: 480px)': {
                fontSize: 7,
                marginBottom: 1,
              }
            }}>
              {lastUpdate}
            </div>
            {/* Return percent in terminal view */}
            {view !== 'graph' && tickers.length > 0 && (
              <div style={{ 
                fontSize: 19, 
                color: isPositive ? green : red, 
                fontWeight: 'bold', 
                marginBottom: 2,
                '@media (max-width: 768px)': {
                  fontSize: 14,
                  marginBottom: 1,
                },
                '@media (max-width: 480px)': {
                  fontSize: 12,
                  marginBottom: 1,
                }
              }}>
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
                  marginBottom: 2,
                  '@media (max-width: 768px)': {
                    fontSize: 14,
                    marginBottom: 1,
                  },
                  '@media (max-width: 480px)': {
                    fontSize: 12,
                    marginBottom: 1,
                  }
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
                  alignItems: 'flex-end',
                  '@media (max-width: 768px)': {
                    height: 60,
                    maxWidth: 140,
                    marginTop: 1,
                  },
                  '@media (max-width: 480px)': {
                    height: 50,
                    maxWidth: 120,
                    marginTop: 1,
                  }
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

      {/* Centered +++ button below cards - Hidden on mobile since it's in the stack */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        margin: '40px 0 0 0',
        '@media (max-width: 768px)': {
          display: 'none', // Hide on mobile since it's in the stack
        }
      }}>
        <CustomButton
          mobile={true}
          onClick={handleCreateWatchlist}
          className={justClicked ? 'clicked-button' : ''}
          style={{
            backgroundColor: green,
            color: black,
            transition: 'all 0.2s ease-in-out',
            minHeight: '44px',
            padding: '12px 24px',
            fontSize: '18px',
          }}
        >
          +++
        </CustomButton>
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
          onClick={handleExportData}
          className="action-button"
        >
          EXPORT
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
        >
          IMPORT
        </button>
        <button
          onClick={() => {
            setEditMode(!editMode);
            console.log('🛠️ Edit mode:', !editMode);
          }}
          className="action-button"
          style={{
            textTransform: 'lowercase',
            fontWeight: 400,
            letterSpacing: 1,
          }}
        >
          {editMode ? 'done' : 'edit'}
        </button>
        <button
          onClick={handleCreateWatchlist}
          className="action-button"
          style={{
            backgroundColor: green,
            color: black,
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          +++
        </button>
      </div>
    </div>
  );
};

export default HomePage;