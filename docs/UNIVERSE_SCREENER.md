# Universe Screener

The Universe Screener is a powerful tool for swing trading that allows you to screen and manage potential trading opportunities before adding them to your watchlists.

## Features

### Bulk Ticker Input
- Add multiple tickers at once using comma, space, or tab separation
- Automatically fetches current price and calculates ATR (Average True Range)
- Validates ticker symbols and prevents duplicates

### Editable Universe Table
Each row in the universe table includes:
- **Symbol**: Stock ticker symbol
- **Last Price**: Current market price (fetched automatically)
- **ATR(14)**: Average True Range - editable field for manual adjustment
- **Flags**: Checkboxes for News, EMA, RSI, SMA indicators
- **Entry Price**: Manual entry price input
- **SL**: Stop Loss (auto-calculated)
- **TP**: Take Profit (auto-calculated)
- **Position Size**: Auto-calculated based on risk settings
- **Notes**: Free text field for trading notes

### Automatic Calculations
When you enter an Entry Price and ATR, the system automatically calculates:
- **Stop Loss**: Tighter of 3.5% or 1.25×ATR
- **Take Profit**: 2× the risk distance
- **Position Size**: Based on account size and risk percentage

### Screener Settings
- **Account Size**: Your total trading capital
- **Risk %**: Maximum risk per trade (default 2%)

### Watchlist Creation
- Select multiple tickers using checkboxes
- Click "Create Watchlist from Selected" to create a new watchlist
- Selected tickers are added with their entry prices as buy prices
- The new watchlist appears in your main watchlist view

## Usage

1. **Navigate to Screener**: Click the "SCREENER" button on the homepage
2. **Configure Settings**: Set your account size and risk percentage
3. **Add Tickers**: Paste ticker symbols in the bulk input field
4. **Edit Universe**: Modify ATR values, entry prices, and add notes
5. **Select Candidates**: Use checkboxes to select promising trades
6. **Create Watchlist**: Convert selected tickers into a watchlist

## Data Storage

- **Universe Data**: Stored in `burnlist_universe` localStorage key
- **Screener Settings**: Stored in `burnlist_screener_settings` localStorage key
- **Watchlists**: Created watchlists are stored in `burnlist_watchlists` localStorage key

## Technical Details

- Uses the same data fetching system as the main app
- ATR calculation is approximated based on price volatility
- All calculations use 5 decimal precision internally, 2 decimal display
- Follows the same aesthetic as the main burnpage with CRT green theme
- Responsive design with sortable columns

## Example Workflow

1. Add tickers: `AAPL, MSFT, GOOGL, TSLA`
2. Review fetched prices and ATR values
3. Adjust ATR if needed based on your analysis
4. Enter entry prices for promising setups
5. Add notes about your analysis
6. Select the best candidates
7. Create watchlist and monitor performance 