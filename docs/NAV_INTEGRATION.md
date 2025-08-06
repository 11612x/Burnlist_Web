# NAV Calculation - Real Timestamp Integration

## Overview

The NAV (Net Asset Value) calculation has been significantly improved to use real market data timestamps instead of artificial timestamp generation. This ensures more accurate and reliable NAV calculations that align with actual market behavior.

## Key Improvements

### 1. Real Timestamp Extraction

**Before**: Used `generateFiveMinuteTimestamps()` to create artificial timestamps at fixed 5-minute intervals, regardless of actual market data availability.

**After**: Uses `extractRealTimestamps()` to derive NAV timestamps from the actual historical data arrays of tickers in the watchlist.

### 2. Coverage-Based Timestamp Selection

The new approach implements intelligent timestamp selection:

- **Intersection Approach**: Only calculates NAV at timestamps where all tickers have price data
- **Union with Coverage Filter**: Uses timestamps that appear in ≥80% of tickers (configurable via `MIN_TIMESTAMP_COVERAGE`)
- **Quality Thresholds**: Ensures sufficient data quality for reliable NAV calculation

### 3. Market-Aware Fallback Logic

Enhanced fallback strategies when insufficient data is available:

- **Market Status Awareness**: Different strategies for open/closed/pre-market hours
- **Confidence Scoring**: Each NAV point includes a confidence score based on data quality
- **Anomaly Detection**: Identifies statistical anomalies in NAV calculations

## Technical Implementation

### Core Functions

#### `extractRealTimestamps(portfolioData, timeframe)`

Extracts real timestamps from ticker historical data:

1. **Collect All Timestamps**: Gathers all timestamps from all tickers' historical data
2. **Apply Timeframe Filter**: Filters timestamps based on selected timeframe (D, W, M, YTD, MAX)
3. **Coverage Analysis**: Identifies timestamps with sufficient ticker coverage (≥80% by default)
4. **Deduplication**: Removes duplicates and ensures reasonable gaps between timestamps

#### `filterTimestampsByTimeframe(timestamps, timeframe)`

Applies timeframe-specific filtering:

- **D (Day)**: Last 24 hours
- **W (Week)**: Last 7 days  
- **M (Month)**: Last 30 days
- **YTD**: Year to date
- **MAX**: All available data (no filtering)

#### `deduplicateAndSortTimestamps(timestamps)`

Ensures clean timestamp series:

- Sorts timestamps chronologically
- Removes duplicates
- Enforces minimum gap between timestamps (15 minutes by default)
- Maintains data quality standards

### Configuration Parameters

```javascript
// Real timestamp extraction settings
this.MIN_TIMESTAMP_COVERAGE = 0.8; // 80% of tickers must have data
this.MAX_TIMESTAMP_GAP = 15; // Maximum gap in minutes between timestamps
this.TIMESTAMP_TOLERANCE = 5; // ±5 minutes tolerance for data matching
```

## Benefits

### 1. Accuracy Improvement

- **Real Market Data**: NAV calculations now use actual market-observed price points
- **No Artificial Sampling**: Eliminates synthetic timestamp artifacts
- **Data-Driven**: Timestamps are derived from actual data availability

### 2. Performance Enhancement

- **Reduced Calculations**: Only calculates NAV at timestamps with sufficient data
- **Efficient Processing**: Avoids unnecessary calculations at artificial intervals
- **Quality Filtering**: Focuses computational resources on high-quality data points

### 3. Reliability Gains

- **Coverage Validation**: Ensures NAV calculations have sufficient ticker coverage
- **Confidence Scoring**: Each NAV point includes reliability metrics
- **Anomaly Detection**: Identifies and flags suspicious NAV calculations

## Usage

The NAV calculator now uses a simple, clean approach:

```javascript
import simpleNavCalculator from './src/data/simpleNavCalculator.js';

// Calculate NAV performance using simple averaging
const navData = simpleNavCalculator.calculateSimpleNAV(portfolioData);

// Each NAV point includes:
// - timestamp: Formatted timestamp
// - returnPercent: Average return percentage
// - etfPrice: Average price of all tickers
// - validTickers: Number of valid tickers
// - totalTickers: Total number of tickers
```

## Testing

The simple NAV calculator provides clean, synchronized averaging:

- **Simple Averaging**: Calculates average % return of all tickers at each timestamp
- **No Sophisticated Features**: No confidence scores, anomaly detection, or fallbacks
- **Clean Output**: Just timestamp and return percentage
- **Synchronized Data**: Uses all available timestamps from ticker data

## Migration Notes

### Breaking Changes

- NAV calculation now uses simple averaging instead of sophisticated features
- No confidence scores, anomaly detection, or market-aware fallbacks
- Clean, synchronized output focused on average returns

### Backward Compatibility

- Existing NAV calculation interface remains the same
- All existing timeframes (D, W, M, YTD, MAX) are supported
- Simple fallback logic ensures NAV calculation continues even with insufficient data

## Future Enhancements

1. **Performance Optimization**: Optimize for large ticker sets
2. **Data Validation**: Enhanced input validation and error handling
3. **Chart Integration**: Improved chart component integration
4. **Real-Time Updates**: Better real-time NAV update handling 