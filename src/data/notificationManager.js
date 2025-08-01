class NotificationManager {
  constructor() {
    this.notifications = [];
    this.callbacks = new Set();
    this.apiStatus = 'online';
    this.lastApiCheck = Date.now();
  }

  // Add notification callback
  addCallback(callback) {
    this.callbacks.add(callback);
  }

  // Remove notification callback
  removeCallback(callback) {
    this.callbacks.delete(callback);
  }

  // Notify all callbacks
  notify(type, data) {
    this.callbacks.forEach(callback => {
      try {
        callback(type, data);
      } catch (error) {
        console.error('❌ Error in notification callback:', error);
      }
    });
  }

  // Handle API offline status
  handleApiOffline(error) {
    this.apiStatus = 'offline';
    this.lastApiCheck = Date.now();
    
    const notification = {
      type: 'api-offline',
      message: 'API is offline. Using cached data.',
      details: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      severity: 'warning'
    };
    
    this.notifications.push(notification);
    this.notify('api-offline', notification);
    
    console.error('❌ API Offline:', error);
  }

  // Handle API online status
  handleApiOnline() {
    const wasOffline = this.apiStatus === 'offline';
    this.apiStatus = 'online';
    this.lastApiCheck = Date.now();
    
    if (wasOffline) {
      const notification = {
        type: 'api-online',
        message: 'API is back online.',
        timestamp: new Date().toISOString(),
        severity: 'success'
      };
      
      this.notifications.push(notification);
      this.notify('api-online', notification);
      
      console.log('✅ API Online');
    }
  }

  // Handle rate limit warnings
  handleRateLimitWarning(status) {
    if (status.atLimit) {
      const notification = {
        type: 'rate-limit-reached',
        message: 'Rate limit reached. Waiting for reset...',
        details: `${status.totalRate}/${status.maxCallsPerMinute} calls`,
        timestamp: new Date().toISOString(),
        severity: 'error'
      };
      
      this.notifications.push(notification);
      this.notify('rate-limit-reached', notification);
      
      console.warn('⚠️ Rate limit reached');
    } else if (status.approaching) {
      const notification = {
        type: 'rate-limit-approaching',
        message: 'Approaching rate limit.',
        details: `${status.totalRate}/${status.maxCallsPerMinute} calls`,
        timestamp: new Date().toISOString(),
        severity: 'warning'
      };
      
      this.notifications.push(notification);
      this.notify('rate-limit-approaching', notification);
      
      console.warn('⚠️ Approaching rate limit');
    }
  }

  // Handle manual update status
  handleManualUpdateStatus(slug, status) {
    const notification = {
      type: 'manual-update',
      message: `Manual update ${status} for ${slug}`,
      slug,
      status,
      timestamp: new Date().toISOString(),
      severity: status === 'completed' ? 'success' : 'info'
    };
    
    this.notifications.push(notification);
    this.notify('manual-update', notification);
    
    console.log(`📋 Manual update ${status} for ${slug}`);
  }

  // Handle return changes
  handleReturnChanges(changes) {
    if (changes.length === 0) return;
    
    const notification = {
      type: 'return-changes',
      message: `${changes.length} ticker(s) with significant return changes`,
      changes,
      timestamp: new Date().toISOString(),
      severity: 'info'
    };
    
    this.notifications.push(notification);
    this.notify('return-changes', notification);
    
    console.log(`📊 ${changes.length} significant return changes detected`);
  }

  // Handle system errors
  handleSystemError(error, context) {
    const notification = {
      type: 'system-error',
      message: 'System error occurred',
      details: error?.message || 'Unknown error',
      context,
      timestamp: new Date().toISOString(),
      severity: 'error'
    };
    
    this.notifications.push(notification);
    this.notify('system-error', notification);
    
    console.error('❌ System Error:', error);
  }

  // Handle sync status
  handleSyncStatus(status, details) {
    const notification = {
      type: 'sync-status',
      message: `Sync ${status}`,
      details,
      timestamp: new Date().toISOString(),
      severity: status === 'completed' ? 'success' : 'info'
    };
    
    this.notifications.push(notification);
    this.notify('sync-status', notification);
    
    console.log(`🔄 Sync ${status}:`, details);
  }

  // Get current API status
  getApiStatus() {
    return {
      status: this.apiStatus,
      lastCheck: this.lastApiCheck,
      isOnline: this.apiStatus === 'online'
    };
  }

  // Get recent notifications
  getRecentNotifications(limit = 10) {
    return this.notifications
      .slice(-limit)
      .reverse();
  }

  // Clear old notifications (older than 1 hour)
  clearOldNotifications() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const initialLength = this.notifications.length;
    
    this.notifications = this.notifications.filter(notification => {
      const notificationTime = new Date(notification.timestamp).getTime();
      return notificationTime > oneHourAgo;
    });
    
    const removed = initialLength - this.notifications.length;
    if (removed > 0) {
      console.log(`🧹 Cleared ${removed} old notifications`);
    }
  }

  // Get notification statistics
  getNotificationStats() {
    const stats = {
      total: this.notifications.length,
      byType: {},
      bySeverity: {}
    };
    
    this.notifications.forEach(notification => {
      // Count by type
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[notification.severity] = (stats.bySeverity[notification.severity] || 0) + 1;
    });
    
    return stats;
  }

  // Export notifications for debugging
  exportNotifications() {
    return {
      timestamp: new Date().toISOString(),
      apiStatus: this.getApiStatus(),
      notifications: this.notifications,
      stats: this.getNotificationStats()
    };
  }

  // Reset all notifications
  reset() {
    this.notifications = [];
    this.apiStatus = 'online';
    this.lastApiCheck = Date.now();
    console.log('🔄 Notification manager reset');
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

export default notificationManager; 