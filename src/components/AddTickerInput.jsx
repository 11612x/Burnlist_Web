import React, { useState, useEffect, useRef } from "react";
import { isValidTicker, normalizeSymbol } from '@data/tickerUtils';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import MobileFormWrapper from '@components/MobileFormWrapper';
import { useThemeColor } from '../ThemeContext';

const CRT_GREEN = 'rgb(149,184,163)';
const CRT_RED = 'rgb(239,68,68)'; // Added CRT_RED for error messages

const AddTickerInput = ({ bulkSymbols, setBulkSymbols, handleBulkAdd, setNotification, setNotificationType }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef();

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
  }, [bulkSymbols, touched]);

  const handleAddTickers = async () => {
    setTouched(true);
    if (!validateInputs()) return;
    setIsLoading(true);
    setError('');
    
    try {
      // Accept comma, space, or both as delimiters
      const rawSymbols = bulkSymbols.split(/[,\s]+/).map((sym) => sym.trim().toUpperCase()).filter(Boolean);
      const validSymbols = rawSymbols.filter(isValidTicker);
      
      console.log("📦 Adding Tickers:", bulkSymbols);
      console.log(`🔍 Processing ${validSymbols.length} valid symbols:`, validSymbols);
      
      if (validSymbols.length === 0) {
        if (setNotification && setNotificationType) {
          setNotification('No valid tickers were entered');
          setNotificationType('error');
        }
        return;
      }

      // Normalize symbols
      const normalizedSymbols = validSymbols.map(symbol => normalizeSymbol(symbol));
      console.log(`📝 Normalized symbols:`, normalizedSymbols);

      // Call parent handler with symbols
      if (handleBulkAdd && typeof handleBulkAdd === 'function') {
        console.log("🧪 Calling handleBulkAdd with symbols:", normalizedSymbols);
        await handleBulkAdd(normalizedSymbols);
      } else {
        console.warn("⚠️ handleBulkAdd is not a function");
        if (setNotification && setNotificationType) {
          setNotification('Error: handleBulkAdd function not available');
          setNotificationType('error');
        }
        return;
      }

      // Clear input on success
      setBulkSymbols('');

    } catch (error) {
      console.error('❌ Error in handleAddTickers:', error);
      if (setNotification && setNotificationType) {
        setNotification('Failed to add tickers. Please try again.');
        setNotificationType('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-5 md:mt-4 sm:mt-3">
      <div className="flex items-center w-full gap-0" style={{ height: '32px' }}>
        <textarea
          value={bulkSymbols}
          onChange={(e) => setBulkSymbols(e.target.value)}
          placeholder="e.g. SPY, QQQ"
          rows={1}
          className="flex-1 font-mono text-sm bg-black border border-green-500 text-green-500 resize-none box-border cursor-pointer min-w-0"
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            backgroundColor: black,
            border: `1px solid ${CRT_GREEN}`,
            color: CRT_GREEN,
            outline: 'none',
            borderRight: 'none',
            borderTopRightRadius: '0',
            borderBottomRightRadius: '0',
            height: '32px',
            padding: '0',
            fontSize: '14px',
            lineHeight: '32px',
            margin: '0',
            boxSizing: 'border-box'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddTickers();
            }
          }}
        />
        <CustomButton
          onClick={handleAddTickers}
          disabled={isLoading || !bulkSymbols.trim()}
          loading={isLoading}
          style={{
            minWidth: '60px',
            height: '32px',
            fontSize: '14px',
            fontFamily: "'Courier New', monospace",
            backgroundColor: 'transparent',
            color: CRT_GREEN,
            border: `1px solid ${CRT_GREEN}`,
            borderLeft: 'none',
            borderTopLeftRadius: '0',
            borderBottomLeftRadius: '0',
            cursor: (isLoading || !bulkSymbols.trim()) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || !bulkSymbols.trim()) ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            margin: '0',
            boxSizing: 'border-box'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && bulkSymbols.trim()) {
              e.target.style.background = CRT_GREEN;
              e.target.style.color = 'black';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = CRT_GREEN;
          }}
        >
          {isLoading ? '...' : '+++'}
        </CustomButton>
      </div>
      
      {error && (
        <div style={{
          color: CRT_RED,
          fontSize: '12px',
          marginTop: '8px',
          fontFamily: "'Courier New', monospace"
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default AddTickerInput;
