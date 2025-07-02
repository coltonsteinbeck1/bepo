// offlineNotificationService.js - Service to send notifications when bot goes offline
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

class OfflineNotificationService {
    constructor() {
        this.webhooks = []; // Discord webhook URLs for notifications
        this.notificationCooldown = 10 * 60 * 1000; // 10 minutes cooldown
        this.lastNotificationTime = 0;
        this.alertFile = path.join(process.cwd(), 'logs', 'offline-alerts.json');
        this.loadConfiguration();
    }

    loadConfiguration() {
        try {
            // Load webhook URLs from environment or config
            if (process.env.DISCORD_ALERT_WEBHOOK) {
                this.webhooks.push(process.env.DISCORD_ALERT_WEBHOOK);
            }
            
            // You can add more webhooks here for different channels
            const webhookConfig = process.env.OFFLINE_WEBHOOKS;
            if (webhookConfig) {
                const additionalWebhooks = webhookConfig.split(',');
                this.webhooks.push(...additionalWebhooks);
            }
        } catch (error) {
            console.error('Failed to load notification configuration:', error);
        }
    }

    async sendOfflineAlert(statusReport) {
        const now = Date.now();
        
        // Check cooldown to prevent spam
        if (now - this.lastNotificationTime < this.notificationCooldown) {
            return false;
        }

        const alertData = {
            timestamp: new Date().toISOString(),
            status: statusReport.summary.status,
            lastSeen: statusReport.bot.lastSeen,
            downtime: statusReport.bot.timeSinceUpdate || 'Unknown',
            reason: statusReport.bot.reason
        };

        // Log the alert
        this.logAlert(alertData);

        // Send to configured webhooks
        for (const webhookUrl of this.webhooks) {
            try {
                await this.sendWebhookNotification(webhookUrl, alertData);
            } catch (error) {
                console.error(`Failed to send webhook notification: ${error.message}`);
            }
        }

        this.lastNotificationTime = now;
        return true;
    }

    async sendWebhookNotification(webhookUrl, alertData) {
        const embed = {
            title: '🔴 Bepo Offline Alert',
            description: '**Bepo is down**',
            color: 0xff0000, // Red
            fields: [
                {
                    name: '📊 Status',
                    value: alertData.status,
                    inline: true
                },
                {
                    name: '🕒 Last Seen',
                    value: alertData.lastSeen ? 
                        `<t:${Math.floor(new Date(alertData.lastSeen).getTime() / 1000)}:R>` : 
                        'Unknown',
                    inline: true
                },
                {
                    name: '⏱️ Downtime',
                    value: typeof alertData.downtime === 'number' ? 
                        `${Math.floor(alertData.downtime / 60)} minutes` : 
                        alertData.downtime,
                    inline: true
                },
                {
                    name: '❓ Reason',
                    value: alertData.reason,
                    inline: false
                }
            ],
            timestamp: alertData.timestamp,
            footer: {
                text: 'Bepo Monitor'
            }
        };

        const payload = {
            username: 'Bepo Monitor',
            avatar_url: 'https://cdn.discordapp.com/emojis/852358740330938399.png', // Red circle emoji
            embeds: [embed]
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
        }
    }

    async sendOnlineAlert(statusReport) {
        // Send a recovery notification when bot comes back online
        const alertData = {
            timestamp: new Date().toISOString(),
            status: statusReport.summary.status,
            uptime: statusReport.summary.uptime || 0
        };

        for (const webhookUrl of this.webhooks) {
            try {            const embed = {
                title: '🟢 Bepo Online Recovery',
                description: '**Bepo is back online**',
                color: 0x00ff00, // Green
                    fields: [
                        {
                            name: '📊 Status',
                            value: alertData.status,
                            inline: true
                        },
                        {
                            name: '⏱️ Uptime',
                            value: this.formatUptime(alertData.uptime),
                            inline: true
                        }
                    ],
                    timestamp: alertData.timestamp,
                    footer: {
                        text: 'Bepo Monitor'
                    }
                };

                const payload = {
                    username: 'Bepo Monitor',
                    avatar_url: 'https://cdn.discordapp.com/emojis/852358740330938399.png',
                    embeds: [embed]
                };

                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.error(`Failed to send recovery notification: ${error.message}`);
            }
        }

        this.logAlert({ ...alertData, type: 'RECOVERY' });
    }

    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    logAlert(alertData) {
        try {
            const logDir = path.dirname(this.alertFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            fs.appendFileSync(this.alertFile, JSON.stringify(alertData) + '\n');
        } catch (error) {
            console.error('Failed to log alert:', error);
        }
    }

    // Method to generate a status page URL or message for users
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
}

// Export singleton instance
const offlineNotificationService = new OfflineNotificationService();
export default offlineNotificationService;
