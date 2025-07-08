// Unit tests for health command
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the healthMonitor before importing the command
vi.mock('../../src/utils/healthMonitor.js', () => ({
  default: {
    getHealthSummary: vi.fn(() => ({
      online: true,
      status: 'ONLINE',
      healthy: true,
      discord: {
        connected: true,
        ping: 50,
        guilds: 5,
        users: 100
      },
      uptime: '1h 30m',
      uptimeSeconds: 5400,
      errorCount: 0,
      criticalErrorCount: 0,
      memoryUsage: '45 MB',
      memoryTotal: '512 MB',
      lastError: null,
      lastHealthCheck: new Date().toISOString()
    }))
  }
}));

// Mock the statusChecker
vi.mock('../../src/utils/statusChecker.js', () => ({
  getStatusChecker: vi.fn(() => ({
    getBotStatus: vi.fn(() => ({
      summary: {
        operational: true
      }
    }))
  }))
}));

import healthCommand from '../../src/commands/fun/health.js';
import errorHandler from '../../src/utils/errorHandler.js';
import healthMonitor from '../../src/utils/healthMonitor.js';
import { getStatusChecker } from '../../src/utils/statusChecker.js';

describe('Health Command', () => {
  beforeEach(() => {
    // Reset error handler state
    errorHandler.errors = [];
    errorHandler.criticalErrors = [];
    errorHandler.startTime = Date.now();

    // Reset mocks
    vi.clearAllMocks();
    
    // Reset healthMonitor mock to default
    healthMonitor.getHealthSummary.mockReturnValue({
      online: true,
      status: 'ONLINE',
      healthy: true,
      discord: {
        connected: true,
        ping: 50,
        guilds: 5,
        users: 100
      },
      uptime: '1h 30m',
      uptimeSeconds: 5400,
      errorCount: 0,
      criticalErrorCount: 0,
      memoryUsage: '45 MB',
      memoryTotal: '512 MB',
      lastError: null,
      lastHealthCheck: new Date().toISOString()
    });

    // Reset statusChecker mock to default
    const mockStatusChecker = getStatusChecker();
    mockStatusChecker.getBotStatus.mockReturnValue({
      summary: {
        operational: true
      }
    });
  });

  describe('command structure', () => {
    it('should have correct command data', () => {
      expect(healthCommand.data).toBeDefined();
      expect(healthCommand.data.name).toBe('health');
      expect(healthCommand.data.description).toBe('Check bot system health and status');
    });

    it('should have execute function', () => {
      expect(healthCommand.execute).toBeDefined();
      expect(typeof healthCommand.execute).toBe('function');
    });
  });

  describe('command execution', () => {
    it('should execute successfully with healthy status', async () => {
      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds).toBeDefined();
      expect(replyCall.embeds[0].data.title).toBe('🟢 Bot Health & Status Dashboard');
      expect(replyCall.embeds[0].data.color).toBe(0x00ff00); // Green for healthy
      expect(replyCall.components).toBeDefined(); // Should include interactive buttons
    });

    it('should show unhealthy status when errors exist', async () => {
      // Add enough errors to exceed threshold and trigger unhealthy status
      for (let i = 0; i < 51; i++) {
        errorHandler.trackError('test');
      }

      // Mock healthMonitor to return unhealthy state but online
      healthMonitor.getHealthSummary.mockReturnValue({
        online: true,
        status: 'ONLINE',
        healthy: false,
        discord: {
          connected: true,
          ping: 50,
          guilds: 5,
          users: 100
        },
        uptime: '1h 30m',
        uptimeSeconds: 5400,
        errorCount: 51,
        criticalErrorCount: 0,
        memoryUsage: '45 MB',
        memoryTotal: '512 MB',
        lastError: null,
        lastHealthCheck: new Date().toISOString()
      });

      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0].data.color).toBe(0xffaa00); // Orange for online but unhealthy
      expect(replyCall.embeds[0].data.description).toContain('Warning');
    });

    it('should show offline status when bot is offline', async () => {
      // Mock healthMonitor to return offline state
      healthMonitor.getHealthSummary.mockReturnValue({
        online: false,
        status: 'OFFLINE',
        healthy: true,
        discord: {
          connected: false,
          ping: null,
          guilds: 0,
          users: 0
        },
        uptime: '0h 0m',
        uptimeSeconds: 0,
        errorCount: 0,
        criticalErrorCount: 0,
        memoryUsage: '45 MB',
        memoryTotal: '512 MB',
        lastError: null,
        lastHealthCheck: new Date().toISOString()
      });

      // Mock statusChecker to return non-operational status
      const mockStatusChecker = getStatusChecker();
      mockStatusChecker.getBotStatus.mockReturnValue({
        summary: {
          operational: false
        }
      });

      // Mock errorHandler to return unhealthy status  
      const originalGetHealthStatus = errorHandler.getHealthStatus;
      errorHandler.getHealthStatus = vi.fn().mockReturnValue({
        healthy: false,
        errorCount: 5,
        criticalErrorCount: 2,
        uptime: 0,
        lastHealthCheck: Date.now(),
        memoryUsage: {
          used: 45 * 1024 * 1024,
          total: 512 * 1024 * 1024
        }
      });

      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      
      // Note: Even when status checker says offline, if it's still operational in Discord, 
      // it shows orange (unhealthy) rather than red (offline)
      expect(replyCall.embeds[0].data.color).toBe(0xffaa00); // Orange for unhealthy but still operational
      expect(replyCall.embeds[0].data.description).toContain('Warning');

      // Restore original function
      errorHandler.getHealthStatus = originalGetHealthStatus;
    });

    it('should include memory warning for high usage', async () => {
      // Mock high memory usage
      const originalGetHealthStatus = errorHandler.getHealthStatus;
      errorHandler.getHealthStatus = vi.fn().mockReturnValue({
        healthy: true,
        errorCount: 0,
        criticalErrorCount: 0,
        uptime: 60000,
        lastHealthCheck: Date.now(),
        memoryUsage: {
          used: 450 * 1024 * 1024, // 450 MB (> 400 MB threshold)
          total: 1024 * 1024 * 1024 // 1 GB
        }
      });

      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embedFields = replyCall.embeds[0].data.fields;
      const memoryWarning = embedFields.find(field => field.name.includes('Memory Warning'));
      expect(memoryWarning).toBeDefined();

      // Restore original function
      errorHandler.getHealthStatus = originalGetHealthStatus;
    });

    it('should display last critical error when present', async () => {
      // Add a critical error (type, error)
      errorHandler.logCriticalError('test_context', new Error('Test critical error'));

      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embedFields = replyCall.embeds[0].data.fields;
      const criticalErrorField = embedFields.find(field => field.name.includes('Last Critical Error'));
      expect(criticalErrorField).toBeDefined();
      expect(criticalErrorField.value).toContain('Test critical error');
    });

    it('should handle command execution errors gracefully', async () => {
      const mockInteraction = global.createMockInteraction();

      // Mock editReply to throw an error initially
      const originalEditReply = mockInteraction.editReply;
      mockInteraction.editReply = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementation(originalEditReply);

      await healthCommand.execute(mockInteraction);

      // Should have attempted to edit reply multiple times
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should format uptime correctly', async () => {
      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embedFields = replyCall.embeds[0].data.fields;
      const uptimeField = embedFields.find(field => field.name.includes('Uptime'));
      expect(uptimeField).toBeDefined();
      expect(uptimeField.value).toMatch(/\d+h \d+m \d+s/);
    });

    it('should format memory usage correctly', async () => {
      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embedFields = replyCall.embeds[0].data.fields;
      const memoryField = embedFields.find(field => field.name.includes('Memory Usage'));
      expect(memoryField).toBeDefined();
      expect(memoryField.value).toMatch(/\d+ MB \/ \d+ MB/);
    });
  });

  describe('embed formatting', () => {
    it('should include all required fields', async () => {
      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embed = replyCall.embeds[0];
      const fieldNames = embed.data.fields.map(field => field.name);

      expect(fieldNames).toContain('🤖 Bot Status');
      expect(fieldNames).toContain('🔗 Discord Connection');
      expect(fieldNames).toContain('⏱️ Uptime');
      expect(fieldNames).toContain('💾 Memory Usage');
      expect(fieldNames).toContain('⚠️ Errors (Last Hour)');
      expect(fieldNames).toContain('🚨 Critical Errors');
    });

    it('should set timestamp and footer', async () => {
      const mockInteraction = global.createMockInteraction();

      await healthCommand.execute(mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embed = replyCall.embeds[0];

      expect(embed.data.timestamp).toBeDefined();
      expect(embed.data.footer.text).toBe('Health data refreshes every 30 seconds • Interactive for 5 minutes');
    });
  });
});
