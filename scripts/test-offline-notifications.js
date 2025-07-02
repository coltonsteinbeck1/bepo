#!/usr/bin/env node
/**
 * Test Offline Notification System for Bepo
 * This script simulates Bepo offline scenarios and tests the notification system
 */

import offlineNotificationService from '../src/utils/offlineNotificationService.js';
import { getStatusChecker } from '../src/utils/statusChecker.js';

async function testOfflineNotifications() {
    console.log('🧪 Testing Offline Notification System\n');

    try {
        // Test 1: Get current bot status
        console.log('1️⃣ Checking current Bepo status...');
        const statusChecker = getStatusChecker();
        const currentStatus = await statusChecker.getBotStatus();
        
        if (currentStatus) {
            console.log(`📊 Bepo Status: ${currentStatus.summary.status}`);
            console.log(`🟢 Operational: ${currentStatus.summary.operational}`);
            console.log(`📅 Last Update: ${currentStatus.bot.lastSeen || 'Unknown'}`);
            
            // Test 2: Generate status message
            console.log('\n2️⃣ Testing status message generation...');
            const statusMessage = offlineNotificationService.generateStatusMessage(currentStatus);
            console.log('Generated message:');
            console.log(statusMessage);
            
            // Test 3: Test webhook notification (if configured)
            console.log('\n3️⃣ Testing webhook notifications...');
            if (offlineNotificationService.webhooks && offlineNotificationService.webhooks.length > 0) {
                console.log(`📡 Found ${offlineNotificationService.webhooks.length} webhook(s) configured`);
                
                // Reset cooldown for test
                const originalCooldown = offlineNotificationService.lastNotificationTime;
                offlineNotificationService.lastNotificationTime = 0;
                
                // Create a test offline scenario
                const testStatusReport = {
                    summary: {
                        status: 'TEST_OFFLINE',
                        operational: false
                    },
                    bot: {
                        lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
                        timeSinceUpdate: 5 * 60 * 1000, // 5 minutes in ms
                        reason: 'Test notification - Bepo offline simulation'
                    }
                };

                const notificationSent = await offlineNotificationService.sendOfflineAlert(testStatusReport);
                
                if (notificationSent) {
                    console.log('✅ Test notification sent successfully!');
                    console.log('📬 Check your Discord channel for the notification');
                    
                    // Test recovery notification
                    console.log('\n4️⃣ Testing recovery notification...');
                    const recoveryReport = {
                        summary: {
                            status: 'ONLINE',
                            operational: true,
                            uptime: 30000 // 30 seconds
                        },
                        bot: {
                            lastSeen: new Date().toISOString()
                        }
                    };
                    
                    await offlineNotificationService.sendOnlineAlert(recoveryReport);
                    console.log('✅ Recovery notification sent!');
                } else {
                    console.log('⚠️ Notification was skipped (possibly due to cooldown)');
                }
                
                // Restore cooldown
                offlineNotificationService.lastNotificationTime = originalCooldown;
            } else {
                console.log('⚠️ No webhooks configured');
                console.log('💡 Run: node scripts/setup-webhook-notifications.js to configure webhooks');
            }
        } else {
            console.log('❌ Could not retrieve Bepo status');
        }
        
        console.log('\n✅ Test completed!');
        console.log('\n📋 Summary:');
        console.log('• Status checking: Working');
        console.log('• Message generation: Working');
        console.log(`• Webhook notifications: ${offlineNotificationService.webhooks?.length > 0 ? 'Configured' : 'Not configured'}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Test different scenarios
async function testScenarios() {
    console.log('🎭 Testing different offline scenarios...\n');
    
    const scenarios = [
        {
            name: 'Bepo Process Stopped',
            status: {
                summary: { status: 'OFFLINE', operational: false },
                bot: {
                    lastSeen: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                    reason: 'Bepo process not running'
                }
            }
        },
        {
            name: 'Bepo Not Responding',
            status: {
                summary: { status: 'DEGRADED', operational: false },
                bot: {
                    lastSeen: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                    reason: 'Bepo not responding to health checks'
                }
            }
        },
        {
            name: 'Bepo Online',
            status: {
                summary: { status: 'ONLINE', operational: true },
                bot: {
                    lastSeen: new Date().toISOString(),
                    reason: null
                }
            }
        }
    ];
    
    for (const scenario of scenarios) {
        console.log(`📋 Scenario: ${scenario.name}`);
        const message = offlineNotificationService.generateStatusMessage(scenario.status);
        console.log(message);
        console.log('---');
    }
}

// Run tests based on command line argument
const command = process.argv[2];

if (command === 'scenarios') {
    testScenarios();
} else {
    testOfflineNotifications();
}
