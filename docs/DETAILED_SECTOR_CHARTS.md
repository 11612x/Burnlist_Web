# Detailed Sector Charts Component

## Overview
The `DetailedSectorCharts` component provides enhanced sector performance visualization for the Market page. It fetches real-time sector data from Finviz Elite and displays it in both chart and table formats.

## Features

### Data Source
- Fetches CSV data from: `https://elite.finviz.com/grp_export.ashx?g=sector&v=140&auth=f6202a40-4a7c-4d91-9ef8-068795ffbac0`
- Parses the following columns: Name, Performance (Week), Performance (Month), Performance (Quarter), Performance (Year To Date)

### Chart Features
- **Horizontal Bar Charts**: Each performance metric gets its own chart
- **Auto-scaling**: X-axis bounds are calculated based on data min/max values
- **Clean rounding**: Axis bounds are rounded to nearest clean numbers (multiples of 5, 10, 25, 50, 100)
- **Color coding**: 
  - Green (#0de309) for positive values
  - Red (#e31507) for negative values  
  - Gray (#888) for values close to 0 (-0.05 to +0.05)
- **Sorting**: Bars are sorted from highest to lowest performance
- **Value labels**: Each bar shows the exact performance value

### Table View
- Displayed when timeframe is set to "Day" (D/day/Day)
- Shows all sectors with their performance metrics
- Maintains the same aesthetic as charts (black background, Courier New font)

### Styling
- **Background**: Pure black (#000000)
- **Font**: Courier New throughout
- **Minimal design**: No grid lines, no axis ticks
- **Responsive**: Adapts to different screen sizes

### Timeframe Integration
- Integrates with the existing timeframe selector in MarketPage
- Shows charts for Week, Month, Quarter, and YTD timeframes
- Shows table for Day timeframe (since daily data is not available in the CSV)

## Technical Details

### Component Props
- `selectedTimeframe`: String - The currently selected timeframe from the parent component

### Data Processing
- Converts percentage strings (e.g., "-4.63%") to float values (-4.63)
- Handles quoted CSV headers and values
- Removes special characters and normalizes property names

### Error Handling
- Loading states with appropriate messaging
- Error states for failed API requests
- Graceful fallbacks for missing or malformed data

## Usage
The component is automatically integrated into the MarketPage and replaces the previous sector data table. It responds to timeframe changes from the parent component's timeframe selector.

## Performance
- Efficient CSV parsing with minimal memory usage
- Optimized chart rendering with smooth transitions
- Responsive design that works on all device sizes 