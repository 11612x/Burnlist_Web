import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// API Routes - handle all requests
app.use('/api', async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    
    // Twelve Data Historical Data
    if (pathname === '/twelvedata-historical') {
      const { symbol, start_date, interval = '1day' } = req.query;
      
      if (!symbol || !start_date) {
        return res.status(400).json({ error: 'symbol and start_date are required' });
      }
      
      const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '22f43f5ca678492daa17cb74b5bb2a77';
      const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&start_date=${start_date}&apikey=${TWELVE_DATA_API_KEY}`;
      
      console.log(`🔍 Fetching historical data for ${symbol} from ${start_date}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'error') {
        console.error(`❌ Twelve Data API error:`, data);
        return res.status(500).json({ 
          error: 'Twelve Data API error',
          details: data.message || 'Unknown error'
        });
      }
      
      console.log(`✅ Historical data fetched for ${symbol}: ${data.values?.length || 0} records`);
      
      const transformedData = {
        status: 'ok',
        historicalData: data.values?.map(item => ({
          price: parseFloat(item.close),
          close: parseFloat(item.close),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          timestamp: item.datetime,
          volume: parseInt(item.volume),
          symbol: symbol
        })) || []
      };
      
      res.json(transformedData);
      
    } 
    // Twelve Data Quote
    else if (pathname === '/twelvedata-quote') {
      const { symbols, interval = '1min' } = req.query;
      
      if (!symbols) {
        return res.status(400).json({ error: 'symbols is required' });
      }
      
      const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '22f43f5ca678492daa17cb74b5bb2a77';
      const url = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${TWELVE_DATA_API_KEY}`;
      
      console.log(`🔍 Fetching quote for ${symbols}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'error') {
        console.error(`❌ Twelve Data API error:`, data);
        return res.status(500).json({ 
          error: 'Twelve Data API error',
          details: data.message || 'Unknown error'
        });
      }
      
      console.log(`✅ Quote fetched for ${symbols}`);
      res.json(data);
      
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
    // Health check
    else if (pathname === '/health') {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'burnlist-api',
        endpoints: ['/twelvedata-historical', '/twelvedata-quote', '/finviz-quote', '/health']
      });
      
    } else {
      res.status(404).json({ 
        error: 'API endpoint not found',
        path: pathname,
        available: ['/twelvedata-historical', '/twelvedata-quote', '/finviz-quote', '/health']
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