import React, { useState, useEffect, useRef } from "react";
import { createTicker } from '@data/createTicker';
import { isValidTicker, normalizeSymbol } from '@data/tickerUtils';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import MobileFormWrapper from '@components/MobileFormWrapper';
import { useThemeColor } from '../ThemeContext';

const CRT_GREEN = 'rgb(140,185,162)';

const AddTickerInput = ({ bulkSymbols, setBulkSymbols, handleBulkAdd, buyDate, setBuyDate, buyPrice, setBuyPrice, setWatchlists, editMode, watchlists, setNotification, setNotificationType }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef();

  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');

  const validateInputs = () => {
    if (!bulkSymbols.trim()) {
      setValidationError('');
      return false;
    }
    const symbols = bulkSymbols
      .split(/[,	\s]+/)
      .map(sym => sym.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) {
      setValidationError('Please enter valid ticker symbols.');
      return false;
    }
    const invalidSymbols = symbols.filter(sym => !isValidTicker(sym));
    if (invalidSymbols.length > 0) {
      setValidationError(`Invalid symbols: ${invalidSymbols.join(', ')}`);
      return false;
    }
    if (editMode) {
      if (buyPrice !== null && (isNaN(buyPrice) || buyPrice <= 0)) {
        setValidationError('Buy price must be a positive number.');
        return false;
      }
      if (buyDate && isNaN(Date.parse(buyDate))) {
        setValidationError('Please enter a valid buy date.');
        return false;
      }
    }
    setValidationError('');
    return true;
  };

  useEffect(() => {
    if (validationError) {
      if (setNotification && setNotificationType) {
        setNotification(validationError);
        setNotificationType('error');
      }
    }
  }, [validationError, setNotification, setNotificationType]);

  // Debounce validation on bulkSymbols change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      validateInputs();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkSymbols, buyPrice, buyDate, editMode, touched]);

  const handleAddTickers = async () => {
    setTouched(true);
    if (!validateInputs()) return;
    setIsLoading(true);
    setError('');
    try {
      // Accept comma, space, or both as delimiters
      const rawSymbols = bulkSymbols.split(/[,\s]+/).map((sym) => sym.trim().toUpperCase()).filter(Boolean);
      const validSymbols = rawSymbols.filter(isValidTicker);
      const slugMatch = window.location.pathname.split("/").pop();
      const existingItems = watchlists && Object.values(watchlists).find(w => w.slug === slugMatch)?.items || [];
      const existingSymbols = new Set(existingItems.map(i => i.symbol));
      // Check for duplicates in input
      const duplicateInput = validSymbols.find(sym => existingSymbols.has(sym));
      if (duplicateInput) {
        if (setNotification && setNotificationType) {
          setNotification(`Ticker '${duplicateInput}' already exists in this watchlist`);
          setNotificationType('error');
        }
        setIsLoading(false);
        return;
      }

      console.log("📦 Adding Tickers:", bulkSymbols);
      console.log("📅 With Buy Date:", buyDate);
      console.log("💵 With Buy Price:", buyPrice);

      const newItems = [];
      console.log(`🔍 Processing ${validSymbols.length} valid symbols:`, validSymbols);
      
      for (const rawSymbol of validSymbols) {
        console.log(`🔄 Processing symbol: ${rawSymbol}`);
        const symbol = normalizeSymbol(rawSymbol);
        console.log(`📝 Normalized symbol: ${symbol}`);
        
        if (existingSymbols.has(symbol)) {
          console.warn(`⚠️ Skipping duplicate symbol: ${symbol}`);
          continue;
        }
        
        // Add delay between requests to prevent rate limiting
        if (newItems.length > 0) {
          console.log(`⏳ Waiting 5 seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Use buyPrice and buyDate only in editMode, otherwise let API assign defaults
        const price = editMode && typeof buyPrice === 'number' && !isNaN(buyPrice) ? buyPrice : undefined;
        const fallbackFromApi = !editMode && !price;
        const date = editMode && buyDate ? buyDate : undefined;

        console.log(`📞 Calling createTicker for ${symbol} with price=${price}, date=${date}`);
        const item = await createTicker(
          symbol,
          "real",
          price,
          date
        );
        
        if (!item) {
          console.warn(`❌ createTicker returned null for symbol: ${symbol}`);
          continue;
        }
        
        console.log(`✅ createTicker succeeded for ${symbol}:`, item);
        
        // Skip tickers with invalid buyPrice
        if (typeof item.buyPrice !== 'number' || item.buyPrice === 0) {
          console.warn(`❌ Skipping ${symbol}: buyPrice is still 0 after fetch.`);
          continue;
        }
        
        if (item) {
          console.log(`✅ Adding ${symbol} to newItems with buyPrice: ${item.buyPrice}`);
          newItems.push(item);
        } else {
          console.warn("❌ Failed to create ticker:", symbol);
        }
      }

      console.log(`📊 Final newItems count: ${newItems.length}/${validSymbols.length}`);
      console.log(`📋 Final newItems:`, newItems.map(item => ({ symbol: item.symbol, buyPrice: item.buyPrice })));

      if (newItems.length === 0) {
        if (setNotification && setNotificationType) {
          setNotification('No valid tickers were added, check your input');
          setNotificationType('error');
        }
        return;
        
      }

      if (typeof setWatchlists === 'function') {
        const updatedObject = { ...watchlists };
        for (const id in updatedObject) {
          if (updatedObject[id].slug === slugMatch) {
            updatedObject[id] = {
              ...updatedObject[id],
              items: [...(updatedObject[id].items || []), ...newItems.map(i => ({
                ...i,
                buyPrice: typeof i.buyPrice === 'number' ? i.buyPrice : 0
              }))]
            };
            console.log("🔍 Pre-setWatchlists buyPrices:", updatedObject[id].items.map(i => ({ symbol: i.symbol, buyPrice: i.buyPrice })));
          }
        }

        try {
          localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedObject));
        } catch (e) {
          console.error("❌ Failed to save to localStorage:", e);
          setError('Failed to save to storage. Please try again.');
          return;
        }

        if (!updatedObject || typeof updatedObject !== "object") {
          console.error("❌ updatedObject is invalid before calling setWatchlists");
          setError('Failed to update watchlists. Please try again.');
          return;
        } else {
          console.log("✅ Final watchlist structure before setWatchlists:", updatedObject);
          setWatchlists(updatedObject);
        }
      }

      for (const item of newItems) {
        if (!item.buyDate || isNaN(new Date(item.buyDate))) {
          console.error("❌ Invalid buyDate in item:", item);
        }
      }

      // Ensure the newItems are reflected in UI by calling optional handler
      if (typeof handleBulkAdd === "function") {
        console.log("🧪 Calling handleBulkAdd with:", newItems);
        handleBulkAdd(newItems);
      } else {
        console.warn("⚠️ handleBulkAdd is not a function");
      }

      // Clear inputs on success
      setBulkSymbols('');
      setBuyPrice(null);
      setBuyDate(null);

    } catch (error) {
      if (setNotification && setNotificationType) {
        setNotification('Failed to add tickers. Please try again.');
        setNotificationType('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      marginTop: 20,
      '@media (max-width: 768px)': {
        marginTop: 16,
      },
      '@media (max-width: 480px)': {
        marginTop: 12,
      }
    }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          width: '100%',
          flexWrap: 'wrap',
          gap: '8px',
          '@media (max-width: 480px)': {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '12px',
          }
        }}>
        <textarea
          value={bulkSymbols}
          onChange={(e) => setBulkSymbols(e.target.value)}
          placeholder="e.g. SPY, QQQ"
          rows={1}
          style={{
            flex: 1,
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "0.9rem",
            backgroundColor: black,
            border: `1px solid ${green}`,
            color: green,
            padding: 6,
            resize: "none",
            boxSizing: "border-box",
            cursor: "pointer",
            minWidth: 0,
            minHeight: '32px',
            '@media (max-width: 480px)': {
              fontSize: '14px',
              padding: '8px',
              width: '100%',
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddTickers();
            }
          }}
          onBlur={() => setTouched(true)}
        />
        {editMode && (
          <input
            type="number"
            placeholder="Buy Price"
            step="0.01"
            value={buyPrice || ''}
            onChange={(e) => {
              const price = parseFloat(e.target.value);
              setBuyPrice(price);
            }}
            style={{
              marginLeft: 8,
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "0.9rem",
              backgroundColor: black,
              border: `1px solid ${green}`,
              color: green,
              padding: 6,
              cursor: "pointer",
              minWidth: 0,
              minHeight: '32px',
              '@media (max-width: 480px)': {
                marginLeft: 0,
                fontSize: '14px',
                padding: '8px',
                width: '100%',
              }
            }}
          />
        )}
        {editMode && (
          <input
            type="date"
            value={buyDate || ''}
            onChange={(e) => {
              const selectedDate = e.target.value;
              setBuyDate(selectedDate);
            }}
            style={{
              marginLeft: 8,
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "0.9rem",
              backgroundColor: black,
              border: `1px solid ${green}`,
              color: green,
              padding: 6,
              cursor: "pointer",
              minWidth: 0,
              minHeight: '32px',
              '@media (max-width: 480px)': {
                marginLeft: 0,
                fontSize: '14px',
                padding: '8px',
                width: '100%',
              }
            }}
          />
        )}
        <CustomButton
          mobile={false}
          onClick={handleAddTickers}
          disabled={isLoading}
          title="Add ticker(s)"
          style={{
            marginLeft: 8,
            backgroundColor: isLoading ? "#666666" : green,
            color: "black",
            opacity: isLoading ? 0.6 : 1,
            minWidth: 0,
            height: '32px',
            minHeight: '32px',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            transition: 'all 0.2s ease-in-out',
            '@media (max-width: 480px)': {
              marginLeft: 0,
              width: '100%',
              fontSize: '14px',
              padding: '8px 16px',
              height: '32px',
              minHeight: '32px',
            }
          }}
        >
          {isLoading ? "..." : "+++"}
        </CustomButton>
        </div>
    </div>
  );
};

export default AddTickerInput;
