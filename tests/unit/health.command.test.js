// Unit tests for health command
import { describe, it, expect, vi, beforeEach } from 'vitest';
import healthCommand from '../../src/commands/fun/health.js';
import errorHandler from '../../src/utils/errorHandler.js';

describe('Health Command', () => {
  beforeEach(() => {
    // Reset error handler state
    errorHandler.errors = [];
    errorHandler.criticalErrors = [];
    errorHandler.startTime = Date.now();
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
      expect(replyCall.embeds[0].data.title).toBe('🏥 Bot Health Status');
      expect(replyCall.embeds[0].data.color).toBe(0x00ff00); // Green for healthy
    });

    it('should show unhealthy status when errors exist', async () => {
      // Add enough errors to exceed threshold and trigger unhealthy status
      for (let i = 0; i < 51; i++) {
        errorHandler.trackError('test');
      }
      
      const mockInteraction = global.createMockInteraction();
      
      await healthCommand.execute(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalled();
      
      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0].data.color).toBe(0xff0000); // Red for unhealthy
      expect(replyCall.embeds[0].data.description).toContain('Warning');
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
      // Mock error handler to throw
      const originalGetHealthStatus = errorHandler.getHealthStatus;
      errorHandler.getHealthStatus = vi.fn().mockImplementation(() => {
        throw new Error('Health status error');
      });
      
      const mockInteraction = global.createMockInteraction();
      
      await healthCommand.execute(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Failed to retrieve health status')
      });
      
      // Restore original function
      errorHandler.getHealthStatus = originalGetHealthStatus;
    });

    it('should format uptime correctly', async () => {
      // Mock specific uptime
      const originalGetHealthStatus = errorHandler.getHealthStatus;
      errorHandler.getHealthStatus = vi.fn().mockReturnValue({
        healthy: true,
        errorCount: 0,
        criticalErrorCount: 0,
        uptime: 3661000, // 1 hour, 1 minute, 1 second in milliseconds
        lastHealthCheck: Date.now(),
        memoryUsage: { used: 100 * 1024 * 1024, total: 1024 * 1024 * 1024 }
      });
      
      const mockInteraction = global.createMockInteraction();
      
      await healthCommand.execute(mockInteraction);
      
      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embedFields = replyCall.embeds[0].data.fields;
      const uptimeField = embedFields.find(field => field.name.includes('Uptime'));
      expect(uptimeField.value).toBe('1h 1m 1s');
      
      // Restore original function
      errorHandler.getHealthStatus = originalGetHealthStatus;
    });

    it('should format memory usage correctly', async () => {
      const mockInteraction = global.createMockInteraction();
      
      await healthCommand.execute(mockInteraction);
      
      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embedFields = replyCall.embeds[0].data.fields;
      const memoryField = embedFields.find(field => field.name.includes('Memory Usage'));
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
      
      expect(fieldNames).toContain('📊 Overall Status');
      expect(fieldNames).toContain('⏱️ Uptime');
      expect(fieldNames).toContain('💾 Memory Usage');
      expect(fieldNames).toContain('⚠️ Errors (Last Hour)');
      expect(fieldNames).toContain('🚨 Critical Errors');
      expect(fieldNames).toContain('🔄 Last Health Check');
    });

    it('should set timestamp and footer', async () => {
      const mockInteraction = global.createMockInteraction();
      
      await healthCommand.execute(mockInteraction);
      
      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      const embed = replyCall.embeds[0];
      
      expect(embed.data.timestamp).toBeDefined();
      expect(embed.data.footer.text).toBe('Health data refreshes every 5 minutes');
    });
  });
});
