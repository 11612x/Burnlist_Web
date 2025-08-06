import React, { useMemo } from "react";
import { useThemeColor } from '../ThemeContext';
import TickerRow from "./TickerRow";
import MobileTableWrapper from "./MobileTableWrapper";
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(140,185,162)';
const CRT_GREEN_DARK = 'rgb(120,150,130)';
const CRT_GREEN_LIGHT = 'rgb(180,220,180)';

const TickerTable = ({
  items,
  editMode,
  handleChangeSymbol,
  handleBuyPriceChange,
  handleBuyDateChange,
  handleRevertBuyDate,
  handleFetchHistoricalData,
  handleDelete,
  handleRefreshPrice,
  selectedTimeframe = 'W', // Default to weekly if not provided
  showInactiveBadges = false,
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const greenDark = useThemeColor(CRT_GREEN_DARK);

  // NEW NAV CALCULATION: Calculate average return using simple logic
  const averageReturn = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    
    try {
      // Simple fallback: calculate average of individual ticker returns
      let totalReturn = 0;
      let validTickers = 0;
      
      items.forEach(item => {
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
      logger.log(`🔍 [TICKER TABLE NAV DEBUG] Average return: ${average.toFixed(2)}%`);
      return average;
      
    } catch (error) {
      logger.error('Error calculating average return:', error);
      return 0;
    }
  }, [items, selectedTimeframe]);

  // Sort items by symbol (alphabetical)
  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
  }, [items]);

  // Check if ticker is inactive (no price update in over 4 hours)
  const isTickerInactive = (ticker) => {
    if (!ticker.lastPriceUpdate) return true;
    
    const lastUpdate = new Date(ticker.lastPriceUpdate);
    const now = new Date();
    
    // Consider ticker inactive if no update in the last 4 hours (more lenient)
    const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    
    return lastUpdate < fourHoursAgo;
  };

  const handleSort = (key) => {
    logger.log(`🔄 Sorting by: ${key}`);
  };

  const renderSortArrow = (key) => {
    return <span style={{ marginLeft: '4px' }}>↑</span>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div style={{ 
        textAlign: "center", 
        padding: 60, 
        color: greenDark, 
        fontFamily: "'Courier New'", 
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '8px',
        border: `1px solid ${green}`,
        fontSize: '1.1rem'
      }}>
        No tickers in watchlist.
      </div>
    );
  }

  return (
    <MobileTableWrapper>
      <table style={{
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: '14.5px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <thead>
          <tr style={{
            background: `linear-gradient(135deg, rgba(149,184,163,0.1) 0%, rgba(149,184,163,0.05) 100%)`,
            borderBottom: `2px solid ${green}`
          }}>
            <th style={{ 
              padding: '16px 12px', 
              textAlign: "center", 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer',
              borderRight: `1px solid rgba(149,184,163,0.2)`,
              width: editMode ? '16.66%' : '20%'
            }}>
              Symbol {renderSortArrow("symbol")}
            </th>
            <th style={{ 
              padding: '16px 12px', 
              textAlign: "center", 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer',
              borderRight: `1px solid rgba(149,184,163,0.2)`,
              width: editMode ? '16.66%' : '20%'
            }}>
              Buy Price
            </th>
            <th style={{ 
              padding: '16px 12px', 
              textAlign: "center", 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer',
              borderRight: `1px solid rgba(149,184,163,0.2)`,
              width: editMode ? '16.66%' : '20%'
            }}>
              Buy Date
            </th>
            <th style={{ 
              padding: '16px 12px', 
              textAlign: "center", 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer',
              borderRight: `1px solid rgba(149,184,163,0.2)`,
              width: editMode ? '16.66%' : '20%'
            }}>
              Current Price
            </th>
            <th style={{ 
              padding: '16px 12px', 
              textAlign: "center", 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer',
              borderRight: `1px solid rgba(149,184,163,0.2)`,
              width: editMode ? '16.66%' : '20%'
            }}>
              Change % {renderSortArrow("changePercent")}
            </th>
            {/* Show Actions column only if edit mode is enabled */}
            {editMode && <th style={{ 
              color: green, 
              borderBottom: `1px solid ${green}`, 
              fontFamily: 'Courier New', 
              background: black,
              padding: '16px 12px',
              textAlign: "center",
              fontWeight: 'bold',
              fontSize: '14.5px',
              width: '16.66%'
            }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {/* Render each sorted item as a TickerRow component */}
          {sortedItems.map((item, index) => {
            logger.log(`🩹 Rendering row for ${item.symbol}`);
            
            // Find the original index in the unsorted items array
            const originalIndex = items.findIndex(originalItem => 
              originalItem.symbol === item.symbol && 
              originalItem.buyDate === item.buyDate &&
              originalItem.buyPrice === item.buyPrice
            );

            return (
              <TickerRow
                key={`${item.symbol}-${originalIndex}`}
                item={{ ...item }}
                index={originalIndex}
                editMode={editMode}
                handleChangeSymbol={handleChangeSymbol}
                handleBuyPriceChange={typeof handleBuyPriceChange === 'function' ? handleBuyPriceChange : undefined}
                handleBuyDateChange={typeof handleBuyDateChange === 'function' ? handleBuyDateChange : undefined}
                handleRevertBuyDate={typeof handleRevertBuyDate === 'function' ? handleRevertBuyDate : undefined}
                handleFetchHistoricalData={typeof handleFetchHistoricalData === 'function' ? handleFetchHistoricalData : undefined}
                handleDelete={typeof handleDelete === 'function' ? handleDelete : undefined}
                handleRefreshPrice={typeof handleRefreshPrice === 'function' ? handleRefreshPrice : undefined}
                items={items}
                selectedTimeframe={selectedTimeframe}
                changePercent={0} // Let TickerRow calculate its own percentage
                lookedUpBuyPrice={0} // Let TickerRow calculate its own price
                isInactive={showInactiveBadges ? isTickerInactive(item) : false}
              />
            );
          })}
        </tbody>
      </table>
    </MobileTableWrapper>
  );
};

export default React.memo(TickerTable);