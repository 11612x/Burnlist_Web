// Finviz Elite Proxy Server
// Configured for your Elite subscription

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3001;

// Default Finviz Elite API key (fallback)
const DEFAULT_FINVIZ_API_KEY = 'f6202a40-4a7c-4d91-9ef8-068795ffbac0';

// Enable CORS for your frontend
app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5173'], // Multiple possible frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware to parse JSON
app.use(express.json());

// Proxy endpoint for Finviz Elite URLs
app.get('/api/finviz-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || !url.includes('finviz.com')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    console.log(`Fetching data from: ${url}`);

    // Extract API key from URL or use default
    let apiKey = DEFAULT_FINVIZ_API_KEY;
    const authMatch = url.match(/[?&]auth=([^&]*)/);
    if (authMatch) {
      apiKey = authMatch[1];
      console.log('Using API key from URL');
    }
    
    // Transform URL to use auth parameter instead of ft
    let transformedUrl = url;
    if (url.includes('elite.finviz.com') && url.includes('ft=')) {
      transformedUrl = url.replace(/&ft=[^&]*/, `&auth=${apiKey}`);
      console.log(`Transformed URL: ${transformedUrl}`);
    } else if (url.includes('elite.finviz.com') && !url.includes('auth=')) {
      // If it's an Elite URL without auth parameter, add it
      const separator = url.includes('?') ? '&' : '?';
      transformedUrl = url + separator + `auth=${apiKey}`;
      console.log(`Added auth parameter: ${transformedUrl}`);
    }

    // Use API key authentication for Elite URLs
    const response = await axios.get(transformedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://elite.finviz.com/',
        'Origin': 'https://elite.finviz.com'
      },
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accept redirects
      }
    });

    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, response.headers);

    // Check if we got CSV data
    const contentType = response.headers['content-type'] || '';
    console.log('Content-Type:', contentType);
    console.log('Response data length:', response.data.length);
    console.log('First 100 chars:', response.data.substring(0, 100));
    
    // If we got a successful response, return the data
    if (response.status >= 200 && response.status < 300) {
      res.setHeader('Content-Type', 'text/csv');
      res.send(response.data);
    } else {
      // If we got HTML instead of CSV, it might be a login page
      console.log('Received HTML instead of CSV, might need authentication');
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'Received HTML response instead of CSV data. Please check your Elite credentials.'
      });
    }
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch data from Finviz Elite',
      details: error.message,
      status: error.response?.status
    });
  }
});

// Test endpoint to verify your Elite access
app.get('/api/test-elite', async (req, res) => {
  try {
    const testUrl = `https://elite.finviz.com/export.ashx?v=111&f=cap_smallover&auth=${FINVIZ_API_KEY}`;
    
    const response = await axios.get(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://elite.finviz.com/',
        'Origin': 'https://elite.finviz.com'
      },
      timeout: 10000,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });
    
    res.json({ 
      status: 'success', 
      message: 'Elite access is working',
      responseStatus: response.status,
      dataLength: response.data.length
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Elite access test failed',
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    apiKey: FINVIZ_API_KEY ? 'Configured' : 'Missing'
  });
});

app.listen(PORT, () => {
  console.log(`Finviz Elite proxy server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test API key: http://localhost:${PORT}/api/test-elite`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/api/finviz-proxy?url=YOUR_ELITE_URL`);
});

/*
To use this proxy:

1. Install dependencies:
   npm install express cors axios

2. Start the server:
   node finviz-proxy-server.js

3. Test your API key:
   curl http://localhost:3001/api/test-elite

4. Use in your frontend:
   const response = await fetch(`http://localhost:3001/api/finviz-proxy?url=${encodeURIComponent(apiLink)}`);

Example Elite URL format:
https://elite.finviz.com/export.ashx?v=111&f=cap_smallover,sh_avgvol_o500,sh_price_o7,sh_relvol_o1.5,ta_pattern_channelup2|channelup|wedgeresistance|wedgeup,ta_perf_5to-1w,ta_rsi_55to70&ft=4

The 'ft=4' parameter appears to be your session token.
*/ 