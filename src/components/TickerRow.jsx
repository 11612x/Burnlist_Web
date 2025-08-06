/**
 * TickerRow.jsx
 * Patch summary:
 * - Update to use simple NAV calculations with basic buy prices
 * - Replace sophisticated NAV calculation with simple return calculation
 */
import React from "react";
import { useThemeColor } from '../ThemeContext';
import { getCachedExchange } from '../utils/exchangeDetector';
import CustomButton from './CustomButton'; // Added import for CustomButton
import { formatDateEuropean } from '../utils/dateUtils';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(149,184,163)';
const CRT_RED = '#e31507';

const TickerRow = ({
  item, index, editMode, selectedTimeframe = 'W', // Add selectedTimeframe prop
  handleChangeSymbol, handleBuyPriceChange, handleBuyDateChange, handleRevertBuyDate, handleFetchHistoricalData, handleDelete, handleRefreshPrice, items, changePercent, lookedUpBuyPrice, isInactive = false
}) => {
  const green = useThemeColor(CRT_GREEN);
  const red = useThemeColor(CRT_RED);
  const black = useThemeColor('black');
  
  // 🔍 LEVEL 1 DEBUG: Ticker Row Rendering
  logger.log(`🔍 [TICKER ROW RENDER] ${item?.symbol || 'unknown'}:`);
  logger.log(`  - Index: ${index}`);
  logger.log(`  - Timeframe: ${selectedTimeframe}`);
  logger.log(`  - Historical data points: ${item?.historicalData?.length || 0}`);
  logger.log(`  - Buy price: $${item?.buyPrice}`);
  logger.log(`  - Current price: $${item?.currentPrice}`);
  
  logger.debug("TickerRow received item:", item);
  logger.debug("Historical Data:", item.historicalData);

  if (!item || !Array.isArray(item.historicalData)) {
    logger.warn("\u26d4 Invalid item or missing historicalData for row", item);
    return null;
  }

  // NEW NAV CALCULATION: Use shared baseline price for consistency with NAV calculator
  let buy = NaN;
  let currentPrice = NaN;
  let returnPercent = 0;

  try {
    // For MAX timeframe, use shared baseline price (same as NAV calculator)
    if (selectedTimeframe === 'MAX' && items && items.length > 0) {
      // Get shared baseline price from NAV calculator
      buy = Number(item.buyPrice); // Assuming item.buyPrice is the baseline for MAX
      logger.log(`🔍 [TICKER ROW SHARED BASELINE] ${item.symbol}: Using shared baseline price = $${buy}`);
    } else {
      // For other timeframes, use individual dynamic buy price
      buy = Number(item.buyPrice) || 0;
      logger.log(`🔍 [TICKER ROW INDIVIDUAL BASELINE] ${item.symbol}: Using individual baseline price = $${buy}`);
    }
    
    // Get current price from historical data (most recent available)
    if (item.historicalData && item.historicalData.length > 0) {
      const first = item.historicalData[0];
      const last = item.historicalData[item.historicalData.length - 1];
      
      // Check if data is sorted ascending or descending
      const isAscending = item.historicalData.length === 1 || 
                          new Date(first?.timestamp) < new Date(last?.timestamp);
      
      if (isAscending) {
        // Ascending: latest is at the end
        currentPrice = Number(last?.price);
      } else {
        // Descending: latest is at the beginning
        currentPrice = Number(first?.price);
      }
    }
    
    // Use currentPrice field if available (for real-time updates)
    if (typeof item.currentPrice === 'number') {
      currentPrice = item.currentPrice;
    }
    
    // Calculate return percentage using new NAV logic
    if (!isNaN(buy) && !isNaN(currentPrice) && buy > 0) {
      returnPercent = ((currentPrice - buy) / buy) * 100;
    }
    
    // 🔍 LEVEL 1 DEBUG: New NAV Calculation
    logger.log(`🔍 [TICKER ROW NAV DEBUG] ${item.symbol}:`);
    logger.log(`  - Timeframe: ${selectedTimeframe}`);
    logger.log(`  - Baseline Price: $${buy}`);
    logger.log(`  - Current Price: $${currentPrice}`);
    logger.log(`  - Return %: ${returnPercent.toFixed(2)}%`);
    
  } catch (error) {
    logger.error(`Error calculating NAV for ${item.symbol}:`, error);
    // Fallback to old calculation
    buy = Number(item.buyPrice) || 0;
    currentPrice = item.currentPrice || 0;
    returnPercent = changePercent || 0;
  }

  // DEBUG: Check historical data order and actual stored values
  logger.debug(`[DEBUG PRICES] ${item.symbol}:`);
    logger.debug(`item.buyPrice (stored):`, item.buyPrice);
    logger.debug(`Historical data length:`, item.historicalData?.length);
  if (item.historicalData && item.historicalData.length > 0) {
    const first = item.historicalData[0];
    const last = item.historicalData[item.historicalData.length - 1];
    logger.debug(`First historical point: ${first?.timestamp} → $${first?.price}`);
      logger.debug(`Last historical point: ${last?.timestamp} → $${last?.price}`);
      logger.debug(`Are timestamps ascending?`, new Date(first?.timestamp) < new Date(last?.timestamp));
  }

  if (isNaN(buy)) {
    logger.warn(`\u26d4 Skipping row: No valid buy price resolved for ${item.symbol}`);
    return null;
  }

  // Log the changePercent prop for traceability
  logger.debug(`[ChangePercent Prop] ${item.symbol}:`, changePercent);
  logger.debug(`Rendering row for ${item.symbol}`);

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

  // Helper function to create detailed tooltip content
  const createTooltipContent = (type, data) => {
    const CRT_GREEN = 'rgb(140,185,162)';
    const red = '#e31507';
    
    switch (type) {
      case 'ticker':
        return `Symbol: ${data.symbol}\nClick to open chart\nLast updated: ${data.lastUpdate || 'Unknown'}`;
      case 'buyPrice':
        return `Buy Price: $${data.buyPrice}\nBuy Date: ${data.buyDate}\nEntry Point`;
      case 'buyDate':
        return `Buy Date: ${data.buyDate}\nFormatted: ${data.formattedDate}\nPurchase Date`;
      case 'currentPrice':
        return `Current Price: $${data.currentPrice}\nLatest Update: ${data.lastUpdate || 'Unknown'}\nMarket Price`;
      case 'changePercent':
        const changeColor = data.change >= 0 ? CRT_GREEN : red;
        const prefix = data.change >= 0 ? '+' : '';
        return `Return: ${prefix}${data.change.toFixed(2)}%\nTimeframe: ${data.timeframe || 'Selected'}\nPerformance`;
      default:
        return '';
    }
  };

  // Get last update time from historical data
  const getLastUpdateTime = () => {
    if (!item.historicalData || item.historicalData.length === 0) return 'Unknown';
    const lastDataPoint = item.historicalData[item.historicalData.length - 1];
    if (!lastDataPoint || !lastDataPoint.timestamp) return 'Unknown';
    
    const timestamp = new Date(lastDataPoint.timestamp);
    const now = new Date();
    const diffMs = now - timestamp;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const lastUpdate = getLastUpdateTime();

  return (
    <tr key={index} style={{ borderBottom: `1px solid ${green}`, background: black }}>
      {/* Symbol: editable in edit mode */}
      <td style={{ 
        padding: 8, 
        fontFamily: "'Courier New', Courier, monospace", 
        color: green, 
        fontSize: 15,
        textAlign: 'center'
      }}
          title={`Symbol: ${item.symbol} | Type: ${item.type || 'stock'} | Last updated: ${lastUpdate}`}>
        {editMode ? (
          <input
            type="text"
            value={item.symbol}
            onChange={e => {
              if (typeof handleChangeSymbol === 'function') {
                handleChangeSymbol(index, e.target.value);
              }
            }}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "1rem",
              backgroundColor: black,
              border: `1px solid ${green}`,
              color: green,
              padding: 4,
              width: 80,
              textAlign: 'center'
            }}
            title="Edit ticker symbol"
          />
        ) : (
          <span
            onClick={() => handleTickerClick(item.symbol)}
            style={{
              cursor: 'pointer',
              textDecoration: 'underline',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              justifyContent: 'center'
            }}
            title={`Click to open ${item.symbol} chart in new tab - Last updated: ${lastUpdate}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
              {(() => {
                const totalCount = items.filter((it) => it.symbol === item.symbol).length;
                if (totalCount > 1) {
                  const countBefore = items.slice(0, index).filter((it) => it.symbol === item.symbol).length;
                  const stars = "*".repeat(countBefore + 1);
                  return item.symbol + stars;
                }
                return item.symbol;
              })()}
              {isInactive && (
                <span
                  style={{
                    fontSize: '10px',
                    color: red,
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(227, 21, 7, 0.1)',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: `1px solid ${red}`
                  }}
                  title="No price update in over 1 trading day"
                >
                  ⚠ INACTIVE
                </span>
              )}
            </div>
          </span>
        )}
      </td>
      {/* Buy Price / Start Price: shows baseline price used by NAV calculator */}
      <td style={{ 
        padding: 8, 
        fontFamily: "'Courier New', Courier, monospace", 
        color: green, 
        fontSize: 15,
        textAlign: 'center'
      }}
          title={`${editMode ? 'Stored Buy Price' : 'Baseline Price'}: $${editMode ? (!isNaN(buy) ? buy.toFixed(2) : 'N/A') : (!isNaN(buy) ? buy.toFixed(2) : 'N/A')} | Buy Date: ${item.buyDate}`}>
        {editMode ? (
          <input
            type="number"
            value={!isNaN(buy) ? buy : ''}
            step="0.01"
            min="0"
            onChange={e => {
              if (typeof handleBuyPriceChange === 'function') {
                handleBuyPriceChange(index, parseFloat(e.target.value));
              }
            }}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "1rem",
              backgroundColor: black,
              border: `1px solid ${green}`,
              color: green,
              padding: 4,
              width: 80,
              textAlign: 'center'
            }}
          />
        ) : (
          !isNaN(buy) ? buy.toFixed(2) : "-"
        )}
      </td>
      {/* Buy Date: editable in edit mode */}
      <td style={{ 
        padding: 8, 
        fontFamily: "'Courier New', Courier, monospace", 
        color: green, 
        fontSize: 15,
        textAlign: 'center'
      }}
          title={`Buy Date: ${item.buyDate} | Formatted: ${formatDateEuropean(item.buyDate)}${item.buyDateMetadata ? ' | Custom date' : ''}`}>
        {editMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <input
              type="date"
              value={item.buyDate ? item.buyDate.slice(0, 10) : ''}
              onChange={e => {
                if (typeof handleBuyDateChange === 'function') {
                  handleBuyDateChange(index, e.target.value);
                }
              }}
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "1rem",
                backgroundColor: black,
                border: `1px solid ${green}`,
                color: green,
                padding: 4,
                width: 120,
                textAlign: 'center'
              }}
            />
            {/* Show revert button if buy date has been customized */}
            {item.buyDateMetadata && typeof handleRevertBuyDate === 'function' && (
              <button
                onClick={() => handleRevertBuyDate(index)}
                title={`Revert to original buy date: ${item.buyDateMetadata.originalBuyDate ? formatDateEuropean(item.buyDateMetadata.originalBuyDate) : 'original'}`}
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: "0.8rem",
                  backgroundColor: 'transparent',
                  border: `1px solid ${green}`,
                  color: green,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  borderRadius: 2,
                  minWidth: 'auto',
                  height: 'auto',
                }}
                onMouseOver={e => {
                  e.target.style.backgroundColor = green;
                  e.target.style.color = black;
                }}
                onMouseOut={e => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = green;
                }}
              >
                ↶
              </button>
            )}
            <style>
              {`
                input[type="date"]::-webkit-calendar-picker-indicator {
                  filter: invert(1) brightness(0.8) sepia(1) saturate(5) hue-rotate(140deg);
                }
                input[type="date"]::-webkit-clear-button {
                  display: none !important;
                }
                input[type="date"]::-webkit-inner-spin-button {
                  display: none !important;
                }
              `}
            </style>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            {formatDateEuropean(item.buyDate)}
            {item.buyDateMetadata && (
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }} title="Custom buy date">⚙</span>
            )}
          </div>
        )}
      </td>
      {/* Current Price: always latest price */}
      <td style={{ 
        padding: 8, 
        fontFamily: "'Courier New', Courier, monospace", 
        color: green, 
        fontSize: 15,
        textAlign: 'center'
      }}
          title={`Current Price: $${!isNaN(currentPrice) ? currentPrice.toFixed(2) : 'N/A'} | Last updated: ${lastUpdate}`}>
        {!isNaN(currentPrice) ? currentPrice.toFixed(2) : "-"}
      </td>
      {/* % Change: shows timeframe-specific return with reference date */}
      <td style={{ 
        padding: 8, 
        fontFamily: "'Courier New', Courier, monospace", 
        color: green, 
        fontSize: 15,
        textAlign: 'center'
      }}>
        {
          (() => {
            const parsedChange = Number(returnPercent);
            const isValidChange = isFinite(parsedChange);

            // Get reference date for tooltip
            const getReferenceDate = () => {
              const now = new Date();
              switch (selectedTimeframe) {
                case 'D':
                  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                  return dayAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                case 'W':
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
                  return weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                case 'M':
                  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
                  return monthAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                case 'YTD':
                  const jan1 = new Date(now.getFullYear(), 0, 1);
                  return jan1.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                case 'MAX':
                  return 'original buy date';
                default:
                  return 'baseline date';
              }
            };

            return isValidChange ? (
              <span
                title={`ETF-style return: ${parsedChange >= 0 ? '+' : ''}${parsedChange.toFixed(2)}% from ${getReferenceDate()} | Timeframe: ${selectedTimeframe}`}
                style={{
                  color: parsedChange >= 0 ? CRT_GREEN : CRT_RED,
                  fontFamily: "'Courier New', Courier, monospace"
                }}
              >
                {parsedChange.toFixed(2)}%
              </span>
            ) : (
              <>
                {logger.warn("\u26a0\ufe0f Missing or invalid changePercent for", item.symbol)}
                <span
                  title="Change % not available"
                  style={{
                    color: useThemeColor('#888888'),
                    fontFamily: "'Courier New', Courier, monospace"
                  }}
                >
                  0.00%
                </span>
              </>
            )
          })()
        }
      </td>
      {editMode && (
        <td style={{ 
          padding: 8,
          textAlign: 'center'
        }}>
          <CustomButton
            onClick={() => {
              if (typeof handleDelete === 'function') {
                handleDelete(index);
              }
            }}
            style={{
              background: 'transparent',
              color: CRT_RED,
              border: `1px solid ${CRT_RED}`,
              fontFamily: "'Courier New', monospace",
              textTransform: 'lowercase',
              fontWeight: 400,
              letterSpacing: 1,
              boxShadow: 'none',
              borderRadius: 2,
            }}
          >
            delete
          </CustomButton>
        </td>
      )}
      <td />
    </tr>
  );
};

export default React.memo(TickerRow);