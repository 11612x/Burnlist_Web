import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// API Routes - handle all requests
app.use('/api', async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    
    // Twelve Data Market Data (quotes + historical in one call)
    if (pathname === '/twelvedata-market-data') {
      const { symbols, start_date, end_date, interval = '1day', outputsize } = req.query;
      
      if (!symbols || !start_date) {
        return res.status(400).json({ error: 'symbols and start_date are required' });
      }
      
      const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '22f43f5ca678492daa17cb74b5bb2a77';
      
      // Convert ISO dates to Twelve Data format (YYYY-MM-DD HH:MM:SS)
      const formatDateForAPI = (isoDate) => {
        const date = new Date(isoDate);
        return date.toISOString().replace('T', ' ').replace('.000Z', '');
      };
      
      const startDateFormatted = formatDateForAPI(start_date);
      // Clean up symbols - remove spaces and ensure proper comma separation
      const cleanSymbols = symbols.replace(/\s+/g, '').replace(/,\s*/g, ',');
      let url = `https://api.twelvedata.com/time_series?symbol=${cleanSymbols}&interval=${interval}&start_date=${startDateFormatted}&apikey=${TWELVE_DATA_API_KEY}`;
      
      // Add end_date parameter if provided
      if (end_date) {
        const endDateFormatted = formatDateForAPI(end_date);
        url += `&end_date=${endDateFormatted}`;
      }
      
      // Add outputsize parameter if provided
      if (outputsize && Number.isInteger(parseInt(outputsize)) && parseInt(outputsize) > 0) {
        url += `&outputsize=${outputsize}`;
      }
      
      console.log(`🔍 Fetching market data for ${symbols} from ${start_date}${end_date ? ` to ${end_date}` : ''}`);
      console.log(`🔗 Generated URL: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'error') {
        console.error(`❌ Twelve Data API error:`, data);
        return res.status(500).json({ 
          error: 'Twelve Data API error',
          details: data.message || 'Unknown error'
        });
      }
      
      console.log(`✅ Market data fetched for ${symbols}: ${data.values?.length || Object.keys(data).length} records`);
      
      // Handle both single symbol (array format) and multiple symbols (object format)
      const quotes = {};
      const historical = {};
      
      if (Array.isArray(data.values)) {
        // Single symbol response - data.values is an array
        const symbol = symbols.split(',')[0];
        
        // Use first item (most recent) as quote
        if (data.values && data.values.length > 0) {
          const latestItem = data.values[0];
          quotes[symbol] = {
            price: parseFloat(latestItem.close),
            close: parseFloat(latestItem.close),
            open: parseFloat(latestItem.open),
            high: parseFloat(latestItem.high),
            low: parseFloat(latestItem.low),
            timestamp: latestItem.datetime,
            volume: parseInt(latestItem.volume),
            symbol: symbol
          };
        }
        
        // Add all items to historical data
        data.values?.forEach(item => {
          if (!historical[symbol]) {
            historical[symbol] = [];
          }
          historical[symbol].push({
            price: parseFloat(item.close),
            close: parseFloat(item.close),
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            timestamp: item.datetime,
            volume: parseInt(item.volume),
            symbol: symbol
          });
        });
      } else {
        // Multiple symbols response - data is an object with symbol keys
        Object.keys(data).forEach(symbol => {
          if (data[symbol] && data[symbol].values) {
            // Use first item (most recent) as quote
            if (data[symbol].values.length > 0) {
              const latestItem = data[symbol].values[0];
              quotes[symbol] = {
                price: parseFloat(latestItem.close),
                close: parseFloat(latestItem.close),
                open: parseFloat(latestItem.open),
                high: parseFloat(latestItem.high),
                low: parseFloat(latestItem.low),
                timestamp: latestItem.datetime,
                volume: parseInt(latestItem.volume),
                symbol: symbol
              };
            }
            
            // Add all items to historical data
            data[symbol].values.forEach(item => {
              if (!historical[symbol]) {
                historical[symbol] = [];
              }
              historical[symbol].push({
                price: parseFloat(item.close),
                close: parseFloat(item.close),
                open: parseFloat(item.open),
                high: parseFloat(item.high),
                low: parseFloat(item.low),
                timestamp: item.datetime,
                volume: parseInt(item.volume),
                symbol: symbol
              });
            });
          }
        });
      }
      
      const transformedData = {
        status: 'ok',
        quotes,
        historicalData: historical
      };
      
      res.json(transformedData);
      
    }
    // Twelve Data Historical Data
    else if (pathname === '/twelvedata-historical') {
      const { symbol, symbols, start_date, end_date, interval = '1day', outputsize } = req.query;
      
      // Support both single symbol and multiple symbols
      const symbolParam = symbols || symbol;
      
      if (!symbolParam || !start_date) {
        return res.status(400).json({ error: 'symbol/symbols and start_date are required' });
      }
      
      const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '22f43f5ca678492daa17cb74b5bb2a77';
      let url = `https://api.twelvedata.com/time_series?symbol=${symbolParam}&interval=${interval}&start_date=${start_date}&apikey=${TWELVE_DATA_API_KEY}`;
      
      // Add end_date parameter if provided
      if (end_date) {
        url += `&end_date=${end_date}`;
      }
      
      // Add outputsize parameter if provided
      if (outputsize && Number.isInteger(parseInt(outputsize)) && parseInt(outputsize) > 0) {
        url += `&outputsize=${outputsize}`;
      }
      
      console.log(`🔍 Fetching historical data for ${symbolParam} from ${start_date}${end_date ? ` to ${end_date}` : ''}`);
      console.log(`📅 Date debug - received start_date: ${start_date}, end_date: ${end_date || 'not provided'}, current time: ${new Date().toISOString()}`);
      
      // Check if the date is in the future and adjust if necessary
      const startDate = new Date(start_date);
      const now = new Date();
      
      if (startDate > now) {
        console.log(`⚠️  Warning: Start date ${start_date} is in the future, adjusting to 1 day ago`);
        const adjustedStartDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 1 day ago
        url = `https://api.twelvedata.com/time_series?symbol=${symbolParam}&interval=${interval}&start_date=${adjustedStartDate.toISOString()}&apikey=${TWELVE_DATA_API_KEY}`;
        console.log(`📅 Adjusted start_date to: ${adjustedStartDate.toISOString()}`);
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'error') {
        console.error(`❌ Twelve Data API error:`, data);
        return res.status(500).json({ 
          error: 'Twelve Data API error',
          details: data.message || 'Unknown error'
        });
      }
      
      console.log(`✅ Historical data fetched for ${symbolParam}: ${data.values?.length || 0} records`);
      console.log(`🔍 Raw Twelve Data response:`, JSON.stringify(data, null, 2));
      
      // Transform data to match expected format for static system
      const symbolsArray = symbolParam.split(',').map(s => s.trim());
      const transformedData = {};
      
      if (symbolsArray.length === 1) {
        // Single symbol - data.values is an array
        console.log(`🔍 Processing single symbol: ${symbolsArray[0]}`);
        console.log(`🔍 Data.values exists:`, !!data.values);
        console.log(`🔍 Data.values is array:`, Array.isArray(data.values));
        console.log(`🔍 Data.values length:`, data.values?.length);
        
        if (data.values && Array.isArray(data.values)) {
          transformedData[symbolsArray[0]] = {
            historicalData: data.values.map(item => ({
              price: parseFloat(item.close),
              close: parseFloat(item.close),
              open: parseFloat(item.open),
              high: parseFloat(item.high),
              low: parseFloat(item.low),
              timestamp: item.datetime,
              volume: parseInt(item.volume),
              symbol: symbolsArray[0]
            }))
          };
          console.log(`✅ Successfully transformed data for ${symbolsArray[0]}`);
        } else {
          console.log(`❌ No valid data.values for ${symbolsArray[0]}`);
        }
      } else {
        // Multiple symbols - data is an object with symbol keys
        symbolsArray.forEach(symbol => {
          if (data[symbol] && data[symbol].values) {
            transformedData[symbol] = {
              historicalData: data[symbol].values.map(item => ({
                price: parseFloat(item.close),
                close: parseFloat(item.close),
                open: parseFloat(item.open),
                high: parseFloat(item.high),
                low: parseFloat(item.low),
                timestamp: item.datetime,
                volume: parseInt(item.volume),
                symbol: symbol
              }))
            };
          }
        });
      }
      
      console.log(`🔍 Transformed data:`, JSON.stringify(transformedData, null, 2));
      console.log(`🔍 Final response being sent:`, JSON.stringify(transformedData, null, 2));
      res.json(transformedData);
      
    } 
    // Twelve Data Quote
    else if (pathname === '/twelvedata-quote') {
      const { symbols, interval = '1min' } = req.query;
      
      if (!symbols) {
        return res.status(400).json({ error: 'symbols is required' });
      }
      
      const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '22f43f5ca678492daa17cb74b5bb2a77';
      
      // Use historical data endpoint to get the most recent available price
      // This ensures we get the last closing price when markets are closed
      const url = `https://api.twelvedata.com/time_series?symbol=${symbols}&interval=1day&start_date=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&apikey=${TWELVE_DATA_API_KEY}`;
      
      console.log(`🔍 Fetching most recent price for ${symbols} using historical data`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'error') {
        console.error(`❌ Twelve Data API error:`, data);
        return res.status(500).json({ 
          error: 'Twelve Data API error',
          details: data.message || 'Unknown error'
        });
      }
      
      console.log(`✅ Most recent price fetched for ${symbols}`);
      
      // Transform historical data response to match expected quote format for static system
      const symbolsArray = symbols.split(',').map(s => s.trim());
      const transformedData = {};
      
      symbolsArray.forEach(symbol => {
        if (data.values && Array.isArray(data.values)) {
          // Single symbol response
          if (data.values.length > 0) {
            const latestData = data.values[0]; // Most recent data point
            transformedData[symbol] = {
              price: parseFloat(latestData.close || 0),
              close: parseFloat(latestData.close || 0),
              open: parseFloat(latestData.open || 0),
              high: parseFloat(latestData.high || 0),
              low: parseFloat(latestData.low || 0),
              timestamp: latestData.datetime,
              volume: parseInt(latestData.volume || 0),
              fetchTimestamp: new Date().toISOString()
            };
          }
        } else if (data[symbol] && data[symbol].values) {
          // Multiple symbols response
          if (data[symbol].values.length > 0) {
            const latestData = data[symbol].values[0]; // Most recent data point
            transformedData[symbol] = {
              price: parseFloat(latestData.close || 0),
              close: parseFloat(latestData.close || 0),
              open: parseFloat(latestData.open || 0),
              high: parseFloat(latestData.high || 0),
              low: parseFloat(latestData.low || 0),
              timestamp: latestData.datetime,
              volume: parseInt(latestData.volume || 0),
              fetchTimestamp: new Date().toISOString()
            };
          }
        }
      });
      
      res.json(transformedData);
      
    }
    // Finviz Quote
    else if (pathname === '/finviz-quote') {
      const { ticker, timeframe = 'd' } = req.query;
      if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
      }

      console.log(`🔍 API Request: ${ticker} (${timeframe})`);
      const FINVIZ_API_TOKEN = process.env.FINVIZ_API_TOKEN || '947b2097-7436-4e8d-bcd9-894fcdebb27b';
      const url = `https://elite.finviz.com/quote_export.ashx?t=${ticker}&p=${timeframe}&auth=${FINVIZ_API_TOKEN}`;

      try {
        console.log(`🌐 Fetching from Finviz: ${url}`);
        const response = await fetch(url);
        
        console.log(`📊 Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          console.error(`❌ Finviz API error for ${ticker}: ${response.status} ${response.statusText}`);
          return res.status(500).json({ 
            error: 'Failed to fetch data from Finviz',
            ticker: ticker,
            status: response.status,
            statusText: response.statusText,
            url: url
          });
        }
        
        const csvText = await response.text();
        console.log(`📈 Raw CSV length for ${ticker}: ${csvText.length} characters`);
        
        if (!csvText || csvText.trim().length === 0) {
          console.error(`❌ Empty CSV response for ${ticker}`);
          return res.status(500).json({ 
            error: 'Empty CSV response from Finviz',
            ticker: ticker
          });
        }
        
        if (csvText.includes('error') || csvText.includes('Error') || csvText.includes('not found')) {
          console.error(`❌ Error in CSV for ${ticker}:`, csvText.substring(0, 200));
          return res.status(500).json({ 
            error: 'Finviz returned error in CSV',
            ticker: ticker,
            details: csvText.substring(0, 200)
          });
        }

        const records = parse(csvText, {
          columns: true,
          skip_empty_lines: true,
        });

        console.log(`✅ Parsed ${records.length} records for ${ticker}`);
        
        if (records.length === 0) {
          console.error(`❌ No records parsed for ${ticker}`);
          return res.status(500).json({ 
            error: 'No records found in CSV',
            ticker: ticker,
            csvLength: csvText.length
          });
        }

        res.json(records);
        
      } catch (error) {
        console.error(`❌ Finviz API error for ${ticker}:`, error);
        res.status(500).json({ 
          error: 'Finviz API error',
          details: error.message,
          ticker: ticker
        });
      }
    }
    // Finviz Sector Data
    else if (pathname === '/finviz-sector') {
      try {
        const FINVIZ_API_TOKEN = process.env.FINVIZ_API_TOKEN || 'f6202a40-4a7c-4d91-9ef8-068795ffbac0';
        const url = `https://elite.finviz.com/grp_export.ashx?g=sector&v=140&auth=${FINVIZ_API_TOKEN}`;
        
        console.log(`🔍 Fetching sector data from Finviz: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`❌ Finviz sector API error: ${response.status} ${response.statusText}`);
          return res.status(response.status).json({ 
            error: 'Failed to fetch sector data from Finviz',
            status: response.status,
            statusText: response.statusText
          });
        }
        
        const csvText = await response.text();
        
        if (!csvText || csvText.trim().length === 0) {
          console.error(`❌ Empty CSV response from Finviz sector API`);
          return res.status(500).json({ 
            error: 'Empty CSV response from Finviz sector API'
          });
        }
        
        console.log(`✅ Sector data fetched from Finviz: ${csvText.length} characters`);
        
        // Set appropriate headers for CSV
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(csvText);
        
      } catch (error) {
        console.error(`❌ Finviz sector API error:`, error);
        res.status(500).json({ 
          error: 'Finviz sector API error',
          details: error.message
        });
      }
    }
    // Finviz Proxy for Screener
    else if (pathname === '/finviz-proxy') {
      const { url } = req.query;
      
      if (!url) {
        return res.status(400).json({ error: 'url parameter is required' });
      }

      try {
        console.log(`🔍 Proxy request for URL: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`❌ Proxy fetch failed: ${response.status} ${response.statusText}`);
          return res.status(response.status).json({ 
            error: 'Proxy fetch failed',
            status: response.status,
            statusText: response.statusText
          });
        }
        
        const csvText = await response.text();
        console.log(`✅ Proxy success: ${csvText.length} characters`);
        
        // Set appropriate headers for CSV
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(csvText);
        
      } catch (error) {
        console.error(`❌ Proxy error:`, error);
        res.status(500).json({ 
          error: 'Proxy error',
          details: error.message
        });
      }
    }

    // Health check
    else if (pathname === '/health') {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'burnlist-api',
        endpoints: ['/twelvedata-historical', '/twelvedata-quote', '/finviz-quote', '/finviz-sector', '/finviz-proxy', '/health']
      });
      
    } else {
      res.status(404).json({ 
        error: 'API endpoint not found',
        path: pathname,
        available: ['/twelvedata-historical', '/twelvedata-quote', '/finviz-quote', '/finviz-sector', '/finviz-proxy', '/health']
      });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'API server error', details: error.message });
  }
});

// Serve static files from the dist directory with aggressive cache busting
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: (req, res) => {
    // No cache for JS files to force updates
    if (req.path.endsWith('.js')) {
      return 0; // No cache for JS files
    }
    return '1h'; // 1 hour for other files
  },
  etag: false, // Disable etag for JS files
  lastModified: false // Disable lastModified for JS files
}));

// Add cache control headers for JS files
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Combined server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`);
  console.log(`🔗 API routes available at /api/*`);
});