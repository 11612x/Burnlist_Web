# New Data Architecture: 5-Minute Aligned Historical Data with Advanced Reliability Layers

## Overview

Burnlist has been updated to use a comprehensive 5-minute aligned historical data architecture that ensures precise NAV calculations across all timeframes, with robust data validation, intelligent fallback behavior, and advanced quality scoring.

## Key Changes

### 1. Immediate 3-Year Historical Data Fetch

When a user adds a ticker, the system now immediately fetches 3 years of historical price data at 5-minute intervals, covering only active trading hours (9:30 AM - 4:00 PM ET, Mon-Fri).

**Files Modified:**
- `src/data/createTicker.js` - Updated to fetch comprehensive historical data
- `src/data/historicalDataFetcher.js` - New file for fetching and filtering historical data

### 2. 5-Minute Aligned Data Structure

All historical data is now stored in a single, sorted `historicalData[]` array with each entry formatted as:
```javascript
{
  timestamp: "2024-01-15T09:30:00.000Z",
  price: 150.25,
  symbol: "AAPL"
}
```

**Key Features:**
- All timestamps are aligned to 5-minute intervals (00, 05, 10, 15, etc.)
- Only trading hours data is included (no weekends or off-market times)
- Data is sorted chronologically
- No duplicate timestamps allowed

### 3. Advanced NAV Calculation with Reliability Layers

The NAV calculator now uses a simple, clean approach with synchronized averaging.

**Files Modified:**
- `src/data/simpleNavCalculator.js` - New simple NAV calculator
- `src/data/historicalDataFetcher.js` - Updated for simple data handling
- `src/components/WatchlistChart.jsx` - Updated to handle simple NAV data
- `src/pages/WatchlistPage.jsx` - Updated to use simple NAV calculator

**Key Functions:**
- `calculateSimpleNAV(portfolioData)` - Simple synchronized averaging
- `extractAllTimestamps(portfolioData)` - Gets all unique timestamps
- `calculateAverageReturn(items, timestamp)` - Calculates average return at timestamp
- `formatTimestamp(timestamp)` - Formats timestamp for display

### 4. Enhanced Data Management with Simple Logic

The historical data manager has been updated to work with the simple NAV calculator.

**Files Modified:**
- `src/data/historicalDataManager.js` - Updated for simple data handling
- `src/data/livePriceUpdater.js` - Updated for simple updates

**Key Features:**
- Simple synchronized averaging
- No sophisticated features (confidence scores, anomaly detection)
- Clean, predictable output
- Easy to understand and maintain

## Reliability Layers

### 1. Deferred Fallback Initialization

**Problem Solved**: No more flat lines at 0% when first valid NAV hasn't been established.

**Solution**: 
- `lastValidNAV` is not initialized as 0
- Fallback substitutions are deferred until first valid NAV is known
- Early timestamps are backfilled with first valid NAV value
- Bootstrapped points are flagged with `.bootstrapped = true`

```javascript
let firstValidNAV = null; // Track first valid NAV for bootstrapping
let lastValidNAV = null; // For fallback continuity (not initialized as 0)

// Post-process: backfill bootstrapped values for early timestamps
if (firstValidNAV !== null) {
  this.backfillBootstrappedValues(navDataPoints, firstValidNAV);
}
```

### 2. Adaptive Threshold Logic

**Problem Solved**: Inconsistent behavior based on watchlist size.

**Solution**: Adaptive thresholds based on watchlist size:
- **≤3 tickers**: Require all tickers (2-of-2, 3-of-3)
- **4-10 tickers**: Use majority logic (3-of-5, 5-of-8)
- **>10 tickers**: Use 70% threshold (7-of-10, 14-of-20)

```javascript
calculateAdaptiveThreshold(totalTickers) {
  if (totalTickers <= 3) {
    return Math.max(2, totalTickers);
  } else if (totalTickers <= 10) {
    return Math.ceil(totalTickers / 2);
  } else {
    return Math.max(2, Math.floor(totalTickers * this.MIN_DATA_COVERAGE));
  }
}
```

### 3. Smart Fallback Strategies

**Problem Solved**: Single fallback strategy not suitable for all scenarios.

**Solution**: Multiple fallback strategies with traceability:

1. **Bootstrapped**: Use first valid NAV for early points
2. **Carry Forward**: Use last valid NAV value
3. **Interpolated**: Calculate from surrounding valid points
4. **Default Zero**: Last resort fallback

