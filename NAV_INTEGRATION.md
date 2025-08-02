# ETF-Style NAV Performance Tracking

This document describes the new ETF-style NAV (Net Asset Value) performance tracking system implemented in Burnlist.

## Overview

The NAV calculator simulates true ETF-style NAV performance tracking where:
- NAV starts at 0% return (baseline)
- Each chart data point represents the average % return across all tickers with valid data
- Returns are calculated using the formula: `(currentPrice - buyPrice) / buyPrice`
- All tickers are equally weighted in the calculation

## Dynamic Buy Price Calculation

The buy price is dynamic based on the selected timeframe:

| Timeframe | Buy Price Source |
|-----------|------------------|
| D (Daily) | Price from exactly 24 hours ago |
| W (Week) | Price from 7 trading days ago |
| M (Month) | Price from 30 trading days ago |
| YTD | Closing price on Jan 1 (or earliest available thereafter) |
| MAX | Actual buy price stored in watchlist (price when added or manually edited) |

## Sampling Rules

Each timeframe follows strict sampling rules:

| Timeframe | Sampling Rule |
|-----------|---------------|
| D | One point every 3 minutes during NYC extended hours (04:00-20:00 EST) |
| W | 3 points per trading day (open, mid, close) over last 7 market days |
| M | 2 points per day over 30 trading days (open and close) |
| YTD | One point per trading day |
| MAX | One point per trading day |

## Implementation Details

### Files Modified

1. **`src/data/navCalculator.js`** - New NAV calculation engine
2. **`src/components/WatchlistChart.jsx`** - Updated to use NAV calculator

### Key Features

- **Dynamic Buy Prices**: Calculates appropriate buy prices based on timeframe
- **Trading Day Awareness**: Excludes weekends from calculations
- **NYC Trading Hours**: Respects market hours for daily sampling
- **Equal Weighting**: All tickers contribute equally to NAV calculation
- **Baseline Start**: First data point always shows 0% return

### Usage

The NAV calculator is automatically used by the `WatchlistChart` component when:
- No watchlist-specific chart data is available
- Portfolio data contains historical data arrays

### Example

For a watchlist with AAPL and MSFT:

```
AAPL: Buy Price $150, Current Price $160 → +6.67% return
MSFT: Buy Price $300, Current Price $320 → +6.67% return

NAV = (6.67% + 6.67%) / 2 = 6.67%
```

## Benefits

1. **True ETF Simulation**: Mimics how real ETFs track performance
2. **Intent-Driven**: Reflects the actual performance of the watchlist as a single entity
3. **Consistent Baseline**: Always starts at 0% for clear performance tracking
4. **Dynamic Timeframes**: Adapts buy prices based on selected timeframe
5. **Market-Aware Sampling**: Respects trading hours and market days

## Technical Notes

- Uses existing `historicalData[]` arrays - no changes to API fetching
- Maintains backward compatibility with existing chart data
- Implements proper trading day calculations (excludes weekends)
- Handles timezone considerations for NYC trading hours
- Provides detailed logging for debugging

## Testing

A test page (`test-nav.html`) is available to verify NAV calculations work correctly with sample data. 