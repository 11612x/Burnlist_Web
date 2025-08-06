// Centralized storage utility
const STORAGE_KEYS = {
  WATCHLISTS: 'burnlist_watchlists',
  UNIVERSES: 'burnlist_universes',
  SCREENER_SETTINGS: 'burnlist_screener_settings',
  SCREENERS: 'burnlist_screeners',
  TRADE_JOURNAL: 'trade_journal_trades',
  FETCH_COUNT: 'burnlist_fetch_count',
  LAST_REFRESH: 'burnlist_last_refresh_',
  UNIVERSE_TOGGLES: 'universe_toggles_',
  CHART_DATA: 'burnlist_chart_data_'
};

class StorageManager {
  constructor() {
    this.isAvailable = this.checkAvailability();
  }

  checkAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  get(key, defaultValue = null) {
    if (!this.isAvailable) return defaultValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Failed to get item from localStorage: ${key}`, error);
      return defaultValue;
    }
  }

  set(key, value) {
    if (!this.isAvailable) return false;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Failed to set item in localStorage: ${key}`, error);
      return false;
    }
  }

  remove(key) {
    if (!this.isAvailable) return false;
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove item from localStorage: ${key}`, error);
      return false;
    }
  }

  clear() {
    if (!this.isAvailable) return false;
    
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage', error);
      return false;
    }
  }

  // Specific methods for common operations
  getWatchlists() {
    return this.get(STORAGE_KEYS.WATCHLISTS, {});
  }

  setWatchlists(watchlists) {
    return this.set(STORAGE_KEYS.WATCHLISTS, watchlists);
  }

  getUniverses() {
    return this.get(STORAGE_KEYS.UNIVERSES, {});
  }

  setUniverses(universes) {
    return this.set(STORAGE_KEYS.UNIVERSES, universes);
  }

  getTradeJournal() {
    return this.get(STORAGE_KEYS.TRADE_JOURNAL, []);
  }

  setTradeJournal(trades) {
    return this.set(STORAGE_KEYS.TRADE_JOURNAL, trades);
  }

  getLastRefresh(slug) {
    return this.get(`${STORAGE_KEYS.LAST_REFRESH}${slug}`);
  }

  setLastRefresh(slug, timestamp) {
    return this.set(`${STORAGE_KEYS.LAST_REFRESH}${slug}`, timestamp);
  }

  getUniverseToggles(ticker) {
    return this.get(`${STORAGE_KEYS.UNIVERSE_TOGGLES}${ticker}`, {});
  }

  setUniverseToggles(ticker, toggles) {
    return this.set(`${STORAGE_KEYS.UNIVERSE_TOGGLES}${ticker}`, toggles);
  }

  getScreeners() {
    return this.get(STORAGE_KEYS.SCREENERS, {});
  }

  setScreeners(screeners) {
    return this.set(STORAGE_KEYS.SCREENERS, screeners);
  }

  getFetchCount() {
    return this.get(STORAGE_KEYS.FETCH_COUNT, 0);
  }

  setFetchCount(count) {
    return this.set(STORAGE_KEYS.FETCH_COUNT, count);
  }

  getChartData(slug) {
    return this.get(`${STORAGE_KEYS.CHART_DATA}${slug}`, []);
  }

  setChartData(slug, data) {
    return this.set(`${STORAGE_KEYS.CHART_DATA}${slug}`, data);
  }
}

export const storage = new StorageManager();
export { STORAGE_KEYS }; 