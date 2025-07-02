#!/usr/bin/env node
/**
 * Webhook Configuration Setup
 * This script helps set up Discord webhooks for offline notifications
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise(resolve => {
        rl.question(question, resolve);
    });
}

async function setupWebhooks() {
    console.log('🔧 Setting up Discord Webhooks for Bot Offline Notifications\n');
    
    console.log('To get a Discord webhook URL:');
    console.log('1. Go to your Discord server');
    console.log('2. Right-click on the channel where you want notifications');
    console.log('3. Select "Edit Channel" > "Integrations" > "Webhooks"');
    console.log('4. Click "Create Webhook" and copy the webhook URL\n');

    const webhookUrl = await askQuestion('Enter your Discord webhook URL (or press Enter to skip): ');
    
    if (webhookUrl.trim()) {
        // Validate webhook URL format
        if (!webhookUrl.includes('discord.com/api/webhooks/')) {
            console.log('❌ Invalid webhook URL format');
            process.exit(1);
        }

        // Read existing .env file
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Check if webhook already exists
        if (envContent.includes('DISCORD_ALERT_WEBHOOK=')) {
            // Update existing webhook
            envContent = envContent.replace(
                /DISCORD_ALERT_WEBHOOK=.*/,
                `DISCORD_ALERT_WEBHOOK=${webhookUrl}`
            );
        } else {
            // Add new webhook
            envContent += `\n# Discord webhook for bot offline notifications\nDISCORD_ALERT_WEBHOOK=${webhookUrl}\n`;
        }

        // Write back to .env file
        fs.writeFileSync(envPath, envContent);
        
        console.log('✅ Webhook configured successfully!');
        console.log('📍 Added to .env file as DISCORD_ALERT_WEBHOOK');
        
        // Test the webhook
        const testNotification = await askQuestion('\nWould you like to send a test notification? (y/n): ');
        
        if (testNotification.toLowerCase() === 'y' || testNotification.toLowerCase() === 'yes') {
            await testWebhook(webhookUrl);
        }
    } else {
        console.log('⏭️ Webhook setup skipped');
    }

    console.log('\n📋 Next steps:');
    console.log('1. Make sure your bot monitor is running: npm run monitor');
    console.log('2. The bot will now send notifications when it goes offline');
    console.log('3. Users can mention the bot to check its status when it\'s having issues');
    
    rl.close();
}

async function testWebhook(webhookUrl) {
    try {
        console.log('🧪 Sending test notification...');
        
        // Import the notification service
        const { default: offlineNotificationService } = await import('../src/utils/offlineNotificationService.js');
        
        // Create a test status report
        const testStatusReport = {
            summary: {
                status: 'TEST',
                operational: false
            },
            bot: {
                lastSeen: new Date().toISOString(),
                timeSinceUpdate: 0,
                reason: 'This is a test notification from the webhook setup'
            }
        };

        // Temporarily override webhook for test
        const originalWebhooks = offlineNotificationService.webhooks;
        offlineNotificationService.webhooks = [webhookUrl];
        offlineNotificationService.lastNotificationTime = 0; // Reset cooldown for test

        const success = await offlineNotificationService.sendOfflineAlert(testStatusReport);
        
        // Restore original webhooks
        offlineNotificationService.webhooks = originalWebhooks;
        
        if (success) {
            console.log('✅ Test notification sent successfully!');
            console.log('📬 Check your Discord channel for the test message');
        } else {
            console.log('⚠️ Test notification failed - check the webhook URL');
        }
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }
}

// Run the setup
setupWebhooks().catch(console.error);
