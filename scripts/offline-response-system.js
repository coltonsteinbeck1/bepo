#!/usr/bin/env node
/**
 * External Offline Response System for Bepo
 * This system uses Discord webhooks to respond to mentions when Bepo is offline
 * It monitors for @mentions in configured c                    {
                        name: '📋 What Happened',
                        value: shutdownReason,
                        inline: false
                    },ls and responds with offline status
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
        
        // Create a lightweight Discord client just for monitoring mentions
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.client.on('ready', () => {
            console.log(`✅ Offline Response Monitor ready as: ${this.client.user.tag}`);
            this.botUserId = this.client.user.id; // Get bot ID from client
            this.isMonitoring = true;
            this.startStatusMonitoring();
            
            // Set status to invisible to hide online presence
            this.client.user.setPresence({
                status: 'invisible'
            });
            console.log('👻 Set presence to invisible to avoid showing as online');
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

    startStatusMonitoring() {
        const checkStatus = async () => {
            if (!this.isMonitoring) return;

            try {
                const statusChecker = getStatusChecker();
                const currentStatus = await statusChecker.getBotStatus();
                
                // Only respond to mentions if main bot is offline/unhealthy
                this.mainBotOffline = !currentStatus.summary.operational;
                
                if (this.mainBotOffline) {
                    console.log(`🔴 Bepo detected as offline/unhealthy: ${currentStatus.summary.status}`);
                } else {
                    // If main bot is online, we can be less active
                    console.log(`🟢 Bepo is operational, standing by...`);
                }
                
                this.lastStatusCheck = Date.now();
            } catch (error) {
                console.error('Status check failed:', error);
                // Assume offline if we can't check status
                this.mainBotOffline = true;
            }

            // Schedule next check
            setTimeout(checkStatus, this.statusCheckInterval);
        };

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

        // Check if main bot is offline
        if (!this.mainBotOffline) {
            console.log(`🟢 Bepo mention detected but Bepo is online, letting main bot handle it`);
            return;
        }

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

        console.log(`🔴 Responding to ${isHealthRequest ? 'health request' : 'mention'} while Bepo is offline`);
        
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
                        value: currentStatus.bot.lastSeen ? 
                            `<t:${Math.floor(new Date(currentStatus.bot.lastSeen).getTime() / 1000)}:R>` : 
                            'Unknown',
                        inline: true
                    },
                    {
                        name: '⏱️ Duration',
                        value: currentStatus.bot.timeSinceUpdate ? 
                            `${Math.floor(currentStatus.bot.timeSinceUpdate / 60)} min` : 
                            'Unknown',
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
            
            const lastSeenTime = currentStatus.bot.lastSeen ? 
                `<t:${Math.floor(new Date(currentStatus.bot.lastSeen).getTime() / 1000)}:R>` : 
                'Unknown';
            
            const downtime = currentStatus.bot.timeSinceUpdate ? 
                `${Math.floor(currentStatus.bot.timeSinceUpdate / 60)} minutes` : 
                'Unknown';

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
        
        if (this.client) {
            await this.client.destroy();
        }
        
        console.log('✅ Offline Response System stopped');
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
        
        console.log('🎯 Offline Response System is now monitoring for mentions...');
        console.log('💡 This system will respond to bot mentions when the main bot is offline');
        
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
