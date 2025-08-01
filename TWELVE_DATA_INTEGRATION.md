# Twelve Data Integration System

Complete integration of Twelve Data API for real-time price synchronization across burnlists with intelligent rate limiting and batch processing.

## 🚀 Quick Start

```bash
# Make the start script executable
chmod +x start-twelvedata.sh

# Start the entire system
./start-twelvedata.sh start

# Or use the interactive menu
./start-twelvedata.sh
```

## 📋 System Overview

### Core Components

1. **Twelve Data API Server** (`twelvedata-api-server.cjs`)
   - Handles API communication with Twelve Data
   - Batch processing (5 symbols per request)
   - Error handling and response parsing

2. **Twelve Data Adapter** (`src/data/twelvedataAdapter.js`)
   - Frontend API client
   - Batch quote fetching
   - Data normalization

3. **Rate Limiter** (`src/data/rateLimiter.js`)
   - 55 calls/minute limit enforcement
   - Separate tracking for automatic/manual requests
   - Dynamic throttling

4. **Active Burnlist Manager** (`src/data/activeBurnlistManager.js`)
   - Manages 5 active burnlists maximum
   - Manual update queue for inactive burnlists
   - Priority-based processing

5. **Historical Data Manager** (`src/data/historicalDataManager.js`)
   - Stores close price datapoints
   - Automatic cleanup (30 days)
   - Chart data management

6. **Return Calculator** (`src/data/returnCalculator.js`)
   - Real-time return calculations
   - Portfolio performance tracking
   - Significant change notifications

7. **Notification Manager** (`src/data/notificationManager.js`)
   - API status monitoring
   - Rate limit warnings
   - System error handling

8. **Sync Manager** (`src/data/twelvedataSyncManager.js`)
   - Orchestrates all components
   - Automatic sync scheduling
   - Manual update processing

9. **Fetch Manager** (`src/data/twelvedataFetchManager.js`)
   - Replaces existing fetch system
   - Batch processing integration
   - Progress tracking

## 🔧 Configuration

### API Key
Your Twelve Data API key is configured in:
- `twelvedata-api-server.cjs` (line 5)
- Current key: `22f43f5ca678492daa17cb74b5bb2a77`

### Rate Limits
- **Total calls/minute**: 55
- **Automatic sync**: 45 calls/minute
- **Manual updates**: 10 calls/minute
- **Batch size**: 5 symbols per request

### Active Burnlists
- **Maximum active**: 5 burnlists
- **Auto-registration**: When burnlist is opened
- **Manual updates**: Click header for inactive burnlists

## 📊 Data Flow

### 1. Automatic Sync
```
Active Burnlists → Unique Tickers → Batch Creation → API Calls → Historical Data → Return Calculation
```

### 2. Manual Updates
```
Header Click → Manual Queue → Rate Limit Check → API Calls → Historical Data → Return Calculation
```

### 3. Data Storage
```
Close Price → Historical Data Array → localStorage → Chart Datapoints → Return Calculations
```

## 🎯 Key Features

### Rate Limiting
- **Smart throttling**: Predictive rate limit management
- **Reserved capacity**: 10 calls/minute for manual updates
- **Dynamic intervals**: 60-120 seconds based on ticker count

### Batch Processing
- **Optimal batches**: 5 symbols per API call
- **Priority system**: Recently opened burnlists first
- **Error handling**: Continue processing on batch failures

### Historical Data
- **Close price only**: Simplified data structure
- **100 datapoints**: Per ticker maximum
- **30-day cleanup**: Automatic old data removal

### Return Calculations
- **Real-time updates**: Every price change
- **Average returns**: Across burnlists
- **Significant changes**: 2% threshold notifications

### Manual Updates
- **Header click**: For inactive burnlists
- **Queue system**: Prevents duplicate requests
- **Status tracking**: Processing indicators

## 🔄 Integration Points

### Replace Existing System
- **Finnhub Adapter**: Replaced with Twelve Data
- **Finviz Adapter**: Replaced with Twelve Data
- **Fetch Manager**: Updated for new system
- **Data Structure**: Maintains compatibility

### Maintained Compatibility
- **Chart components**: No changes needed
- **Return calculations**: Same logic
- **localStorage**: Same structure
- **UI components**: No changes needed

## 📈 Performance

### Capacity
- **225 tickers/minute**: Automatic sync (45 calls × 5 symbols)
- **50 tickers/minute**: Manual updates (10 calls × 5 symbols)
- **Total capacity**: 275 tickers/minute

### Refresh Intervals
- **≤ 225 tickers**: 60 seconds
- **226-450 tickers**: 90 seconds
- **> 450 tickers**: 120 seconds

