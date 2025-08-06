# Finviz Integration

This document explains how the Finviz CSV API integration works in the Burnlist application.

## Overview

The application now uses Finviz's CSV export API instead of Finhub for fetching stock data. This provides more comprehensive historical data and better reliability.

## Architecture

### Components

1. **Finviz API Server** (`finviz-api-server.cjs`)
   - Runs on `http://localhost:3001`
   - Fetches CSV data from Finviz's elite API
   - Converts CSV to JSON format
   - Handles authentication with Finviz token

2. **Finviz Adapter** (`src/data/finvizAdapter.js`)
   - Replaces the old Finhub adapter
   - Fetches data from the local Finviz API server
   - Converts Finviz data format to the application's internal format
   - Handles error cases and data validation

3. **Updated Fetch Manager** (`src/data/fetchManager.js`)
   - Now imports from `finvizAdapter` instead of `finhubAdapter`
   - Maintains the same rate limiting and batch processing logic
   - Compatible with the new data format

## Setup

### Prerequisites

- Node.js installed
- Finviz Elite API token (configured in `finviz-api-server.cjs`)

### Starting the Application

Use the new startup script that runs both servers:

```bash
./start-with-finviz.sh
```

This script will:
1. Start the Finviz API server on port 3001
2. Build the React application
3. Start the app server on port 5175
4. Open the browser automatically

### Manual Setup

If you prefer to run servers manually:

1. Start the Finviz API server:
   ```bash
   node finviz-api-server.cjs
   ```

2. Start the React app:
   ```bash
   npm run build
   npx serve dist -p 5175
   ```

## Data Format

### Finviz CSV Format
The Finviz API returns CSV data with columns:
- `Date`: Date in MM/DD/YYYY format
- `Open`, `High`, `Low`, `Close`: Price data
- `Volume`: Trading volume

### Internal Format
The adapter converts this to the application's internal format:
```javascript
{
  symbol: "AAPL",
  buyPrice: 150.25,
  buyDate: "2025-01-27T10:30:00.000Z",
  historicalData: [
    {
      price: 150.25,
      timestamp: "2025-01-27T10:30:00.000Z"
    }
    // ... full historical data from CSV
  ]
}
```

**Important**: The system now **accumulates all historical CSV data** for each ticker, building comprehensive price histories over time. Data points before the buy date are filtered out but the full historical dataset is preserved.

## Buy Price and Buy Date Logic

The system now properly handles buy prices and dates:

### **When adding a ticker (first time only):**
- **No custom price/date**: Uses current market price and date as buy price/date
- **Custom price/date provided**: Uses your manually entered price and date
- **Fixed forever**: Once set, the buy price and date never change during refreshes

### **Buy Price Logic:**
1. If you enter a custom buy price → Uses your price (fixed forever)
2. If no custom price → Uses current market price as buy price (fixed forever)
3. During refreshes → Buy price stays the same, only current price updates
4. Shows return calculation: (Current Price - Buy Price) / Buy Price

### **Buy Date Logic:**
1. If you enter a custom buy date → Uses your date (fixed forever)
2. If no custom date → Uses current market date as buy date (fixed forever)
3. During refreshes → Buy date stays the same, only current data updates
4. Shows time period since your buy date

### **Refresh Behavior:**
- **Buy Price**: Never changes during refreshes (stays at original purchase price)
- **Buy Date**: Never changes during refreshes (stays at original purchase date)
- **Current Price**: Updates with latest market data
- **Historical Data**: Appends new data points (never replaces existing data)
- **Data Filtering**: Automatically removes any data points before the buy date
- **Return Calculation**: Always uses original buy price vs current price

### **Chart and Header Display:**
- **Custom Buy Price/Date**: Automatically reflected in header and chart
- **2-Point Data**: When custom price/date provided, creates 2 data points for charting
- **Chart Normalization**: Automatically handles 2 data points to create proper graphs
- **Header Calculations**: Shows return percentage based on custom buy price vs current price
- **Visual Feedback**: Chart displays the price movement from your buy point to current price
- **Timeframe Support**: Charts work on all timeframes (D, W, M, Y, YTD, MAX)
- **Real-time Updates**: Header return updates immediately when you edit buy prices

### **Data Accumulation:**
- **Full Historical Data**: Accumulates all CSV data for each ticker
- **Smart Merging**: New data is merged with existing data, removing duplicates
- **Build Over Time**: Historical data grows with each successful refresh
- **Clean Data**: Automatically filters out any data points before the buy date
- **Efficient Storage**: Stores comprehensive price history for instant access
- **Offline Capability**: Historical data persists locally between sessions

## API Endpoints

### Finviz API Server
- `GET /api/finviz-quote?ticker=AAPL&timeframe=d`
  - Returns historical data for a ticker
  - `timeframe` can be: `d` (daily), `w` (weekly), `m` (monthly)

### Application
- The main app runs on `http://localhost:5175`
- All existing functionality remains the same
- Data is now sourced from Finviz instead of Finhub

## Benefits

1. **More Data**: Finviz provides comprehensive historical data
2. **Better Reliability**: Finviz's API is more stable than Finhub
3. **Unlimited Requests**: No rate limiting - fetch data whenever you want
4. **Market Status Reminder**: Still shows market closed notification as a reminder
5. **CSV Format**: More standardized data format
6. **Elite Features**: Access to Finviz's premium data

## Troubleshooting

### API Server Not Starting
- Check if port 3001 is available
- Verify Node.js is installed
- Check the Finviz API token in `finviz-api-server.cjs`

### No Data Loading
- Ensure the Finviz API server is running
- Check browser console for CORS errors
- Verify the ticker symbol is valid

### Build Errors
- Make sure all dependencies are installed: `npm install`
- Check that the import paths are correct in the adapter files

## Migration from Finhub

The migration is seamless:
1. All existing data remains intact
2. New data will be fetched from Finviz
3. The UI and functionality remain unchanged
4. Historical data will be more comprehensive

## Unlimited Requests

The application now supports unlimited API requests:
- No rate limiting on API calls
- No delays between requests
- Larger batch sizes (100 instead of 60)
- Market closed notification still works as a reminder
- You can refresh data as frequently as needed

## Data Processing

The system now accumulates and processes comprehensive CSV data:
- **Full Historical Data**: Uses all data points from the CSV file
- **Smart Merging**: Merges new data with existing data, removing duplicates
- **Better Charts**: More comprehensive data for chart visualization
- **Instant Access**: Historical data is stored locally for quick lookups
- **Data Validation**: Ensures all data points are valid before processing
- **Offline Capability**: Historical data persists between sessions

## Configuration

### Finviz API Token
Update the token in `finviz-api-server.cjs`:
```javascript
const FINVIZ_API_TOKEN = 'your-token-here';
```

### Server Ports
- Finviz API: Port 3001 (configurable in `finviz-api-server.cjs`)
- App Server: Port 5175 (configurable in startup scripts)

## Development

### Adding New Features
- Modify `finvizAdapter.js` for data processing changes
- Update `finviz-api-server.cjs` for API endpoint changes
- The fetch manager handles the rest automatically

### Testing
- Test the API server: `curl "http://localhost:3001/api/finviz-quote?ticker=AAPL"`
- Test the app: Build and run with `./start-with-finviz.sh`
- Check browser console for any errors 