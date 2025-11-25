#!/usr/bin/env node
/**
 * Enhanced Bepo Monitor - Runs independently to monitor bot process and health
 * This script can run as a separate process to detect when Bepo is truly down
 */

import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Import offline notification service if available
let offlineNotificationService = null;
try {
    const { default: service } = await import('../src/utils/offlineNotificationService.js');
    offlineNotificationService = service;
    console.log('✅ Offline notification service loaded');
} catch (error) {
    console.log('⚠️ Offline notification service not available:', error.message);
}

const CONFIG = {
    STATUS_FILE: path.join(process.cwd(), 'logs', 'bot-status.json'),
    MONITOR_LOG: path.join(process.cwd(), 'logs', 'monitor.log'),
    CHECK_INTERVAL: 30000, // 30 seconds
    OFFLINE_THRESHOLD: 90000, // 90 seconds - if no update for this long, consider offline
    BOT_SCRIPT: 'src/index.js', // Main bot script
    BOT_PROCESS_NAME: 'node' // Process name to look for
};

class BepoMonitor {
    constructor() {
        this.isMonitoring = false;
        this.lastKnownStatus = null;
        this.consecutiveOfflineChecks = 0;
        this.setupMonitoring();
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        
        try {
            fs.appendFileSync(CONFIG.MONITOR_LOG, logMessage + '\n');
        } catch (error) {
            console.error('Failed to write to monitor log:', error);
        }
    }

    async setupMonitoring() {
        this.log('🔍 Bepo Monitor starting...');
        
        // Ensure log directory exists
        const logDir = path.dirname(CONFIG.STATUS_FILE);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        this.isMonitoring = true;
        this.startMonitoring();
    }

    startMonitoring() {
        const checkStatus = async () => {
            if (!this.isMonitoring) return;

            try {
                await this.performHealthCheck();
            } catch (error) {
                this.log(`❌ Error during health check: ${error.message}`);
            }

            // Schedule next check
            setTimeout(checkStatus, CONFIG.CHECK_INTERVAL);
        };

        checkStatus();
    }

    async performHealthCheck() {
        const status = await this.getBotStatus();
        const processStatus = await this.checkBotProcess();
        
        const isProcessRunning = processStatus.running;
        const isStatusCurrent = status.isStatusCurrent;
        const statusAge = status.statusAge;

        // Determine overall bot state
        let botState = 'UNKNOWN';
        let stateIcon = '❓';
        
        if (isProcessRunning && isStatusCurrent) {
            botState = status.data?.botStatus?.isOnline ? 'ONLINE' : 'STARTING';
            stateIcon = '🟢';
            this.consecutiveOfflineChecks = 0;
        } else if (isProcessRunning && !isStatusCurrent) {
            botState = 'ONLINE_NO_UPDATES';
            stateIcon = '🟡';
            this.consecutiveOfflineChecks++;
        } else if (!isProcessRunning && isStatusCurrent) {
            botState = 'PROCESS_STOPPED';
            stateIcon = '🔴';
            this.consecutiveOfflineChecks++;
        } else {
            botState = 'OFFLINE';
            stateIcon = '🔴';
            this.consecutiveOfflineChecks++;
        }

        // Log status changes
        if (!this.lastKnownStatus || this.lastKnownStatus.state !== botState) {
            this.log(`${stateIcon} Bepo state changed: ${this.lastKnownStatus?.state || 'UNKNOWN'} → ${botState}`);
            
            if (botState === 'OFFLINE' || botState === 'PROCESS_STOPPED') {
                this.log(`⚠️  Bepo is down! Process running: ${isProcessRunning}, Last update: ${Math.round(statusAge / 1000)}s ago`);
                
                // Send offline notification if service is available
                if (offlineNotificationService) {
                    await this.sendOfflineNotification(status.data, {
                        state: botState,
                        processRunning: isProcessRunning,
                        statusAge: statusAge,
                        reason: `Bepo state: ${botState}, Process: ${isProcessRunning ? 'Running' : 'Stopped'}`
                    });
                }
            } else if ((this.lastKnownStatus?.state === 'OFFLINE' || this.lastKnownStatus?.state === 'PROCESS_STOPPED') && 
                       botState === 'ONLINE') {
                this.log(`✅ Bepo recovery detected: ${this.lastKnownStatus.state} → ${botState}`);
                
                // Send recovery notification if service is available
                if (offlineNotificationService) {
                    await this.sendRecoveryNotification(status.data, {
                        state: botState,
                        previousState: this.lastKnownStatus.state
                    });
                }
            }
        }

        // Update status file with monitor information
        await this.updateMonitorStatus(status.data, {
            state: botState,
            processRunning: isProcessRunning,
            statusAge: statusAge,
            lastMonitorCheck: new Date().toISOString(),
            consecutiveOfflineChecks: this.consecutiveOfflineChecks,
            processInfo: processStatus
        });

        this.lastKnownStatus = { state: botState, timestamp: new Date() };
        
        // Detailed status report every 10 checks
        if (this.consecutiveOfflineChecks % 10 === 0 && this.consecutiveOfflineChecks > 0) {
            this.log(`📊 Extended offline period: ${this.consecutiveOfflineChecks} checks (${Math.round(this.consecutiveOfflineChecks * CONFIG.CHECK_INTERVAL / 60000)} minutes)`);
        }
    }

