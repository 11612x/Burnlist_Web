import React, { useMemo } from "react";
import { useThemeColor } from '../ThemeContext';
import TickerRow from "./TickerRow";
import MobileTableWrapper from "./MobileTableWrapper";
import { logger } from '../utils/logger';
import navCalculator from '../data/navCalculator';

const CRT_GREEN = 'rgb(140,185,162)';

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
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');

  // NEW NAV CALCULATION: Calculate average return using NAV calculator
  const averageReturn = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    
    try {
      // Calculate NAV performance for the current timeframe
      const navData = navCalculator.calculateNAVPerformance(items, selectedTimeframe);
      
      if (navData && navData.length > 0) {
        // Get the latest NAV value
        const latestNav = navData[navData.length - 1];
        logger.log(`🔍 [TICKER TABLE NAV DEBUG] Latest NAV return: ${latestNav.returnPercent}%`);
        return latestNav.returnPercent;
      }
      
      // Fallback: calculate simple average of individual ticker returns
      let totalReturn = 0;
      let validTickers = 0;
      
      items.forEach(item => {
        try {
          const buyPrice = navCalculator.calculateDynamicBuyPrice(item, selectedTimeframe);
          const currentPrice = item.currentPrice || (item.historicalData && item.historicalData.length > 0 ? 
            item.historicalData[item.historicalData.length - 1].price : 0);
          
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
      logger.log(`🔍 [TICKER TABLE NAV DEBUG] Fallback average return: ${average.toFixed(2)}%`);
      return average;
      
    } catch (error) {
      logger.error('Error calculating NAV average return:', error);
      return 0;
    }
  }, [items, selectedTimeframe]);

  // Sort items by symbol (alphabetical)
  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
  }, [items]);

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
        padding: 40, 
        color: green, 
        fontFamily: "'Courier New'", 
        background: black 
      }}>
        No tickers in watchlist.
      </div>
    );
  }

  return (
    <MobileTableWrapper>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14.5px'
      }}>
        <thead>
          <tr>
            <th style={{ 
              padding: '12px 8px', 
              textAlign: "left", 
              borderBottom: `2px solid ${green}`, 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}>
              Symbol {renderSortArrow("symbol")}
            </th>
            <th style={{ 
              padding: '12px 8px', 
              textAlign: "left", 
              borderBottom: `2px solid ${green}`, 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}>
              Buy Price
            </th>
            <th style={{ 
              padding: '12px 8px', 
              textAlign: "left", 
              borderBottom: `2px solid ${green}`, 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}>
              Buy Date
            </th>
            <th style={{ 
              padding: '12px 8px', 
              textAlign: "left", 
              borderBottom: `2px solid ${green}`, 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}>
              Current Price
            </th>
            <th style={{ 
              padding: '12px 8px', 
              textAlign: "left", 
              borderBottom: `2px solid ${green}`, 
              color: green,
              fontWeight: 'bold',
              fontSize: '14.5px',
              userSelect: 'none',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}>
              Change % {renderSortArrow("changePercent")}
            </th>
            {/* Show Actions column only if edit mode is enabled */}
            {editMode && <th style={{ 
              padding: '8px 4px', 
              textAlign: "left", 
              color: green, 
              borderBottom: `1px solid ${green}`, 
              fontFamily: 'Courier New', 
              background: black,
              minWidth: '80px',
              '@media (max-width: 480px)': {
                padding: '4px 2px',
                minWidth: '60px',
              }
            }}>Actions</th>}
            <th style={{ 
              textAlign: "left", 
              color: green, 
              borderBottom: `1px solid ${green}`, 
              fontFamily: 'Courier New', 
              background: black,
              width: '20px',
              '@media (max-width: 480px)': {
                width: '10px',
              }
            }} />
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
              />
            );
          })}
        </tbody>
      </table>
    </MobileTableWrapper>
  );
};

export default React.memo(TickerTable);