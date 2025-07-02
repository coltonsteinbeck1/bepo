// healthMonitor.js - Enhanced health monitoring with online/offline status tracking
import fs from 'fs';
import path from 'path';
import errorHandler from './errorHandler.js';

class HealthMonitor {
    constructor() {
        this.startTime = Date.now();
        this.lastHealthCheck = Date.now();
        this.lastHeartbeat = Date.now();
        this.healthCheckInterval = 5 * 60 * 1000; // 5 minutes
        this.logInterval = 30 * 60 * 1000; // 30 minutes
        this.heartbeatInterval = 30 * 1000; // 30 seconds
        this.statusFile = path.join(process.cwd(), 'logs', 'bot-status.json');
        this.isOnline = true;
        this.discordClient = null;
        this.setupHealthChecks();
        this.createInitialStatusFile();
    }

    setDiscordClient(client) {
        this.discordClient = client;
        this.setupDiscordEventListeners();
    }

    setupDiscordEventListeners() {
        if (!this.discordClient) return;

        this.discordClient.on('ready', () => {
            this.isOnline = true;
            console.log('🟢 Discord bot is ONLINE');
            this.updateStatusFile();
        });

        this.discordClient.on('disconnect', () => {
            this.isOnline = false;
            console.log('🔴 Discord bot is OFFLINE');
            this.updateStatusFile();
        });

        this.discordClient.on('error', (error) => {
            console.error('Discord client error:', error);
            this.updateStatusFile();
        });
    }

    createInitialStatusFile() {
        try {
            const logDir = path.dirname(this.statusFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            this.updateStatusFile();
        } catch (error) {
            console.error('Failed to create initial status file:', error);
        }
    }

    updateStatusFile() {
        const health = errorHandler.getHealthStatus();
        const statusData = {
            botStatus: {
                isOnline: this.isOnline,
                status: this.isOnline ? 'ONLINE' : 'OFFLINE',
                lastSeen: new Date().toISOString(),
                uptime: this.isOnline ? Date.now() - this.startTime : 0,
                startTime: new Date(this.startTime).toISOString()
            },
            health: {
                healthy: health.healthy,
                errorCount: health.errorCount,
                criticalErrorCount: health.criticalErrorCount,
                memoryUsage: health.memoryUsage,
                lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
                lastCriticalError: health.lastCriticalError
            },
            discord: {
                connected: this.discordClient?.isReady() || false,
                ping: this.discordClient?.ws?.ping || null,
                guilds: this.discordClient?.guilds?.cache?.size || 0,
                users: this.discordClient?.users?.cache?.size || 0
            },
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid
            },
            lastUpdated: new Date().toISOString()
        };

        try {
            fs.writeFileSync(this.statusFile, JSON.stringify(statusData, null, 2));
        } catch (error) {
            console.error('Failed to update status file:', error);
        }
    }

    setupHealthChecks() {
        // Periodic health checks
        setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);

        // Periodic health logging
        setInterval(() => {
            this.logHealthStatus();
        }, this.logInterval);

        // Heartbeat to update status file
        setInterval(() => {
            this.updateStatusFile();
        }, this.heartbeatInterval);