    async getBotStatus() {
        try {
            if (!fs.existsSync(CONFIG.STATUS_FILE)) {
                return { 
                    data: null, 
                    isStatusCurrent: false, 
                    statusAge: Infinity,
                    exists: false 
                };
            }

            const data = fs.readFileSync(CONFIG.STATUS_FILE, 'utf8');
            const status = JSON.parse(data);
            
            const lastUpdate = new Date(status.lastUpdated);
            const now = new Date();
            const statusAge = now - lastUpdate;
            const isStatusCurrent = statusAge < CONFIG.OFFLINE_THRESHOLD;

            return {
                data: status,
                isStatusCurrent,
                statusAge,
                exists: true
            };
        } catch (error) {
            return { 
                data: null, 
                isStatusCurrent: false, 
                statusAge: Infinity,
                exists: false,
                error: error.message 
            };
        }
    }

    async checkBotProcess() {
        try {
            // Check if any node process is running our bot script
            const { stdout } = await execAsync(`ps aux | grep "${CONFIG.BOT_SCRIPT}" | grep -v grep || true`);
            const processes = stdout.trim().split('\n').filter(line => line.length > 0);
            
            // Also check for any node process in our directory
            const { stdout: nodeProcesses } = await execAsync(`ps aux | grep "node.*bepo" | grep -v grep || true`);
            const nodeProcs = nodeProcesses.trim().split('\n').filter(line => line.length > 0);

            const isRunning = processes.length > 0 || nodeProcs.length > 0;
            
            return {
                running: isRunning,
                processCount: processes.length + nodeProcs.length,
                processes: [...processes, ...nodeProcs],
                checkTime: new Date().toISOString()
            };
        } catch (error) {
            return {
                running: false,
                processCount: 0,
                processes: [],
                error: error.message,
                checkTime: new Date().toISOString()
            };
        }
    }

    async updateMonitorStatus(botStatus, monitorInfo) {
        try {
            const monitorStatus = {
                monitor: {
                    version: '1.0.0',
                    lastCheck: monitorInfo.lastMonitorCheck,
                    botState: monitorInfo.state,
                    processRunning: monitorInfo.processRunning,
                    statusFileAge: monitorInfo.statusAge,
                    consecutiveOfflineChecks: monitorInfo.consecutiveOfflineChecks,
                    processInfo: monitorInfo.processInfo
                },
                bot: botStatus || {
                    status: 'NO_STATUS_FILE',
                    lastSeen: null
                },
                detectedState: {
                    isOnline: monitorInfo.state === 'ONLINE',
                    isHealthy: monitorInfo.state === 'ONLINE' && botStatus?.health?.healthy,
                    hasProcess: monitorInfo.processRunning,
                    statusCurrent: monitorInfo.statusAge < CONFIG.OFFLINE_THRESHOLD
                },
                lastUpdated: new Date().toISOString()
            };

            const statusFile = CONFIG.STATUS_FILE.replace('.json', '-monitor.json');
            fs.writeFileSync(statusFile, JSON.stringify(monitorStatus, null, 2));
        } catch (error) {
            this.log(`❌ Failed to update monitor status: ${error.message}`);
        }
    }

    async sendOfflineNotification(botStatus, monitorInfo) {
        try {
            // Create a status report for the notification service
            const statusReport = {
                summary: {
                    status: 'OFFLINE',
                    operational: false
                },
                bot: {
                    lastSeen: botStatus?.lastUpdated || null,
                    timeSinceUpdate: monitorInfo.statusAge,
                    reason: monitorInfo.reason || 'Bot appears to be offline'
                }
            };

            const notificationSent = await offlineNotificationService.sendOfflineAlert(statusReport);
            if (notificationSent) {
                this.log('📬 Offline notification sent successfully');
            } else {
                this.log('⏭️ Offline notification skipped (cooldown)');
            }
        } catch (error) {
            this.log(`❌ Failed to send offline notification: ${error.message}`);
        }
    }

    async sendRecoveryNotification(botStatus, monitorInfo) {
        try {
            // Create a status report for the notification service
            const statusReport = {
                summary: {
                    status: 'ONLINE',
                    operational: true,
                    uptime: botStatus?.health?.uptime || 0
                },
                bot: {
                    lastSeen: new Date().toISOString(),
                    previousState: monitorInfo.previousState
                }
            };

            await offlineNotificationService.sendOnlineAlert(statusReport);
            this.log('📬 Recovery notification sent successfully');
        } catch (error) {
            this.log(`❌ Failed to send recovery notification: ${error.message}`);
        }
    }

    stop() {
        this.isMonitoring = false;
        this.log('🛑 Bepo Monitor stopped');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Bepo Monitor shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Bepo Monitor terminated');
    process.exit(0);
});

// If run directly, start monitoring
if (import.meta.url === `file://${process.argv[1]}`) {
    const monitor = new BepoMonitor();
    
    process.on('SIGINT', () => {
        monitor.stop();
        process.exit(0);
    });
}

export { BepoMonitor };
