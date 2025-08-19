#!/usr/bin/env node
/**
 * Offline Mode Setup Validator
 * Checks if all required configuration is in place for offline mode to work
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
    'BOT_TOKEN',
    'BOT_USER_ID', 
    'OFFLINE_RESPONSE_CHANNELS',
    'DISCORD_ALERT_WEBHOOK'
];

const requiredFiles = [
    'scripts/bepo-config.sh',
    'scripts/bepo-status.sh',
    'scripts/start-bepo.sh',
    'scripts/stop-bepo.sh',
    'scripts/stop-bot-only.sh',
    'scripts/start-bot-only.sh',
    'scripts/offline-response-system.js',
    'scripts/bot-monitor.js',
    'src/utils/statusChecker.js',
    'src/utils/offlineNotificationService.js'
];

const requiredDirs = [
    'logs',
    'temp'
];

function checkEnvironmentVariables() {
    console.log('🔍 Checking Environment Variables...');
    
    const missing = [];
    const present = [];
    
    for (const envVar of requiredEnvVars) {
        if (process.env[envVar]) {
            present.push(envVar);
        } else {
            missing.push(envVar);
        }
    }
    
    if (present.length > 0) {
        console.log('✅ Present environment variables:');
        present.forEach(env => console.log(`   ${env}: ${process.env[env].substring(0, 20)}...`));
    }
    
    if (missing.length > 0) {
        console.log('❌ Missing environment variables:');
        missing.forEach(env => console.log(`   ${env}`));
        return false;
    }
    
    // Validate channel IDs format
    const channels = process.env.OFFLINE_RESPONSE_CHANNELS;
    if (channels) {
        const channelIds = channels.split(',').map(id => id.trim());
        console.log(`📺 Configured response channels: ${channelIds.length}`);
        channelIds.forEach(id => {
            if (!/^\d{17,20}$/.test(id)) {
                console.log(`⚠️  Invalid channel ID format: ${id}`);
            } else {
                console.log(`   ✅ ${id}`);
            }
        });
    }
    
    return true;
}

function checkRequiredFiles() {
    console.log('\n📁 Checking Required Files...');
    
    const missing = [];
    const present = [];
    
    for (const file of requiredFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            present.push(file);
        } else {
            missing.push(file);
        }
    }
    
    if (present.length > 0) {
        console.log('✅ Present files:');
        present.forEach(file => console.log(`   ${file}`));
    }
    
    if (missing.length > 0) {
        console.log('❌ Missing files:');
        missing.forEach(file => console.log(`   ${file}`));
        return false;
    }
    
    return true;
}

function checkRequiredDirectories() {
    console.log('\n📂 Checking Required Directories...');
    
    const missing = [];
    const present = [];
    
    for (const dir of requiredDirs) {
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
            present.push(dir);
        } else {
            missing.push(dir);
        }
    }
    
    if (present.length > 0) {
        console.log('✅ Present directories:');
        present.forEach(dir => console.log(`   ${dir}`));
    }
    
    if (missing.length > 0) {
        console.log('❌ Missing directories:');
        missing.forEach(dir => console.log(`   ${dir}`));
        
        console.log('\nCreating missing directories...');
        missing.forEach(dir => {
            const dirPath = path.join(process.cwd(), dir);
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`   ✅ Created ${dir}`);
        });
    }
    
    return true;
}

function checkScriptPermissions() {
    console.log('\n🔐 Checking Script Permissions...');
    
    const scripts = ['scripts/start-bepo.sh', 'scripts/stop-bepo.sh', 'scripts/bepo-status.sh', 'scripts/bepo-config.sh'];
    
    for (const script of scripts) {
        const scriptPath = path.join(process.cwd(), script);
        try {
            const stats = fs.statSync(scriptPath);
            const isExecutable = !!(stats.mode & parseInt('111', 8));
            
            if (isExecutable) {
                console.log(`   ✅ ${script} is executable`);
            } else {
                console.log(`   ❌ ${script} is not executable`);
                console.log(`      Run: chmod +x ${script}`);
            }
        } catch (error) {
            console.log(`   ❌ ${script} not found`);
        }
    }
}

function validatePackageJsonScripts() {
    console.log('\n📦 Checking package.json Scripts...');
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const scripts = packageJson.scripts;
        
        const requiredScripts = [
            'start:offline',
            'stop:offline', 
            'monitor',
            'status',
            'logs:offline'
        ];
        
        const missing = requiredScripts.filter(script => !scripts[script]);
        
        if (missing.length === 0) {
            console.log('✅ All required npm scripts present');
        } else {
            console.log('❌ Missing npm scripts:');
            missing.forEach(script => console.log(`   ${script}`));
        }
    } catch (error) {
        console.log('❌ Error reading package.json:', error.message);
    }
}

function generateTestCommands() {
    console.log('\n🧪 Offline Mode Test Commands:');
    console.log('');
    console.log('1. Start all services:');
    console.log('   ./start-bepo.sh');
    console.log('');
    console.log('2. Check status:');
    console.log('   ./bepo-status.sh');
    console.log('');
    console.log('3. Test offline response:');
    console.log('   ./stop-bot-only.sh    # Stops ONLY the bot (keeps monitor & offline running)');
    console.log('   # Wait 2 minutes, then mention @Bepo in Discord');
    console.log('   # You should get an offline response!');
    console.log('');
    console.log('4. Restart just the bot:');
    console.log('   ./start-bot-only.sh   # Starts ONLY the bot');
    console.log('');
    console.log('5. Monitor offline activity:');
    console.log('   tail -f logs/offlineOutput.log');
    console.log('');
    console.log('6. Check offline response history:');
    console.log('   cat logs/offline-responses.json | jq "."');
    console.log('');
    console.log('7. Stop everything:');
    console.log('   ./stop-bepo.sh        # Stops ALL services');
    console.log('');
    console.log('8. Full testing guide:');
    console.log('   cat OFFLINE_MODE_TESTING.md');
}

function main() {
    console.log('🤖 Bepo Offline Mode Setup Validator');
    console.log('=====================================\n');
    
    let allGood = true;
    
    allGood &= checkEnvironmentVariables();
    allGood &= checkRequiredFiles();
    allGood &= checkRequiredDirectories();
    
    checkScriptPermissions();
    validatePackageJsonScripts();
    
    console.log('\n' + '='.repeat(50));
    
    if (allGood) {
        console.log('✅ SETUP VALIDATION PASSED');
        console.log('   Offline mode should work correctly!');
        generateTestCommands();
    } else {
        console.log('❌ SETUP VALIDATION FAILED');
        console.log('   Please fix the issues above before testing offline mode.');
    }
    
    console.log('\n📚 For detailed testing scenarios, see:');
    console.log('   OFFLINE_MODE_TESTING.md');
}

main();
