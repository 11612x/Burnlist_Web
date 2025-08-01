import { logger } from '../utils/logger';

class ActiveBurnlistManager {
  constructor() {
    this.activeBurnlists = new Map(); // slug -> { lastOpened, priority, tickers }
    this.maxActiveBurnlists = 5;
    this.manualUpdateQueue = [];
  }

  // Register a burnlist as active (opens it)
  registerActiveBurnlist(slug, tickers = []) {
    const now = Date.now();
    
    // If already active, just update last opened time
    if (this.activeBurnlists.has(slug)) {
      const existing = this.activeBurnlists.get(slug);
      existing.lastOpened = now;
      existing.tickers = new Set(tickers);
      this.activeBurnlists.set(slug, existing);
      logger.log(`📝 Updated active burnlist: ${slug}`);
      return;
    }

    // If at capacity, remove oldest
    if (this.activeBurnlists.size >= this.maxActiveBurnlists) {
      const oldest = this.getOldestActiveBurnlist();
      if (oldest) {
        this.activeBurnlists.delete(oldest);
        logger.log(`🗑️ Removed oldest active burnlist: ${oldest}`);
      }
    }

    // Add new active burnlist
    this.activeBurnlists.set(slug, {
      lastOpened: now,
      priority: this.calculatePriority(now),
      tickers: new Set(tickers)
    });

    logger.log(`✅ Registered active burnlist: ${slug} (${this.activeBurnlists.size}/${this.maxActiveBurnlists})`);
  }

  // Unregister a burnlist (closes it)
  unregisterActiveBurnlist(slug) {
    if (this.activeBurnlists.has(slug)) {
      this.activeBurnlists.delete(slug);
      logger.log(`❌ Unregistered active burnlist: ${slug}`);
    }
  }

  // Get all active burnlists
  getActiveBurnlists() {
    return Array.from(this.activeBurnlists.entries()).map(([slug, data]) => ({
      slug,
      lastOpened: data.lastOpened,
      priority: data.priority,
      tickers: Array.from(data.tickers)
    }));
  }

  // Check if a burnlist is active
  isActiveBurnlist(slug) {
    return this.activeBurnlists.has(slug);
  }

  // Get priority of a burnlist (higher = more recent)
  getBurnlistPriority(slug) {
    const burnlist = this.activeBurnlists.get(slug);
    return burnlist ? burnlist.priority : 0;
  }

  // Get all unique tickers from active burnlists
  getAllUniqueTickers() {
    const allTickers = new Set();
    
    this.activeBurnlists.forEach((data, slug) => {
      data.tickers.forEach(ticker => allTickers.add(ticker));
    });
    
    return Array.from(allTickers);
  }

  // Get which burnlists contain a specific ticker
  getBurnlistsForTicker(symbol) {
    const burnlists = [];
    
    this.activeBurnlists.forEach((data, slug) => {
      if (data.tickers.has(symbol)) {
        burnlists.push(slug);
      }
    });
    
    return burnlists;
  }

  // Get oldest active burnlist
  getOldestActiveBurnlist() {
    let oldest = null;
    let oldestTime = Date.now();
    
    this.activeBurnlists.forEach((data, slug) => {
      if (data.lastOpened < oldestTime) {
        oldestTime = data.lastOpened;
        oldest = slug;
      }
    });
    
    return oldest;
  }

  // Calculate priority based on last opened time
  calculatePriority(lastOpened) {
    const now = Date.now();
    const timeDiff = now - lastOpened;
    return Math.max(0, 1000 - Math.floor(timeDiff / 1000)); // Higher priority for more recent
  }

  // Request manual update for inactive burnlist
  requestManualUpdate(slug) {
    if (this.isActiveBurnlist(slug)) {
      logger.log(`⚠️ Manual update requested for active burnlist: ${slug}`);
      return false; // Don't queue manual updates for active burnlists
    }

    // Check if already in queue
    const existing = this.manualUpdateQueue.find(item => item.slug === slug);
    if (existing) {
      logger.log(`⚠️ Manual update already queued for: ${slug}`);
      return false;
    }

    // Add to manual update queue
    this.manualUpdateQueue.push({
      slug,
      timestamp: Date.now(),
      status: 'pending'
    });

    logger.log(`📋 Queued manual update for: ${slug}`);
    return true;
  }

  // Get manual update queue
  getManualUpdateQueue() {
    return this.manualUpdateQueue.map(item => ({ ...item }));
  }

  // Check if manual update is pending
  isManualUpdatePending(slug) {
    return this.manualUpdateQueue.some(item => item.slug === slug && item.status === 'pending');
  }

  // Mark manual update as processing
  markManualUpdateProcessing(slug) {
    const item = this.manualUpdateQueue.find(item => item.slug === slug);
    if (item) {
      item.status = 'processing';
      logger.log(`⚙️ Processing manual update for: ${slug}`);
    }
  }

  // Mark manual update as completed
  markManualUpdateCompleted(slug) {
    const index = this.manualUpdateQueue.findIndex(item => item.slug === slug);
    if (index !== -1) {
      this.manualUpdateQueue.splice(index, 1);
      logger.log(`✅ Completed manual update for: ${slug}`);
    }
  }

  // Get next manual update to process
  getNextManualUpdate() {
    return this.manualUpdateQueue.find(item => item.status === 'pending');
  }

  // Get system status
  getSystemStatus() {
    return {
      activeBurnlists: this.activeBurnlists.size,
      maxActiveBurnlists: this.maxActiveBurnlists,
      manualUpdateQueue: this.manualUpdateQueue.length,
      totalUniqueTickers: this.getAllUniqueTickers().length
    };
  }

  // Clean up old manual update requests (older than 5 minutes)
  cleanupOldManualUpdates() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const initialLength = this.manualUpdateQueue.length;
    
    this.manualUpdateQueue = this.manualUpdateQueue.filter(item => 
      item.timestamp > fiveMinutesAgo
    );
    
    const removed = initialLength - this.manualUpdateQueue.length;
    if (removed > 0) {
      logger.log(`🧹 Cleaned up ${removed} old manual update requests`);
    }
  }
}

// Create singleton instance
const activeBurnlistManager = new ActiveBurnlistManager();

export default activeBurnlistManager; 