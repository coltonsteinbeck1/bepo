#!/usr/bin/env node
/**
 * Quick Environment Setup for Monitoring System
 * This script helps set up the required environment variables for the unified monitoring system
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔧 Setting up Unified Monitoring System Environment Variables');
console.log('');

const requiredVars = [
    {
        name: 'DISCORD_ALERT_WEBHOOK',
        description: 'Discord webhook URL for sending status notifications',
        example: 'https://discord.com/api/webhooks/1234567890/abcdef...'
    },
    {
        name: 'BOT_SPAM',
        description: 'Discord channel ID where notifications should be sent',
        example: '123456789012345678'
    },
    {
        name: 'BOT_USER_ID',
        description: 'The bot\'s Discord user ID (for offline response system)',
        example: '987654321098765432'
    },
    {
        name: 'OFFLINE_RESPONSE_CHANNELS',
        description: 'Comma-separated list of channel IDs to monitor for mentions',
        example: '123456789012345678,987654321098765432'
    }
];

async function promptForVar(varInfo) {
    return new Promise((resolve) => {
        console.log(`\n📝 ${varInfo.name}:`);
        console.log(`   ${varInfo.description}`);
        console.log(`   Example: ${varInfo.example}`);
        
        rl.question(`   Enter value (or press Enter to skip): `, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function setupEnvironment() {
    console.log('This script will help you set up environment variables for the monitoring system.');
    console.log('You can either:');
    console.log('1. Enter values here and they will be saved to a .env file');
    console.log('2. Set them manually in your environment');
    console.log('');

    const envVars = {};
    
    for (const varInfo of requiredVars) {
        const value = await promptForVar(varInfo);
        if (value) {
            envVars[varInfo.name] = value;
        }
    }

    if (Object.keys(envVars).length > 0) {
        console.log('\n💾 Saving environment variables to .env file...');
        
        let envContent = '';
        
        // Read existing .env if it exists
        const envPath = '.env';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        // Add new variables
        for (const [key, value] of Object.entries(envVars)) {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            const line = `${key}=${value}`;
            
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, line);
                console.log(`   ✅ Updated ${key}`);
            } else {
                envContent += `\n${line}`;
                console.log(`   ✅ Added ${key}`);
            }
        }
        
        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log(`\n✅ Environment variables saved to ${envPath}`);
        
        console.log('\n🔄 Please restart the monitoring service to use the new configuration:');
        console.log('   1. Stop current monitoring: Ctrl+C on the monitor-service.js terminal');
        console.log('   2. Restart: node scripts/monitor-service.js');
    } else {
        console.log('\n⚠️  No environment variables configured.');
        console.log('Please set the following environment variables manually:');
        requiredVars.forEach(varInfo => {
            console.log(`   ${varInfo.name}: ${varInfo.description}`);
        });
    }

    console.log('\n💡 You can also test the setup with:');
    console.log('   node scripts/test-unified-monitoring.js');
    
    rl.close();
}

setupEnvironment().catch(console.error);
