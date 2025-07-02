#!/usr/bin/env node
/**
 * External Offline Response System for Bepo
 * This system uses Discord webhooks to respond to mentions when Bepo is offline
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

        console.log(`🔴 Responding to mention while Bepo is offline`);
        await this.sendOfflineResponse(message);
        
        // Set cooldown for this user
        this.responseCooldown.set(userId, Date.now());
    }

    async sendOfflineResponse(message) {
        try {
            // Get current status for the response
            const statusChecker = getStatusChecker();
            const currentStatus = await statusChecker.getBotStatus();
            const statusMessage = offlineNotificationService.generateStatusMessage(currentStatus);

            // Try to reply to the message
            await message.reply({
                content: `${statusMessage}\n\n*This is an automated response from the offline monitoring system.*`,
                allowedMentions: { repliedUser: false }
            });

            console.log(`📬 Sent offline response to ${message.author.tag} in ${message.channel.name || message.channel.id}`);
            
            // Log the response
            this.logOfflineResponse(message, statusMessage);
            
        } catch (error) {
            console.error('Failed to send offline response:', error);
            
            // Fallback: try to send via webhook if configured
            await this.sendWebhookFallback(message, error);
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
