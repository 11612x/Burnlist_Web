import React, { useState, useEffect } from "react";
import { useTheme } from '../ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import greenflag from '../assets/greenflag.png';
import yellowflag from '../assets/yellowflag.png';
import redflag from '../assets/redflag.png';
import backbutton from '../assets/backbutton.png';
import useNotification from '../hooks/useNotification';
import { logger } from '../utils/logger';
import { getCachedExchange } from '../utils/exchangeDetector';

const CRT_GREEN = 'rgb(140,185,162)';

const TradeJournal = () => {
  const { isInverted } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [trades, setTrades] = useState([]);
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();
  const [editMode, setEditMode] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState(new Set());

  // Load trades from localStorage on mount
  useEffect(() => {
    const savedTrades = localStorage.getItem("trade_journal_trades");
    if (savedTrades) {
      try {
        setTrades(JSON.parse(savedTrades));
      } catch (error) {
        logger.error("Error loading trades:", error);
      }
    }
  }, []);

  // Save trades to localStorage whenever trades change
  useEffect(() => {
    localStorage.setItem("trade_journal_trades", JSON.stringify(trades));
  }, [trades]);

  const updateTrade = (id, updates) => {
    setTrades(prev => prev.map(trade => 
      trade.id === id ? { ...trade, ...updates } : trade
    ));
  };

  const deleteTrade = (id) => {
    setTrades(prev => prev.filter(trade => trade.id !== id));
    setNotification("Trade deleted", "success");
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    });
  };

  // Function to open ticker chart in new tab
  const handleTickerClick = async (symbol) => {
    if (!symbol) return;
    
    try {
      // Get the correct exchange for this symbol
      const exchange = await getCachedExchange(symbol);
      const encodedSymbol = encodeURIComponent(`${exchange}:${symbol.toUpperCase()}`);
      const chartUrl = `https://www.tradingview.com/chart/i0seCgVv/?symbol=${encodedSymbol}`;
      window.open(chartUrl, '_blank');
    } catch (error) {
      logger.warn(`⚠️ Error opening chart for ${symbol}:`, error);
      // Fallback to NASDAQ if there's an error
      const encodedSymbol = encodeURIComponent(`NASDAQ:${symbol.toUpperCase()}`);
      const chartUrl = `https://www.tradingview.com/chart/i0seCgVv/?symbol=${encodedSymbol}`;
      window.open(chartUrl, '_blank');
    }
  };

  // Calculate trade statistics
  const calculateTradeStats = () => {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        openTrades: 0,
        winRate: 0,
        averageReturn: 0
      };
    }

    const completedTrades = trades.filter(trade => trade.outcome && trade.outcome !== 'Open');
    const winTrades = completedTrades.filter(trade => trade.outcome === 'Win').length;
    const lossTrades = completedTrades.filter(trade => trade.outcome === 'Loss').length;
    const openTrades = trades.filter(trade => !trade.outcome || trade.outcome === 'Open').length;
    
    const winRate = completedTrades.length > 0 ? (winTrades / completedTrades.length) * 100 : 0;

    // Calculate average return based on actual buy price to sell price returns
    const totalReturn = completedTrades.reduce((sum, trade) => {
      if (!trade.entryPrice || !trade.target) return sum;
      
      // Calculate return percentage: (sell_price - buy_price) / buy_price * 100
      const buyPrice = parseFloat(trade.entryPrice);
      const sellPrice = parseFloat(trade.target);
      
      if (isNaN(buyPrice) || isNaN(sellPrice) || buyPrice <= 0) return sum;
      
      const returnPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
      return sum + returnPercent;
    }, 0);
    
    const averageReturn = completedTrades.length > 0 ? totalReturn / completedTrades.length : 0;

    return {
      totalTrades: trades.length,
      winTrades,
      lossTrades,
      openTrades,
      winRate,
      averageReturn
    };
  };

  const stats = calculateTradeStats();

  // Edit mode handlers
  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    setSelectedTrades(new Set());
  };

  const handleSelectTrade = (tradeId) => {
    setSelectedTrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tradeId)) {
        newSet.delete(tradeId);
      } else {
        newSet.add(tradeId);
      }
      return newSet;
    });
  };

  const handleSelectAllTrades = () => {
    if (selectedTrades.size === trades.length) {
      setSelectedTrades(new Set());
    } else {
      setSelectedTrades(new Set(trades.map(trade => trade.id)));
    }
  };

  const handleMassDelete = () => {
    if (selectedTrades.size === 0) {
      setNotification("Please select at least one trade to delete", "error");
      return;
    }
    
    setTrades(prev => prev.filter(trade => !selectedTrades.has(trade.id)));
    setSelectedTrades(new Set());
    setNotification(`Deleted ${selectedTrades.size} trades`, "success");
  };

  const handleCreateBurnlist = () => {
    if (selectedTrades.size === 0) {
      setNotification("Please select at least one trade to create burnlist", "error");
      return;
    }

    const selectedTradeData = trades.filter(trade => selectedTrades.has(trade.id));
    const watchlists = JSON.parse(localStorage.getItem('burnlist_watchlists') || '{}');
    
    const watchlistName = `Journal_${new Date().toISOString().split('T')[0]}`;
    const watchlistId = `journal_${Date.now()}`;
    const watchlistSlug = watchlistName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const newWatchlist = {
      id: watchlistId,
      name: watchlistName,
      slug: watchlistSlug,
      items: selectedTradeData.map(trade => ({
        symbol: trade.ticker,
        buyPrice: parseFloat(trade.entryPrice) || 0,
        buyDate: trade.executedAt || trade.date || new Date().toISOString(),
        historicalData: []
      })),
      reason: `Created from journal with ${selectedTradeData.length} trades`,
      createdAt: new Date().toISOString()
    };

    const updatedWatchlists = { ...watchlists, [watchlistId]: newWatchlist };
    localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedWatchlists));
    
    setNotification(`Created burnlist "${watchlistName}" with ${selectedTradeData.length} stocks`, "success");
    setSelectedTrades(new Set());
  };

  return (
    <div style={{ 
      backgroundColor: isInverted ? 'rgb(140,185,162)' : '#000000', 
      color: isInverted ? '#000000' : '#ffffff', 
      minHeight: '100vh',
      padding: '0',
      fontFamily: "'Courier New', monospace"
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: `2px solid ${CRT_GREEN}`,
        background: 'rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ 
            color: CRT_GREEN, 
            margin: 0, 
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            TRADE JOURNAL
          </h1>
        </div>
        <div style={{ color: CRT_GREEN, fontSize: '14px' }}>
          {trades.length} Trades Logged
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10px 20px',
        borderBottom: `1px solid ${CRT_GREEN}`,
        background: 'rgba(0,0,0,0.3)',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <CustomButton
          onClick={() => navigate('/universes')}
          style={{
            background: location.pathname === '/universes' || location.pathname.startsWith('/universe/') ? CRT_GREEN : 'transparent',
            color: location.pathname === '/universes' || location.pathname.startsWith('/universe/') ? '#000000' : CRT_GREEN,
            border: `1px solid ${CRT_GREEN}`,
            padding: '9px 18px',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '80px',
            textAlign: 'center'
          }}
        >
          UNIVERSE
        </CustomButton>
        
        <CustomButton
          onClick={() => navigate('/journal')}
          style={{
            background: location.pathname === '/journal' ? CRT_GREEN : 'transparent',
            color: location.pathname === '/journal' ? '#000000' : CRT_GREEN,
            border: `1px solid ${CRT_GREEN}`,
            padding: '9px 18px',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '80px',
            textAlign: 'center'
          }}
        >
          JOURNAL
        </CustomButton>
        
        <CustomButton
          onClick={() => navigate('/market')}
          style={{
            background: location.pathname === '/market' ? CRT_GREEN : 'transparent',
            color: location.pathname === '/market' ? '#000000' : CRT_GREEN,
            border: `1px solid ${CRT_GREEN}`,
            padding: '9px 18px',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '80px',
            textAlign: 'center'
          }}
        >
          MARKET
        </CustomButton>
        
        <CustomButton
          onClick={() => navigate('/')}
          style={{
            background: location.pathname === '/' || location.pathname.startsWith('/burn/') ? CRT_GREEN : 'transparent',
            color: location.pathname === '/' || location.pathname.startsWith('/burn/') ? '#000000' : CRT_GREEN,
            border: `1px solid ${CRT_GREEN}`,
            padding: '9px 18px',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '80px',
            textAlign: 'center'
          }}
        >
          BURNPAGE
        </CustomButton>
      </div>

      {/* Stats Banner */}
      {stats.totalTrades > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'rgba(0,0,0,0.2)',
          '@media (max-width: 768px)': {
            flexDirection: 'column',
            gap: '8px',
            padding: '8px 16px'
          }
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: CRT_GREEN, fontSize: '14px', fontWeight: 'bold' }}>
              TOTAL TRADES
            </div>
            <div style={{ color: CRT_GREEN, fontSize: '18px', fontWeight: 'bold' }}>
              {stats.totalTrades}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: CRT_GREEN, fontSize: '14px', fontWeight: 'bold' }}>
              WINS
            </div>
            <div style={{ color: CRT_GREEN, fontSize: '18px', fontWeight: 'bold' }}>
              {stats.winTrades}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: CRT_GREEN, fontSize: '14px', fontWeight: 'bold' }}>
              LOSSES
            </div>
            <div style={{ color: CRT_GREEN, fontSize: '18px', fontWeight: 'bold' }}>
              {stats.lossTrades}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: CRT_GREEN, fontSize: '14px', fontWeight: 'bold' }}>
              OPEN
            </div>
            <div style={{ color: CRT_GREEN, fontSize: '18px', fontWeight: 'bold' }}>
              {stats.openTrades}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: CRT_GREEN, fontSize: '14px', fontWeight: 'bold' }}>
              WIN RATE
            </div>
            <div style={{ color: CRT_GREEN, fontSize: '18px', fontWeight: 'bold' }}>
              {stats.winRate.toFixed(1)}%
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: CRT_GREEN, fontSize: '14px', fontWeight: 'bold' }}>
              AVG RETURN
            </div>
            <div style={{ color: CRT_GREEN, fontSize: '18px', fontWeight: 'bold' }}>
              {stats.averageReturn.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Notification Banner */}
      {notification && (
        <NotificationBanner
          message={notification}
          type={notificationType}
          onClose={() => setNotification("")}
        />
      )}

      {/* Main Content */}
      <div style={{ padding: '20px' }}>
        {/* Edit Button - Above Table */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '10px'
        }}>
          <button
            onClick={handleToggleEditMode}
            style={{
              background: 'none',
              border: 'none',
              color: CRT_GREEN,
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '4px 8px',
              textDecoration: 'underline'
            }}
          >
            {editMode ? 'DONE' : 'EDIT'}
          </button>
        </div>

        {trades.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            color: CRT_GREEN,
            fontSize: '18px'
          }}>
            <div style={{ marginBottom: '20px' }}>
              📊 No executed trades yet
            </div>
            <div style={{ fontSize: '14px', opacity: 0.7 }}>
              Execute trades from the Universe page to see them here
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: `1px solid ${CRT_GREEN}`,
              fontSize: '14px',
              tableLayout: 'fixed',
              lineHeight: '24px'
            }}>
                              <thead>
                <tr style={{ 
                  background: 'rgba(140,185,162,0.1)',
                  borderBottom: `2px solid ${CRT_GREEN}`,
                  height: '40px'
                }}>
                  {editMode && (
                    <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedTrades.size === trades.length && trades.length > 0}
                        onChange={handleSelectAllTrades}
                        style={{ accentColor: CRT_GREEN }}
                      />
                    </th>
                  )}
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Ticker
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Setup
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    R:R
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Verdict
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Outcome
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Entry
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Stop
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Target
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Position
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Date
                  </th>
                  <th style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                    Price Source
                  </th>
                  {editMode && (
                    <th style={{ padding: '0px', textAlign: 'center', height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                                 {trades.map((trade, index) => (
                   <tr 
                     key={trade.id}
                     style={{ 
                       borderBottom: `1px solid ${CRT_GREEN}`,
                       background: index % 2 === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)',
                       height: '40px'
                     }}
                   >
                     {editMode && (
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden', width: '40px' }}>
                         <input
                           type="checkbox"
                           checked={selectedTrades.has(trade.id)}
                           onChange={() => handleSelectTrade(trade.id)}
                           style={{ accentColor: CRT_GREEN }}
                         />
                       </td>
                     )}
                     <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, fontWeight: 'bold', height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                       <span
                         onClick={() => handleTickerClick(trade.ticker)}
                         style={{
                           cursor: 'pointer',
                           textDecoration: 'underline',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           gap: '4px'
                         }}
                         title={`Click to open ${trade.ticker} chart in new tab`}
                       >
                         {trade.ticker}
                       </span>
                     </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         {trade.setup || trade.setupType || 'Manual'}
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         {trade.riskReward ? `${trade.riskReward}:1` : 'N/A'}
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '24px', maxHeight: '24px' }}>
                           <img 
                             src={trade.verdictFlag || greenflag} 
                             alt={trade.verdict} 
                             style={{ width: '14px', height: '14px' }} 
                           />
                           <span style={{ fontSize: '12px', lineHeight: '14px' }}>{trade.verdict || 'Qualified'}</span>
                         </div>
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         <select
                           value={trade.outcome || 'Open'}
                           onChange={(e) => updateTrade(trade.id, { outcome: e.target.value })}
                           style={{
                             background: 'transparent',
                             color: CRT_GREEN,
                             border: 'none',
                             padding: '2px 4px',
                             fontFamily: "'Courier New', monospace",
                             fontSize: '11px',
                             cursor: 'pointer',
                             height: '35px',
                             maxHeight: '35px',
                             lineHeight: '31px'
                           }}
                         >
                           <option value="Open">Open</option>
                           <option value="Win">Win</option>
                           <option value="Loss">Loss</option>
                           <option value="Break Even">Break Even</option>
                         </select>
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         ${trade.entryPrice ? trade.entryPrice.toFixed(2) : 'N/A'}
                         {trade.currentMarketPrice && (
                           <div style={{ 
                             fontSize: '10px', 
                             color: '#666', 
                             marginTop: '2px',
                             fontStyle: 'italic'
                           }}>
                             Market: ${trade.currentMarketPrice.toFixed(2)}
                           </div>
                         )}
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         ${trade.stopLoss ? trade.stopLoss.toFixed(2) : 'N/A'}
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         ${trade.target ? trade.target.toFixed(2) : 'N/A'}
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         {trade.positionSize ? `${trade.positionSize} shares` : 'N/A'}
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         {trade.executedAt ? formatDate(trade.executedAt) : formatDate(trade.date)}
                       </td>
                       <td style={{ padding: '0px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                         {trade.priceSource || 'Manual'}
                       </td>
                       {editMode && (
                         <td style={{ padding: '8px', textAlign: 'center', height: '40px', minHeight: '40px', maxHeight: '40px', lineHeight: '24px', boxSizing: 'border-box', verticalAlign: 'middle', overflow: 'hidden' }}>
                           <CustomButton
                             onClick={() => deleteTrade(trade.id)}
                             style={{
                               background: 'none',
                               border: 'none',
                               color: '#ff4444',
                               padding: '2px 4px',
                               fontSize: '10px',
                               cursor: 'pointer',
                               height: '20px',
                               maxHeight: '20px',
                               lineHeight: '16px'
                             }}
                           >
                             DELETE
                           </CustomButton>
                         </td>
                       )}
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mass Action Buttons - Only in Edit Mode */}
      {editMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: `1px solid ${CRT_GREEN}`,
          background: 'rgba(0,0,0,0.2)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <CustomButton
            onClick={handleSelectAllTrades}
            style={{
              background: selectedTrades.size === trades.length ? CRT_GREEN : 'transparent',
              color: selectedTrades.size === trades.length ? '#000000' : CRT_GREEN,
              border: `1px solid ${CRT_GREEN}`,
              padding: '6px 12px',
              fontFamily: "'Courier New', monospace",
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {selectedTrades.size === trades.length ? 'DESELECT ALL' : 'SELECT ALL'}
          </CustomButton>
          
          <CustomButton
            onClick={handleMassDelete}
            disabled={selectedTrades.size === 0}
            style={{
              background: selectedTrades.size === 0 ? 'rgba(0,0,0,0.3)' : 'transparent',
              color: selectedTrades.size === 0 ? '#666' : '#e31507',
              border: `1px solid ${selectedTrades.size === 0 ? '#666' : '#e31507'}`,
              padding: '6px 12px',
              fontFamily: "'Courier New', monospace",
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: selectedTrades.size === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            DELETE ({selectedTrades.size})
          </CustomButton>
          
          <CustomButton
            onClick={handleCreateBurnlist}
            disabled={selectedTrades.size === 0}
            style={{
              background: selectedTrades.size === 0 ? 'rgba(0,0,0,0.3)' : 'transparent',
              color: selectedTrades.size === 0 ? '#666' : CRT_GREEN,
              border: `1px solid ${selectedTrades.size === 0 ? '#666' : CRT_GREEN}`,
              padding: '6px 12px',
              fontFamily: "'Courier New', monospace",
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: selectedTrades.size === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            CREATE BURNLIST ({selectedTrades.size})
          </CustomButton>
        </div>
      )}
    </div>
  );
};

export default TradeJournal; 