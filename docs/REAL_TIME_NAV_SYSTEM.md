# Real-time NAV System

## Overview

The real-time NAV system provides continuous, live updates to NAV calculations and chart displays, creating a passive ETF dashboard experience. The system aligns with exact 5-minute market intervals and provides immediate updates when individual tickers are updated.

## Key Features

### 1. Event-Driven Architecture
- **NAV Event Emitter**: Central event system that notifies components when NAV calculations complete
- **Real-time Updates**: Components automatically refresh when new NAV data arrives
- **Source Tracking**: Distinguishes between batch, real-time, and aligned updates

### 2. 5-Minute Market Alignment
- **Exact Boundary Alignment**: NAV calculations align with market 5-minute intervals (09:35, 09:40, etc.)
- **Smart Scheduling**: Delays fetch/start times to match market boundaries
- **Boundary Detection**: Identifies when system is near 5-minute boundaries

### 3. Real-time Status Display
- **Timestamp Indicators**: Shows last update time in chart header
- **Stale Data Detection**: Fades display when data is older than 5 minutes
- **Update Source Tracking**: Shows whether update was batch, real-time, or aligned

### 4. Reactive Updates
- **Single Ticker Updates**: NAV recalculates immediately when any ticker in cohort is updated
- **No Full Cycle Waiting**: Updates happen without waiting for complete sync cycles
- **Immediate Feedback**: Users see changes instantly

## System Components

### 1. NAV Event Emitter (`navEventEmitter.js`)
```javascript
// Subscribe to NAV updates
const unsubscribe = navEventEmitter.subscribe(watchlistSlug, (navData, metadata) => {
  // Handle NAV update
  console.log('NAV updated:', navData, metadata);
});

// Emit NAV update
navEventEmitter.emit(watchlistSlug, navData, 'realtime');
```

### 2. Real-time NAV Calculator (`realTimeNavCalculator.js`)
```javascript
// Start the system
realTimeNavCalculator.start();

// Queue aligned calculation
realTimeNavCalculator.queueAlignedCalculation(watchlistSlug, items, timeframe);

// Trigger immediate calculation
realTimeNavCalculator.triggerImmediateCalculation(watchlistSlug, items, timeframe);
```

### 3. Enhanced WatchlistChart Component
- **Real-time Subscription**: Automatically subscribes to NAV updates
- **Live Data Display**: Shows real-time NAV data with timestamp indicators
- **Stale Detection**: Fades display when data is older than 5 minutes

### 4. Real-time NAV Status Component
- **Status Display**: Shows last update time, next boundary, and update source
- **Color Coding**: Green for live, orange for aligned, red for stale
- **Boundary Countdown**: Shows time until next 5-minute boundary

## Integration Points

### 1. Batched Fetch Manager
```javascript
// Queue NAV calculation after price updates
realTimeNavCalculator.queueAlignedCalculation(burnlistSlug, items, 'MAX');

// Emit NAV update after batch calculation
navEventEmitter.emit(burnlistSlug, navData, 'batch');
```

### 2. Twelve Data Sync Manager
```javascript
// Trigger immediate calculation after ticker updates
await realTimeNavCalculator.triggerImmediateCalculation(burnlistSlug, items, 'MAX');
```

### 3. BurnPage Component
```javascript
// Subscribe to NAV updates
useEffect(() => {
  const unsubscribe = navEventEmitter.subscribe(slug, (navData, metadata) => {
    // Force chart re-render
    setWatchlist(prev => ({ ...prev, lastUpdate: metadata.timestamp }));
  });
  return unsubscribe;
}, [slug]);

// Trigger immediate calculation on manual refresh
await realTimeNavCalculator.triggerImmediateCalculation(slug, items, selectedTimeframe);
```

## Usage Examples

### 1. Basic Real-time NAV Display
```jsx
<WatchlistChart
  portfolioReturnData={items}
  watchlistSlug={slug}
  timeframe={timeframe}
  // Real-time updates automatically handled
/>
```

### 2. Status Display
```jsx
<RealTimeNavStatus 
  watchlistSlug={slug} 
  timeframe={timeframe} 
/>
```

### 3. Manual NAV Calculation
```javascript
// Trigger immediate calculation
await realTimeNavCalculator.triggerImmediateCalculation(slug, items, timeframe);
```

## Configuration

### 1. Alignment Settings
```javascript
// 5-minute intervals
updateInterval = 5 * 60 * 1000; // 5 minutes

// 30-second tolerance for boundary detection
alignmentTolerance = 30 * 1000; // 30 seconds
```

### 2. Stale Data Threshold
```javascript
// Data considered stale after 5 minutes
const fiveMinutes = 5 * 60 * 1000;
return (now - updateTime) > fiveMinutes;
```

### 3. Event Queue Processing
```javascript
// Process events asynchronously
async processQueue() {
  while (this.updateQueue.length > 0) {
    const event = this.updateQueue.shift();
    await this.notifyListeners(event);
  }
}
```

## Testing

### 1. Test Page
Open `tests/test-realtime-nav.html` to test:
- Event emitter functionality
- Real-time calculator operations
- 5-minute alignment logic
- Full system integration

### 2. Manual Testing
1. Add tickers to a watchlist
2. Observe real-time NAV updates in chart
3. Check status indicators for update timing
4. Verify 5-minute boundary alignment

## Performance Considerations

### 1. Event Queue Management
- Events are queued and processed asynchronously
- Prevents overwhelming the system with rapid updates
- Maintains order of updates

### 2. Component Optimization
- WatchlistChart uses memoization for performance
- Real-time updates only trigger when necessary
- Stale data detection prevents unnecessary re-renders

### 3. Memory Management
- Event listeners are properly cleaned up
- Unused subscriptions are automatically removed
- Chart data is limited to prevent memory issues

## Troubleshooting

### 1. No Real-time Updates
- Check if real-time NAV calculator is running
- Verify event emitter subscriptions
- Check console for error messages

### 2. Stale Data Indicators
- Data older than 5 minutes shows as stale
- Manual refresh can trigger immediate updates
- Check market hours for automatic updates

### 3. Alignment Issues
- System aligns to next 5-minute boundary
- Current time vs boundary time is logged
- Manual alignment possible if needed

## Future Enhancements

### 1. WebSocket Integration
- Real-time price streaming
- Instant NAV updates
- Reduced API calls

### 2. Advanced Alignment
- Market-specific intervals
- Custom alignment schedules
- Timezone handling

### 3. Enhanced Status Display
- More detailed update information
- Performance metrics
- System health indicators 