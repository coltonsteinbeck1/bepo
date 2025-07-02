#!/usr/bin/env node
/**
 * Enhanced Bot Status Checker - Can detect when bot is truly offline
 * Works independently by reading both bot status and monitor status files
 */

import fs from 'fs';
import path from 'path';

const STATUS_FILE = path.join(process.cwd(), 'logs', 'bot-status.json');
const MONITOR_FILE = path.join(process.cwd(), 'logs', 'bot-status-monitor.json');

function formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function getOverallStatus(monitorData, botData) {
    if (!monitorData && !botData) {
        return { icon: '❓', text: 'UNKNOWN', description: 'No status information available' };
    }
    
    if (monitorData) {
        const state = monitorData.monitor.botState;
        const hasProcess = monitorData.monitor.processRunning;
        const isHealthy = monitorData.detectedState?.isHealthy;
        
        switch (state) {
            case 'ONLINE':
                return { 
                    icon: isHealthy ? '🟢' : '🟡', 
                    text: isHealthy ? 'ONLINE & HEALTHY' : 'ONLINE (Issues)',
                    description: isHealthy ? 'Bot is fully operational' : 'Bot is online but has health issues'
                };
            case 'ONLINE_NO_UPDATES':
                return { 
                    icon: '🟡', 
                    text: 'ONLINE (Stale)',
                    description: 'Process running but status updates stopped'
                };
            case 'PROCESS_STOPPED':
                return { 
                    icon: '�', 
                    text: 'PROCESS STOPPED',
                    description: 'Bot process is not running'
                };
            case 'OFFLINE':
                return { 
                    icon: '�', 
                    text: 'OFFLINE',
                    description: 'Bot is completely offline'
                };
            default:
                return { 
                    icon: '❓', 
                    text: 'UNKNOWN',
                    description: `Unknown state: ${state}`
                };
        }
    }
    
    // Fallback to basic bot status if no monitor data
    if (botData) {
        const lastUpdate = new Date(botData.lastUpdated);
        const now = new Date();
        const timeSinceUpdate = now - lastUpdate;
        
        if (timeSinceUpdate < 2 * 60 * 1000 && botData.botStatus?.isOnline) {
            return { 
                icon: '🟢', 
                text: 'ONLINE',
                description: 'Based on recent status update'
            };
        } else {
            return { 
                icon: '🔴', 
                text: 'LIKELY OFFLINE',
                description: 'No recent status updates'
            };
        }
    }
    
    return { icon: '❓', text: 'UNKNOWN', description: 'No status data available' };
}

function checkBotStatus() {
    try {
        let monitorData = null;
        let botData = null;
        
        // Try to read monitor status first (more reliable)
        if (fs.existsSync(MONITOR_FILE)) {
            try {
                const data = fs.readFileSync(MONITOR_FILE, 'utf8');
                monitorData = JSON.parse(data);
            } catch (error) {
                console.log('⚠️  Could not read monitor file:', error.message);
            }
        }
        
        // Try to read bot status file
        if (fs.existsSync(STATUS_FILE)) {
            try {
                const data = fs.readFileSync(STATUS_FILE, 'utf8');
                botData = JSON.parse(data);
            } catch (error) {
                console.log('⚠️  Could not read bot status file:', error.message);
            }
        }
        
        if (!monitorData && !botData) {
            console.log('❌ No status files found. Bot may never have been started or monitor not running.');
            console.log('💡 Start the bot monitor with: node scripts/bot-monitor.js');
            return false;
        }

        const overallStatus = getOverallStatus(monitorData, botData);
        
        console.log('🤖 Enhanced Bot Status Report');
        console.log('=============================');
        console.log(`${overallStatus.icon} Status: ${overallStatus.text}`);
        console.log(`📝 Details: ${overallStatus.description}`);
        console.log('');

        // Monitor information
        if (monitorData) {
            const lastMonitorCheck = new Date(monitorData.monitor.lastCheck);
            const monitorAge = Date.now() - lastMonitorCheck.getTime();
            const offlineTime = monitorData.monitor.consecutiveOfflineChecks * 30; // seconds
            
            console.log('🔍 Monitor Information:');
            console.log(`   Last Check: ${lastMonitorCheck.toLocaleString()} (${formatDuration(monitorAge)} ago)`);
            console.log(`   Process Running: ${monitorData.monitor.processRunning ? '✅ Yes' : '❌ No'}`);
            console.log(`   Bot State: ${monitorData.monitor.botState}`);
            
            if (monitorData.monitor.consecutiveOfflineChecks > 0) {
                console.log(`   Offline Duration: ~${formatDuration(offlineTime * 1000)}`);
            }
            
            if (monitorData.monitor.processInfo?.processCount > 0) {
                console.log(`   Processes Found: ${monitorData.monitor.processInfo.processCount}`);
            }
            console.log('');
        }

        // Bot information (if available and recent)
        if (botData) {
            const lastUpdate = new Date(botData.lastUpdated);
            const updateAge = Date.now() - lastUpdate.getTime();
            
            console.log('🏥 Bot Health Information:');
            console.log(`   Last Update: ${lastUpdate.toLocaleString()} (${formatDuration(updateAge)} ago)`);
            
            if (updateAge < 5 * 60 * 1000) { // If updated within last 5 minutes, show details
                if (botData.botStatus?.uptime) {
                    console.log(`   Uptime: ${formatUptime(botData.botStatus.uptime)}`);
                }
                console.log(`   Discord: ${botData.discord?.connected ? '✅ Connected' : '❌ Disconnected'}`);
                if (botData.discord?.ping) {
                    console.log(`   Ping: ${botData.discord.ping}ms`);
                }
                if (botData.discord?.guilds) {
                    console.log(`   Servers: ${botData.discord.guilds}`);
                }
                console.log(`   Health: ${botData.health?.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
                console.log(`   Errors: ${botData.health?.errorCount || 0} (last hour)`);
                console.log(`   Critical: ${botData.health?.criticalErrorCount || 0}`);
                if (botData.health?.memoryUsage) {
                    const memMB = Math.round(botData.health.memoryUsage.used / 1024 / 1024);
                    const totalMB = Math.round(botData.health.memoryUsage.total / 1024 / 1024);
                    console.log(`   Memory: ${memMB}MB / ${totalMB}MB`);
                }
            } else {
                console.log('   ⚠️  Bot status information is stale');
            }
            console.log('');
        }

        // Recommendations
        if (overallStatus.text.includes('OFFLINE') || overallStatus.text.includes('STOPPED')) {
            console.log('💡 Troubleshooting:');
            if (!monitorData?.monitor?.processRunning) {
                console.log('   • Bot process is not running - start with: npm start');
            }
            if (monitorData && !botData) {
                console.log('   • Bot status file missing - bot may be failing to start');
            }
            console.log('   • Check logs for error messages');
            console.log('   • Ensure all dependencies are installed');
        }
        
        console.log('=============================');
        
        // Return true if bot is fully operational
        return overallStatus.text === 'ONLINE & HEALTHY';
        
    } catch (error) {
        console.error('❌ Error checking bot status:', error.message);
        return false;
    }
}

// If run directly, execute the status check
if (import.meta.url === `file://${process.argv[1]}`) {
    const isHealthy = checkBotStatus();
    process.exit(isHealthy ? 0 : 1);
}

export { checkBotStatus };
