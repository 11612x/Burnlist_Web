import { logger } from '../utils/logger';

/**
 * Real-time NAV Event Emitter
 * Provides event-driven updates for NAV calculations and chart refreshes
 */
class NAVEventEmitter {
  constructor() {
    this.listeners = new Map();
    this.lastNAVUpdate = null;
    this.updateQueue = [];
    this.isProcessing = false;
  }

  /**
   * Subscribe to NAV update events
   * @param {string} watchlistSlug - Watchlist identifier
   * @param {Function} callback - Callback function to execute on NAV updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(watchlistSlug, callback) {
    if (!this.listeners.has(watchlistSlug)) {
      this.listeners.set(watchlistSlug, new Set());
    }
    
    this.listeners.get(watchlistSlug).add(callback);
    
    logger.debug(`[NAV EVENT] Subscribed to NAV updates for ${watchlistSlug}`);
    
    // Return unsubscribe function
    return () => {
      const watchlistListeners = this.listeners.get(watchlistSlug);
      if (watchlistListeners) {
        watchlistListeners.delete(callback);
        if (watchlistListeners.size === 0) {
          this.listeners.delete(watchlistSlug);
        }
      }
      logger.debug(`[NAV EVENT] Unsubscribed from NAV updates for ${watchlistSlug}`);
    };
  }

  /**
   * Emit NAV update event for a specific watchlist
   * @param {string} watchlistSlug - Watchlist identifier
   * @param {Object} navData - NAV calculation data
   * @param {string} source - Source of the update ('batch', 'realtime', 'manual')
   */
  emit(watchlistSlug, navData, source = 'batch') {
    const timestamp = new Date().toISOString();
    const event = {
      watchlistSlug,
      navData,
      source,
      timestamp,
      isRealTime: source === 'realtime'
    };

    // Store last update
    this.lastNAVUpdate = {
      watchlistSlug,
      timestamp,
      source
    };

    // Queue the update
    this.updateQueue.push(event);
    
    logger.debug(`[NAV EVENT] Emitting NAV update for ${watchlistSlug} (${source})`);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the update queue
   */
  async processQueue() {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const event = this.updateQueue.shift();
        await this.notifyListeners(event);
      }
    } catch (error) {
      logger.error('[NAV EVENT] Error processing update queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Notify all listeners for a specific watchlist
   * @param {Object} event - NAV update event
   */
  async notifyListeners(event) {
    const { watchlistSlug, navData, source, timestamp, isRealTime } = event;
    
    const listeners = this.listeners.get(watchlistSlug);
    if (!listeners || listeners.size === 0) {
      logger.debug(`[NAV EVENT] No listeners for ${watchlistSlug}`);
      return;
    }

    logger.debug(`[NAV EVENT] Notifying ${listeners.size} listeners for ${watchlistSlug}`);
    
    // Notify all listeners
    const promises = Array.from(listeners).map(callback => {
      try {
        return callback(navData, { source, timestamp, isRealTime });
      } catch (error) {
        logger.error(`[NAV EVENT] Error in listener callback:`, error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get the last NAV update for a watchlist
   * @param {string} watchlistSlug - Watchlist identifier
   * @returns {Object|null} Last update info
   */
  getLastUpdate(watchlistSlug) {
    if (this.lastNAVUpdate && this.lastNAVUpdate.watchlistSlug === watchlistSlug) {
      return this.lastNAVUpdate;
    }
    return null;
  }

  /**
   * Check if NAV data is stale (older than 5 minutes)
   * @param {string} watchlistSlug - Watchlist identifier
   * @returns {boolean} True if data is stale
   */
  isDataStale(watchlistSlug) {
    const lastUpdate = this.getLastUpdate(watchlistSlug);
    if (!lastUpdate) return true;

    const now = new Date().getTime();
    const updateTime = new Date(lastUpdate.timestamp).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    return (now - updateTime) > fiveMinutes;
  }

  /**
   * Get time since last update
   * @param {string} watchlistSlug - Watchlist identifier
   * @returns {number} Milliseconds since last update
   */
  getTimeSinceLastUpdate(watchlistSlug) {
    const lastUpdate = this.getLastUpdate(watchlistSlug);
    if (!lastUpdate) return Infinity;

    const now = new Date().getTime();
    const updateTime = new Date(lastUpdate.timestamp).getTime();
    return now - updateTime;
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
    this.updateQueue = [];
    this.lastNAVUpdate = null;
    this.isProcessing = false;
    logger.debug('[NAV EVENT] Cleared all listeners and queue');
  }

  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    const totalListeners = Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0);
    const activeWatchlists = Array.from(this.listeners.keys());
    
    return {
      totalListeners,
      activeWatchlists,
      queueLength: this.updateQueue.length,
      isProcessing: this.isProcessing,
      lastUpdate: this.lastNAVUpdate
    };
  }
}

// Create singleton instance
const navEventEmitter = new NAVEventEmitter();

export default navEventEmitter; 