// offlineNotificationService.js - DEPRECATED - Use UnifiedMonitoringService instead
// This file is maintained for backwards compatibility only

console.warn('⚠️  DEPRECATED: offlineNotificationService.js is deprecated.');
console.warn('⚠️  Please use UnifiedMonitoringService from scripts/monitor-service.js instead.');
console.warn('⚠️  This service provides auto-updating webhook embeds and better monitoring.');

// Minimal compatibility wrapper - most functionality moved to UnifiedMonitoringService
class OfflineNotificationService {
    constructor() {
        console.warn('⚠️  OfflineNotificationService is deprecated. Use UnifiedMonitoringService from scripts/monitor-service.js instead.');
    }

    // Legacy method for compatibility - redirects to simple status message generation
    generateStatusMessage(statusReport) {
        const isOnline = statusReport.summary.operational;
        const statusEmoji = isOnline ? '🟢' : '🔴';
        const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
        
        if (isOnline) {
            return `${statusEmoji} **Bepo Status: ${statusText}**\n✅ All systems operational`;
        } else {
            const lastSeen = statusReport.bot.lastSeen ? 
                `<t:${Math.floor(new Date(statusReport.bot.lastSeen).getTime() / 1000)}:R>` : 
                'Unknown';
            
            return `${statusEmoji} **Bepo Status: ${statusText}**\n` +
                   `🕒 Last seen: ${lastSeen}\n` +
                   `❓ Reason: ${statusReport.bot.reason}\n` +
                   `\n*Bepo may be temporarily unavailable. Please try again later.*`;
        }
    }

    // Deprecated methods - log warnings and do nothing
    async sendOfflineAlert(statusReport) {
        console.warn('⚠️  sendOfflineAlert is deprecated. Use UnifiedMonitoringService instead.');
        return false;
    }

    async sendOnlineAlert(statusReport) {
        console.warn('⚠️  sendOnlineAlert is deprecated. Use UnifiedMonitoringService instead.');
        return false;
    }

    loadConfiguration() {
        console.warn('⚠️  loadConfiguration is deprecated. Use UnifiedMonitoringService instead.');
    }
}

// Export singleton instance for backwards compatibility
const offlineNotificationService = new OfflineNotificationService();
export default offlineNotificationService;
