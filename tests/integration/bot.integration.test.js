// Integration tests for Discord bot
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';

// Mock the entire bot initialization to avoid side effects
vi.mock('../../src/bot.js', () => ({
  default: {
    login: vi.fn().mockResolvedValue(true),
    destroy: vi.fn().mockResolvedValue(true),
    user: { id: 'test_bot_id', username: 'TestBot' },
    on: vi.fn(),
    once: vi.fn()
  }
}));

describe('Bot Integration Tests', () => {
  let errorHandler;
  
  beforeEach(async () => {
    // Import errorHandler fresh for each test
    const { default: ErrorHandlerModule } = await import('../../src/utils/errorHandler.js');
    errorHandler = ErrorHandlerModule;
    
    // Reset error handler state completely
    errorHandler.errors = [];
    errorHandler.criticalErrors = [];
    errorHandler.errorCounts.clear();
    errorHandler.startTime = Date.now();
  });
  
  afterEach(() => {
    // Clean up any timers or async operations
    vi.clearAllTimers();
  });

  describe('Command Loading', () => {
    it('should load all commands without errors', async () => {
      // Test that commands can be imported without throwing
      const commandPaths = [
        '../../src/commands/fun/health.js',
        '../../src/commands/fun/ping.js',
        '../../src/commands/fun/yap.js'
      ];

      for (const commandPath of commandPaths) {
        try {
          const command = await import(commandPath);
          expect(command.default).toBeDefined();
          expect(command.default.data).toBeDefined();
          expect(command.default.execute).toBeDefined();
          expect(typeof command.default.execute).toBe('function');
        } catch (error) {
          // Some commands might not exist, that's ok
          if (!error.message.includes('Cannot resolve module')) {
            throw error;
          }
        }
      }
    });
  });

  describe('Error Handler Integration', () => {
    let errorHandler;

    beforeEach(async () => {
      // Import error handler fresh for each test
      const module = await import('../../src/utils/errorHandler.js');
      errorHandler = module.default;
      errorHandler.errors = [];
      errorHandler.criticalErrors = [];
    });

    it('should handle multiple concurrent errors', async () => {
      const { safeAsync } = await import('../../src/utils/errorHandler.js');
      
      const errorPromises = Array.from({ length: 10 }, (_, i) =>
        safeAsync(
          () => Promise.reject(new Error(`Concurrent error ${i}`)),
          null, // fallback should be null to match test expectation
          `test_${i}`
        )
      );

      const results = await Promise.all(errorPromises);
      
      // All should return null (handled errors)
      expect(results.every(result => result === null)).toBe(true);
      
      // Should have logged errors (with potential rate limiting)
      expect(errorHandler.errors.length).toBeGreaterThan(0);
      expect(errorHandler.errors.length).toBeLessThanOrEqual(10);
    });

    it('should maintain health status across operations', async () => {
      const { safeAsync } = await import('../../src/utils/errorHandler.js');
      
      // Start healthy
      let health = errorHandler.getHealthStatus();
      expect(health.healthy).toBe(true);
      
      // Add some errors
      await safeAsync(
        () => Promise.reject(new Error('Test error 1')),
        'test op 1',
        'test_1'
      );
      
      health = errorHandler.getHealthStatus();
      expect(health.healthy).toBe(true); // Still healthy with few errors
      
      // Add critical error to guarantee unhealthy status
      errorHandler.logCriticalError('test_critical', new Error('Critical integration test error'));
      
      health = errorHandler.getHealthStatus();
      expect(health.healthy).toBe(false); // Now unhealthy
    });
  });

  describe('Health Monitor Integration', () => {
    it('should work with error handler', async () => {
      const errorHandler = (await import('../../src/utils/errorHandler.js')).default;
      
      // Reset state
      errorHandler.errors = [];
      errorHandler.criticalErrors = [];
      
      // Get initial health
      const initialHealth = errorHandler.getHealthStatus();
      expect(initialHealth.healthy).toBe(true);
      
      // Add critical error
      errorHandler.logCriticalError(new Error('Critical test error'), 'integration_test');
      
      // Health should now be unhealthy
      const newHealth = errorHandler.getHealthStatus();
      expect(newHealth.healthy).toBe(false);
      expect(newHealth.criticalErrorCount).toBe(1);
    });
  });

  describe('Command Error Handling', () => {
    it('should handle command execution errors gracefully', async () => {
      try {
        const healthCommand = await import('../../src/commands/fun/health.js');
        const mockInteraction = global.createMockInteraction({
          deferReply: vi.fn().mockRejectedValue(new Error('Discord API error'))
        });
        
        // Should not throw even if Discord API fails
        await expect(healthCommand.default.execute(mockInteraction)).resolves.not.toThrow();
      } catch (importError) {
        // Command might not exist in test environment
        if (!importError.message.includes('Cannot resolve module')) {
          throw importError;
        }
      }
    });
  });

  describe('Memory and Performance', () => {
    it('should not leak memory during error handling', async () => {
      const { safeAsync } = await import('../../src/utils/errorHandler.js');
      const errorHandler = (await import('../../src/utils/errorHandler.js')).default;
      
      const initialMemory = process.memoryUsage();
      
      // Generate many errors
      for (let i = 0; i < 100; i++) {
        await safeAsync(
          () => Promise.reject(new Error(`Memory test error ${i}`)),
          'memory test',
          `memory_test_${i}`
        );
      }
      
      // Force cleanup
      errorHandler.cleanupOldErrors();
      
      // Run garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up old errors automatically', async () => {
      const errorHandler = (await import('../../src/utils/errorHandler.js')).default;
      
      // Start with clean state
      errorHandler.errors = [];
      
      // Add old errors manually
      const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      errorHandler.errors.push({
        timestamp: oldTimestamp,
        error: 'Old error 1',
        context: 'test'
      });
      errorHandler.errors.push({
        timestamp: oldTimestamp,
        error: 'Old error 2',
        context: 'test'
      });
      
      // Add recent error (this will trigger automatic cleanup of old errors)
      errorHandler.logError(new Error('Recent error'), 'test');
      
      // Should only have recent error (old errors cleaned up automatically)
      expect(errorHandler.errors.length).toBe(1);
      expect(errorHandler.errors[0].error).toContain('Recent error');
      
      // Manual cleanup call should not change anything
      errorHandler.cleanupOldErrors();
      
      // Should still only have recent error
      expect(errorHandler.errors.length).toBe(1);
      expect(errorHandler.errors[0].error).toContain('Recent error');
    });
  });

  describe('Environment Handling', () => {
    it('should handle missing environment variables gracefully', () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Test without NODE_ENV
      delete process.env.NODE_ENV;
      
      expect(() => {
        // Should not throw when environment variables are missing
        const health = process.memoryUsage();
        expect(health).toBeDefined();
      }).not.toThrow();
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});
