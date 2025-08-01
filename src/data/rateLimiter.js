import { logger } from '../utils/logger';

class RateLimiter {
  constructor(maxCallsPerMinute = 55) {
    this.maxCallsPerMinute = maxCallsPerMinute;
    this.automaticCalls = [];
    this.manualCalls = [];
    this.reservedForManual = 10; // Reserve 10 calls for manual updates
    this.batchSize = 5; // 5 symbols per batch
  }

  // Check if we can make an automatic request
  canMakeAutomaticRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old calls
    this.automaticCalls = this.automaticCalls.filter(timestamp => timestamp > oneMinuteAgo);
    
    // Check if we have room for automatic calls
    const availableForAutomatic = this.maxCallsPerMinute - this.reservedForManual;
    return this.automaticCalls.length < availableForAutomatic;
  }

  // Check if we can make a manual request
  canMakeManualRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old calls
    this.manualCalls = this.manualCalls.filter(timestamp => timestamp > oneMinuteAgo);
    
    return this.manualCalls.length < this.reservedForManual;
  }

  // Record an automatic API call
  recordAutomaticRequest() {
    this.automaticCalls.push(Date.now());
    logger.log(`📊 Automatic API call recorded. Total: ${this.automaticCalls.length}`);
  }

  // Record a manual API call
  recordManualRequest() {
    this.manualCalls.push(Date.now());
    logger.log(`📊 Manual API call recorded. Total: ${this.manualCalls.length}`);
  }

  // Get current rate limit status
  getRateLimitStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const automaticRate = this.automaticCalls.filter(t => t > oneMinuteAgo).length;
    const manualRate = this.manualCalls.filter(t => t > oneMinuteAgo).length;
    const totalRate = automaticRate + manualRate;
    
    return {
      automaticRate,
      manualRate,
      totalRate,
      maxCallsPerMinute: this.maxCallsPerMinute,
      reservedForManual: this.reservedForManual,
      availableForAutomatic: this.maxCallsPerMinute - this.reservedForManual,
      approaching: totalRate >= this.maxCallsPerMinute * 0.8, // 80% threshold
      atLimit: totalRate >= this.maxCallsPerMinute,
      nextAutomaticAvailable: this.canMakeAutomaticRequest() ? 0 : this.getNextAvailableTime('automatic'),
      nextManualAvailable: this.canMakeManualRequest() ? 0 : this.getNextAvailableTime('manual')
    };
  }

  // Calculate when the next request will be available
  getNextAvailableTime(type) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    if (type === 'automatic') {
      const calls = this.automaticCalls.filter(t => t > oneMinuteAgo);
      if (calls.length < this.maxCallsPerMinute - this.reservedForManual) {
        return 0; // Available now
      }
      // Find the oldest call that will expire
      const oldestCall = Math.min(...calls);
      return oldestCall + 60000 - now; // Time until oldest call expires
    } else {
      const calls = this.manualCalls.filter(t => t > oneMinuteAgo);
      if (calls.length < this.reservedForManual) {
        return 0; // Available now
      }
      // Find the oldest call that will expire
      const oldestCall = Math.min(...calls);
      return oldestCall + 60000 - now; // Time until oldest call expires
    }
  }

  // Calculate how many unique tickers we can process per minute
  getMaxTickersPerMinute() {
    const availableForAutomatic = this.maxCallsPerMinute - this.reservedForManual;
    return availableForAutomatic * this.batchSize; // 45 * 5 = 225 tickers/minute
  }

  // Calculate optimal refresh interval based on ticker count
  calculateRefreshInterval(totalTickers) {
    const maxTickersPerMinute = this.getMaxTickersPerMinute();
    
    if (totalTickers <= maxTickersPerMinute) {
      return 60000; // 60 seconds - can process all tickers in one cycle
    } else if (totalTickers <= maxTickersPerMinute * 2) {
      return 90000; // 90 seconds - need 2 cycles
    } else {
      return 120000; // 120 seconds - need 3+ cycles
    }
  }

  // Wait for rate limit to reset
  async waitForRateLimit(type = 'automatic') {
    const waitTime = this.getNextAvailableTime(type);
    if (waitTime > 0) {
      logger.log(`⏳ Waiting ${Math.ceil(waitTime / 1000)}s for rate limit reset (${type})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Get status message for UI
  getStatusMessage() {
    const status = this.getRateLimitStatus();
    
    if (status.atLimit) {
      return 'Rate limit reached. Waiting for reset...';
    } else if (status.approaching) {
      return `Approaching rate limit: ${status.totalRate}/${status.maxCallsPerMinute} calls`;
    } else {
      return `API calls: ${status.totalRate}/${status.maxCallsPerMinute}`;
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

export default rateLimiter; 