        // Initial health check after startup
        setTimeout(() => {
            this.performHealthCheck();
        }, 30000); // Wait 30 seconds after startup
    }

    performHealthCheck() {
        const health = errorHandler.getHealthStatus();
        
        // Log health status
        console.log(`📊 Health Check - ${new Date().toISOString()}`);
        console.log(`   Online: ${this.isOnline ? '🟢' : '🔴'} ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        console.log(`   Healthy: ${health.healthy ? '✅' : '❌'}`);
        console.log(`   Discord: ${this.discordClient?.isReady() ? '🔗 Connected' : '❌ Disconnected'}`);
        console.log(`   Errors (last hour): ${health.errorCount}`);
        console.log(`   Critical errors: ${health.criticalErrorCount}`);
        console.log(`   Uptime: ${Math.floor((Date.now() - this.startTime) / 60000)} minutes`);
        console.log(`   Memory: ${Math.round((health.memoryUsage?.used || 0) / 1024 / 1024)} MB`);
        if (this.discordClient?.ws?.ping) {
            console.log(`   Discord Ping: ${this.discordClient.ws.ping}ms`);
        }
        
        // Alert on unhealthy status
        if (!health.healthy) {
            console.warn('🚨 HEALTH ALERT: Bot is in unhealthy state!');
            this.logCriticalAlert(health);
        }

        // Alert on Discord disconnection
        if (this.isOnline && !this.discordClient?.isReady()) {
            console.warn('🚨 DISCORD ALERT: Bot is online but Discord is disconnected!');
        }

        // Alert on high memory usage (> 500MB)
        const memoryMB = (health.memoryUsage?.used || 0) / 1024 / 1024;
        if (memoryMB > 500) {
            console.warn(`🚨 MEMORY ALERT: High memory usage detected: ${Math.round(memoryMB)} MB`);
        }

        this.lastHealthCheck = Date.now();
        this.updateStatusFile();
    }

    logHealthStatus() {
        const health = errorHandler.getHealthStatus();
        const logData = {
            timestamp: new Date().toISOString(),
            healthy: health.healthy,
            errorCount: health.errorCount,
            criticalErrorCount: health.criticalErrorCount,
            uptime: health.uptime,
            memoryUsage: health.memoryUsage,
            lastCriticalError: health.lastCriticalError
        };

        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logFile = path.join(logDir, `health-${new Date().toISOString().split('T')[0]}.json`);
            fs.appendFileSync(logFile, JSON.stringify(logData) + '\n');
        } catch (error) {
            console.error('Failed to write health log:', error);
        }
    }

    logCriticalAlert(health) {
        const alertData = {
            timestamp: new Date().toISOString(),
            type: 'HEALTH_ALERT',
            errorCount: health.errorCount,
            criticalErrorCount: health.criticalErrorCount,
            lastCriticalError: health.lastCriticalError,
            uptime: health.uptime,
            memoryUsage: health.memoryUsage
        };

        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const alertFile = path.join(logDir, 'critical-alerts.json');
            fs.appendFileSync(alertFile, JSON.stringify(alertData) + '\n');
        } catch (error) {
            console.error('Failed to write critical alert:', error);
        }
    }

    getUptimeStats() {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const health = errorHandler.getHealthStatus();
        
        return {
            startTime: new Date(this.startTime).toISOString(),
            uptimeSeconds,
            uptimeMinutes: Math.floor(uptimeSeconds / 60),
            uptimeHours: Math.floor(uptimeSeconds / 3600),
            healthy: health.healthy,
            errorRate: health.errorCount,
            lastHealthCheck: new Date(this.lastHealthCheck).toISOString()
        };
    }

    // Method to get enhanced summary for Discord commands
    getHealthSummary() {
        const health = errorHandler.getHealthStatus();
        const uptime = this.getUptimeStats();
        
        return {
            online: this.isOnline,
            status: this.isOnline ? 'ONLINE' : 'OFFLINE',
            healthy: health.healthy,
            discord: {
                connected: this.discordClient?.isReady() || false,
                ping: this.discordClient?.ws?.ping || null,
                guilds: this.discordClient?.guilds?.cache?.size || 0
            },
            uptime: `${uptime.uptimeHours}h ${uptime.uptimeMinutes % 60}m`,
            uptimeSeconds: uptime.uptimeSeconds,
            errorCount: health.errorCount,
            criticalErrorCount: health.criticalErrorCount,
            memoryUsage: `${Math.round((health.memoryUsage?.used || 0) / 1024 / 1024)} MB`,
            memoryTotal: `${Math.round((health.memoryUsage?.total || 0) / 1024 / 1024)} MB`,
            lastError: health.lastCriticalError ? {
                type: health.lastCriticalError.type,
                message: health.lastCriticalError.message || health.lastCriticalError.error,
                time: new Date(health.lastCriticalError.timestamp).toISOString()
            } : null,
            lastHealthCheck: new Date(this.lastHealthCheck).toISOString()
        };
    }

    // Method to read status from file (can be used externally even when bot is offline)
    static getStatusFromFile() {
        try {
            const statusFile = path.join(process.cwd(), 'logs', 'bot-status.json');
            if (fs.existsSync(statusFile)) {
                const data = fs.readFileSync(statusFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to read status file:', error);
        }
        return null;
    }

    // Method to check if bot is online based on last update time
    static isBotOnline() {
        const status = HealthMonitor.getStatusFromFile();
        if (!status) return false;
        
        const lastUpdate = new Date(status.lastUpdated);
        const now = new Date();
        const timeDiff = now - lastUpdate;
        
        // Consider offline if no update in last 2 minutes
        return timeDiff < 2 * 60 * 1000 && status.botStatus.isOnline;
    }
}

// Export singleton instance
const healthMonitor = new HealthMonitor();
export default healthMonitor;
