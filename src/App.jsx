// React core and lifecycle
import React, { useState, useEffect } from "react";
// React Router for routing
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// App pages
import Home from "@pages/HomePage";
import BurnPage from "@pages/burnPage";
// Logging utility
import { logger } from './utils/logger';

import UniverseScreenerPage from "@pages/UniverseScreenerPage";
import UniverseHomePage from "@pages/UniverseHomePage";
import TradeDashboard from './pages/TradeDashboard';
import TradeJournal from './pages/TradeJournal';
import AddStockPricePage from './pages/AddStockPricePage';
import MarketPage from './pages/MarketPage';
// Fetch manager for cleanup
import { fetchManager } from '@data/twelvedataFetchManager';
import { ThemeProvider } from './ThemeContext';
import MobileNavigation from './components/MobileNavigation';


function App() {
  // Load watchlists from localStorage or default to empty object
  const [watchlists, setWatchlists] = useState(() => {
    try {
      const saved = localStorage.getItem("burnlist_watchlists");
      logger.info("💾 Loaded watchlists from localStorage:", saved);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist watchlists to localStorage on changes
  useEffect(() => {
    logger.info("💾 Saving watchlists to localStorage:", watchlists);
    localStorage.setItem("burnlist_watchlists", JSON.stringify(watchlists));
  }, [watchlists]);

  // Cleanup fetch manager on app unmount
  useEffect(() => {
    return () => {
      fetchManager.cleanup();
    };
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route
            path="/"
            element={<Home watchlists={watchlists} setWatchlists={setWatchlists} />}
          />
          <Route
            path="/watchlist/:slug"
            element={<BurnPage watchlists={watchlists} setWatchlists={setWatchlists} />}
          />

          {/* Route for Universe Homepage */}
          <Route path="/universes" element={<UniverseHomePage />} />
          {/* Route for Universe Screener */}
          <Route path="/universe/:slug" element={<UniverseScreenerPage />} />
          <Route path="/trade" element={<TradeDashboard />} />
          <Route path="/journal" element={<TradeJournal />} />
          <Route path="/add-stock-price" element={<AddStockPricePage />} />
          <Route path="/market" element={<MarketPage />} />
        </Routes>
        <MobileNavigation />
      </Router>
    </ThemeProvider>
  );
}

export default App;