import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// API Routes - handle Twelve Data requests directly
app.use('/api', async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    
    if (pathname === '/twelvedata-historical') {
      // Handle historical data requests
      const { symbol, start_date, interval = '1day' } = req.query;
      
      if (!symbol || !start_date) {
        return res.status(400).json({ error: 'symbol and start_date are required' });
      }
      
      // Twelve Data API endpoint
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
      
      // Transform the response to match the frontend's expected format
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
      
    } else if (pathname === '/twelvedata-quote') {
      // Handle quote requests
      const { symbols, interval = '1min' } = req.query;
      
      if (!symbols) {
        return res.status(400).json({ error: 'symbols is required' });
      }
      
      // Twelve Data API endpoint for quotes
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
      
    } else if (pathname === '/health') {
      // Health check endpoint
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'burnlist-api'
      });
      
    } else {
      res.status(404).json({ 
        error: 'API endpoint not found',
        path: pathname,
        available: ['/twelvedata-historical', '/twelvedata-quote', '/health']
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