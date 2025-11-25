import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

class UnifiedMonitoringService {
    constructor() {
        this.statusFile = path.join(__dirname, '..', 'logs', 'bot-status-monitor.json');
        this.healthFile = path.join(__dirname, '..', 'logs', 'bot-status.json');
        this.webhookUrl = process.env.DISCORD_ALERT_WEBHOOK;
        this.botSpamChannelId = process.env.BOT_SPAM;
        this.messageId = null; // Store the message ID for updates
        this.currentStatus = null;
        this.checkInterval = 30000; // 30 seconds
        this.intervalId = null;
        
        this.initializeStatus();
    }

    initializeStatus() {
        try {
            // Ensure logs directory exists
            const logsDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }

            // Initialize status file if it doesn't exist
            if (!fs.existsSync(this.statusFile)) {
                const initialStatus = {
                    isOnline: false,
                    lastCheck: new Date().toISOString(),
                    lastOnline: null,
                    consecutiveFailures: 0,
                    webhookMessageId: null
                };
                fs.writeFileSync(this.statusFile, JSON.stringify(initialStatus, null, 2));
            }
        } catch (error) {
            console.error('Error initializing status:', error);
        }
    }

    getStatus() {
        try {
            if (fs.existsSync(this.statusFile)) {
                return JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
            }
        } catch (error) {
            console.error('Error reading status file:', error);
        }
        return {
            isOnline: false,
            lastCheck: new Date().toISOString(),
            lastOnline: null,
            consecutiveFailures: 0,
            webhookMessageId: null
        };
    }

    updateStatus(newStatus) {
        try {
            const currentStatus = this.getStatus();
            const updatedStatus = {
                ...currentStatus,
                ...newStatus,
                lastCheck: new Date().toISOString()
            };
            fs.writeFileSync(this.statusFile, JSON.stringify(updatedStatus, null, 2));
            return updatedStatus;
        } catch (error) {
            console.error('Error updating status file:', error);
            return null;
        }
    }

    getHealthData() {
        try {
            if (fs.existsSync(this.healthFile)) {
                const healthData = JSON.parse(fs.readFileSync(this.healthFile, 'utf8'));
                
                // Check if health data is fresh (updated within last 2 minutes)
                const lastUpdate = healthData.lastUpdated ? new Date(healthData.lastUpdated).getTime() : 0;
                const now = Date.now();
                const timeSinceUpdate = now - lastUpdate;
                const isStale = timeSinceUpdate > 120000; // 2 minutes
                
                // Mark data as stale if it's old
                if (isStale) {
                    healthData._isStale = true;
                    healthData._staleDuration = timeSinceUpdate;
                }
                
                return healthData;
            }
        } catch (error) {
            console.error('Error reading health file:', error);
        }
        return {
            status: 'unknown',
            uptime: 0,
            memory: { used: 0, total: 0 },
            errors: { count: 0, recent: [] },
            lastUpdated: new Date().toISOString(),
            _isStale: true
        };
    }

    updateHealthStatus(isOnline, statusChangeTime = null) {
        try {
            if (!isOnline) {
                // Update health file to reflect offline status with exact timestamp
                const offlineTime = statusChangeTime || new Date().toISOString();
                const offlineStatus = {
                    botStatus: {
                        isOnline: false,
                        status: "OFFLINE",
                        lastSeen: offlineTime,
                        uptime: 0,
                        startTime: null
                    },
                    health: {
                        healthy: false,
                        errorCount: 0,
                        criticalErrorCount: 0,
                        memoryUsage: { used: 0, total: 0 },
                        lastHealthCheck: offlineTime,
                        lastCriticalError: null
                    },
                    discord: {
                        connected: false,
                        ping: null,
                        guilds: 0,
                        users: 0
                    },
                    system: {
                        platform: process.platform,
                        nodeVersion: process.version,
                        pid: null
                    },
                    lastUpdated: offlineTime
                };
                
                fs.writeFileSync(this.healthFile, JSON.stringify(offlineStatus, null, 2));
                console.log('📊 Updated health status to offline');
            }
        } catch (error) {
            console.error('Error updating health status:', error);
        }
    }

    checkBotStatus() {
        try {
            // Check if bot process is running
            const result = execSync('pgrep -f "node.*bot.js"', { encoding: 'utf8' }).trim();
            return result.length > 0;
        } catch (error) {
            // pgrep returns non-zero exit code when no process found
            return false;
        }
    }

    createStatusEmbed(isOnline, healthData) {
        const timestamp = new Date().toISOString();
        const color = isOnline ? 0x00ff00 : 0xff0000; // Green for online, red for offline
        const status = isOnline ? 'ONLINE' : 'OFFLINE';
        const currentStatus = this.getStatus();
        
        const embed = {
            title: '🤖 Bot Status Monitor',
            color: color,
            timestamp: timestamp,
            fields: [
                {
                    name: 'Status',
                    value: `**${status}**`,
                    inline: true
                },
                {
                    name: 'Last Check',
                    value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                    inline: true
                }
            ],
            footer: {
                text: 'Bot Status Monitor',
                icon_url: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
            }
        };

        if (isOnline && healthData && healthData.botStatus) {
            // Add health information when online
            const botStatus = healthData.botStatus;
            const health = healthData.health || {};
            const discord = healthData.discord || {};
            const isStale = healthData._isStale || false;
            
            embed.fields.push(
                {
                    name: 'Uptime',
                    value: this.formatUptime(botStatus.uptime || 0),
                    inline: true
                },
                {
                    name: 'Memory Usage',
                    value: health.memoryUsage ? 
                        `${Math.round((health.memoryUsage.used / 1024 / 1024) * 100) / 100} MB` : 
                        'Unknown',
                    inline: true
                },
                {
                    name: 'Discord Connection',
                    value: isStale ? 
                        '🔄 Connecting...' : // Show "Connecting" if health data is stale
                        (discord.connected ? 
                            `✅ Connected (${discord.guilds || 0} guilds, ${discord.users || 0} users)` : 
                            '❌ Disconnected'),
                    inline: true
                },
                {
                    name: 'Error Count',
                    value: health.errorCount ? health.errorCount.toString() : '0',
                    inline: true
                }
            );

            if (health.errorCount && health.errorCount > 0) {
                embed.fields.push({
                    name: 'Health Status',
                    value: health.healthy ? '✅ Healthy' : '⚠️ Issues detected',
                    inline: true
                });
            }

            if (botStatus.lastSeen) {
                embed.fields.push({
                    name: 'Last Seen',
                    value: `<t:${Math.floor(new Date(botStatus.lastSeen).getTime() / 1000)}:R>`,
                    inline: true
                });
            }
            
            // Add note if health data is stale
            if (isStale) {
                const staleDurationSeconds = Math.floor((healthData._staleDuration || 0) / 1000);
                embed.fields.push({
                    name: '⚠️ Note',
                    value: `Health data is ${staleDurationSeconds}s old - metrics may be outdated`,
                    inline: false
                });
            }
        } else if (!isOnline) {
            // Add offline information using the same timestamp sources
            let offlineTimestamp = null;
            
            // Use the most recent timestamp available
            if (healthData && healthData.botStatus && healthData.botStatus.lastSeen) {
                offlineTimestamp = healthData.botStatus.lastSeen;
            } else if (currentStatus.lastOffline) {
                offlineTimestamp = currentStatus.lastOffline;
            } else if (currentStatus.lastOnline) {
                offlineTimestamp = currentStatus.lastOnline;
            }
            
            embed.fields.push({
                name: 'Offline Since',
                value: offlineTimestamp ? 
                    `<t:${Math.floor(new Date(offlineTimestamp).getTime() / 1000)}:R>` : 
                    'Unknown',
                inline: true
            });

            embed.fields.push({
                name: 'Discord Connection',
                value: '🔄 **Backup System Active**\n✅ Offline responses enabled',
                inline: true
            });

            embed.fields.push({
                name: 'Consecutive Failures',
                value: currentStatus.consecutiveFailures ? currentStatus.consecutiveFailures.toString() : '1',
                inline: true
            });

            // Add reason if available
            if (healthData && healthData.botStatus && healthData.botStatus.reason) {
                embed.fields.push({
                    name: 'Reason',
                    value: healthData.botStatus.reason,
                    inline: false
                });
            } else {
                embed.fields.push({
                    name: 'Reason',
                    value: 'Bot process not detected',
                    inline: false
                });
            }
        }

        return embed;
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    async sendWebhookNotification(isOnline, healthData, isUpdate = false) {
        if (!this.webhookUrl || !this.botSpamChannelId) {
            console.log('⚠️  Webhook URL or BOT_SPAM channel not configured');
            console.log('⚠️  Set DISCORD_ALERT_WEBHOOK and BOT_SPAM environment variables to enable webhook notifications');
            return null;
        }

        try {
            const embed = this.createStatusEmbed(isOnline, healthData);
            const status = this.getStatus();

            console.log(`📡 Sending ${isUpdate ? 'updated' : 'new'} webhook notification for ${isOnline ? 'online' : 'offline'} status...`);

            if (isUpdate && status.webhookMessageId) {
                // Update existing message
                const editUrl = `${this.webhookUrl}/messages/${status.webhookMessageId}`;
                const response = await axios.patch(editUrl, {
                    embeds: [embed]
                });
                console.log(`✅ Updated webhook message for ${isOnline ? 'online' : 'offline'} status`);
                return status.webhookMessageId;
            } else {
                // Send new message
                const response = await axios.post(this.webhookUrl, {
                    embeds: [embed]
                });
                
                const messageId = response.data.id;
                console.log(`✅ Sent new webhook notification for ${isOnline ? 'online' : 'offline'} status (Message ID: ${messageId || 'undefined'})`);
                
                // Store message ID for future updates
                this.updateStatus({ webhookMessageId: messageId });
                return messageId;
            }
        } catch (error) {
            console.error('❌ Error sending webhook notification:', error.response?.data || error.message);
            return null;
        }
    }

    async performStatusCheck() {
        const isOnline = this.checkBotStatus();
        let healthData = this.getHealthData();
        const currentStatus = this.getStatus();
        
        const timestamp = new Date().toLocaleTimeString();
        
        // Check if status changed
        const statusChanged = currentStatus.isOnline !== isOnline;
        
        if (statusChanged) {
            console.log(`🔄 Status changed from ${currentStatus.isOnline ? 'ONLINE' : 'OFFLINE'} to ${isOnline ? 'ONLINE' : 'OFFLINE'} (${timestamp})`);
            
            // Record the exact time of status change
            const statusChangeTime = new Date().toISOString();
            
            // Update health status file when going offline
            if (!isOnline) {
                this.updateHealthStatus(false, statusChangeTime);
            } else {
                // Bot just came online - wait a bit for it to update its health file
                console.log('⏳ Waiting 5 seconds for bot to initialize and update health data...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                // Re-read health data after waiting
                healthData = this.getHealthData();
                console.log(`📊 Health data refreshed - Discord connected: ${healthData.discord?.connected || false}`);
            }
            
            // Update status with the exact change time
            const newStatus = {
                isOnline: isOnline,
                consecutiveFailures: isOnline ? 0 : (currentStatus.consecutiveFailures || 0) + 1,
                lastOnline: isOnline ? statusChangeTime : currentStatus.lastOnline,
                lastOffline: !isOnline ? statusChangeTime : currentStatus.lastOffline,
                statusChangeTime: statusChangeTime
            };
            
            this.updateStatus(newStatus);
            
            // Send or update webhook notification for status change
            console.log('📡 Sending webhook notification for status change...');
            await this.sendWebhookNotification(isOnline, healthData, currentStatus.webhookMessageId !== null);
        } else {
            // Status hasn't changed - just update the check time silently
            console.log(`🔍 Bot status check: ${isOnline ? 'ONLINE' : 'OFFLINE'} (${timestamp}) - no change`);
            this.updateStatus({
                isOnline: isOnline,
                consecutiveFailures: isOnline ? 0 : (currentStatus.consecutiveFailures || 0) + 1
            });
        }
    }

    start() {
        console.log('Starting unified monitoring service...');
        
        // Perform initial check
        this.performStatusCheck();
        
        // Set up periodic checks
        this.intervalId = setInterval(() => {
            this.performStatusCheck();
        }, this.checkInterval);
        
        console.log(`Monitoring service started with ${this.checkInterval / 1000}s intervals`);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Monitoring service stopped');
        }
    }

    // Method to manually trigger a status check (useful for testing)
    async checkNow() {
        console.log('Manual status check triggered');
        await this.performStatusCheck();
    }
}

// Export for use in other modules
export default UnifiedMonitoringService;

// If run directly, start the monitoring service
if (import.meta.url === `file://${process.argv[1]}`) {
    const monitor = new UnifiedMonitoringService();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down monitoring service...');
        monitor.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\nShutting down monitoring service...');
        monitor.stop();
        process.exit(0);
    });
    
    monitor.start();
}