```javascript
calculateSmartFallback(timestamp, lastValidNAV, firstValidNAV, navResult, pointIndex, allTimestamps) {
  // Strategy 1: Bootstrapped (use first valid NAV for early points)
  if (firstValidNAV !== null && lastValidNAV === null) {
    return { strategy: 'bootstrapped', bootstrapped: true };
  }
  
  // Strategy 2: Carry forward (use last valid NAV)
  if (lastValidNAV !== null) {
    return { strategy: 'carry_forward', bootstrapped: false };
  }
  
  // Strategy 3: Interpolated (if we have surrounding valid points)
  const interpolatedValue = this.calculateInterpolatedNAV(timestamp, pointIndex, allTimestamps);
  if (interpolatedValue !== null) {
    return { strategy: 'interpolated', bootstrapped: false };
  }
  
  // Strategy 4: Default to 0 (last resort)
  return { strategy: 'default_zero', bootstrapped: false };
}
```

### 4. Per-Ticker Data Quality Scoring

**Problem Solved**: No way to identify or exclude low-quality ticker data.

**Solution**: Comprehensive quality scoring system:

**Quality Factors:**
- **Gap Frequency**: Penalty for data gaps >10 minutes
- **Timestamp Precision**: Penalty for irregular 5-minute intervals
- **Volatility Outliers**: Penalty for price changes beyond 2 standard deviations
- **Data Freshness**: Bonus for recent data (within 24-48 hours)

```javascript
calculateTickerQualityScore(ticker) {
  let score = 1.0;
  
  // 1. Gap frequency penalty
  const gaps = this.calculateDataGaps(data);
  const gapPenalty = Math.min(0.3, gaps / data.length * 0.3);
  score -= gapPenalty;
  
  // 2. Timestamp precision penalty
  const precisionPenalty = this.calculateTimestampPrecisionPenalty(data);
  score -= precisionPenalty;
  
  // 3. Volatility outlier penalty
  const outlierPenalty = this.calculateVolatilityOutlierPenalty(data);
  score -= outlierPenalty;
  
  // 4. Data freshness bonus
  const freshnessBonus = this.calculateDataFreshnessBonus(data);
  score += freshnessBonus;
  
  return Math.max(0.0, Math.min(1.0, score));
}
```

**Quality Weighting**: Tickers with higher quality scores contribute more to NAV calculations.

## Data Validation and Quality Control

### Strict Data Filtering

The new NAV calculation implements strict data validation:

1. **±5 Minute Tolerance**: Only tickers with price data within ±5 minutes of the target timestamp are included
2. **Adaptive Coverage Threshold**: Minimum coverage varies by watchlist size
3. **Quality Score Threshold**: Tickers below minimum quality score are excluded
4. **No Stale Data**: Data outside the tolerance window is completely excluded
5. **Quality Tracking**: Each NAV point is tagged with comprehensive quality information

### Intelligent Fallback Behavior

When insufficient data is available:

1. **Deferred Fallback**: No fallback until first valid NAV is established
2. **Multiple Strategies**: Choose best fallback strategy based on context
3. **Quality Flags**: Fallback points are marked with strategy and reason
4. **Visual Indicators**: Different colors and line thickness for different quality levels
5. **Traceability**: Complete audit trail of fallback decisions

### NAV Data Structure

Each NAV data point now includes comprehensive quality information:

```javascript
{
  timestamp: 1642233600000,
  returnPercent: 2.45,
  valid: true,                    // true for calculated, false for fallback
  source: 'calculation',          // 'calculation', 'fallback', or 'legacy'
  dataCoverage: 0.85,            // Percentage of tickers with valid data
  validTickers: 17,              // Number of tickers contributing
  totalTickers: 20,              // Total tickers in watchlist
  reason: 'valid_calculation',   // Reason for validity or fallback
  bootstrapped: false,           // true if backfilled from first valid NAV
  fallbackStrategy: 'carry_forward' // Strategy used for fallback
}
```

## Configuration and Monitoring

### NAV Calculator Configuration

A new configuration component allows real-time adjustment of:

- **Fallback Strategy**: Choose between carry_forward, interpolated, or bootstrapped
- **Data Quality Scoring**: Enable/disable quality scoring
- **Quality Threshold**: Minimum quality score for ticker inclusion (0.0-1.0)
- **Coverage Threshold**: Minimum data coverage percentage (50%-90%)
- **Timestamp Tolerance**: Time window for finding price data (±1-10 minutes)

### Quality Monitoring

Enhanced monitoring provides:

- **Quality Percentage**: Percentage of valid vs fallback points
- **Data Coverage**: Average percentage of tickers contributing to each point
- **Fallback Strategies**: Breakdown of which strategies were used
- **Fallback Reasons**: Detailed breakdown of why fallbacks occurred
- **Adaptive Thresholds**: Shows current threshold based on watchlist size
- **Visual Indicators**: Color-coded quality levels (Excellent/Good/Fair/Poor)

## Data Flow

### Ticker Addition
1. User adds ticker (e.g., AAPL)
2. `createTicker()` calls `fetchThreeYearHistoricalData()`
3. System fetches 3 years of 5-minute data from API
4. Data is filtered for trading hours only
5. Ticker object created with comprehensive `historicalData[]` array
6. Data is validated for 5-minute spacing

