// React core and lifecycle
import React, { useState, useEffect } from "react";
// React Router for routing
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// App pages
import Home from "@pages/HomePage";
import WatchlistPage from "@pages/WatchlistPage";
// Logging utility
import { logger } from './utils/logger';
import { storage } from './utils/storage';

import UniverseScreenerPage from "@pages/UniverseScreenerPage";
import UniverseHomePage from "@pages/UniverseHomePage";
import TradeDashboard from './pages/TradeDashboard';
import TradeJournal from './pages/TradeJournal';
import MarketPage from './pages/MarketPage';
import ScreenersPage from './pages/ScreenersPage';
import ScreenerResultsPage from './pages/ScreenerResultsPage';
import BurnPage from './pages/burnPage';
// Fetch manager for cleanup
import { fetchManager } from '@data/twelvedataFetchManager';
import { ThemeProvider } from './ThemeContext';
import MobileNavigation from './components/MobileNavigation';


function App() {
  // Load watchlists from storage or default to empty object
  const [watchlists, setWatchlists] = useState(() => {
    const saved = storage.getWatchlists();
    logger.info("💾 Loaded watchlists from storage:", saved);
    return saved;
  });

  // Persist watchlists to storage on changes
  useEffect(() => {
    logger.info("💾 Saving watchlists to storage:", watchlists);
    storage.setWatchlists(watchlists);
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
            element={<WatchlistPage watchlists={watchlists} setWatchlists={setWatchlists} />}
          />

          {/* Route for Universe Homepage */}
          <Route path="/universes" element={<UniverseHomePage />} />
          {/* Route for Universe Screener */}
          <Route path="/universe/:slug" element={<UniverseScreenerPage />} />
          <Route path="/trade" element={<TradeDashboard />} />
          <Route path="/journal" element={<TradeJournal />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/screeners" element={<ScreenersPage />} />
          <Route path="/screeners/screener/:screenerSlug" element={<ScreenerResultsPage />} />
          <Route path="/burn/:slug" element={<BurnPage />} />
        </Routes>
        <MobileNavigation />
      </Router>
    </ThemeProvider>
  );
}

export default App;