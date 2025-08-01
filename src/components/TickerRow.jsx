/**
 * TickerRow.jsx
 * Patch summary:
 * - Update comment on return percentage calculation to clarify that it uses timeframe-sliced historical data.
 * - The return percentage now clearly reflects, "How did this asset perform from the start of the selected timeframe?"
 */
import React from "react";
import { useThemeColor } from '../ThemeContext';
import { getCachedExchange } from '../utils/exchangeDetector';
import CustomButton from './CustomButton'; // Added import for CustomButton
import { formatDateEuropean } from '../utils/dateUtils';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(140,185,162)';

const TickerRow = ({
  item, index, editMode,
  handleChangeSymbol, handleBuyPriceChange, handleBuyDateChange, handleRevertBuyDate, handleFetchHistoricalData, handleDelete, handleRefreshPrice, items, changePercent, lookedUpBuyPrice
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  logger.debug("TickerRow received item:", item);
  logger.debug("Historical Data:", item.historicalData);

  if (!item || !Array.isArray(item.historicalData)) {
    logger.warn("\u26d4 Invalid item or missing historicalData for row", item);
    return null;
  }

  // Calculate buy price - use stored value or fall back to oldest historical price
  let buy = NaN;
  if (!isNaN(Number(item.buyPrice))) {
    buy = Number(item.buyPrice);
    logger.debug(`Using stored buyPrice: ${buy}`);
  } else if (item.historicalData && item.historicalData.length > 0) {
    const first = item.historicalData[0];
    const last = item.historicalData[item.historicalData.length - 1];
    
    // Check if data is sorted ascending or descending
    const isAscending = item.historicalData.length === 1 || 
                        new Date(first?.timestamp) < new Date(last?.timestamp);
    
    if (isAscending) {
      // Ascending: oldest is at the beginning
      buy = Number(first?.price);
    } else {
      // Descending: oldest is at the end
      buy = Number(last?.price);
    }
    logger.debug(`Using oldest historical price as buyPrice: ${buy} (data is ${isAscending ? 'ascending' : 'descending'})`);
  }
  


  // Find the latest price - handle both ascending and descending sorted data
  let latestPrice = NaN;
  if (item.historicalData && item.historicalData.length > 0) {
    const first = item.historicalData[0];
    const last = item.historicalData[item.historicalData.length - 1];
    
    // Check if data is sorted ascending (oldest to newest) or descending (newest to oldest)
    const isAscending = item.historicalData.length === 1 || 
                        new Date(first?.timestamp) < new Date(last?.timestamp);
    
    if (isAscending) {
      // Ascending: latest is at the end
      latestPrice = Number(last?.price);
    } else {
      // Descending: latest is at the beginning
      latestPrice = Number(first?.price);
    }
    
    logger.debug(`Data sort order: ${isAscending ? 'ascending' : 'descending'}, latest price: ${latestPrice}`);
  }
  
  // Use currentPrice field if available, otherwise use latest historical price
  const currentPrice = typeof item.currentPrice === 'number' ? item.currentPrice : latestPrice;

  logger.debug(`Buy price for ${item.symbol}:`, buy);
  logger.debug(`Latest price for ${item.symbol}:`, latestPrice);
  logger.debug(`Current price for ${item.symbol}:`, currentPrice);
  
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
      <td style={{ padding: 8, fontFamily: "'Courier New', Courier, monospace", color: green, fontSize: 15 }}>
        {editMode ? (
          <input
            type="text"
            value={item.symbol}
            onChange={(e) => handleChangeSymbol(index, e.target.value)}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "1rem",
              backgroundColor: black,
              border: `1px solid ${green}`,
              color: green,
              padding: 4,
              width: 80,
              textTransform: "uppercase",
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
              gap: '4px'
            }}
            title={`Click to open ${item.symbol} chart in new tab - Last updated: ${lastUpdate}`}
          >
            {(() => {
              const totalCount = items.filter((it) => it.symbol === item.symbol).length;
              if (totalCount > 1) {
                const countBefore = items.slice(0, index).filter((it) => it.symbol === item.symbol).length;
                const stars = "*".repeat(countBefore + 1);
                return item.symbol + stars;
              }
              return item.symbol;
            })()}
          </span>
        )}
      </td>
      {/* Buy Price / Start Price: editable in edit mode, context-aware display */}
      <td style={{ padding: 8, fontFamily: "'Courier New', Courier, monospace", color: green, fontSize: 15 }}
          title={`${editMode ? 'Stored Buy Price' : 'Display Price'}: $${editMode ? (!isNaN(buy) ? buy.toFixed(2) : 'N/A') : (!isNaN(lookedUpBuyPrice) ? lookedUpBuyPrice.toFixed(2) : 'N/A')} | Buy Date: ${item.buyDate}`}>
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
            }}
          />
        ) : (
          !isNaN(lookedUpBuyPrice) ? lookedUpBuyPrice.toFixed(2) : "-"
        )}
      </td>
      {/* Buy Date: editable in edit mode */}
      <td style={{ padding: 8, fontFamily: "'Courier New', Courier, monospace", color: green, fontSize: 15 }}
          title={`Buy Date: ${item.buyDate} | Formatted: ${formatDateEuropean(item.buyDate)}${item.buyDateMetadata ? ' | Custom date' : ''}`}>
        {editMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {formatDateEuropean(item.buyDate)}
            {item.buyDateMetadata && (
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }} title="Custom buy date">⚙</span>
            )}
          </div>
        )}
      </td>
      {/* Current Price: always latest price */}
      <td style={{ padding: 8, fontFamily: "'Courier New', Courier, monospace", color: green, fontSize: 15 }}
          title={`Current Price: $${!isNaN(currentPrice) ? currentPrice.toFixed(2) : 'N/A'} | Last updated: ${lastUpdate}`}>
        {!isNaN(currentPrice) ? currentPrice.toFixed(2) : "-"}
      </td>
      {/* % Change: still updates per timeframe */}
      <td style={{ padding: 8, fontFamily: "'Courier New', Courier, monospace", color: green, fontSize: 15 }}>
        {
          (() => {
            const parsedChange = Number(changePercent);
            const isValidChange = isFinite(parsedChange);

            return isValidChange ? (
              <span
                title={`Return: ${parsedChange >= 0 ? '+' : ''}${parsedChange.toFixed(2)}% | Timeframe: Selected timeframe`}
                style={{
                  color: parsedChange >= 0 ? green : red,
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
        <td style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <CustomButton
              onClick={() => {
                if (typeof handleFetchHistoricalData === 'function') {
                  handleFetchHistoricalData(index);
                }
              }}
              style={{
                background: 'transparent',
                color: green,
                border: `1px solid ${green}`,
                fontFamily: "'Courier New', monospace",
                textTransform: 'lowercase',
                fontWeight: 400,
                letterSpacing: 1,
                boxShadow: 'none',
                borderRadius: 2,
                fontSize: '0.8rem',
                padding: '2px 6px',
              }}
              title="Fetch historical data for current buy date"
            >
              📊
            </CustomButton>
            <CustomButton
              onClick={() => {
                if (typeof handleDelete === 'function') {
                  handleDelete(index);
                }
              }}
              style={{
                background: 'transparent',
                color: green,
                border: `1px solid ${green}`,
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
          </div>
        </td>
      )}
      <td />
    </tr>
  );
};

export default React.memo(TickerRow);