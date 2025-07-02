// statusChecker.js - Standalone utility to check bot status from files
import fs from 'fs';
import path from 'path';

/**
 * Check if the bot is currently online based on status file
 * @returns {Object} Status information
 */
export function checkBotStatus() {
    try {
        const statusFile = path.join(process.cwd(), 'logs', 'bot-status.json');
        
        if (!fs.existsSync(statusFile)) {
            return {
                online: false,
                reason: 'Status file not found',
                lastSeen: null,
                data: null
            };
        }

        const data = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        const lastUpdate = new Date(data.lastUpdated);
        const now = new Date();
        const timeDiff = now - lastUpdate;
        
        // Consider offline if no update in last 2 minutes
        const isOnline = timeDiff < 2 * 60 * 1000 && data.botStatus.isOnline;
        
        return {
            online: isOnline,
            reason: !isOnline ? (timeDiff >= 2 * 60 * 1000 ? 'Last update too old' : 'Bot marked offline') : 'Online',
            lastSeen: data.botStatus.lastSeen,
            data,
            timeSinceUpdate: Math.floor(timeDiff / 1000) // seconds
        };
    } catch (error) {
        return {
            online: false,
            reason: `Error reading status: ${error.message}`,
            lastSeen: null,
            data: null
        };
    }
}

/**
 * Get health status from log files
 * @returns {Object} Health status information
 */
export function getHealthFromLogs() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const healthFile = path.join(process.cwd(), 'logs', `health-${today}.json`);
        
        if (!fs.existsSync(healthFile)) {
            return {
                healthy: null,
                reason: 'No health log for today',
                lastCheck: null
            };
        }

        const lines = fs.readFileSync(healthFile, 'utf8').trim().split('\n');
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        
        return {
            healthy: lastEntry.healthy,
            errorCount: lastEntry.errorCount,
            criticalErrorCount: lastEntry.criticalErrorCount,
            lastCheck: lastEntry.timestamp,
            memoryUsage: lastEntry.memoryUsage
        };
    } catch (error) {
        return {
            healthy: null,
            reason: `Error reading health logs: ${error.message}`,
            lastCheck: null
        };
    }
}

/**
 * Get a comprehensive status report
 * @returns {Object} Complete status report
 */
export function getStatusReport() {
    const botStatus = checkBotStatus();
    const healthStatus = getHealthFromLogs();
    
    return {
        timestamp: new Date().toISOString(),
        bot: botStatus,
        health: healthStatus,
        summary: {
            operational: botStatus.online && (healthStatus.healthy !== false),
            status: botStatus.online ? 
                (healthStatus.healthy === false ? 'DEGRADED' : 'OPERATIONAL') : 
                'OFFLINE',
            uptime: botStatus.data?.botStatus?.uptime || 0
        }
    };
}

// Export default as the main status checker
export default {
    checkBotStatus,
    getHealthFromLogs,
    getStatusReport
};

// Export a factory function for consistency with other modules
export function getStatusChecker() {
    return {
        getBotStatus: getStatusReport,
        checkOnline: checkBotStatus,
        getHealth: getHealthFromLogs
    };
}
