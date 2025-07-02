#!/usr/bin/env node
/**
 * Webhook-Only Offline Response System for Bepo
 * This system uses ONLY Discord webhooks to respond when Bepo is offline
 * No bot client = No "online" status in Discord
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Import status checking utilities
import { getStatusChecker } from '../src/utils/statusChecker.js';
import offlineNotificationService from '../src/utils/offlineNotificationService.js';

class WebhookOfflineResponseSystem {
    constructor() {
        this.isMonitoring = false;
        this.lastStatusCheck = 0;
        this.statusCheckInterval = 30000; // 30 seconds
        this.mainBotOffline = false;
        this.responseWebhooks = new Map(); // Channel ID -> webhook URL mapping
        this.responseCooldown = new Map(); // User cooldown to prevent spam
        this.cooldownDuration = 60000; // 1 minute cooldown per user
        this.botUserId = process.env.BOT_USER_ID;
        
        this.loadConfiguration();
    }

    loadConfiguration() {
        try {
            // Load response channels and create webhook URLs for each
            const channels = process.env.OFFLINE_RESPONSE_CHANNELS;
            if (channels) {
                channels.split(',').forEach(channelId => {
                    const trimmedId = channelId.trim();
                    // Create webhook URL using the alert webhook as base
                    // In a real setup, you'd want separate webhooks per channel
                    this.responseWebhooks.set(trimmedId, process.env.DISCORD_ALERT_WEBHOOK);
                });
            }

            console.log(`📡 Loaded configuration:`);
            console.log(`   Bepo User ID: ${this.botUserId}`);
            console.log(`   Response Channels: ${Array.from(this.responseWebhooks.keys()).join(', ')}`);
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    async initialize() {
        console.log('🔧 Initializing Webhook-Only Offline Response System...');
        console.log('💡 This system monitors via status files (no Discord connection)');
        console.log('✅ No bot presence = Accurate Discord status');
        
        this.startStatusMonitoring();
        this.isMonitoring = true;
        
        console.log('✅ Webhook-Only Offline Response System ready');
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

        // Start checking immediately
        checkStatus();
    }

    // Since we can't monitor Discord messages directly, this would be called
    // by an external system that detects mentions (like a Discord webhook endpoint)
    async handleMentionWebhook(channelId, userId, content, username = 'Unknown User') {
        // Check if this is in a monitored channel
        if (!this.responseWebhooks.has(channelId)) {
            console.log(`📍 Mention detected in non-monitored channel: ${channelId}`);
            return;
        }

        // Check if the bot was mentioned
        const botMentioned = content.includes(`<@${this.botUserId}>`) || 
                           content.includes(`@${this.botUserId}`) ||
                           content.toLowerCase().includes('@bepo');

        if (!botMentioned) {
            console.log(`💬 Message detected but no bot mention in channel ${channelId}`);
            return;
        }

        // Check if main bot is offline
        if (!this.mainBotOffline) {
            console.log(`🟢 Bepo mention detected but Bepo is online, no webhook response needed`);
            return;
        }

        // Check user cooldown
        const lastResponse = this.responseCooldown.get(userId);
        if (lastResponse && Date.now() - lastResponse < this.cooldownDuration) {
            console.log(`⏱️ User ${userId} is on cooldown, skipping response`);
            return;
        }

        console.log(`🔴 Responding to mention while Bepo is offline via webhook`);
        await this.sendOfflineWebhookResponse(channelId, username);
        
        // Set cooldown for this user
        this.responseCooldown.set(userId, Date.now());
    }

    async sendOfflineWebhookResponse(channelId, username = 'User') {
        const webhookUrl = this.responseWebhooks.get(channelId);
        if (!webhookUrl) {
            console.error(`❌ No webhook configured for channel ${channelId}`);
            return;
        }

        try {
            // Get current status for the response
            const statusChecker = getStatusChecker();
            const statusReport = await statusChecker.getBotStatus();
            
            const lastSeen = statusReport.bot.lastSeen ? 
                `<t:${Math.floor(new Date(statusReport.bot.lastSeen).getTime() / 1000)}:R>` : 
                'Unknown';

            const embed = {
                title: "🔴 Bepo is Currently Offline",
                description: "I'm temporarily unavailable, but I'll be back soon!",
                color: 0xff6b6b, // Red color
                fields: [
                    {
                        name: "📊 Status",
                        value: statusReport.summary.status,
                        inline: true
                    },
                    {
                        name: "🕒 Last Seen",
                        value: lastSeen,
                        inline: true
                    },
                    {
                        name: "❓ Reason",
                        value: statusReport.bot.reason,
                        inline: false
                    },
                    {
                        name: "💡 Note",
                        value: `Hey ${username}! I detected that you mentioned me while I was offline. This is an automated response to let you know I received your message.`,
                        inline: false
                    }
                ],
                footer: {
                    text: "Bepo Offline Response System",
                },
                timestamp: new Date().toISOString()
            };

            const payload = {
                embeds: [embed],
                username: "Bepo (Offline)",
                avatar_url: "https://cdn.discordapp.com/attachments/123456789/attachment.png"
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`📬 Sent offline webhook response for ${username} in channel ${channelId}`);
                
                // Log the response
                this.logOfflineResponse({
                    timestamp: new Date().toISOString(),
                    channelId,
                    username,
                    status: statusReport.summary.status,
                    method: 'webhook'
                });
            } else {
                console.error(`❌ Failed to send webhook response: ${response.status}`);
            }
        } catch (error) {
            console.error('Error sending offline webhook response:', error);
        }
    }

    logOfflineResponse(responseData) {
        try {
            const logFile = path.join(process.cwd(), 'logs', 'offline-responses.json');
            const logDir = path.dirname(logFile);
            
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            fs.appendFileSync(logFile, JSON.stringify(responseData) + '\n');
        } catch (error) {
            console.error('Failed to log offline response:', error);
        }
    }

    // Method to be called externally when a mention is detected
    // This could be called by a Discord webhook endpoint you set up
    async processMention(channelId, userId, content, username) {
        await this.handleMentionWebhook(channelId, userId, content, username);
    }

    stop() {
        this.isMonitoring = false;
        console.log('🛑 Webhook-only offline response system stopped');
    }
}

// Create and start the system
const webhookOfflineSystem = new WebhookOfflineResponseSystem();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    webhookOfflineSystem.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    webhookOfflineSystem.stop();
    process.exit(0);
});

// Initialize the system
await webhookOfflineSystem.initialize();

console.log('');
console.log('🌐 Webhook-Only Offline Response System is running!');
console.log('💡 To test: Set up Discord webhook endpoints that call processMention()');
console.log('📝 Or use the original client-based system for automatic mention detection');
console.log('');

// Export for external use
export default webhookOfflineSystem;