### Live Price Updates
1. New price data received from API
2. `livePriceUpdater.addPriceUpdate()` aligns timestamp to 5-minute intervals
3. System checks for existing data within 5-minute tolerance
4. New data is merged or existing data is updated
5. `historicalData[]` array is re-sorted chronologically
6. Data integrity is validated

### NAV Calculation with Advanced Quality Control
1. User selects timeframe (D, W, M, YTD, MAX)
2. `generateFiveMinuteTimestamps()` creates real timestamps for timeframe
3. System scores data quality for each ticker
4. For each timestamp, system validates data quality:
   - Finds closest 5-minute data point for each ticker
   - Only includes tickers with data within ±5 minutes
   - Applies quality score weighting
   - Calculates adaptive coverage threshold
5. If coverage ≥ threshold: Calculate weighted average NAV
6. If coverage < threshold: Use smart fallback strategy
7. Post-process: Backfill bootstrapped values for early timestamps
8. Tag each point with comprehensive quality information

## Quality Monitoring and Visualization

### NAV Quality Monitor

Enhanced component tracks and displays:

- **Quality Percentage**: Percentage of valid vs fallback points
- **Data Coverage**: Average percentage of tickers contributing to each point
- **Fallback Strategies**: Detailed breakdown of which strategies were used
- **Fallback Reasons**: Detailed breakdown of why fallbacks occurred
- **Adaptive Thresholds**: Shows current threshold based on watchlist size
- **Bootstrapped Points**: Count of points backfilled from first valid NAV
- **Visual Indicators**: Color-coded quality levels (Excellent/Good/Fair/Poor)

### Chart Visualization

The NAV chart now includes advanced quality indicators:

- **Color Coding**: 
  - Green: Positive valid NAV
  - Red: Negative valid NAV  
  - Yellow: Fallback points
  - Orange: Bootstrapped points
- **Line Thickness**: 
  - Normal (2px): Valid points
  - Thicker (3px): Fallback points
  - Thickest (4px): Bootstrapped points
- **Tooltip Information**: Shows coverage percentage, ticker count, fallback reasons, and strategy
- **Quality Tracking**: Real-time monitoring of data quality

## Validation and Quality Control

### Data Integrity Checks
- 5-minute spacing validation
- Trading hours filtering
- Duplicate timestamp detection
- Data range validation (minimum 1 day of data)
- Adaptive coverage percentage validation
- Quality score validation
- Gap frequency analysis
- Volatility outlier detection

### Error Handling
- Intelligent fallback for insufficient data
- Quality tracking for transparency
- Comprehensive logging for debugging
- Data cleanup for stale entries
- Reason tracking for fallback analysis
- Strategy selection based on context

## Performance Improvements

### Memory Management
- Increased data retention (3 years vs 30 days)
- Efficient data structure (single array per ticker)
- Automatic cleanup of old data

### Calculation Efficiency
- Real timestamps eliminate artificial sampling
- Adaptive tolerance reduces unnecessary calculations
- Sorted data enables efficient binary search
- Quality validation prevents unreliable calculations
- Weighted averaging based on data quality

## Backward Compatibility

The new architecture maintains backward compatibility with existing watchlists while providing enhanced data quality and calculation accuracy.

## Testing and Validation

### Data Quality Metrics
- 5-minute alignment validation
- Trading hours compliance
- Data completeness checks
- NAV calculation accuracy
- Adaptive coverage percentage tracking
- Fallback reason analysis
- Quality score distribution
- Gap frequency analysis

### Performance Metrics
- Data fetch times
- NAV calculation speed
- Memory usage
- Update frequency
- Quality percentage tracking
- Fallback strategy distribution

## Future Enhancements

### Planned Improvements
- Real-time data streaming
- Advanced data compression
- Machine learning for data quality
- Enhanced visualization options
- Quality-based alerting system
- Statistical confidence intervals
- Advanced interpolation algorithms

### Scalability Considerations
- Database migration for large datasets
- Cloud storage integration
- Distributed processing capabilities
- API rate limit optimization

## Migration Guide

### For Existing Users
1. Existing watchlists will continue to work
2. New tickers will use the enhanced data architecture
3. Gradual migration of existing data is planned
4. No user action required
5. Quality monitoring will be available for new calculations
6. Configuration options available for advanced users

### For Developers
1. Update imports to use new data fetcher
2. Implement 5-minute alignment in custom components
3. Use new validation functions for data quality
4. Follow new error handling patterns
5. Integrate quality monitoring components
6. Configure fallback strategies as needed

## Conclusion

The new 5-minute aligned data architecture with advanced reliability layers provides Burnlist with a robust foundation for precise NAV calculations, improved data quality, and enhanced user experience. The system now operates on real market data timestamps with intelligent validation, ensuring accurate and reliable performance tracking across all timeframes while maintaining complete transparency about data quality through comprehensive monitoring and configurable fallback mechanisms. 