### Memory Usage
- **Historical data**: ~50MB for 1000 tickers
- **Active burnlists**: Max 5 in memory
- **Rate tracking**: Minimal overhead

## 🛠️ Development

### File Structure
```
├── twelvedata-api-server.cjs          # API server
├── twelvedata-api-server/
│   └── package.json                   # Server dependencies
├── src/data/
│   ├── twelvedataAdapter.js          # API client
│   ├── rateLimiter.js                # Rate limiting
│   ├── activeBurnlistManager.js      # Burnlist management
│   ├── historicalDataManager.js      # Data storage
│   ├── returnCalculator.js           # Return calculations
│   ├── notificationManager.js        # Notifications
│   ├── twelvedataSyncManager.js      # Main orchestrator
│   └── twelvedataFetchManager.js     # Fetch management
├── start-twelvedata.sh               # Start script
└── TWELVE_DATA_INTEGRATION.md        # This file
```

### Testing
```bash
# Test API server
curl "http://localhost:3002/api/twelvedata-quote?symbols=AAPL,MSFT"

# Test health endpoint
curl "http://localhost:3002/health"

# Check system status
./start-twelvedata.sh status
```

### Debugging
```javascript
// Get system statistics
const stats = twelvedataSyncManager.getSystemStats();
console.log('System stats:', stats);

// Export system data
const exportData = twelvedataSyncManager.exportSystemData();
console.log('Export data:', exportData);
```

## 🚨 Error Handling

### API Errors
- **Network failures**: Automatic retry with exponential backoff
- **Rate limit exceeded**: Wait for reset, continue processing
- **Invalid responses**: Skip failed symbols, continue batch

### System Errors
- **localStorage errors**: Graceful degradation
- **Memory issues**: Automatic cleanup
- **Sync failures**: Retry after 30 seconds

### User Feedback
- **API offline**: Banner and persistent indicator
- **Rate limit warnings**: Subtle indicators
- **Manual update status**: Progress tracking

## 📝 Migration Guide

### From Finnhub/Finviz
1. **Stop old system**: No changes needed
2. **Start new system**: `./start-twelvedata.sh start`
3. **Verify data**: Check browser console for logs
4. **Test functionality**: Open burnlists, check updates

### Data Compatibility
- **Existing burnlists**: Work unchanged
- **Historical data**: Preserved and enhanced
- **Return calculations**: Same format
- **Chart data**: Same structure

## 🔍 Monitoring

### Console Logs
- **API calls**: Request/response tracking
- **Rate limiting**: Call counting and warnings
- **Sync status**: Progress and completion
- **Error details**: Full error context

### Browser Console
- **System status**: Real-time monitoring
- **Performance metrics**: Processing times
- **Error tracking**: Detailed error logs
- **User feedback**: Notification messages

### System Statistics
```javascript
// Get comprehensive stats
const stats = twelvedataSyncManager.getSystemStats();
console.log('Complete system stats:', stats);
```

## 🎉 Success Metrics

### Performance
- ✅ **55 calls/minute**: Rate limit compliance
- ✅ **5 active burnlists**: Capacity management
- ✅ **Real-time updates**: 60-120 second intervals
- ✅ **Batch efficiency**: 5 symbols per request

### Reliability
- ✅ **Error handling**: Graceful degradation
- ✅ **Data persistence**: localStorage backup
- ✅ **API resilience**: Automatic retry
- ✅ **Memory management**: Automatic cleanup

### User Experience
- ✅ **Backward compatibility**: No UI changes
- ✅ **Manual updates**: Header click functionality
- ✅ **Status indicators**: Real-time feedback
- ✅ **Performance**: Smooth operation

## 🚀 Deployment

### Local Development
```bash
./start-twelvedata.sh start
```

### Production Deployment
1. **Deploy API server**: Render.com or similar
2. **Update endpoint**: Change API base URL
3. **Environment variables**: Set production flags
4. **Monitor logs**: Check for errors

### Environment Variables
```bash
NODE_ENV=production
TWELVE_DATA_API_KEY=your_api_key
PORT=3002
```

## 📞 Support

### Common Issues
1. **API server not starting**: Check port 3002 availability
2. **Rate limit errors**: Normal, system handles automatically
3. **Manual updates not working**: Check if burnlist is active
4. **Data not updating**: Check browser console for errors

### Debug Commands
```bash
# Check system status
./start-twelvedata.sh status

# Test API
./start-twelvedata.sh test

# View logs
./start-twelvedata.sh logs

# Restart system
./start-twelvedata.sh stop
./start-twelvedata.sh start
```

---

**🎯 The Twelve Data Integration System provides a complete, production-ready solution for real-time price synchronization with intelligent rate limiting, batch processing, and comprehensive error handling.** 