// healthMonitor.js - Simple health monitoring and logging
import fs from 'fs';
import path from 'path';
import errorHandler from './errorHandler.js';

class HealthMonitor {
    constructor() {
        this.startTime = Date.now();
        this.lastHealthCheck = Date.now();
        this.healthCheckInterval = 5 * 60 * 1000; // 5 minutes
        this.logInterval = 30 * 60 * 1000; // 30 minutes
        this.setupHealthChecks();
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

        // Initial health check after startup
        setTimeout(() => {
            this.performHealthCheck();
        }, 30000); // Wait 30 seconds after startup
    }

    performHealthCheck() {
        const health = errorHandler.getHealthStatus();
        
        // Log health status
        console.log(`📊 Health Check - ${new Date().toISOString()}`);
        console.log(`   Healthy: ${health.healthy ? '✅' : '❌'}`);
        console.log(`   Errors (last hour): ${health.errorCount}`);
        console.log(`   Critical errors: ${health.criticalErrorCount}`);
        console.log(`   Uptime: ${Math.floor(health.uptime / 60)} minutes`);
        console.log(`   Memory: ${Math.round((health.memoryUsage?.used || 0) / 1024 / 1024)} MB`);
        
        // Alert on unhealthy status
        if (!health.healthy) {
            console.warn('🚨 HEALTH ALERT: Bot is in unhealthy state!');
            this.logCriticalAlert(health);
        }

        // Alert on high memory usage (> 500MB)
        const memoryMB = (health.memoryUsage?.used || 0) / 1024 / 1024;
        if (memoryMB > 500) {
            console.warn(`🚨 MEMORY ALERT: High memory usage detected: ${Math.round(memoryMB)} MB`);
        }

        this.lastHealthCheck = Date.now();
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

    // Method to get a summary for Discord commands
    getHealthSummary() {
        const health = errorHandler.getHealthStatus();
        const uptime = this.getUptimeStats();
        
        return {
            status: health.healthy ? 'Healthy' : 'Unhealthy',
            uptime: `${uptime.uptimeHours}h ${uptime.uptimeMinutes % 60}m`,
            errorCount: health.errorCount,
            memoryUsage: `${Math.round(health.memoryUsage.used / 1024 / 1024)} MB`,
            lastError: health.lastCriticalError ? {
                type: health.lastCriticalError.type,
                time: new Date(health.lastCriticalError.timestamp).toISOString()
            } : null
        };
    }
}

// Export singleton instance
const healthMonitor = new HealthMonitor();
export default healthMonitor;
