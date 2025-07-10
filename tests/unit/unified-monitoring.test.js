/**
 * Unit tests for UnifiedMonitoringService
 */

import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import UnifiedMonitoringService from '../../scripts/monitor-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('UnifiedMonitoringService', () => {
    let monitor;
    let tempDir;
    let originalEnv;

    beforeEach(() => {
        // Save original environment variables
        originalEnv = {
            DISCORD_ALERT_WEBHOOK: process.env.DISCORD_ALERT_WEBHOOK,
            BOT_SPAM: process.env.BOT_SPAM
        };

        // Set test environment variables
        process.env.DISCORD_ALERT_WEBHOOK = 'https://discord.com/api/webhooks/test/webhook';
        process.env.BOT_SPAM = '123456789012345678';

        // Create temporary directory for test files
        tempDir = path.join(__dirname, 'temp');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });

        // Create monitor instance (will initialize with default paths)
        monitor = new UnifiedMonitoringService();
        
        // Override paths for testing after initialization
        monitor.statusFile = path.join(tempDir, 'bot-status-monitor.json');
        monitor.healthFile = path.join(tempDir, 'bot-status.json');
    });

    afterEach(() => {
        // Restore original environment variables
        if (originalEnv.DISCORD_ALERT_WEBHOOK) {
            process.env.DISCORD_ALERT_WEBHOOK = originalEnv.DISCORD_ALERT_WEBHOOK;
        } else {
            delete process.env.DISCORD_ALERT_WEBHOOK;
        }

        if (originalEnv.BOT_SPAM) {
            process.env.BOT_SPAM = originalEnv.BOT_SPAM;
        } else {
            delete process.env.BOT_SPAM;
        }

        // Clean up temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }

        // Stop any running monitors
        if (monitor) {
            monitor.stop();
        }
    });

    describe('Initialization', () => {
        it('should initialize with correct properties', () => {
            expect(monitor.webhookUrl).toBe('https://discord.com/api/webhooks/test/webhook');
            expect(monitor.botSpamChannelId).toBe('123456789012345678');
            expect(monitor.checkInterval).toBe(30000);
        });

        it('should create status file if it does not exist', () => {
            // Initialize the monitor which should create the status file
            monitor.initializeStatus();
            
            expect(fs.existsSync(monitor.statusFile)).toBe(true);
            const status = JSON.parse(fs.readFileSync(monitor.statusFile, 'utf8'));
            expect(status).toHaveProperty('isOnline');
            expect(status).toHaveProperty('lastCheck');
            expect(status).toHaveProperty('consecutiveFailures');
            expect(status).toHaveProperty('webhookMessageId');
        });
    });

    describe('Status Management', () => {
        it('should read status correctly', () => {
            const status = monitor.getStatus();
            expect(status).toHaveProperty('isOnline');
            expect(status).toHaveProperty('lastCheck');
            expect(status).toHaveProperty('consecutiveFailures');
            expect(status).toHaveProperty('webhookMessageId');
        });

        it('should update status correctly', () => {
            const newStatus = { isOnline: true, consecutiveFailures: 0 };
            const updatedStatus = monitor.updateStatus(newStatus);
            
            expect(updatedStatus.isOnline).toBe(true);
            expect(updatedStatus.consecutiveFailures).toBe(0);
            expect(updatedStatus).toHaveProperty('lastCheck');
        });

        it('should handle missing status file gracefully', () => {
            // Delete the status file
            if (fs.existsSync(monitor.statusFile)) {
                fs.unlinkSync(monitor.statusFile);
            }
            
            const status = monitor.getStatus();
            expect(status).toHaveProperty('isOnline', false);
            expect(status).toHaveProperty('consecutiveFailures', 0);
        });
    });

    describe('Health Data', () => {
        it('should return default health data when file does not exist', () => {
            const healthData = monitor.getHealthData();
            expect(healthData).toHaveProperty('status', 'unknown');
            expect(healthData).toHaveProperty('uptime', 0);
            expect(healthData).toHaveProperty('memory');
            expect(healthData).toHaveProperty('errors');
            expect(healthData).toHaveProperty('lastUpdated');
        });

        it('should read health data from file when available', () => {
            const testHealthData = {
                status: 'online',
                uptime: 3600,
                memory: { used: 50000000, total: 100000000 },
                errors: { count: 0, recent: [] },
                lastUpdated: new Date().toISOString()
            };

            fs.writeFileSync(monitor.healthFile, JSON.stringify(testHealthData, null, 2));
            
            const healthData = monitor.getHealthData();
            expect(healthData.status).toBe('online');
            expect(healthData.uptime).toBe(3600);
            expect(healthData.memory.used).toBe(50000000);
        });
    });

    describe('Embed Creation', () => {
        it('should create offline embed correctly', () => {
            const healthData = {
                botStatus: {
                    lastSeen: '2025-07-10T20:00:00.000Z',
                    reason: 'Bot process not detected'
                }
            };

            const embed = monitor.createStatusEmbed(false, healthData);
            
            expect(embed.title).toBe('🤖 Bot Status Monitor');
            expect(embed.color).toBe(0xff0000); // Red for offline
            expect(embed.fields[0].value).toBe('**OFFLINE**');
            expect(embed.fields).toHaveLength(6); // Status, Last Check, Offline Since, Discord Connection, Consecutive Failures, Reason
            
            const fieldNames = embed.fields.map(f => f.name);
            expect(fieldNames).toContain('Status');
            expect(fieldNames).toContain('Last Check');
            expect(fieldNames).toContain('Offline Since');
            expect(fieldNames).toContain('Discord Connection');
            expect(fieldNames).toContain('Consecutive Failures');
            expect(fieldNames).toContain('Reason');
        });

        it('should create online embed correctly', () => {
            const healthData = {
                botStatus: {
                    uptime: 3600,
                    lastSeen: '2025-07-10T20:00:00.000Z'
                },
                health: {
                    memoryUsage: { used: 25000000, total: 50000000 },
                    errorCount: 0,
                    healthy: true
                },
                discord: {
                    connected: true,
                    guilds: 2,
                    users: 5
                }
            };

            const embed = monitor.createStatusEmbed(true, healthData);
            
            expect(embed.title).toBe('🤖 Bot Status Monitor');
            expect(embed.color).toBe(0x00ff00); // Green for online
            expect(embed.fields[0].value).toBe('**ONLINE**');
            
            // Should have at least: Status, Last Check, Uptime, Memory Usage, Discord Connection, Error Count, Last Seen
            expect(embed.fields.length).toBeGreaterThanOrEqual(6);
            
            const fieldNames = embed.fields.map(f => f.name);
            expect(fieldNames).toContain('Status');
            expect(fieldNames).toContain('Last Check');
            expect(fieldNames).toContain('Uptime');
            expect(fieldNames).toContain('Memory Usage');
            expect(fieldNames).toContain('Discord Connection');
            expect(fieldNames).toContain('Error Count');
        });

        it('should include health status in online embed when errors are present', () => {
            const healthData = {
                botStatus: {
                    uptime: 3600,
                    lastSeen: '2025-07-10T20:00:00.000Z'
                },
                health: {
                    memoryUsage: { used: 25000000, total: 50000000 },
                    errorCount: 2,
                    healthy: false
                },
                discord: {
                    connected: true,
                    guilds: 2,
                    users: 5
                }
            };

            const embed = monitor.createStatusEmbed(true, healthData);
            
            const fieldNames = embed.fields.map(f => f.name);
            expect(fieldNames).toContain('Health Status');
            
            const healthStatusField = embed.fields.find(field => field.name === 'Health Status');
            expect(healthStatusField).toBeDefined();
            expect(healthStatusField.value).toContain('Issues detected');
        });
    });

    describe('Uptime Formatting', () => {
        it('should format seconds correctly', () => {
            expect(monitor.formatUptime(30)).toBe('30s');
        });

        it('should format minutes and seconds correctly', () => {
            expect(monitor.formatUptime(150)).toBe('2m 30s');
        });

        it('should format hours, minutes, and seconds correctly', () => {
            expect(monitor.formatUptime(3723)).toBe('1h 2m 3s');
        });

        it('should handle zero uptime', () => {
            expect(monitor.formatUptime(0)).toBe('0s');
        });
    });

    describe('Bot Status Detection', () => {
        it('should detect bot status using process check', () => {
            // This test depends on the actual system state
            const isOnline = monitor.checkBotStatus();
            expect(typeof isOnline).toBe('boolean');
        });
    });

    describe('Configuration', () => {
        it('should handle missing environment variables gracefully', () => {
            delete process.env.DISCORD_ALERT_WEBHOOK;
            delete process.env.BOT_SPAM;
            
            const testMonitor = new UnifiedMonitoringService();
            expect(testMonitor.webhookUrl).toBeUndefined();
            expect(testMonitor.botSpamChannelId).toBeUndefined();
        });
    });
});
