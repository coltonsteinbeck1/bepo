#!/usr/bin/env node
// check-bot-status.js - CLI tool to check bot status
import { getStatusReport } from '../src/utils/statusChecker.js';

function formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours}h ${minutes}m ${secs}s`;
}

function displayStatus() {
    console.log('\n🤖 Bepo Bot Status Check');
    console.log('========================\n');
    
    const report = getStatusReport();
    
    // Bot Status
    const statusIcon = report.bot.online ? '🟢' : '🔴';
    
    console.log('Bot Status:');
    console.log(`  ${statusIcon} ${report.bot.online ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`  Reason: ${report.bot.reason}`);
    
    if (report.bot.lastSeen) {
        console.log(`  Last Seen: ${new Date(report.bot.lastSeen).toLocaleString()}`);
    }
    
    if (report.bot.timeSinceUpdate !== undefined) {
        console.log(`  Last Update: ${report.bot.timeSinceUpdate}s ago`);
    }
    
    console.log('');
    
    // Health Status
    console.log('Health Status:');
    if (report.health.healthy !== null) {
        const healthIcon = report.health.healthy ? '✅' : '❌';
        console.log(`  ${healthIcon} ${report.health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
        
        if (report.health.errorCount !== undefined) {
            console.log(`  Errors (last hour): ${report.health.errorCount}`);
        }
        
        if (report.health.criticalErrorCount !== undefined) {
            console.log(`  Critical Errors: ${report.health.criticalErrorCount}`);
        }
        
        if (report.health.lastCheck) {
            console.log(`  Last Check: ${new Date(report.health.lastCheck).toLocaleString()}`);
        }
    } else {
        console.log(`  ❓ UNKNOWN - ${report.health.reason}`);
    }
    
    console.log('');
    
    // Discord Details (if available)
    if (report.bot.data?.discord) {
        const discord = report.bot.data.discord;
        console.log('Discord Connection:');
        console.log(`  Connected: ${discord.connected ? '✅ Yes' : '❌ No'}`);
        if (discord.ping) {
            console.log(`  Ping: ${discord.ping}ms`);
        }
        if (discord.guilds) {
            console.log(`  Guilds: ${discord.guilds}`);
        }
        console.log('');
    }
    
    // System Info (if available)
    if (report.bot.data?.system) {
        const system = report.bot.data.system;
        console.log('System Info:');
        console.log(`  Platform: ${system.platform}`);
        console.log(`  Node.js: ${system.nodeVersion}`);
        console.log(`  PID: ${system.pid}`);
        console.log('');
    }
    
    // Uptime (if available)
    if (report.bot.data?.botStatus?.uptime) {
        console.log('Uptime:');
        console.log(`  ${formatUptime(report.bot.data.botStatus.uptime)}`);
        console.log('');
    }
    
    // Overall Summary
    console.log('Overall Status:');
    console.log(`  ${report.summary.status}`);
    
    console.log(`\nReport generated: ${new Date(report.timestamp).toLocaleString()}\n`);
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log('\nBepo Bot Status Checker');
    console.log('Usage: node scripts/check-bot-status-detailed.js [options]');
    console.log('\nOptions:');
    console.log('  --help, -h     Show this help message');
    console.log('  --json         Output in JSON format');
    console.log('  --watch        Watch for changes (updates every 30 seconds)');
    console.log('');
    process.exit(0);
}

if (args.includes('--json')) {
    const report = getStatusReport();
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
}

if (args.includes('--watch')) {
    console.log('👀 Watching bot status (Ctrl+C to stop)...\n');
    
    displayStatus();
    
    setInterval(() => {
        console.clear();
        displayStatus();
    }, 30000);
} else {
    displayStatus();
}
