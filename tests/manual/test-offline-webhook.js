#!/usr/bin/env node
/**
 * Simulate Offline Response - Test webhook without Discord
 * This script simulates what happens when someone mentions @Bepo while offline
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_ALERT_WEBHOOK;
const BOT_USER_ID = process.env.BOT_USER_ID;

if (!DISCORD_WEBHOOK_URL) {
    console.error('❌ DISCORD_ALERT_WEBHOOK environment variable not set');
    process.exit(1);
}

if (!BOT_USER_ID) {
    console.error('❌ BOT_USER_ID environment variable not set');
    process.exit(1);
}

async function sendOfflineWebhook() {
    const offlineMessage = {
        content: null,
        embeds: [
            {
                title: "🔴 Bepo is Currently Offline",
                description: "I'm temporarily unavailable, but I'll be back soon!",
                color: 0xff6b6b, // Red color
                fields: [
                    {
                        name: "📊 Status",
                        value: "Offline for maintenance",
                        inline: true
                    },
                    {
                        name: "🕐 Expected Return",
                        value: "Soon™️",
                        inline: true
                    },
                    {
                        name: "💡 What happened?",
                        value: "I detected that you mentioned me while I was offline. This is an automated response to let you know I received your message.",
                        inline: false
                    }
                ],
                footer: {
                    text: "Offline Response System • Bepo",
                    icon_url: "https://cdn.discordapp.com/attachments/123456789/attachment.png"
                },
                timestamp: new Date().toISOString()
            }
        ],
        username: "Bepo (Offline)",
        avatar_url: "https://cdn.discordapp.com/attachments/123456789/attachment.png"
    };

    try {
        console.log('🚀 Sending offline webhook...');
        console.log(`📡 Webhook URL: ${DISCORD_WEBHOOK_URL.substring(0, 50)}...`);
        
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(offlineMessage)
        });

        if (response.ok) {
            console.log('✅ Offline webhook sent successfully!');
            console.log(`📨 Response status: ${response.status}`);
        } else {
            console.error('❌ Failed to send webhook');
            console.error(`📨 Response status: ${response.status}`);
            console.error(`📨 Response text: ${await response.text()}`);
        }
    } catch (error) {
        console.error('❌ Error sending webhook:', error.message);
    }
}

console.log('🧪 Bepo Offline Webhook Test');
console.log('============================');
console.log('');
console.log(`🤖 Bot User ID: ${BOT_USER_ID}`);
console.log(`📡 Webhook URL: ${DISCORD_WEBHOOK_URL ? 'Configured' : 'Missing'}`);
console.log('');

await sendOfflineWebhook();
