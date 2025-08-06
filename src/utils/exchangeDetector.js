// Exchange detector utility
const NASDAQ_SYMBOLS = new Set();
const NYSE_SYMBOLS = new Set();

// Load NASDAQ symbols from official source (disabled due to CORS issues)
async function loadNasdaqSymbols() {
  try {
    // Disabled due to CORS issues - using fallback symbols instead
    console.log('📊 NASDAQ symbol loading disabled (CORS issues) - using fallback');
    
    // Add common NASDAQ symbols as fallback
    const nasdaqList = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'ADBE',
      'CRM', 'PYPL', 'INTC', 'AMD', 'QCOM', 'AVGO', 'TXN', 'MU', 'AMAT', 'KLAC',
      'LRCX', 'ASML', 'TSM', 'NVDA', 'AMD', 'INTC', 'QCOM', 'AVGO', 'TXN', 'MU',
      'AMAT', 'KLAC', 'LRCX', 'ASML', 'TSM', 'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN',
      'TSLA', 'META', 'NVDA', 'NFLX', 'ADBE', 'CRM', 'PYPL', 'INTC', 'AMD', 'QCOM'
    ];
    
    nasdaqList.forEach(symbol => NASDAQ_SYMBOLS.add(symbol));
    console.log(`📊 Loaded ${NASDAQ_SYMBOLS.size} NASDAQ symbols from fallback list`);
  } catch (error) {
    console.warn('⚠️ Error loading NASDAQ symbols:', error);
  }
}

// Load NYSE symbols from official JSON file
async function loadNyseSymbols() {
  try {
    // Skip fetching non-existent file and go straight to fallback
    console.log('📊 NYSE symbol loading disabled (file not found) - using fallback');
    
    // Fallback to curated list since the JSON file doesn't exist
    const nyseList = [
      'SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'GLD', 'SLV', 'USO', 
      'TLT', 'TBT', 'TMF', 'TMV', 'UVXY', 'VXX', 'XLE', 'XLF', 'XLK', 'XLV', 'XLI', 
      'XLP', 'XLY', 'XLU', 'XLB', 'XLC', 'XBI', 'IBB', 'SOXL', 'SOXS', 'TQQQ', 'SQQQ', 
      'LABU', 'LABD', 'DPST', 'WDRN', 'JNUG', 'JDST', 'NUGT', 'DUST', 'YANG', 'YINN', 
      'ERX', 'ERY', 'FAS', 'FAZ', 'TNA', 'TZA', 'UPRO', 'SPXU', 'UDOW', 'SDOW', 
      'UMDD', 'SMDD', 'URTY', 'SRTY', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'AIG',
      'GE', 'XOM', 'CVX', 'KO', 'PEP', 'WMT', 'HD', 'MCD', 'DIS', 'NKE', 'BA', 'CAT',
      'MMM', 'IBM', 'INTC', 'CSCO', 'ORCL', 'VZ', 'T', 'ATT', 'CMCSA', 'CMCSK'
    ];
    
    nyseList.forEach(symbol => NYSE_SYMBOLS.add(symbol));
    console.log(`📊 Loaded ${NYSE_SYMBOLS.size} NYSE symbols from fallback list`);
  } catch (error) {
    console.warn('⚠️ Error loading NYSE symbols:', error);
  }
}

// Initialize symbol lists
let symbolsLoaded = false;

async function initializeSymbols() {
  if (symbolsLoaded) return;
  
  await loadNasdaqSymbols();
  await loadNyseSymbols();
  symbolsLoaded = true;
}

export async function getExchangeForSymbol(symbol) {
  if (!symbol) return 'NASDAQ'; // Default fallback
  
  // Initialize symbols if not loaded
  await initializeSymbols();
  
  const symbolUpper = symbol.toUpperCase();
  
  // Check official NASDAQ list first
  if (NASDAQ_SYMBOLS.has(symbolUpper)) {
    return 'NASDAQ';
  }
  
  // Check NYSE list
  if (NYSE_SYMBOLS.has(symbolUpper)) {
    return 'NYSE';
  }
  
  // Fallback to API-based detection
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbolUpper}`);
    
    if (!response.ok) {
      console.warn(`⚠️ Could not fetch exchange info for ${symbol}, using pattern detection`);
      return determineExchangeByPattern(symbolUpper);
    }
    
    const data = await response.json();
    
    // Check if the symbol exists and has exchange info
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      
      // Get exchange from meta data
      if (result.meta && result.meta.exchangeName) {
        const exchangeName = result.meta.exchangeName.toUpperCase();
        
        // Map exchange names to our format
        if (exchangeName.includes('NASDAQ')) {
          return 'NASDAQ';
        } else if (exchangeName.includes('NYSE') || exchangeName.includes('NEW YORK')) {
          return 'NYSE';
        } else if (exchangeName.includes('AMEX') || exchangeName.includes('ARCA')) {
          return 'AMEX';
        } else {
          // For other exchanges, try pattern detection
          return determineExchangeByPattern(symbolUpper);
        }
      }
    }
    
    // Fallback to pattern detection
    return determineExchangeByPattern(symbolUpper);
    
  } catch (error) {
    console.warn(`⚠️ Error fetching exchange info for ${symbol}:`, error);
    return determineExchangeByPattern(symbolUpper);
  }
}

// Pattern-based detection as fallback
function determineExchangeByPattern(symbol) {
  // Symbol pattern detection
  // 4-5 letter symbols are often NASDAQ
  if (symbol.length >= 4 && symbol.length <= 5) {
    return 'NASDAQ';
  }
  // 3 letter symbols are often NYSE
  if (symbol.length === 3) {
    return 'NYSE';
  }
  // Default to NASDAQ for unknown symbols
  return 'NASDAQ';
}

// Cached exchange lookup to avoid repeated API calls
const exchangeCache = new Map();

export async function getCachedExchange(symbol) {
  const symbolUpper = symbol.toUpperCase();
  
  // Check cache first
  if (exchangeCache.has(symbolUpper)) {
    return exchangeCache.get(symbolUpper);
  }
  
  // Fetch exchange info
  const exchange = await getExchangeForSymbol(symbolUpper);
  
  // Cache the result
  exchangeCache.set(symbolUpper, exchange);
  
  return exchange;
}

// Preload symbols on module load
initializeSymbols(); 