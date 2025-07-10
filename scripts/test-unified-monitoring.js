#!/usr/bin/env node
/**
 * Test Unified Monitoring System for Bepo
 * This script tests the new unified monitoring and notification system
 */

import UnifiedMonitoringService from './monitor-service.js';

async function testUnifiedMonitoring() {
    console.log('🧪 Testing Unified Monitoring System\n');

    try {
        // Set test environment variables
        process.env.DISCORD_ALERT_WEBHOOK = process.env.DISCORD_ALERT_WEBHOOK || 'https://discord.com/api/webhooks/test/webhook';
        process.env.BOT_SPAM = process.env.BOT_SPAM || '123456789012345678';

        console.log('Environment check:');
        console.log(`📡 DISCORD_ALERT_WEBHOOK: ${process.env.DISCORD_ALERT_WEBHOOK ? 'SET' : 'NOT SET'}`);
        console.log(`📢 BOT_SPAM: ${process.env.BOT_SPAM ? 'SET' : 'NOT SET'}\n`);

        // Test 1: Initialize monitoring service
        console.log('1️⃣ Initializing unified monitoring service...');
        const monitor = new UnifiedMonitoringService();
        console.log('✅ Service initialized\n');

        // Test 2: Check bot status
        console.log('2️⃣ Checking bot status...');
        const isOnline = monitor.checkBotStatus();
        console.log(`📊 Bot Status: ${isOnline ? 'ONLINE' : 'OFFLINE'}\n`);

        // Test 3: Get health data
        console.log('3️⃣ Retrieving health data...');
        const healthData = monitor.getHealthData();
        console.log('Health Data:', JSON.stringify(healthData, null, 2));
        console.log('');

        // Test 4: Get current status
        console.log('4️⃣ Getting current status...');
        const status = monitor.getStatus();
        console.log('Current Status:', JSON.stringify(status, null, 2));
        console.log('');

        // Test 5: Test embed creation
        console.log('5️⃣ Testing embed creation...');
        const offlineEmbed = monitor.createStatusEmbed(false, healthData);
        console.log('Offline Embed:');
        console.log(JSON.stringify(offlineEmbed, null, 2));
        console.log('');

        const onlineEmbed = monitor.createStatusEmbed(true, healthData);
        console.log('Online Embed:');
        console.log(JSON.stringify(onlineEmbed, null, 2));
        console.log('');

        // Test 6: Manual status check
        console.log('6️⃣ Performing manual status check...');
        await monitor.checkNow();
        console.log('✅ Manual check completed\n');

        // Test 7: Test webhook notification (if environment allows)
        if (process.env.DISCORD_ALERT_WEBHOOK && process.env.DISCORD_ALERT_WEBHOOK !== 'https://discord.com/api/webhooks/test/webhook') {
            console.log('7️⃣ Testing webhook notification...');
            try {
                const messageId = await monitor.sendWebhookNotification(false, healthData, false);
                if (messageId) {
                    console.log(`✅ Webhook test successful! Message ID: ${messageId}`);
                    
                    // Test updating the same message
                    console.log('🔄 Testing embed update...');
                    setTimeout(async () => {
                        try {
                            await monitor.sendWebhookNotification(true, healthData, true);
                            console.log('✅ Embed update test successful!');
                        } catch (updateError) {
                            console.error('❌ Embed update test failed:', updateError.message);
                        }
                    }, 2000);
                } else {
                    console.log('❌ Webhook test failed');
                }
            } catch (webhookError) {
                console.error('❌ Webhook test error:', webhookError.message);
            }
        } else {
            console.log('7️⃣ Skipping webhook test (no valid webhook URL configured)');
        }

        console.log('\n🎉 Unified monitoring system test completed!');
        console.log('\n💡 To test with a real webhook:');
        console.log('   Set DISCORD_ALERT_WEBHOOK and BOT_SPAM environment variables');
        console.log('   Run: node scripts/test-offline-notifications.js');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testUnifiedMonitoring();
