#!/usr/bin/env node
/**
 * Test script to validate shutdown reason detection and formatting
 */
import { getStatusChecker } from './src/utils/statusChecker.js';

async function testShutdownReason() {
    console.log('🧪 Testing shutdown reason detection...\n');
    
    try {
        console.log('📦 Importing status checker...');
        const statusChecker = getStatusChecker();
        console.log('✅ Status checker imported successfully');
        
        console.log('📊 Getting bot status...');
        const status = await statusChecker.getBotStatus();
        console.log('✅ Status retrieved successfully');
        
        console.log('\n📊 Current Status Report:');
        console.log('========================');
        console.log(`Bot Online: ${status.summary.operational ? '✅ Yes' : '❌ No'}`);
        console.log(`Status: ${status.summary.status}`);
        console.log(`Shutdown Reason: ${status.bot.shutdownReason || 'N/A'}`);
        
        if (status.bot.lastSeen) {
            console.log(`Last Seen: ${new Date(status.bot.lastSeen).toLocaleString()}`);
        }
        
        if (status.bot.timeSinceUpdate) {
            console.log(`Time Since Update: ${Math.floor(status.bot.timeSinceUpdate / 60)} minutes`);
        }
        
        // Test categorization
        const shutdownReason = status.bot.shutdownReason || 'Unknown';
        const isPlanned = shutdownReason.includes('Manually') || shutdownReason.includes('script') || 
                         shutdownReason.includes('Testing') || shutdownReason.includes('debugging');
        const isError = shutdownReason.includes('Error') || shutdownReason.includes('error') || 
                       shutdownReason.includes('Network') || shutdownReason.includes('connectivity');
        
        console.log('\n📋 Categorization:');
        console.log('==================');
        console.log(`Planned Shutdown: ${isPlanned ? '✅ Yes' : '❌ No'}`);
        console.log(`Error-Related: ${isError ? '✅ Yes' : '❌ No'}`);
        
        // Test embed colors
        const embedColor = isPlanned ? '🟠 Orange (planned)' : '🔴 Red (unexpected)';
        console.log(`Embed Color: ${embedColor}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    }
}

testShutdownReason();