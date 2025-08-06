import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavigationBar from '@components/NavigationBar';
import WatchlistSelector from '../components/WatchlistSelector';

const CRT_GREEN = 'rgb(140,185,162)';
const CRT_RED = '#e31507';

const boxStyle = {
  border: `1.5px solid ${CRT_GREEN}`,
  borderRadius: 4,
  background: 'black',
  color: CRT_GREEN,
  fontFamily: 'Courier New',
  padding: 16,
  marginBottom: 24,
  boxShadow: '0 2px 8px 0 rgba(140,185,162,0.08)'
};

function getLatestAndChange(item) {
  if (!item || !Array.isArray(item.historicalData) || item.historicalData.length < 2) return { latest: null, change: null };
  const latest = item.historicalData[item.historicalData.length - 1]?.price;
  const prev = item.historicalData[item.historicalData.length - 2]?.price;
  if (typeof latest !== 'number' || typeof prev !== 'number' || prev === 0) return { latest: null, change: null };
  const change = ((latest - prev) / prev) * 100;
  return { latest, change };
}

function TradingViewChart() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Remove any previous widget
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.innerHTML = JSON.stringify({
      "allow_symbol_change": true,
      "calendar": false,
      "details": false,
      "hide_side_toolbar": true,
      "hide_top_toolbar": true,
      "hide_legend": true,
      "hide_volume": true,
      "hotlist": false,
      "interval": "D",
      "locale": "en",
      "save_image": false,
      "style": "1",
      "symbol": "NASDAQ:AAPL",
      "theme": "dark",
      "timezone": "Etc/UTC",
      "backgroundColor": "rgba(0, 0, 0, 1)",
      "gridColor": "rgba(102, 187, 106, 0.06)",
      "watchlist": [],
      "withdateranges": false,
      "compareSymbols": [],
      "studies": ["STD;DEMA"],
      "autosize": true,
      "overrides": {
        "mainSeriesProperties.candleStyle.upColor": "#00aaff",
        "mainSeriesProperties.candleStyle.downColor": "#ffe600",
        "mainSeriesProperties.candleStyle.borderUpColor": "#00aaff",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ffe600",
        "mainSeriesProperties.candleStyle.wickUpColor": "#00aaff",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ffe600"
      }
    });
    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="tradingview-widget-container" style={{height: '150px', width: '100%'}}>
      <div ref={containerRef} className="tradingview-widget-container__widget" style={{height: '167px', width: '100%'}} />
      <div className="tradingview-widget-copyright">
        <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
          <span className="blue-text">Track all markets on TradingView</span>
        </a>
      </div>
    </div>
  );
}

const TradeDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedWatchlist, setSelectedWatchlist] = useState("");
  const [watchlistData, setWatchlistData] = useState(null);

  useEffect(() => {
    if (!selectedWatchlist) {
      setWatchlistData(null);
      return;
    }
    try {
      const saved = localStorage.getItem("burnlist_watchlists");
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = Object.values(parsed).find(w => w.slug === selectedWatchlist);
        setWatchlistData(found || null);
      } else {
        setWatchlistData(null);
      }
    } catch (e) {
      setWatchlistData(null);
    }
  }, [selectedWatchlist]);

  return (
    <div style={{
      fontFamily: 'Courier New',
      color: CRT_GREEN,
      background: 'black',
      minHeight: '100vh',
      padding: '0'
    }}>
      <NavigationBar />
      
      {/* Main Content */}
      <div style={{ margin: '70px 0 1px 0' }}>
        {/* Portfolio Bar */}
      <div style={{ ...boxStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 18 }}>
        <div>Total Equity: $100,000</div>
        <div>Cash: $20,000</div>
        <div>Open P/L: <span style={{ color: CRT_GREEN }}>+$1,200</span></div>
        <div>% Allocated: <span style={{ border: `1px solid ${CRT_GREEN}`, padding: '2px 12px', borderRadius: 2 }}>80%</span></div>
        <div>Exposure: Long 70% / Short 10%</div>
      </div>

      {/* Main Section: Table + Chart/Selector */}
      <div style={{ display: 'flex', gap: 32 }}>
        {/* Positions Table */}
        <div style={{ flex: 2 }}>
          <div style={{ ...boxStyle, minHeight: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Positions</div>
              <button style={{ background: 'none', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, fontFamily: 'Courier New', fontSize: 15, padding: '4px 18px', borderRadius: 2, cursor: 'pointer' }}>Add Position</button>
              <button style={{ background: 'none', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, fontFamily: 'Courier New', fontSize: 15, padding: '4px 18px', borderRadius: 2, cursor: 'pointer' }}>Export .json</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${CRT_GREEN}` }}>
                  <th style={{ textAlign: 'left', padding: 6 }}>Ticker</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Buy</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Current</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>% Return</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>$ Return</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Size</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Held</th>
                  <th style={{ textAlign: 'center', padding: 6 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: 6 }}>Notes</th>
                  <th style={{ textAlign: 'center', padding: 6 }}>Trade</th>
                </tr>
              </thead>
              <tbody>
                {[1,2,3].map(i => (
                  <tr key={i} style={{ borderBottom: `1px solid #222` }}>
                    <td style={{ padding: 6 }}>AAPL</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>$180.00</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>$185.00</td>
                    <td style={{ padding: 6, textAlign: 'right', color: CRT_GREEN }}>+2.8%</td>
                    <td style={{ padding: 6, textAlign: 'right', color: CRT_GREEN }}>+$50</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>$1,000</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>3d</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>Open</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>📝</td>
                    <td style={{ padding: 6, textAlign: 'center' }}><button style={{ background: 'none', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, fontFamily: 'Courier New', fontSize: 14, padding: '2px 10px', borderRadius: 2, cursor: 'pointer' }}>Trade</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Chart + Watchlist Selector */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Watchlist Selector + Table in one box */}
          <div style={{ ...boxStyle, minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', padding: 0 }}>
            <div style={{ padding: 16, borderBottom: watchlistData && Array.isArray(watchlistData.items) && watchlistData.items.length > 0 ? `1px solid #222` : 'none' }}>
              <WatchlistSelector value={selectedWatchlist} onSelect={setSelectedWatchlist} />
            </div>
            {watchlistData && Array.isArray(watchlistData.items) && watchlistData.items.length > 0 && (
              <div style={{ maxHeight: 220, overflowY: 'auto', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                  <thead>
                    <tr style={{ borderBottom: `1.5px solid ${CRT_GREEN}` }}>
                      <th style={{ textAlign: 'left', padding: 6, position: 'sticky', top: 0, background: 'black', zIndex: 1 }}>Symbol</th>
                      <th style={{ textAlign: 'right', padding: 6, position: 'sticky', top: 0, background: 'black', zIndex: 1 }}>Latest</th>
                      <th style={{ textAlign: 'right', padding: 6, position: 'sticky', top: 0, background: 'black', zIndex: 1 }}>% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistData.items.map((item, idx) => {
                      const { latest, change } = getLatestAndChange(item);
                      return (
                        <tr key={item.symbol || idx} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: 6 }}>{item.symbol}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>{typeof latest === 'number' ? `$${latest.toFixed(2)}` : '--'}</td>
                          <td style={{ padding: 6, textAlign: 'right', color: typeof change === 'number' ? (change >= 0 ? CRT_GREEN : CRT_RED) : '#888' }}>{typeof change === 'number' ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '--'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Chart/Indicators */}
          <div style={{ ...boxStyle, minHeight: 180 }}>
            <TradingViewChart />
            {/* Removed RSI, EMA, SMA, ATR buttons */}
          </div>
        </div>
      </div>
      {/* Quick Trade Panel (mockup, not functional) */}
      <div style={{ ...boxStyle, maxWidth: 420, margin: '40px auto 0 auto', background: '#181818' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Quick Trade Panel</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <input placeholder="Symbol" style={{ flex: 1, background: 'black', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, borderRadius: 2, padding: '4px 8px', fontFamily: 'Courier New' }} />
          <select style={{ background: 'black', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, borderRadius: 2, padding: '4px 8px', fontFamily: 'Courier New' }}>
            <option>Long</option>
            <option>Short</option>
          </select>
          <input placeholder="Amount" style={{ width: 80, background: 'black', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, borderRadius: 2, padding: '4px 8px', fontFamily: 'Courier New' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <input placeholder="Stop-loss ($ or %)" style={{ flex: 1, background: 'black', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, borderRadius: 2, padding: '4px 8px', fontFamily: 'Courier New' }} />
          <input placeholder="Take-profit ($ or %)" style={{ flex: 1, background: 'black', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, borderRadius: 2, padding: '4px 8px', fontFamily: 'Courier New' }} />
        </div>
        <textarea placeholder="Reason (optional)" style={{ width: '100%', background: 'black', color: CRT_GREEN, border: `1px solid ${CRT_GREEN}`, borderRadius: 2, padding: '4px 8px', fontFamily: 'Courier New', minHeight: 40, marginBottom: 8 }} />
        <button style={{ width: '100%', background: CRT_GREEN, color: 'black', border: 'none', borderRadius: 2, fontFamily: 'Courier New', fontWeight: 700, fontSize: 15, padding: '8px 0', cursor: 'pointer' }}>Submit Trade</button>
      </div>
      </div>
    </div>
  );
};

export default TradeDashboard; 