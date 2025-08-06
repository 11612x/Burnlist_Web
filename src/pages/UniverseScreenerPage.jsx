import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { createTicker } from '@data/createTicker';
import { isValidTicker, normalizeSymbol } from '@data/tickerUtils';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import NavigationBar from '@components/NavigationBar';
import { useTheme } from '../ThemeContext';
import { logger } from '../utils/logger';
import backButton from '../assets/backbutton.png';
import { calculateBuyScore } from '../data/buyScore';
import { FaEdit, FaCheck, FaTrash } from 'react-icons/fa';
import greenFlag from '../assets/greenflag.png';
import redFlag from '../assets/redflag.png';
import yellowFlag from '../assets/yellowflag.png';
import box from '../assets/box.png';
import checkbox from '../assets/checkbox.png';
import execute from '../assets/excecute.png';
import { formatDateEuropean } from '../utils/dateUtils';
import useNotification from '../hooks/useNotification';
import { getCachedExchange } from '../utils/exchangeDetector';

const CRT_GREEN = 'rgb(140,185,162)';
const gray = '#888';

// Setup configurations with their specific checklists
const SETUP_CONFIGS = {
  breakout: {
    name: "Breakout",
    checklists: [
      "Horizontal resistance tested at least 2–3 times",
      "Tight consolidation range (3–7 bars) near resistance",
      "No overlapping wicks or indecision candles near breakout zone",
      "Volume increasing into resistance (1-day Relative Volume > 1.5)",
      "RSI between 50–65 and rising",
      "MACD bullish crossover or trending upward",
      "Price within 5% of 52-week high",
      "No major macro event or earnings within next 7 days",
      "Clean air above breakout level (no nearby supply)"
    ],
    newsValidation: [
      "Catalyst present in last 3 days (e.g. earnings beat, analyst upgrade, sector momentum)",
      "Headline or PR confirms why price is reacting",
      "Price action matches news intensity (no fade after news)"
    ]
  },
  pullback: {
    name: "Pullback",
    checklists: [
      "Strong uptrend visible on daily chart",
      "Pullback to support (20 EMA, 50 SMA, or breakout retest)",
      "Low volume during the pullback vs prior rally",
      "Candle structure is clean (no breakdown bars or gaps)",
      "Reversal signal forming (hammer, engulfing, inside bar)",
      "RSI between 35–50, curling up",
      "MACD flattening or turning bullish",
      "Relative Volume (3–5 day avg) > 1.2",
      "No earnings within next 5 days",
      "Pullback has not broken prior swing low"
    ],
    newsValidation: [
      "Recent catalyst (earnings, analyst note, macro driver) caused last rally",
      "Catalyst is still relevant (not priced in / not reversed)",
      "If no news, chart structure alone justifies trade"
    ]
  },
  shortSqueeze: {
    name: "Short Squeeze",
    checklists: [
      "Wide-range breakout candle on high volume",
      "Gap + hold or strong Day 1/Day 2 continuation behavior",
      "Relative Volume (1-day) > 2.0",
      "Beta > 2.0 or Volatility > 4%",
      "RSI between 55–70 (not overbought)",
      "MACD trending upward or freshly crossed",
      "High short float (20%+) confirmed externally (Finviz, Fintel, etc.)",
      "Small float or prior squeeze chart behavior",
      "Room above — no major resistance overhead"
    ],
    newsValidation: [
      "Confirmed event or sentiment driver (e.g. earnings beat, activist, insider buys)",
      "Headline present within last 3 days",
      "If no news: verify price is moving *only* due to float pressure (pure squeeze logic)"
    ]
  },
  postEarnings: {
    name: "Post-Earnings Momentum",
    checklists: [
      "Earnings occurred within last 3 trading days",
      "Large green candle on earnings day with strong close",
      "Price gapped up and held or built above 20 EMA",
      "Day 2 or Day 3 shows continuation or controlled pullback",
      "Relative Volume (1–3 day avg) > 1.5",
      "RSI between 55–70",
      "MACD bullish",
      "No major macro interference (Fed, CPI, etc.) within 3 days",
      "Target zone has room for extension (no hard resistance above)"
    ],
    newsValidation: [
      "Confirm earnings beat — look for revenue + EPS beat and guidance raise",
      "Check press release or SA earnings summary",
      "Ensure market reaction aligns with numbers (not a fake pump)"
    ]
  }
};

// Utility function to calculate ATR (Average True Range)
const calculateATR = (high, low, close, period = 14) => {
  // Calculate True Range: max(high-low, abs(high-prevClose), abs(low-prevClose))
  // For simplicity, we'll use a percentage-based approximation
  const trueRange = Math.max(high - low, Math.abs(high - close) * 0.5, Math.abs(low - close) * 0.5);
  const atr = trueRange * 0.015; // Approximate ATR as 1.5% of true range
  return Math.max(atr, 0.01); // Minimum ATR of 0.01
};

// Utility function to calculate SL and TP
const calculateSLandTP = (entryPrice, atr, accountSize, riskPercent) => {
  const riskAmount = accountSize * (riskPercent / 100);
  const slPercent = 3.5;
  const slATR = 1.25 * atr;
  
  // Tighter of 3.5% or 1.25×ATR
  const slDistance = Math.min(entryPrice * (slPercent / 100), slATR);
  const stopLoss = entryPrice - slDistance;
  
  // TP is 2× risk
  const takeProfit = entryPrice + (2 * slDistance);
  
  // Position size based on risk
  const positionSize = riskAmount / slDistance;
  
  return {
    stopLoss: Number(stopLoss.toFixed(5)),
    takeProfit: Number(takeProfit.toFixed(5)),
    positionSize: Number(positionSize.toFixed(5))
  };
};

const UniverseScreenerPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [universe, setUniverse] = useState(null);
  const [universes, setUniverses] = useState({});
  const [bulkSymbols, setBulkSymbols] = useState("");
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: "symbol", direction: "asc" });
  const [screenerSettings, setScreenerSettings] = useState(() => {
    const saved = localStorage.getItem("burnlist_screener_settings");
    return saved ? JSON.parse(saved) : {
      accountSize: 10000,
      riskPercent: 2
    };
  });
  const { isInverted } = useTheme();
  const [journalPanelOpen, setJournalPanelOpen] = useState(false);
  const [journalTicker, setJournalTicker] = useState(null);
  const [selectedTradeType, setSelectedTradeType] = useState("");
  const [checklistItems, setChecklistItems] = useState({});
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [riskPerTrade, setRiskPerTrade] = useState("2");
  const [overrideReason, setOverrideReason] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [currentMarketPrice, setCurrentMarketPrice] = useState(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  // Load universes and find the specific universe on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("burnlist_universes");
      if (saved) {
        const parsed = JSON.parse(saved);
        setUniverses(parsed);
        const found = Object.values(parsed).find(u => u.slug === slug);
        if (found) {
          setUniverse(found);
        }
      }
    } catch (error) {
      logger.error("Failed to load universes:", error);
    }
  }, [slug]);

  // Save universe to localStorage when it changes
  useEffect(() => {
    if (universe) {
      const updatedUniverses = { ...universes };
      const key = Object.keys(updatedUniverses).find(k => updatedUniverses[k].id === universe.id);
      if (key) {
        updatedUniverses[key] = universe;
        localStorage.setItem("burnlist_universes", JSON.stringify(updatedUniverses));
        // Don't call setUniverses here to avoid infinite loop
      }
    }
  }, [universe]);

  // Save screener settings when they change
  useEffect(() => {
    localStorage.setItem("burnlist_screener_settings", JSON.stringify(screenerSettings));
  }, [screenerSettings]);

  const handleBulkAdd = async () => {
    if (!bulkSymbols.trim()) {
      setNotification("Please enter ticker symbols");
      setNotificationType("error");
      return;
    }

    setIsLoading(true);
    setNotification("Adding tickers to universe...");
    setNotificationType("loading");

    try {
      const symbols = bulkSymbols
        .split(/[,	\s]+/)
        .map(sym => sym.trim().toUpperCase())
        .filter(Boolean)
        .filter(isValidTicker);

      if (symbols.length === 0) {
        setNotification("No valid ticker symbols found");
        setNotificationType("error");
        return;
      }

      const existingSymbols = new Set((universe?.items || []).map(item => item.symbol));
      const newSymbols = symbols.filter(sym => !existingSymbols.has(sym));

      if (newSymbols.length === 0) {
        setNotification("All symbols already exist in universe");
        setNotificationType("info");
        return;
      }

      const newItems = [];
      for (const symbol of newSymbols) {
        const normalizedSymbol = normalizeSymbol(symbol);
        
        // Create basic ticker entry without API calls
        const newItem = {
          id: uuidv4(),
          symbol: normalizedSymbol,
          lastPrice: 0, // Will be filled manually
          atr: 0, // Will be filled manually
          flags: {
            news: false
          },
          tradeType: "",
          tradeTypeName: "",
          quickTradeType: "",
          quickTradeTypeName: "",
          journalVerdict: "",
          journalVerdictType: "",
          journalVerdictFlag: "",
          entryPrice: "",
          notes: "",
          stopLoss: "",
          takeProfit: "",
          positionSize: ""
        };
        
        newItems.push(newItem);
      }

      setUniverse(prev => ({
        ...prev,
        items: [...(prev?.items || []), ...newItems]
      }));
      setBulkSymbols("");
      setNotification(`Added ${newItems.length} tickers to universe. You can now manually enter prices.`);
      setNotificationType("success");

    } catch (error) {
      logger.error("Error adding tickers:", error);
      setNotification("Failed to add tickers");
      setNotificationType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemChange = (id, field, value) => {
    setUniverse(prev => ({
      ...prev,
      items: (prev?.items || []).map(item => {
        if (item.id === id) {
          const updated = { ...item };
          
          if (field === 'flags') {
            updated.flags = { ...updated.flags, ...value };
          } else {
            updated[field] = value;
          }

          // Auto-calculate SL, TP, and position size when entry price and ATR are available
          if (field === 'entryPrice' || field === 'atr') {
            const entryPrice = field === 'entryPrice' ? parseFloat(value) : updated.entryPrice;
            const atr = field === 'atr' ? parseFloat(value) : updated.atr;
            
            if (entryPrice && atr && entryPrice > 0 && atr > 0) {
              const { stopLoss, takeProfit, positionSize } = calculateSLandTP(
                entryPrice, 
                atr, 
                screenerSettings.accountSize, 
                screenerSettings.riskPercent
              );
              updated.stopLoss = stopLoss.toFixed(2);
              updated.takeProfit = takeProfit.toFixed(2);
              updated.positionSize = positionSize.toFixed(2);
            }
          }

          return updated;
        }
        return item;
      })
    }));
  };

  const handleDeleteItem = (id) => {
    setUniverse(prev => ({
      ...prev,
      items: (prev?.items || []).filter(item => item.id !== id)
    }));
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === (universe?.items?.length || 0)) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set((universe?.items || []).map(item => item.id)));
    }
  };


  const handleMassDelete = () => {
    setUniverse(prev => ({
      ...prev,
      items: (prev?.items || []).filter(item => !selectedItems.has(item.id))
    }));
    setSelectedItems(new Set());
  };

  const handleCreateWatchlist = async () => {
    if (selectedItems.size === 0) {
      setNotification("Please select at least one ticker");
      setNotificationType("error");
      return;
    }

    setIsLoading(true);
    setNotification("Creating watchlist with fresh market data...");
    setNotificationType("info");

    try {
      const selectedUniverseItems = (universe?.items || []).filter(item => selectedItems.has(item.id));
      const watchlists = JSON.parse(localStorage.getItem("burnlist_watchlists") || "{}");
      
      // Create new watchlist
      const watchlistId = uuidv4();
      const watchlistName = `Screener ${formatDateEuropean(new Date())}`;
      const watchlistSlug = watchlistName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Fetch fresh market data for each selected item
      const watchlistItems = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const item of selectedUniverseItems) {
        try {
          // Use createTicker to fetch fresh market data
          const freshTicker = await createTicker(
            item.symbol,
            'real',
            parseFloat(item.entryPrice) || null, // Use entry price if available
            null // Use current date
          );
          
          if (freshTicker) {
            watchlistItems.push(freshTicker);
            successCount++;
          } else {
            errorCount++;
            logger.warn(`Failed to fetch data for ${item.symbol}`);
          }
          
          // Add delay between requests to prevent rate limiting
          if (selectedUniverseItems.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          errorCount++;
          logger.error(`Error fetching data for ${item.symbol}:`, error);
        }
      }
      
      if (watchlistItems.length === 0) {
        setNotification("Failed to fetch market data for any selected tickers");
        setNotificationType("error");
        setIsLoading(false);
        return;
      }
      
      const newWatchlist = {
        id: watchlistId,
        name: watchlistName,
        slug: watchlistSlug,
        items: watchlistItems,
        reason: `Created from screener with ${successCount} tickers (${errorCount} failed)`,
        createdAt: new Date().toISOString()
      };

      const updatedWatchlists = { ...watchlists, [watchlistId]: newWatchlist };
      localStorage.setItem("burnlist_watchlists", JSON.stringify(updatedWatchlists));
      
      setNotification(`Created watchlist "${watchlistName}" with ${successCount} tickers${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      setNotificationType("success");
      setSelectedItems(new Set());
      
    } catch (error) {
      logger.error("Error creating watchlist:", error);
      setNotification("Failed to create watchlist");
      setNotificationType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsChange = (field, value) => {
    setScreenerSettings(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  // Sort function
  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // Get sorted and filtered universe
  const sortedUniverse = [...(universe?.items || [])]
    .map(item => {
      // Prepare metrics for buy score calculation
      const metrics = {
        epsGrowth: item.epsGrowth || 0,
        avgVolume: item.avgVolume || 0,
        relVolume: item.relVolume || 1,
        technicalFlags: (item.tradeType && item.journalVerdictType === "qualified") ? true : false,
        earningsDaysAway: item.earningsDaysAway || 10,
        price: item.lastPrice || 0,
        pe: item.pe || 15,
        marketCap: item.marketCap || 500000000,
        debtEquity: item.debtEquity || 0.25,
        pb: item.pb || 1.1,
        beta: item.beta || 1.5,
        newsFlag: item.flags?.news || false,
        sectorAlignment: item.sectorAlignment || false,
        marketSupport: item.marketSupport || false,
        volatilityClear: item.volatilityClear || false,
        breadthHealthy: item.breadthHealthy || false,
      };
      const scoreObj = calculateBuyScore(metrics);
      return { ...item, _buyScore: scoreObj.totalBuyScore, _buyTag: scoreObj.tag };
    })
    .sort((a, b) => {
      // Handle nested properties (e.g., "flags.news")
      const getValue = (obj, key) => {
        if (key.includes('.')) {
          const keys = key.split('.');
          return keys.reduce((val, k) => val?.[k], obj);
        }
        return obj[key];
      };

      const aVal = getValue(a, sortConfig.key);
      const bVal = getValue(b, sortConfig.key);

      // Handle string comparisons
      if (sortConfig.key === "symbol" || sortConfig.key === "tradeType" || sortConfig.key === "quickTradeType" || sortConfig.key === "notes" || sortConfig.key === "journalVerdict") {
        const aStr = String(aVal || '');
        const bStr = String(bVal || '');
        return sortConfig.direction === "asc" 
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      }

      // Handle boolean comparisons (for flags)
      if (sortConfig.key === "flags.news") {
        const aBool = Boolean(aVal);
        const bBool = Boolean(bVal);
        if (aBool === bBool) return 0;
        return sortConfig.direction === "asc" 
          ? (aBool ? 1 : -1)
          : (bBool ? 1 : -1);
      }

      // Handle numeric comparisons
      const aNum = parseFloat(aVal) || 0;
      const bNum = parseFloat(bVal) || 0;
      return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
    });

  // Render sort arrow
  const renderSortArrow = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const calculateRiskReward = () => {
    if (!entryPrice || !stopLoss || !target) return null;
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    const targetPrice = parseFloat(target);
    
    if (entry <= 0 || stop <= 0 || targetPrice <= 0) return null;
    
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(targetPrice - entry);
    
    if (risk === 0) return null;
    
    return (reward / risk).toFixed(2);
  };

  const calculatePositionSize = () => {
    if (!accountSize || !riskPerTrade || !entryPrice || !stopLoss) return null;
    
    const account = parseFloat(accountSize);
    const riskPercent = parseFloat(riskPerTrade) / 100;
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    
    if (account <= 0 || riskPercent <= 0 || entry <= 0 || stop <= 0) return null;
    
    const riskAmount = account * riskPercent;
    const riskPerShare = Math.abs(entry - stop);
    
    if (riskPerShare === 0) return null;
    
    return Math.floor(riskAmount / riskPerShare);
  };

  const getVerdict = () => {
    if (!selectedTradeType || Object.keys(checklistItems).length === 0) return null;
    
    const totalItems = Object.keys(checklistItems).length;
    const checkedItems = Object.values(checklistItems).filter(Boolean).length;
    const failedItems = totalItems - checkedItems;
    
    if (failedItems === 0) return { type: "qualified", text: "Qualified", flag: greenFlag };
    if (failedItems <= 2) return { type: "discretionary", text: "Discretionary", flag: yellowFlag };
    return { type: "blocked", text: "Blocked", flag: redFlag };
  };

  const handleChecklistChange = (item) => {
    setChecklistItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const handleJournalClick = (item) => {
    setJournalTicker(item);
    setJournalPanelOpen(true);
    setSelectedTradeType(item.tradeType || "");
    setEntryPrice(item.entryPrice || "");
    setStopLoss(item.stopLoss || "");
    setTarget(item.target || "");
    setAccountSize(item.accountSize || "");
    setRiskPerTrade(item.riskPerTrade || "2");
    setOverrideReason(item.overrideReason || "");
    
    // Load checklist items from item
    const savedChecklist = {};
    if (item.tradeType && SETUP_CONFIGS[item.tradeType]) {
      const allChecklistItems = [
        ...SETUP_CONFIGS[item.tradeType].checklists,
        ...SETUP_CONFIGS[item.tradeType].newsValidation
      ];
      allChecklistItems.forEach(checkItem => {
        if (item.notes && item.notes.includes(checkItem)) {
          savedChecklist[checkItem] = true;
        }
      });
    }
    setChecklistItems(savedChecklist);
    
    // Fetch current market price
    fetchCurrentMarketPrice(item.symbol);
  };

  const fetchCurrentMarketPrice = async (symbol) => {
    if (!symbol) return;
    
    setIsFetchingPrice(true);
    try {
              const response = await fetch(`/api/twelvedata-quote?symbols=${symbol}&interval=1min`);
      
      if (response.ok) {
        const priceData = await response.json();
        if (priceData && priceData.length > 0) {
          setCurrentMarketPrice(priceData[0].price);
        } else {
          logger.warn(`No price data received for ${symbol}`);
          setCurrentMarketPrice(null);
        }
      } else {
        logger.warn(`API error for ${symbol}: ${response.status}`);
        setCurrentMarketPrice(null);
      }
    } catch (error) {
      logger.error("Error fetching current market price:", error);
      setCurrentMarketPrice(null);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleJournalPanelClose = () => {
    setJournalPanelOpen(false);
    setJournalTicker(null);
    // Don't reset the form data when closing, so it's preserved if user reopens
  };

  const handleJournalPanelSave = () => {
    if (!journalTicker || !selectedTradeType) return;

    const verdict = getVerdict();
    if (!verdict) return;

    // Update the universe item with journal data
    setUniverse(prev => ({
      ...prev,
      items: (prev?.items || []).map(item => {
        if (item.id === journalTicker.id) {
                      // Check if news validation passed
            const newsValidationItems = SETUP_CONFIGS[selectedTradeType].newsValidation;
            const newsValidationPassed = newsValidationItems.every(item => checklistItems[item]);
            
            return {
              ...item,
              tradeType: selectedTradeType,
              tradeTypeName: SETUP_CONFIGS[selectedTradeType].name,
              journalVerdict: verdict.text,
              journalVerdictType: verdict.type,
              journalVerdictFlag: verdict.flag,
              entryPrice: entryPrice,
              stopLoss: stopLoss,
              target: target,
              takeProfit: target, // Also store as takeProfit for compatibility
              accountSize: accountSize,
              riskPerTrade: riskPerTrade,
              riskReward: calculateRiskReward(),
              positionSize: calculatePositionSize(),
              checklistItems: { ...checklistItems },
              overrideReason: verdict.type !== "qualified" ? overrideReason : "",
              journaledAt: new Date().toISOString(),
              flags: {
                ...item.flags,
                news: newsValidationPassed
              }
            };
        }
        return item;
      })
    }));

    setJournalPanelOpen(false);
    setJournalTicker(null);
    setSelectedTradeType("");
    setChecklistItems({});
    setEntryPrice("");
    setStopLoss("");
    setTarget("");
    setAccountSize("");
    setRiskPerTrade("2");
    setOverrideReason("");
  };

  // Reset checklist when trade type changes, but only if no saved checklist exists
  useEffect(() => {
    if (!journalPanelOpen) return;
    if (!selectedTradeType || !SETUP_CONFIGS[selectedTradeType]) return;
    // Only reset if checklistItems is empty (no saved data)
    const checklistKeys = Object.keys(checklistItems);
    if (checklistKeys.length === 0) {
      const newChecklist = {};
      SETUP_CONFIGS[selectedTradeType].checklists.forEach(item => {
        newChecklist[item] = false;
      });
      SETUP_CONFIGS[selectedTradeType].newsValidation.forEach(item => {
        newChecklist[item] = false;
      });
      setChecklistItems(newChecklist);
    }
  }, [selectedTradeType, journalPanelOpen]);

  // When trade type changes in the journal panel, clear all journal fields for that ticker
  const handleExecuteTrade = async (item) => {
    if (!item.tradeType || !item.entryPrice || !item.stopLoss || !item.target) {
      setNotification("Complete journal entry first");
      setNotificationType("error");
      return;
    }

    try {
      setNotification("Fetching latest price from Twelve Data API...");
      setNotificationType("loading");

      let currentMarketPrice = null;
      let useCurrentPrice = false;
      
      try {
        // Fetch latest price from Twelve Data API
        const response = await fetch(`/api/twelvedata-quote?symbols=${item.symbol}&interval=1min`);
        
        if (response.ok) {
          const priceData = await response.json();
          
          if (priceData && priceData.length > 0) {
            currentMarketPrice = priceData[0].price;
            logger.log(`📊 Latest price for ${item.symbol}: $${currentMarketPrice}`);
            
            // Ask user if they want to use current market price or keep manual entry
            useCurrentPrice = window.confirm(
              `Current market price for ${item.symbol}: $${currentMarketPrice.toFixed(2)}\n\n` +
              `Your entered price: $${parseFloat(item.entryPrice).toFixed(2)}\n\n` +
              `Would you like to use the current market price instead?`
            );
          }
        }
      } catch (apiError) {
        logger.warn("Twelve Data API not available, using manual entry price:", apiError);
        setNotification("Using manual entry price (API unavailable)");
        setNotificationType("info");
      }
      
      const finalEntryPrice = useCurrentPrice ? currentMarketPrice : parseFloat(item.entryPrice);
      
      // Calculate risk:reward ratio with final entry price
      const entry = finalEntryPrice;
      const stop = parseFloat(item.stopLoss);
      const target = parseFloat(item.target);
      const risk = Math.abs(entry - stop);
      const reward = Math.abs(target - entry);
      const riskReward = risk > 0 ? (reward / risk).toFixed(2) : '0';

      // Create trade entry for journal
      const tradeEntry = {
        id: Date.now(),
        ticker: item.symbol,
        setup: item.tradeTypeName || item.tradeType,
        riskReward: riskReward,
        verdict: item.journalVerdict || 'Not journaled',
        outcome: 'Open',
        entryPrice: finalEntryPrice,
        stopLoss: parseFloat(item.stopLoss),
        target: parseFloat(item.target),
        positionSize: item.positionSize,
        accountSize: item.accountSize,
        riskPerTrade: item.riskPerTrade,
        executedAt: new Date().toISOString(),
        notes: item.notes || '',
        currentMarketPrice: currentMarketPrice, // Store the current market price for reference
        priceSource: useCurrentPrice ? 'Twelve Data API' : (currentMarketPrice ? 'Manual Entry (API Available)' : 'Manual Entry (API Unavailable)')
      };

      // Load existing trades from localStorage
      const existingTrades = JSON.parse(localStorage.getItem("trade_journal_trades") || "[]");
      
      // Add new trade
      const updatedTrades = [tradeEntry, ...existingTrades];
      
      // Save back to localStorage
      localStorage.setItem("trade_journal_trades", JSON.stringify(updatedTrades));
      
      const priceMessage = useCurrentPrice 
        ? ` (updated to current market price: $${currentMarketPrice.toFixed(2)})`
        : currentMarketPrice 
          ? ` (using manual entry: $${parseFloat(item.entryPrice).toFixed(2)})`
          : ` (using manual entry: $${parseFloat(item.entryPrice).toFixed(2)})`;
      
      setNotification(`Trade executed: ${item.symbol} logged to journal${priceMessage}`);
      setNotificationType("success");
      
    } catch (error) {
      logger.error("Error executing trade:", error);
      setNotification(`Failed to execute trade: ${error.message}`);
      setNotificationType("error");
    }
  };

  const handleTradeTypeChange = (newType) => {
    setSelectedTradeType(newType);
    // Reset all journal fields
    setChecklistItems({});
    setEntryPrice("");
    setStopLoss("");
    setTarget("");
    setAccountSize("");
    setRiskPerTrade("2");
    setOverrideReason("");
  };

  const handleQuickTradeTypeChange = (itemId, tradeType) => {
          logger.debug(`Setting trade type for item ${itemId} to ${tradeType}`);
    setUniverse(prev => {
      const updatedItems = (prev?.items || []).map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              quickTradeType: tradeType,
              quickTradeTypeName: tradeType ? SETUP_CONFIGS[tradeType]?.name || tradeType : ""
            }
          : item
      );
      logger.debug(`Updated items:`, updatedItems.map(item => ({ id: item.id, quickTradeType: item.quickTradeType })));
      return {
        ...prev,
        items: updatedItems
      };
    });
  };

  const handleMassQuickTradeTypeChange = (tradeType) => {
    if (selectedItems.size === 0) {
      setNotification("Please select at least one stock first");
      setNotificationType("error");
      return;
    }

    setUniverse(prev => ({
      ...prev,
      items: (prev?.items || []).map(item => 
        selectedItems.has(item.id)
          ? { 
              ...item, 
              quickTradeType: tradeType,
              quickTradeTypeName: tradeType ? SETUP_CONFIGS[tradeType]?.name || tradeType : ""
            }
          : item
      )
    }));

    setNotification(`Set ${selectedItems.size} stocks to ${SETUP_CONFIGS[tradeType]?.name || tradeType}`);
    setNotificationType("success");
  };

  // Function to open ticker chart in new tab
  const handleTickerClick = async (symbol) => {
    if (!symbol) return;
    
    try {
      const chartUrl = `https://elite.finviz.com/charts?t=${symbol.toUpperCase()}&p=d&l=1h1v`;
      window.open(chartUrl, '_blank');
    } catch (error) {
      logger.warn(`⚠️ Error opening chart for ${symbol}:`, error);
    }
  };

  return (
    <div style={{ backgroundColor: isInverted ? 'rgb(140,185,162)' : 'transparent', minHeight: '100vh', color: isInverted ? '#000000' : '#ffffff', padding: '0' }}>
      <NavigationBar />
      
      {/* Main Content */}
      <div style={{ padding: '20px' }}>
        {/* Notification Banner */}
      {notification && (
        <div style={{ position: 'fixed', top: 24, left: 0, right: 0, zIndex: 10001, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ minWidth: 320, maxWidth: 480, pointerEvents: 'auto' }}>
            <NotificationBanner
              message={notification}
              type={notificationType}
              onClose={() => setNotification("")}
            />
          </div>
        </div>
      )}

      {/* Frameless Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Link to="/universes" style={{ display: 'inline-flex', alignItems: 'center', border: 'none', background: 'none', padding: 0, margin: 0, textDecoration: 'none' }} aria-label="back to universes">
          <img src={backButton} alt="back" style={{ width: 24, height: 24, filter: isInverted ? 'invert(1)' : 'none' }} />
        </Link>
        <h1 style={{ color: CRT_GREEN, fontFamily: "'Courier New', monospace", margin: 0, marginLeft: 0, textAlign: 'right', flex: 1 }}>
          {universe?.name || 'UNIVERSE SCREENER'}
        </h1>
      </div>



      {/* Actions */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <CustomButton onClick={handleSelectAll}>
          {selectedItems.size === (universe?.items?.length || 0) ? "DESELECT ALL" : "SELECT ALL"}
        </CustomButton>
        <CustomButton 
          onClick={handleCreateWatchlist}
          disabled={selectedItems.size === 0 || isLoading}
        >
          {isLoading ? "CREATING WATCHLIST..." : `CREATE WATCHLIST FROM SELECTED (${selectedItems.size})`}
        </CustomButton>
        
        {/* Mass Quick Trade Type Controls - Only show in edit mode */}
        {editMode && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ color: CRT_GREEN, fontSize: "12px", fontFamily: "'Courier New', monospace" }}>
              MASS SET:
            </span>
            {Object.keys(SETUP_CONFIGS).map(tradeType => (
              <button
                key={tradeType}
                onClick={() => handleMassQuickTradeTypeChange(tradeType)}
                disabled={selectedRows.size === 0}
                style={{
                  background: 'transparent',
                  color: CRT_GREEN,
                  border: `1px solid ${CRT_GREEN}`,
                  padding: '4px 8px',
                  fontFamily: 'Courier New',
                  fontSize: 10,
                  cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer',
                  borderRadius: 0,
                  opacity: selectedRows.size === 0 ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
                title={`Set ${selectedRows.size} selected stocks to ${SETUP_CONFIGS[tradeType].name}`}
              >
                {tradeType.charAt(0).toUpperCase() + tradeType.slice(1).replace(/([A-Z])/g, ' $1')}
              </button>
            ))}
          </div>
        )}
   </div>

            {/* Universe Table */}
   {(universe?.items?.length || 0) > 0 && (
    <div style={{ overflowX: "auto" }}>
      {/* Edit Mode Toggle and Mass Delete */}
{(universe?.items?.length || 0) > 0 && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
    
    <button
      onClick={() => setEditMode(e => !e)}
      style={{
        background: 'none',
        border: 'none',
        color: CRT_GREEN,
        fontFamily: "'Courier New', monospace",
        fontSize: '12px',
        padding: '2px 8px',
        borderRadius: 0,
        fontWeight: 400,
        textTransform: 'lowercase',
        letterSpacing: 0,
        cursor: 'pointer',
        transition: 'all 0.2s',
        minWidth: 0,
        boxShadow: 'none',
      }}
    >
      {editMode ? 'done' : 'edit'}
    </button>
  </div>
)}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14.5px'
      }}>
                     <thead>
           <tr>
             <th style={{ padding: '6px', textAlign: "center", borderBottom: `2px solid ${CRT_GREEN}`, background: 'black' }}>
               <img
                 src={selectedItems.size === (universe?.items?.length || 0) && (universe?.items?.length || 0) > 0 ? checkbox : box}
                 alt="Select All"
                 onClick={(e) => {
                   e.stopPropagation();
                   handleSelectAll();
                 }}
                 style={{ 
                   width: 16, 
                   height: 16, 
                   cursor: 'pointer',
                   filter: 'drop-shadow(0 0 2px rgba(140,185,162,0.3))'
                 }}
               />
             </th>
             <th 
               onClick={() => handleSort("symbol")} 
               style={{ 
                 cursor: 'pointer',
                 padding: '12px 8px', 
                 textAlign: "left", 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s'
               }}
             >
               Symbol {renderSortArrow("symbol")}
             </th>
             <th 
               onClick={() => handleSort("tradeType")} 
               style={{ 
                 cursor: 'pointer',
                 padding: '12px 8px', 
                 textAlign: "center", 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s'
               }}
             >
               Trade Type {renderSortArrow("tradeType")}
             </th>
             <th 
               onClick={() => handleSort("lastPrice")} 
               style={{ 
                 cursor: 'pointer',
                 padding: '12px 8px', 
                 textAlign: "right", 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s'
               }}
             >
               Last Price {renderSortArrow("lastPrice")}
             </th>
             <th 
               onClick={() => handleSort("tradeType")} 
               style={{ 
                 cursor: 'pointer',
                 padding: '12px 8px', 
                 textAlign: 'center', 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s'
               }}
             >
               SETUP {renderSortArrow("tradeType")}
             </th>
             <th 
               onClick={() => handleSort("flags.news")} 
               style={{ 
                 padding: '12px 8px', 
                 textAlign: 'center', 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s',
                 cursor: "pointer" 
               }}
             >
               NEWS {renderSortArrow("flags.news")}
             </th>
             <th 
               onClick={() => handleSort("journalVerdict")} 
               style={{ 
                 padding: '12px 8px', 
                 textAlign: 'center', 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s',
                 cursor: "pointer" 
               }}
             >
               VERDICT {renderSortArrow("journalVerdict")}
             </th>
             <th onClick={() => handleSort("entryPrice")} style={{ 
               padding: '12px 8px', 
               textAlign: "right", 
               borderBottom: `2px solid ${CRT_GREEN}`, 
               color: CRT_GREEN,
               fontWeight: 'bold',
               fontSize: '14.5px',
               userSelect: 'none',
               transition: 'background-color 0.2s',
               cursor: "pointer" 
             }}>
               Entry Price {renderSortArrow("entryPrice")}
             </th>
             <th 
               onClick={() => handleSort("stopLoss")} 
               style={{ 
                 padding: '12px 8px', 
                 textAlign: "right", 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s',
                 cursor: "pointer" 
               }}
             >
               SL {renderSortArrow("stopLoss")}
             </th>
             <th 
               onClick={() => handleSort("takeProfit")} 
               style={{ 
                 padding: '12px 8px', 
                 textAlign: "right", 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s',
                 cursor: "pointer" 
               }}
             >
               TP {renderSortArrow("takeProfit")}
             </th>
             <th 
               onClick={() => handleSort("positionSize")} 
               style={{ 
                 padding: '12px 8px', 
                 textAlign: "right", 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s',
                 cursor: "pointer" 
               }}
             >
               Position {renderSortArrow("positionSize")}
             </th>
             <th 
               onClick={() => handleSort("notes")} 
               style={{ 
                 padding: '12px 8px', 
                 textAlign: "left", 
                 borderBottom: `2px solid ${CRT_GREEN}`, 
                 color: CRT_GREEN,
                 fontWeight: 'bold',
                 fontSize: '14.5px',
                 userSelect: 'none',
                 transition: 'background-color 0.2s',
                 cursor: "pointer" 
               }}
             >
               Notes {renderSortArrow("notes")}
             </th>
             <th style={{ 
               padding: '12px 8px', 
               textAlign: "center", 
               borderBottom: `2px solid ${CRT_GREEN}`, 
               color: CRT_GREEN,
               fontWeight: 'bold',
               fontSize: '14.5px'
             }}>Execute</th>

           </tr>
         </thead>
                     <tbody>
           {sortedUniverse.map((item, idx) => (
            <tr
              key={item.id}
              style={{
                borderBottom: `1px solid ${gray}`,
                ':hover': {
                  backgroundColor: 'rgba(140,185,162,0.05)'
                }
              }}
              onClick={e => {
                // Prevent row click from triggering when clicking edit/done or delete buttons or checkboxes/inputs
                if (
                  e.target.closest('button') ||
                  e.target.tagName === 'BUTTON' ||
                  e.target.closest('input') ||
                  e.target.tagName === 'IMG' ||
                  e.target.closest('select')
                ) return;
                handleJournalClick(item);
              }}
            >
              <td style={{ padding: '6px', textAlign: "center" }}>
          <img
            src={selectedItems.has(item.id) ? checkbox : box}
            alt="Select Item"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectItem(item.id);
            }}
            style={{ 
              width: 16, 
              height: 16, 
              cursor: 'pointer',
              filter: 'drop-shadow(0 0 2px rgba(140,185,162,0.3))'
            }}
          />
              </td>
              <td style={{ padding: '6px', textAlign: "left" }}>
                <span
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent row click
                    handleTickerClick(item.symbol);
                  }}
                  style={{
                    color: CRT_GREEN,
                    cursor: 'pointer',
                    fontFamily: "'Courier New', monospace",
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 'bold'
                  }}
                  title={`Click to open ${item.symbol} chart in new tab`}
                >
                  {item.symbol}
                  <img src={greenFlag} alt="Open Chart" style={{ width: 12, height: 12, verticalAlign: 'middle' }} />
                </span>
              </td>
              <td style={{ padding: '6px', textAlign: "center" }}>
                {editMode ? (
                  <select
                    value={item.quickTradeType || item.tradeType || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      const value = e.target.value;
                      handleQuickTradeTypeChange(item.id, value);
                    }}
                    data-item-id={item.id}
                    data-field="tradeType"
                    style={{
                      background: 'black',
                      color: CRT_GREEN,
                      border: `1px solid ${CRT_GREEN}`,
                      padding: '2px 4px',
                      fontFamily: 'Courier New',
                      fontSize: 12,
                      width: '100%'
                    }}
                  >
                    <option value="">Select</option>
                    <option value="breakout">Breakout</option>
                    <option value="pullback">Pullback</option>
                    <option value="shortSqueeze">Short Squeeze</option>
                    <option value="postEarnings">Post-Earnings</option>
                  </select>
                ) : (
                  <select
                    value={item.quickTradeType || item.tradeType || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      const value = e.target.value;
                      handleQuickTradeTypeChange(item.id, value);
                    }}
                    style={{
                      background: 'transparent',
                      color: CRT_GREEN,
                      border: 'none',
                      borderBottom: `1px solid ${CRT_GREEN}`,
                      padding: '1px 2px',
                      fontFamily: 'Courier New',
                      fontSize: 12,
                      cursor: 'pointer',
                      borderRadius: 0,
                      width: '100%',
                      textAlign: 'center',
                      height: '18px',
                      outline: 'none'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">-</option>
                    <option value="breakout">Breakout</option>
                    <option value="pullback">Pullback</option>
                    <option value="shortSqueeze">Short Squeeze</option>
                    <option value="postEarnings">Post-Earnings</option>
                  </select>
                )}
              </td>
                            <td 
                              style={{ padding: '6px', textAlign: "right", cursor: editMode ? "text" : "default" }}
                              onClick={editMode ? () => {
                                const input = document.querySelector(`input[data-item-id="${item.id}"][data-field="lastPrice"]`);
                                if (input) input.focus();
                              } : undefined}
                            >
                {editMode ? (
                  <input
                    type="number"
                    step="0.01"
                    value={item.lastPrice || ""}
                    onChange={(e) => handleItemChange(item.id, 'lastPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    data-item-id={item.id}
                    data-field="lastPrice"
                    style={{
                      backgroundColor: "black",
                      color: CRT_GREEN,
                      border: `1px solid ${CRT_GREEN}`,
                      padding: "4px 6px",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 14,
                      width: "60px",
                      textAlign: "right",
                      borderRadius: 0
                    }}
                  />
                ) : (
                  <span>${item.lastPrice ? item.lastPrice.toFixed(2) : '0.00'}</span>
                )}
              </td>
              <td style={{ width: "7.14%", padding: '2px 4px', textAlign: 'center' }}>
                <img src={item.tradeType ? greenFlag : redFlag} alt="SETUP" title={item.tradeTypeName || "No setup selected"} style={{ width: 13, height: 13, verticalAlign: 'middle', filter: 'drop-shadow(0 0 1px #222)' }} />
              </td>
              <td style={{ width: "7.14%", padding: '2px 4px', textAlign: 'center' }}>
                <img src={item.flags?.news || item.newsFlag ? greenFlag : redFlag} alt="NEWS" title="NEWS" style={{ width: 13, height: 13, verticalAlign: 'middle', filter: 'drop-shadow(0 0 1px #222)' }} />
              </td>
              <td style={{ width: "7.14%", padding: '2px 4px', textAlign: 'center' }}>
                <img src={item.journalVerdictFlag || redFlag} alt="VERDICT" title={item.journalVerdict || "Not journaled"} style={{ width: 13, height: 13, verticalAlign: 'middle', filter: 'drop-shadow(0 0 1px #222)' }} />
              </td>
              <td style={{ padding: '6px', textAlign: "right" }}>
                {item.entryPrice !== undefined && item.entryPrice !== null ? item.entryPrice : '-'}
              </td>
              <td style={{ padding: '6px', textAlign: "right" }}>
                {item.stopLoss ? `$${item.stopLoss}` : '-'}
              </td>
              <td style={{ padding: '6px', textAlign: "right" }}>
                {item.target ? `$${item.target}` : (item.takeProfit ? `$${item.takeProfit}` : '-')}
              </td>
              <td style={{ padding: '6px', textAlign: "right" }}>
                {item.positionSize ? item.positionSize : '-'}
              </td>
              <td 
                style={{ padding: '6px', textAlign: "left", cursor: editMode ? "text" : "default" }}
                onClick={editMode ? () => {
                  const input = document.querySelector(`input[data-item-id="${item.id}"][data-field="notes"]`);
                  if (input) input.focus();
                } : undefined}
              >
                {editMode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                      placeholder="Notes..."
                      data-item-id={item.id}
                      data-field="notes"
                      style={{
                        backgroundColor: "black",
                        color: CRT_GREEN,
                        borderRadius: 0,
                        border: `1px solid ${CRT_GREEN}`,
                        fontSize: 14,
                        boxShadow: item.notes.trim() ? `0 0 4px 0 ${CRT_GREEN}22` : 'none',
                        fontFamily: "'Courier New', monospace",
                        width: "80px",
                        padding: "4px 6px"
                      }}
                    />
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: CRT_GREEN,
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'inline-flex',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                      }}
                      title="Delete Ticker"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ) : (
                  <span style={{ color: CRT_GREEN, fontFamily: "'Courier New', monospace", fontSize: 14 }}>
                    {item.notes || '-'}
                  </span>
                )}
              </td>
              <td style={{ padding: '6px', textAlign: "center" }}>
                <img
                  src={execute}
                  alt="Execute Trade"
                  onClick={() => handleExecuteTrade(item)}
                  style={{
                    width: 24,
                    height: 24,
                    cursor: (!item.tradeType || !item.entryPrice || !item.stopLoss || !item.target) ? 'not-allowed' : 'pointer',
                    opacity: (!item.tradeType || !item.entryPrice || !item.stopLoss || !item.target) ? 0.3 : 1,
                    filter: 'drop-shadow(0 0 2px rgba(140,185,162,0.3))',
                    transition: 'all 0.2s'
                  }}
                  title={(!item.tradeType || !item.entryPrice || !item.stopLoss || !item.target) ? "Complete journal entry first" : "Execute trade"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    )}

    {!universe && (
      <div style={{ 
        textAlign: "center", 
        color: "#999", 
        fontFamily: "'Courier New', monospace",
        marginTop: "50px"
      }}>
        ⚠️ Universe not found.
      </div>
    )}
    {universe && (universe?.items?.length || 0) === 0 && (
      <div style={{ 
        textAlign: "center", 
        color: "#999", 
        fontFamily: "'Courier New', monospace",
        marginTop: "50px"
      }}>
        ⚠️ No tickers in universe yet. Add some tickers above to get started.
      </div>
          )}

      {/* Journal Panel */}
      {journalPanelOpen && journalTicker && (
        <>
          {/* Overlay for closing */}
          <div
            onClick={handleJournalPanelClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.3)',
              zIndex: 10009,
              pointerEvents: 'auto',
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 800,
              height: '100vh',
              background: '#0a0a0a',
              color: CRT_GREEN,
              zIndex: 10010,
              boxShadow: `-4px 0 24px 0 ${CRT_GREEN}33`,
              borderLeft: `2px solid ${CRT_GREEN}`,
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.3s',
              fontFamily: 'Courier New',
              padding: 0,
              pointerEvents: 'auto',
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
              <h2 style={{ color: CRT_GREEN, marginBottom: 18, fontWeight: 700, fontSize: 24 }}>
                Journal: {journalTicker.symbol}
              </h2>
              
              {/* Setup Selection */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>1. SELECT SETUP TYPE</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {Object.entries(SETUP_CONFIGS).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => handleTradeTypeChange(key)}
                      style={{
                        background: selectedTradeType === key ? CRT_GREEN : 'transparent',
                        color: selectedTradeType === key ? '#000' : CRT_GREEN,
                        border: `2px solid ${CRT_GREEN}`,
                        fontWeight: selectedTradeType === key ? 'bold' : 'normal',
                        padding: '8px 16px',
                        fontFamily: 'Courier New',
                        cursor: 'pointer'
                      }}
                    >
                      {config.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              {selectedTradeType && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>
                    2. VERIFY SETUP CRITERIA ({SETUP_CONFIGS[selectedTradeType].name})
                  </h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                    gap: '10px',
                    border: `2px solid ${CRT_GREEN}`,
                    padding: '16px',
                    borderRadius: '4px',
                    background: 'rgba(140,185,162,0.04)',
                    marginBottom: '20px'
                  }}>
                    {SETUP_CONFIGS[selectedTradeType].checklists.map((item, index) => (
                      <label key={`checklist-${item}`} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '8px',
                        cursor: 'pointer'
                      }}>
                        <span
                          onClick={() => handleChecklistChange(item)}
                          style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') handleChecklistChange(item); }}
                          role="checkbox"
                          aria-checked={checklistItems[item] || false}
                        >
                          <img
                            src={checklistItems[item] ? checkbox : box}
                            alt={checklistItems[item] ? 'Checked' : 'Unchecked'}
                            style={{ width: 22, height: 22 }}
                          />
                        </span>
                        <span style={{ fontSize: '14px' }}>{item}</span>
                      </label>
                    ))}
                  </div>
                  
                  {/* News Validation Checklist */}
                  <div style={{ marginTop: 24 }}>
                    <h4 style={{ marginBottom: '10px', fontSize: '16px', color: CRT_GREEN }}>News Validation</h4>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                      gap: '10px',
                      border: `2px solid ${CRT_GREEN}`,
                      padding: '16px',
                      borderRadius: '4px',
                      background: 'rgba(140,185,162,0.04)'
                    }}>
                      {SETUP_CONFIGS[selectedTradeType].newsValidation.map((item, index) => (
                        <label key={`news-${item}`} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px',
                          padding: '8px',
                          cursor: 'pointer'
                        }}>
                          <span
                            onClick={() => handleChecklistChange(item)}
                            style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') handleChecklistChange(item); }}
                            role="checkbox"
                            aria-checked={checklistItems[item] || false}
                          >
                            <img
                              src={checklistItems[item] ? checkbox : box}
                              alt={checklistItems[item] ? 'Checked' : 'Unchecked'}
                              style={{ width: 22, height: 22 }}
                            />
                          </span>
                          <span style={{ fontSize: '14px' }}>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Entry Details */}
              {selectedTradeType && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>3. ENTRY DETAILS</h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '15px' 
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Entry Price:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          border: `1px solid ${CRT_GREEN}`,
                          color: CRT_GREEN,
                          fontFamily: 'Courier New'
                        }}
                      />
                      {/* Current Market Price Display */}
                      {isFetchingPrice ? (
                        <div style={{ 
                          fontSize: '12px', 
                          color: CRT_GREEN, 
                          marginTop: '4px',
                          fontStyle: 'italic'
                        }}>
                          🔄 Fetching current market price...
                        </div>
                      ) : currentMarketPrice ? (
                        <div style={{ 
                          fontSize: '12px', 
                          color: CRT_GREEN, 
                          marginTop: '4px',
                          padding: '4px 8px',
                          border: `1px solid ${CRT_GREEN}`,
                          borderRadius: '2px',
                          background: 'rgba(140,185,162,0.1)'
                        }}>
                          📊 Current Market: ${currentMarketPrice.toFixed(2)}
                          <button
                            onClick={() => {
                              setEntryPrice(currentMarketPrice.toFixed(2));
                              setNotification(`Entry price updated to current market price: $${currentMarketPrice.toFixed(2)}`);
                              setNotificationType("success");
                            }}
                            style={{
                              marginLeft: '8px',
                              background: 'transparent',
                              border: `1px solid ${CRT_GREEN}`,
                              color: CRT_GREEN,
                              padding: '2px 6px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              fontFamily: 'Courier New'
                            }}
                          >
                            USE
                          </button>
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#666', 
                          marginTop: '4px',
                          fontStyle: 'italic'
                        }}>
                          Unable to fetch current market price
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Stop Loss:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          border: `1px solid ${CRT_GREEN}`,
                          color: CRT_GREEN,
                          fontFamily: 'Courier New'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Target:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          border: `1px solid ${CRT_GREEN}`,
                          color: CRT_GREEN,
                          fontFamily: 'Courier New'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Management */}
              {selectedTradeType && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>4. RISK MANAGEMENT</h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '15px' 
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Account Size ($):</label>
                      <input
                        type="number"
                        value={accountSize}
                        onChange={(e) => setAccountSize(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          border: `1px solid ${CRT_GREEN}`,
                          color: CRT_GREEN,
                          fontFamily: 'Courier New'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Risk Per Trade (%):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={riskPerTrade}
                        onChange={(e) => setRiskPerTrade(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          border: `1px solid ${CRT_GREEN}`,
                          color: CRT_GREEN,
                          fontFamily: 'Courier New'
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Calculations Display */}
                  <div style={{ 
                    marginTop: '15px',
                    padding: '15px',
                    border: `1px solid ${CRT_GREEN}`,
                    background: 'rgba(140,185,162,0.1)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                      <div>
                        <strong>Risk:Reward:</strong> {calculateRiskReward() ? `${calculateRiskReward()}:1` : 'N/A'}
                      </div>
                      <div>
                        <strong>Position Size:</strong> {calculatePositionSize() ? `${calculatePositionSize()} shares` : 'N/A'}
                      </div>
                      <div>
                        <strong>Risk Amount:</strong> {accountSize && riskPerTrade ? 
                          `$${((parseFloat(accountSize) * parseFloat(riskPerTrade) / 100)).toFixed(2)}` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Verdict */}
              {getVerdict() && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>5. SETUP VERDICT</h3>
                  <div style={{
                    padding: '15px',
                    border: `2px solid ${CRT_GREEN}`,
                    textAlign: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    background: getVerdict().type === 'qualified' ? 'rgba(0,255,0,0.1)' : 
                               getVerdict().type === 'discretionary' ? 'rgba(255,165,0,0.1)' : 
                               'rgba(255,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}>
                    <img 
                      src={getVerdict().flag} 
                      alt={getVerdict().text}
                      style={{ width: '24px', height: '24px' }}
                    />
                    {getVerdict().text}
                  </div>
                  
                  {getVerdict().type !== 'qualified' && (
                    <div style={{ marginTop: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>
                        Override Reason (Required for Discretionary/Blocked):
                      </label>
                      <textarea
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          border: `1px solid ${CRT_GREEN}`,
                          color: CRT_GREEN,
                          fontFamily: 'Courier New',
                          minHeight: '60px'
                        }}
                        placeholder="Explain why you're proceeding despite failed criteria..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, padding: 20, borderTop: `1.5px solid ${CRT_GREEN}`, background: '#111' }}>
              <button onClick={handleJournalPanelClose} style={{ 
                fontFamily: 'Courier New',
                fontWeight: 700,
                fontSize: 17,
                borderRadius: 4,
                padding: '8px 28px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: 'black', 
                color: CRT_GREEN, 
                border: `2px solid ${CRT_GREEN}` 
              }}>
                Cancel
              </button>
              <button onClick={handleJournalPanelSave} style={{ 
                fontFamily: 'Courier New',
                fontWeight: 700,
                fontSize: 17,
                borderRadius: 4,
                padding: '8px 28px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: CRT_GREEN, 
                color: 'black', 
                border: `2px solid ${CRT_GREEN}` 
              }}>
                Save Journal
              </button>
            </div>
          </div>
        </>
      )}
 
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          width: 420,
          gap: 10,
          height: '32px'
        }}>
          <input
            type="text"
            value={bulkSymbols}
            onChange={e => setBulkSymbols(e.target.value)}
            placeholder="e.g. AAPL, MSFT, GOOGL, TSLA"
            style={{
              flex: 1,
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '14px',
              backgroundColor: 'black',
              border: `1px solid ${CRT_GREEN}`,
              color: CRT_GREEN,
              padding: '6px 12px',
              boxSizing: 'border-box',
              minWidth: 0,
              borderRadius: 0,
              height: '32px',
              maxHeight: '32px',
              minHeight: '32px',
              margin: 0,
              outline: 'none',
              lineHeight: '20px'
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleBulkAdd();
              }
            }}
          />
          <CustomButton
            onClick={handleBulkAdd}
            disabled={isLoading || !bulkSymbols.trim()}
            mobile={false}
            title="Add ticker(s)"
            style={{
              backgroundColor: isLoading ? "#666666" : CRT_GREEN,
              color: "black",
              opacity: isLoading ? 0.6 : 1,
              minWidth: 0,
              height: '32px',
              minHeight: '32px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 12px',
              borderRadius: 0
            }}
          >
            {isLoading ? "..." : "+++"}
          </CustomButton>
        </div>
      </div>
      </div>
    </div>
  );
};

export default UniverseScreenerPage; 