#!/usr/bin/env node
/**
 * External Offline Response System for Bepo
 * This system responds to mentions when Bepo is offline
 * It monitors for @mentions in configured channels and responds with offline status
 */

import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Import status checking utilities
import { getStatusChecker } from '../src/utils/statusChecker.js';
import offlineNotificationService from '../src/utils/offlineNotificationService.js';

class OfflineResponseSystem {
    constructor() {
        this.client = null;
        this.botUserId = null;
        this.isMonitoring = false;
        this.lastStatusCheck = 0;
        this.statusCheckInterval = 30000; // 30 seconds
        this.responseChannels = new Set(); // Channels to monitor for mentions
        this.responseCooldown = new Map(); // User cooldown to prevent spam
        this.cooldownDuration = 60000; // 1 minute cooldown per user
        
        this.loadConfiguration();
    }

    loadConfiguration() {
        try {
            // Load response channels from environment or config
            const channels = process.env.OFFLINE_RESPONSE_CHANNELS;
            if (channels) {
                channels.split(',').forEach(channelId => {
                    this.responseChannels.add(channelId.trim());
                });
            }
                 // Get bot user ID for mention detection
        this.botUserId = process.env.BOT_USER_ID;
        
        console.log(`📡 Loaded configuration:`);
        console.log(`   Bepo User ID: ${this.botUserId}`);
        console.log(`   Response Channels: ${Array.from(this.responseChannels).join(', ')}`);
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    async initialize() {
        console.log('🔧 Initializing Offline Response System...');
        
        // Start by monitoring status without logging into Discord
        this.isMonitoring = true;
        this.startStatusMonitoring();
        
        console.log('🎯 Offline Response System is now monitoring bot status...');
        console.log('💡 Will only connect to Discord when main bot goes offline');
    }

    async connectToDiscord() {
        if (this.client && this.client.readyState !== 'DISCONNECTED') {
            console.log('🔄 Already connected to Discord');
            return;
        }

        console.log('🔗 Connecting to Discord for offline responses...');
        
        // Create a lightweight Discord client just for monitoring mentions
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.client.on('ready', async () => {
            console.log(`✅ Offline Response Monitor connected as: ${this.client.user.tag}`);
            this.botUserId = this.client.user.id; // Get bot ID from client
            
            // Set status to invisible to hide online presence
            try {
                await this.client.user.setPresence({
                    status: 'invisible',
                    activities: []
                });
                console.log('👻 Set presence to invisible while in offline mode');
            } catch (error) {
                console.error('❌ Failed to set invisible presence:', error);
            }
        });

        this.client.on('messageCreate', async (message) => {
            await this.handleMessage(message);
        });

        this.client.on('error', (error) => {
            console.error('❌ Offline Response Client Error:', error);
        });

        // Login with the same bot token
        await this.client.login(process.env.BOT_TOKEN);
    }

    async disconnectFromDiscord() {
        if (this.client && this.client.readyState !== 'DISCONNECTED') {
            console.log('🔌 Disconnecting from Discord (main bot is back online)');
            try {
                await this.client.destroy();
                this.client = null;
            } catch (error) {
                console.error('Error disconnecting from Discord:', error);
            }
        }
    }

    startStatusMonitoring() {
        const checkStatus = async () => {
            if (!this.isMonitoring) return;

            try {
                const statusChecker = getStatusChecker();
                const currentStatus = await statusChecker.getBotStatus();
                
                const isMainBotOffline = !currentStatus.summary.operational;
                const wasOffline = this.mainBotOffline;
                this.mainBotOffline = isMainBotOffline;
                
                // Handle state changes
                if (isMainBotOffline && !wasOffline) {
                    // Bot just went offline - connect to Discord
                    console.log(`🔴 Main bot went offline (${currentStatus.summary.status}) - connecting offline response system`);
                    await this.connectToDiscord();
                    this.statusCheckInterval = 30000; // Check every 30 seconds when offline
                } else if (!isMainBotOffline && wasOffline) {
                    // Bot came back online - disconnect from Discord
                    console.log(`� Main bot came back online (${currentStatus.summary.status}) - disconnecting offline response system`);
                    await this.disconnectFromDiscord();
                    this.statusCheckInterval = 120000; // Check every 2 minutes when online
                } else if (isMainBotOffline) {
                    // Still offline
                    console.log(`🔴 Main bot still offline (${currentStatus.summary.status})`);
                    this.statusCheckInterval = 30000;
                } else {
                    // Still online - log occasionally
                    if (Date.now() - this.lastStatusCheck > 300000) { // Only log every 5 minutes when online
                        console.log(`🟢 Main bot operational (${currentStatus.summary.status}) - offline response system standing by`);
                    }
                    this.statusCheckInterval = 120000;
                }
                
                this.lastStatusCheck = Date.now();
            } catch (error) {
                console.error('Status check failed:', error);
                // If we can't check status, don't change connection state
                console.log('⚠️ Status check failed - maintaining current connection state');
            }

            // Schedule next check with dynamic interval
            setTimeout(checkStatus, this.statusCheckInterval);
        };

        // Start with first check
        checkStatus();
    }

    async handleMessage(message) {
        // Ignore messages from bots
        if (message.author.bot) return;

        // Only monitor configured channels (or all if none specified)
        if (this.responseChannels.size > 0 && !this.responseChannels.has(message.channel.id)) {
            return;
        }

        // Check if the bot was mentioned
        const botMentioned = message.mentions.users.has(this.botUserId) || 
                           message.content.includes(`<@${this.botUserId}>`);

        if (!botMentioned) return;

        // We only get here if we're connected to Discord, which means main bot is offline
        console.log(`� Bot mention detected while main bot is offline - responding`);

        // Check user cooldown
        const userId = message.author.id;
        const lastResponse = this.responseCooldown.get(userId);
        if (lastResponse && Date.now() - lastResponse < this.cooldownDuration) {
            console.log(`⏱️ User ${userId} is on cooldown, skipping response`);
            return;
        }

        // Check if this is a health/status request
        const messageContent = message.content.toLowerCase();
        const isHealthRequest = messageContent.includes('health') || 
                               messageContent.includes('status') || 
                               messageContent.includes('/health');

        console.log(`🔴 Responding to ${isHealthRequest ? 'health request' : 'mention'} while main bot is offline`);
        
        if (isHealthRequest) {
            await this.sendHealthResponse(message);
        } else {
            await this.sendOfflineResponse(message);
        }
        
        // Set cooldown for this user
        this.responseCooldown.set(userId, Date.now());
    }

    async sendOfflineResponse(message) {
        try {
            // Get current status for the response
            const statusChecker = getStatusChecker();
            const currentStatus = await statusChecker.getBotStatus();

            // Create rich embed for offline response
            const shutdownReason = currentStatus.bot.shutdownReason || 'Unknown';
            const isPlanned = shutdownReason.includes('Manually') || shutdownReason.includes('script') || 
                             shutdownReason.includes('Testing') || shutdownReason.includes('debugging');
            
            const embed = {
                title: '🔴 Bepo is Currently Offline',
                description: isPlanned ? 
                    '🔧 **Planned Maintenance** - I\'ll be back soon!' :
                    '⚠️ **Unexpected Downtime** - Working on getting back online!',
                color: isPlanned ? 0xffa500 : 0xff6b6b, // Orange for planned, red for unexpected
                fields: [
                    {
                        name: '📊 Current Status',
                        value: `🔴 **OFFLINE**`,
                        inline: true
                    },
                    {
                        name: '🕐 Last Seen',
                        value: this.formatLastSeen(currentStatus),
                        inline: true
                    },
                    {
                        name: '⏱️ Duration',
                        value: this.formatDowntime(currentStatus),
                        inline: true
                    },
                    {
                        name: '� What Happened',
                        value: shutdownReason,
                        inline: false
                    },
                    {
                        name: '💡 Auto-Response Active',
                        value: 'This automated system detected your mention and responded while the main bot is offline.',
                        inline: false
                    }
                ],
                footer: {
                    text: 'Offline Response System • Bepo',
                    icon_url: 'https://cdn.discordapp.com/emojis/1143334637851136051.png'
                },
                timestamp: new Date().toISOString()
            };
            
            // Add contextual fields based on shutdown reason
            if (isPlanned) {
                embed.fields.push({
                    name: '🔄 Expected Return',
                    value: 'Usually within a few minutes',
                    inline: true
                }, {
                    name: '✅ No Action Needed',
                    value: 'This is routine maintenance',
                    inline: true
                });
            } else {
                embed.fields.push({
                    name: '🔄 Recovery Status',
                    value: 'Automatic restart in progress',
                    inline: true
                }, {
                    name: '📞 Need Help?',
                    value: 'Contact <@540624372398817312> for urgent issues',
                    inline: true
                });
            }

            // Try to reply to the message with embed
            await message.reply({
                embeds: [embed],
                allowedMentions: { repliedUser: false }
            });

            console.log(`📬 Sent offline response to ${message.author.tag} in ${message.channel.name || message.channel.id}`);
            
            // Log the response
            this.logOfflineResponse(message, embed.title);
            
        } catch (error) {
            console.error('Failed to send offline response:', error);
            
            // Fallback: try to send via webhook if configured
            await this.sendWebhookFallback(message, error);
        }
    }

    async sendHealthResponse(message) {
        try {
            // Get comprehensive status for health response
            const statusChecker = getStatusChecker();
            const currentStatus = await statusChecker.getBotStatus();
            const healthStatus = await statusChecker.getHealth();

            // Calculate status metrics
            const shutdownReason = currentStatus.bot.shutdownReason || 'Unknown';
            const isPlanned = shutdownReason.includes('Manually') || shutdownReason.includes('script') || 
                             shutdownReason.includes('Testing') || shutdownReason.includes('debugging');
            
            const lastSeenTime = this.formatLastSeen(currentStatus);
            const downtime = this.formatDowntime(currentStatus);

            // Create comprehensive health embed
            const embed = {
                title: '🔴 Bot Health & Status Dashboard (Offline Mode)',
                description: '📡 **Backup System Active** - Health data from offline monitoring',
                color: isPlanned ? 0xffa500 : 0xff0000, // Orange for planned, red for unexpected
                fields: [
                    {
                        name: '🤖 Bot Status',
                        value: `**Status:** 🔴 OFFLINE\n**Health:** ❌ Unavailable`,
                        inline: true
                    },
                    {
                        name: '🕐 Last Seen',
                        value: lastSeenTime,
                        inline: true
                    },
                    {
                        name: '⏱️ Downtime',
                        value: downtime,
                        inline: true
                    },
                    {
                        name: '📋 Shutdown Reason',
                        value: shutdownReason,
                        inline: false
                    },
                    {
                        name: '📡 Backup System',
                        value: '✅ Active (Auto-responding)\n✅ Health monitoring available\n✅ Status checking operational',
                        inline: true
                    },
                    {
                        name: '🔄 Recovery',
                        value: isPlanned ? 
                            '🔧 Planned maintenance\n⏰ Expected return soon' : 
                            '🚨 Automatic restart in progress\n📞 Admin notified',
                        inline: true
                    }
                ],
                footer: {
                    text: 'Offline Health Monitor • Bepo',
                    icon_url: 'https://cdn.discordapp.com/emojis/1143334637851136051.png'
                },
                timestamp: new Date().toISOString()
            };

            // Add health details if available
            if (healthStatus.healthy !== null) {
                embed.fields.push({
                    name: '📊 Last Health Check',
                    value: healthStatus.lastCheck ? 
                        `<t:${Math.floor(new Date(healthStatus.lastCheck).getTime() / 1000)}:R>` : 
                        'No recent health data',
                    inline: true
                });
            }

            // Add contextual information based on shutdown type
            if (isPlanned) {
                embed.fields.push({
                    name: '🔧 Maintenance Info',
                    value: 'This is planned maintenance. No action required from users.',
                    inline: false
                });
            } else if (shutdownReason.includes('Error') || shutdownReason.includes('error')) {
                embed.fields.push({
                    name: '⚠️ Issue Detected',
                    value: 'Bot encountered an error. Automatic recovery is in progress.',
                    inline: false
                });
            }

            // Send the health response
            await message.reply({
                embeds: [embed],
                allowedMentions: { repliedUser: false }
            });

            console.log(`📊 Sent health response to ${message.author.tag} in ${message.channel.name || message.channel.id}`);
            
            // Log the health response
            this.logOfflineResponse(message, 'Health Status (Offline Mode)');
            
        } catch (error) {
            console.error('Failed to send health response:', error);
            
            // Fallback to simple offline response
            await this.sendOfflineResponse(message);
        }
    }

    async sendWebhookFallback(message, originalError) {
        try {
            // Only attempt webhook fallback if webhooks are configured
            if (!offlineNotificationService.webhooks || offlineNotificationService.webhooks.length === 0) {
                console.log('No webhook fallback available');
                return;
            }

            console.log('Attempting webhook fallback for offline response...');
            
            const statusChecker = getStatusChecker();
            const currentStatus = await statusChecker.getBotStatus();
            
            // Create a mention alert via webhook
            const embed = {
                title: '🔴 Bepo Mention Alert - Bepo is Down',
                description: `**${message.author.tag}** mentioned Bepo in **${message.channel.name || 'DM'}**`,
                color: 0xff0000,
                fields: [
                    {
                        name: '📝 Message',
                        value: message.content.slice(0, 1000) + (message.content.length > 1000 ? '...' : ''),
                        inline: false
                    },
                    {
                        name: '🔗 Channel',
                        value: message.url,
                        inline: true
                    },
                    {
                        name: '📊 Bepo Status',
                        value: currentStatus.summary.status,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Bepo Offline Response System - Could not reply directly'
                }
            };

            // Send to first configured webhook
            const webhookUrl = offlineNotificationService.webhooks[0];
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'Bepo Offline Response Monitor',
                    embeds: [embed]
                })
            });

            console.log('✅ Webhook fallback sent successfully');
            
        } catch (fallbackError) {
            console.error('Webhook fallback also failed:', fallbackError);
        }
    }

    logOfflineResponse(message, statusMessage) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                userId: message.author.id,
                username: message.author.tag,
                channelId: message.channel.id,
                channelName: message.channel.name || 'DM',
                messageId: message.id,
                originalMessage: message.content,
                response: statusMessage,
                responseMethod: 'direct_reply'
            };

            const logFile = path.join(process.cwd(), 'logs', 'offline-responses.json');
            fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('Failed to log offline response:', error);
        }
    }

    async stop() {
        console.log('🛑 Stopping Offline Response System...');
        this.isMonitoring = false;
        
        await this.disconnectFromDiscord();
        
        console.log('✅ Offline Response System stopped');
    }

    formatLastSeen(statusData) {
        try {
            // Try to get last seen from different sources
            let lastSeenTime = null;
            
            // First, try the bot.data.botStatus.lastSeen field (ISO string)
            if (statusData.bot?.data?.botStatus?.lastSeen) {
                lastSeenTime = new Date(statusData.bot.data.botStatus.lastSeen);
            }
            // Try the bot's lastUpdated time as fallback
            else if (statusData.bot?.data?.lastUpdated) {
                if (typeof statusData.bot.data.lastUpdated === 'number') {
                    // Unix timestamp in seconds, convert to milliseconds
                    lastSeenTime = new Date(statusData.bot.data.lastUpdated * 1000);
                } else {
                    // ISO string
                    lastSeenTime = new Date(statusData.bot.data.lastUpdated);
                }
            }
            // Try timestamp from status data
            else if (statusData.timestamp) {
                lastSeenTime = new Date(statusData.timestamp);
            }
            
            if (lastSeenTime && !isNaN(lastSeenTime.getTime())) {
                // Use Discord's relative timestamp format
                return `<t:${Math.floor(lastSeenTime.getTime() / 1000)}:R>`;
            } else {
                return 'Unknown';
            }
        } catch (error) {
            console.error('Error formatting last seen time:', error);
            return 'Unknown';
        }
    }

    formatDowntime(statusData) {
        try {
            let durationMs = 0;
            
            // Try to calculate downtime from different sources
            if (statusData.bot?.timeSinceUpdate) {
                // timeSinceUpdate is in seconds, convert to milliseconds
                durationMs = statusData.bot.timeSinceUpdate * 1000;
            } else if (statusData.bot?.data?.botStatus?.lastSeen) {
                // Calculate from last seen time (ISO string)
                const lastSeen = new Date(statusData.bot.data.botStatus.lastSeen);
                if (!isNaN(lastSeen.getTime())) {
                    durationMs = Date.now() - lastSeen.getTime();
                }
            } else if (statusData.bot?.data?.lastUpdated) {
                // lastUpdated might be Unix timestamp (seconds) or ISO string
                let lastUpdate;
                if (typeof statusData.bot.data.lastUpdated === 'number') {
                    // Unix timestamp in seconds, convert to milliseconds
                    lastUpdate = new Date(statusData.bot.data.lastUpdated * 1000);
                } else {
                    // ISO string
                    lastUpdate = new Date(statusData.bot.data.lastUpdated);
                }
                if (!isNaN(lastUpdate.getTime())) {
                    durationMs = Date.now() - lastUpdate.getTime();
                }
            } else {
                return 'Unknown';
            }
            
            // Convert to human-readable format
            const durationMinutes = Math.floor(durationMs / (1000 * 60));
            const durationHours = Math.floor(durationMinutes / 60);
            const durationDays = Math.floor(durationHours / 24);
            
            if (durationDays > 0) {
                return `${durationDays} day${durationDays !== 1 ? 's' : ''}, ${durationHours % 24} hour${(durationHours % 24) !== 1 ? 's' : ''}`;
            } else if (durationHours > 0) {
                return `${durationHours} hour${durationHours !== 1 ? 's' : ''}, ${durationMinutes % 60} min`;
            } else if (durationMinutes > 0) {
                return `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;
            } else {
                return 'Less than 1 minute';
            }
        } catch (error) {
            console.error('Error formatting downtime:', error);
            return 'Unknown';
        }
    }
}

// Handle graceful shutdown
let responseSystem = null;

async function gracefulShutdown() {
    console.log('\n🛑 Offline Response System shutting down...');
    if (responseSystem) {
        await responseSystem.stop();
    }
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Main execution
async function main() {
    try {
        responseSystem = new OfflineResponseSystem();
        await responseSystem.initialize();
        
        console.log('🎯 Offline Response System initialized successfully');
        console.log('💡 Monitoring main bot status - will connect to Discord only when bot goes offline');
        
    } catch (error) {
        console.error('❌ Failed to start Offline Response System:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { OfflineResponseSystem };
