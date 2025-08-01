const express = require('express');
const cors = require('cors');

// Twelve Data API configuration
const TWELVE_DATA_API_KEY = '22f43f5ca678492daa17cb74b5bb2a77';
const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

const app = express();

// Configure CORS for Render.com deployment
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://burnlist-frontend.onrender.com', 'http://localhost:5173']
    : true,
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

const PORT = process.env.PORT || 3002;

// Health check endpoint for Render.com
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper function to format date for Twelve Data API
function formatDateForAPI(date, interval = '1h') {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // For daily and weekly intervals, use date only (no time)
  if (interval === '1day' || interval === '1week') {
    return `${year}-${month}-${day}`;
  }
  
  // For hourly intervals, include time
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Convert Twelve Data datetime to ISO timestamp
function convertTwelveDataDateTime(datetime, timezone = 'America/New_York') {
  try {
    const date = new Date(datetime);
    return date.toISOString();
  } catch (error) {
    console.error('Error converting datetime:', error);
    return new Date().toISOString();
  }
}

// Parse Twelve Data batch response
function parseBatchResponse(batchData) {
  const results = [];
  
  // Handle single symbol response
  if (batchData.meta && batchData.values) {
    try {
      const { meta, values, status } = batchData;
      
      if (status !== 'ok' || !values || values.length === 0) {
        console.error(`Invalid response for ${meta.symbol}: status=${status}`);
        return results;
      }
      
      const latestData = values[0];
      const timestamp = convertTwelveDataDateTime(latestData.datetime, meta.exchange_timezone);
      
      results.push({
        symbol: meta.symbol,
        price: parseFloat(latestData.close),
        timestamp: timestamp,
        fetchTimestamp: new Date().toISOString(),
        volume: parseInt(latestData.volume),
        high: parseFloat(latestData.high),
        low: parseFloat(latestData.low),
        open: parseFloat(latestData.open),
        exchange: meta.exchange,
        currency: meta.currency,
        interval: meta.interval,
        type: meta.type,
        status: status
      });
    } catch (error) {
      console.error(`Error parsing single symbol data:`, error);
    }
    return results;
  }
  
  // Handle batch response (multiple symbols)
  for (const [symbol, symbolData] of Object.entries(batchData)) {
    try {
      const { meta, values, status } = symbolData;
      
      if (status !== 'ok' || !values || values.length === 0) {
        console.error(`Invalid response for ${symbol}: status=${status}`);
        continue;
      }
      
      const latestData = values[0];
      const timestamp = convertTwelveDataDateTime(latestData.datetime, meta.exchange_timezone);
      
      results.push({
        symbol: meta.symbol,
        price: parseFloat(latestData.close),
        timestamp: timestamp,
        fetchTimestamp: new Date().toISOString(),
        volume: parseInt(latestData.volume),
        high: parseFloat(latestData.high),
        low: parseFloat(latestData.low),
        open: parseFloat(latestData.open),
        exchange: meta.exchange,
        currency: meta.currency,
        interval: meta.interval,
        type: meta.type,
        status: status
      });
    } catch (error) {
      console.error(`Error parsing data for ${symbol}:`, error);
    }
  }
  
  return results;
}

app.get('/api/twelvedata-quote', async (req, res) => {
  const { symbols, interval = '1min' } = req.query;
  
  if (!symbols) {
    return res.status(400).json({ error: 'Symbols parameter is required' });
  }

  console.log(`🔍 API Request: ${symbols} (${interval})`);
  
  // Ensure symbols are comma-separated
  const symbolString = symbols.split(',').map(s => s.trim()).join(', ');
  const url = `${TWELVE_DATA_BASE_URL}/time_series?apikey=${TWELVE_DATA_API_KEY}&interval=${interval}&symbol=${symbolString}&outputsize=1&dp=2&format=JSON`;

  try {
    console.log(`🌐 Fetching from Twelve Data: ${url}`);
    const response = await fetch(url);
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`❌ Twelve Data API error: ${response.status} ${response.statusText}`);
      return res.status(500).json({ 
        error: 'Failed to fetch data from Twelve Data',
        symbols: symbols,
        status: response.status,
        statusText: response.statusText,
        url: url
      });
    }
    
    const data = await response.json();
    console.log(`📥 Raw response length: ${JSON.stringify(data).length} characters`);
    
    // Check for API errors
    if (data.status === 'error') {
      console.error(`❌ Twelve Data API error:`, data);
      return res.status(500).json({ 
        error: 'Twelve Data API error',
        symbols: symbols,
        details: data.message || 'Unknown error'
      });
    }
    
    // Parse batch response
    const results = parseBatchResponse(data);
    console.log(`✅ Parsed ${results.length} results for ${symbols}`);
    
    if (results.length === 0) {
      console.error(`❌ No results parsed for ${symbols}`);
      return res.status(500).json({ 
        error: 'No results found',
        symbols: symbols
      });
    }

    res.json(results);
  } catch (err) {
    console.error(`❌ API Error for ${symbols}:`, err);
    res.status(500).json({ 
      error: 'Server error', 
      symbols: symbols,
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Historical data endpoint for buy date changes
app.get('/api/twelvedata-historical', async (req, res) => {
  const { symbol, start_date, end_date, interval = '1h', outputsize } = req.query;
  
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter is required' });
  }

  if (!start_date) {
    return res.status(400).json({ error: 'Start date parameter is required' });
  }

  // Format end date (default to current date if not provided)
  let formattedEndDate;
  if (end_date) {
    formattedEndDate = formatDateForAPI(new Date(end_date), interval);
  } else {
    formattedEndDate = formatDateForAPI(new Date(), interval);
  }

  // Format start date
  const formattedStartDate = formatDateForAPI(new Date(start_date), interval);

  console.log(`📅 Historical API Request: ${symbol} from ${formattedStartDate} to ${formattedEndDate} (${interval}${outputsize ? `, outputsize: ${outputsize}` : ''})`);
  
  let url = `${TWELVE_DATA_BASE_URL}/time_series?apikey=${TWELVE_DATA_API_KEY}&interval=${interval}&symbol=${symbol}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&dp=2&format=JSON`;
  
  // Add outputsize parameter if provided
  if (outputsize && Number.isInteger(parseInt(outputsize)) && parseInt(outputsize) > 0) {
    url += `&outputsize=${outputsize}`;
  }

  try {
    console.log(`🌐 Fetching historical data from Twelve Data: ${url}`);
    const response = await fetch(url);
    
    console.log(`📊 Historical response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`❌ Twelve Data Historical API error: ${response.status} ${response.statusText}`);
      return res.status(500).json({ 
        error: 'Failed to fetch historical data from Twelve Data',
        symbol: symbol,
        status: response.status,
        statusText: response.statusText,
        url: url
      });
    }
    
    const data = await response.json();
    console.log(`📥 Historical raw response length: ${JSON.stringify(data).length} characters`);
    
    // Check for API errors
    if (data.status === 'error') {
      console.error(`❌ Twelve Data Historical API error:`, data);
      return res.status(500).json({ 
        error: 'Twelve Data API error',
        symbol: symbol,
        details: data.message || 'Unknown error'
      });
    }
    
    // Parse historical response
    const { meta, values, status } = data;
    
    if (status !== 'ok' || !values || values.length === 0) {
      console.error(`Invalid historical response for ${symbol}: status=${status}, values=${values?.length || 0}`);
      return res.status(500).json({ 
        error: 'No historical data found',
        symbol: symbol,
        status: status
      });
    }
    
    // Convert to our format (only close prices for historical data)
    const historicalData = values.map(item => ({
      price: parseFloat(item.close),
      timestamp: convertTwelveDataDateTime(item.datetime, meta.exchange_timezone),
      volume: parseInt(item.volume),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      open: parseFloat(item.open),
      datetime: item.datetime
    }));
    
    console.log(`✅ Historical data: ${historicalData.length} datapoints for ${symbol}`);
    
    res.json({
      symbol: symbol,
      historicalData: historicalData,
      meta: meta,
      status: status
    });
    
  } catch (err) {
    console.error(`❌ Historical API Error for ${symbol}:`, err);
    res.status(500).json({ 
      error: 'Server error', 
      symbol: symbol,
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Twelve Data API Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
}); 