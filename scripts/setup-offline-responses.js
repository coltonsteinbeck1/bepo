#!/usr/bin/env node
/**
 * Setup script for the Offline Response System
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

async function setupOfflineResponseSystem() {
    console.log('🔧 Setting up Offline Response System\n');
    
    console.log('This system allows an external monitor to respond to bot mentions when the main bot is offline.');
    console.log('It uses a lightweight Discord client to monitor for mentions and send status updates.\n');

    // Ask for channel configuration
    console.log('📢 Channel Configuration:');
    console.log('Which channels should be monitored for offline responses?');
    console.log('(Leave empty to monitor all channels, or provide comma-separated channel IDs)\n');
    
    const channels = await askQuestion('Channel IDs (optional): ');
    
    // Read existing .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add configuration
    if (channels.trim()) {
        if (envContent.includes('OFFLINE_RESPONSE_CHANNELS=')) {
            envContent = envContent.replace(
                /OFFLINE_RESPONSE_CHANNELS=.*/,
                `OFFLINE_RESPONSE_CHANNELS=${channels.trim()}`
            );
        } else {
            envContent += `\n# Channels to monitor for offline responses (comma-separated)\nOFFLINE_RESPONSE_CHANNELS=${channels.trim()}\n`;
        }
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuration saved!');
    
    // Instructions
    console.log('\n📋 Next Steps:');
    console.log('1. Start the offline response system: npm run offline-monitor');
    console.log('2. The system will monitor for bot mentions and respond when main bot is offline');
    console.log('3. Test by mentioning the bot while it\'s not running');
    
    console.log('\n🔍 How it works:');
    console.log('• A lightweight Discord client monitors configured channels');
    console.log('• When someone mentions the bot, it checks if the main bot is offline');
    console.log('• If offline, it responds with current status information');
    console.log('• Includes cooldown to prevent spam');
    
    console.log('\n⚙️  Files created/updated:');
    console.log('• .env (added OFFLINE_RESPONSE_CHANNELS if specified)');
    console.log('• scripts/offline-response-system.js (the monitoring system)');
    
    rl.close();
}

// Run the setup
setupOfflineResponseSystem().catch(console.error);
