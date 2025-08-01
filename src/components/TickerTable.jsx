import React, { useState, useMemo } from "react";
import { useAverageReturn } from "@hooks/useAverageReturn";
import TickerRow from "@components/TickerRow";
import { useSortedItems } from "@hooks/useSortedItems";
import { getReturnInTimeframe, getSlicedData } from "@logic/portfolioUtils";
import { useThemeColor } from '../ThemeContext';
import MobileTableWrapper from "./MobileTableWrapper";
import { logger } from '../utils/logger';

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
  selectedTimeframe,
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  if (!Array.isArray(items)) {
    logger.warn("\u26a0\ufe0f TickerTable received invalid items prop:", items);
    return null;
  }
  // State to keep track of sorting configuration: key and direction
  const [sortConfig, setSortConfig] = useState({ key: "symbol", direction: "asc" });

  // Toggle sort direction or set new key when a header is clicked
  const handleSort = (key) => {
    logger.log(`\ud83e\udded handleSort triggered for key: ${key}`);
    setSortConfig((prev) => {
      if (prev.key === key) {
        // If the same key is clicked, toggle the direction
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      // Otherwise, set new key with ascending direction
      return { key, direction: "asc" };
    });
  };

  // Display sort direction arrow next to the sorted column header
  const renderSortArrow = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? "\u2191" : "\u2193";
  };

  // Get sorted items based on current sort configuration
  const sortedItems = useSortedItems(items, sortConfig);

  // Calculate average return from sorted items using custom hook
  const averageReturn = useAverageReturn(sortedItems);

  // Debug average return value
  logger.log("\ud83d\udcca Average return from sortedItems:", averageReturn);

  // If a global setter function exists, update it with the latest average return
  if (typeof window !== "undefined" && typeof window.setWatchlistAverageReturn === "function") {
    window.setWatchlistAverageReturn(averageReturn);
  }

  return (
    <MobileTableWrapper>
      <table style={{ 
        width: "100%", 
        borderCollapse: "collapse", 
        color: green, 
        background: black, 
        fontFamily: 'Courier New',
        minWidth: '600px', // Ensure table doesn't get too cramped
        '@media (max-width: 768px)': {
          minWidth: '500px',
        },
        '@media (max-width: 480px)': {
          minWidth: '400px',
        }
      }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${green}` }}>
            {/* Column headers with clickable sorting functionality */}
            <th onClick={() => handleSort("symbol")} style={{ 
              cursor: "pointer", 
              padding: '8px 4px', 
              textAlign: "left", 
              color: green, 
              borderBottom: `1px solid ${green}`, 
              fontFamily: 'Courier New', 
              background: black,
              minWidth: '60px',
              '@media (max-width: 480px)': {
                padding: '4px 2px',
                minWidth: '50px',
              }
            }}>
              Symbol {renderSortArrow("symbol")}
            </th>
            <th onClick={() => handleSort("buyPrice")} style={{ 
              cursor: "pointer", 
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
            }}>
              {selectedTimeframe === 'MAX' ? 'Buy Price' : 'Start Price'} {renderSortArrow("buyPrice")}
            </th>
            <th style={{ 
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
            }}>
              Buy Date
            </th>
            <th onClick={() => handleSort("currentPrice")} style={{ 
              cursor: "pointer", 
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
            }}>
              Current Price {renderSortArrow("currentPrice")}
            </th>
            <th onClick={() => handleSort("changePercent")} style={{ 
              cursor: "pointer", 
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
            // Safely resolve buyPrice
            let resolvedBuyPrice;
            if (typeof item.buyPrice === "number") {
              resolvedBuyPrice = item.buyPrice;
            } else if (Array.isArray(item.historicalData) && item.historicalData.length > 0) {
              resolvedBuyPrice = item.historicalData[0].price;
            } else if (typeof item.currentPrice === "number") {
              resolvedBuyPrice = item.currentPrice; // fallback for real stock on first fetch
            }

          if (!item.historicalData || item.historicalData.length === 0) {
            return null;
          }

          if (
            typeof resolvedBuyPrice === "undefined" ||
            !item.buyDate ||
            !item.historicalData ||
            !Array.isArray(item.historicalData) ||
            item.historicalData.length === 0
          ) {
            logger.warn(`\u26a0\ufe0f Invalid ticker data for ${item.symbol}. Skipping row.`, item);
            return null;
          }

          // Calculate timeframe-based return percentage with new clean logic
          const validBuyDate = item.buyDate && new Date(item.buyDate).toString() !== 'Invalid Date' ? item.buyDate : null;
          
          logger.debug(`[NEW LOGIC] ${item.symbol} in timeframe: ${selectedTimeframe}`);
          
          let startPoint, endPoint;
          
          if (selectedTimeframe === 'MAX') {
            // MAX timeframe: Always use stored buyPrice vs current price (investment logic)
            logger.debug(`[MAX MODE DEBUG] ${item.symbol}:`);
            logger.debug(`  - Stored buyPrice: ${item.buyPrice}`);
            logger.debug(`  - Stored buyDate: ${item.buyDate}`);
            logger.debug(`  - Current price: ${item.currentPrice}`);
            logger.debug(`  - Historical data points: ${item.historicalData?.length || 0}`);
            if (item.historicalData?.length > 0) {
              const first = item.historicalData[0];
              const last = item.historicalData[item.historicalData.length - 1];
              logger.debug(`  - First historical point: ${first.timestamp} → $${first.price}`);
              logger.debug(`  - Last historical point: ${last.timestamp} → $${last.price}`);
            }
            const { startPoint: sp, endPoint: ep } = getSlicedData(item.historicalData, selectedTimeframe, validBuyDate, item.symbol, null);
            startPoint = sp;
            endPoint = ep;
          } else {
            // Other timeframes: Always use timeframe start price, ignore custom buy dates (performance window logic)
            logger.debug(`[TIMEFRAME MODE] Using timeframe start price for ${selectedTimeframe}, ignoring custom buy date for ${item.symbol}`);
            const { startPoint: sp, endPoint: ep } = getSlicedData(item.historicalData, selectedTimeframe, null, item.symbol, null);
            startPoint = sp;
            endPoint = ep;
          }
          
          let changePercent = 0;
          let displayPrice = item.buyPrice; // Default fallback
          
          if (startPoint && typeof startPoint.price === "number" && startPoint.price > 0) {
            // Update display price based on timeframe logic
            if (selectedTimeframe === 'MAX') {
              displayPrice = startPoint.price; // Show first price from manual date in MAX
              logger.debug(`[MAX PRICE] ${item.symbol}: Using startPoint.price (first historical price): ${displayPrice}`);
            } else {
              displayPrice = startPoint.price; // Show timeframe start price in others
            }
            // Use currentPrice if available (from auto-fetch), otherwise use endPoint price
            // NEVER fall back to buyPrice as current price - that makes no sense!
            let currentPrice;
            
            if (typeof item.currentPrice === 'number') {
              currentPrice = item.currentPrice;
            } else if (endPoint && typeof endPoint.price === 'number') {
              currentPrice = endPoint.price;
            } else {
              logger.warn(`⚠️ No valid current price found for ${item.symbol}, skipping calculation`);
              return null; // Skip this ticker entirely
            }
            
            // Calculate percentage change using the correct reference price for each timeframe
            let referencePrice;
            if (selectedTimeframe === 'MAX') {
              // MAX timeframe: Use startPoint.price (actual historical price from manual date) as reference
              referencePrice = startPoint.price;
              changePercent = ((currentPrice - referencePrice) / referencePrice) * 100;
              logger.debug(`[Table % MAX] ${item.symbol}: startPoint.price: ${referencePrice}, currentPrice: ${currentPrice}, changePercent: ${changePercent}%`);
            } else {
              // Other timeframes: Use timeframe start price as reference
              referencePrice = startPoint.price;
              changePercent = ((currentPrice - referencePrice) / referencePrice) * 100;
              logger.debug(`[Table % ${selectedTimeframe}] ${item.symbol}: startPoint: ${referencePrice}, currentPrice: ${currentPrice}, changePercent: ${changePercent}%`);
            }
            logger.debug(`[Table Price] ${item.symbol}: displayPrice: ${displayPrice} (${selectedTimeframe === 'MAX' ? 'buyPrice' : 'timeframe start price'})`);
            logger.debug(`DEBUG ${item.symbol}: referencePrice=${referencePrice}, currentPrice=${currentPrice}, difference=${currentPrice - referencePrice}, calculation=${((currentPrice - referencePrice) / referencePrice) * 100}`);
          }

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
              changePercent={changePercent}
              lookedUpBuyPrice={displayPrice}
            />
          );
        })}
              </tbody>
      </table>
    </MobileTableWrapper>
  );
};

export default React.memo(TickerTable);