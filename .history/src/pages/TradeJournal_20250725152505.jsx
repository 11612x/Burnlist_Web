import React, { useState, useEffect } from "react";
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router-dom';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import greenflag from '../assets/greenflag.png';
import yellowflag from '../assets/yellowflag.png';
import redflag from '../assets/redflag.png';
import backbutton from '../assets/backbutton.png';

const CRT_GREEN = 'rgb(140,185,162)';

const TradeJournal = () => {
  const { isInverted } = useTheme();
  const navigate = useNavigate();
  const [trades, setTrades] = useState([]);
  const [notification, setNotification] = useState("");
  const [notificationType, setNotificationType] = useState("info");

  // Load trades from localStorage on mount
  useEffect(() => {
    const savedTrades = localStorage.getItem("trade_journal_trades");
    if (savedTrades) {
      try {
        setTrades(JSON.parse(savedTrades));
      } catch (error) {
        console.error("Error loading trades:", error);
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
    setNotification("Trade deleted");
    setNotificationType("success");
    setTimeout(() => setNotification(""), 3000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    });
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
          <CustomButton
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer'
            }}
          >
            <img 
              src={backbutton} 
              alt="Back" 
              style={{ 
                width: '24px', 
                height: '24px',
                filter: isInverted ? 'invert(1)' : 'none'
              }} 
            />
          </CustomButton>
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
              fontSize: '14px'
            }}>
                              <thead>
                <tr style={{ 
                  background: 'rgba(140,185,162,0.1)',
                  borderBottom: `2px solid ${CRT_GREEN}`,
                  height: '40px'
                }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Ticker
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Setup
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    R:R
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Verdict
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Outcome
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Entry
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Stop
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Target
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Position
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}`, height: '40px' }}>
                    Date
                  </th>
                  <th style={{ padding: '8px', textAlign: 'center', height: '40px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, index) => (
                  <tr 
                    key={trade.id}
                    style={{ 
                      borderBottom: `1px solid ${CRT_GREEN}`,
                      background: index % 2 === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'
                    }}
                  >
                    <td style={{ padding: '12px 8px', borderRight: `1px solid ${CRT_GREEN}`, fontWeight: 'bold' }}>
                      {trade.ticker}
                    </td>
                    <td style={{ padding: '12px 8px', borderRight: `1px solid ${CRT_GREEN}` }}>
                      {trade.setup || trade.setupType || 'Manual'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      {trade.riskReward ? `${trade.riskReward}:1` : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <img 
                          src={trade.verdictFlag || greenflag} 
                          alt={trade.verdict} 
                          style={{ width: '16px', height: '16px' }} 
                        />
                        {trade.verdict || 'Qualified'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      <select
                        value={trade.outcome || 'Open'}
                        onChange={(e) => updateTrade(trade.id, { outcome: e.target.value })}
                        style={{
                          background: 'transparent',
                          color: CRT_GREEN,
                          border: `1px solid ${CRT_GREEN}`,
                          padding: '4px 8px',
                          fontFamily: "'Courier New', monospace",
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Open">Open</option>
                        <option value="Win">Win</option>
                        <option value="Loss">Loss</option>
                        <option value="Break Even">Break Even</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      ${trade.entryPrice ? trade.entryPrice.toFixed(2) : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      ${trade.stopLoss ? trade.stopLoss.toFixed(2) : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      ${trade.target ? trade.target.toFixed(2) : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      {trade.positionSize ? `${trade.positionSize} shares` : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${CRT_GREEN}` }}>
                      {trade.executedAt ? formatDate(trade.executedAt) : formatDate(trade.date)}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <CustomButton
                        onClick={() => deleteTrade(trade.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff4444',
                          padding: '4px 8px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        DELETE
                      </CustomButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeJournal; 