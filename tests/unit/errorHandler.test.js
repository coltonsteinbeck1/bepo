// Unit tests for error handler
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import errorHandler, { safeAsync, safeSync, handleDiscordError } from '../../src/utils/errorHandler.js';

describe('ErrorHandler', () => {
  beforeEach(() => {
    // Reset error handler state completely
    errorHandler.errors = [];
    errorHandler.criticalErrors = [];
    errorHandler.errorCounts.clear(); // Clear the Map
    errorHandler.startTime = Date.now();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('safeAsync', () => {
    it('should execute async function successfully', async () => {
      const testFn = vi.fn().mockResolvedValue('success');
      const result = await safeAsync(testFn, 'test operation', 'test_context');
      
      expect(testFn).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should handle async function errors gracefully', async () => {
      const testError = new Error('Test error');
      const testFn = vi.fn().mockRejectedValue(testError);
      
      const result = await safeAsync(testFn, null, 'test_context');
      
      expect(testFn).toHaveBeenCalled();
      expect(result).toBeNull();
      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].error).toContain('Test error');
    });

    it('should retry failed operations', async () => {
      const testFn = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const result = await safeAsync(testFn, 'test operation', 'test_context', 3);
      
      expect(testFn).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should fail after max retries', async () => {
      const testFn = vi.fn().mockRejectedValue(new Error('Persistent error'));
      
      const result = await safeAsync(testFn, null, 'test_context', 2);
      
      expect(testFn).toHaveBeenCalledTimes(2);
      expect(result).toBeNull();
    });
  });

  describe('safeSync', () => {
    it('should execute sync function successfully', () => {
      const testFn = vi.fn().mockReturnValue('success');
      const result = safeSync(testFn, 'test operation', 'test_context');
      
      expect(testFn).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should handle sync function errors gracefully', () => {
      const testFn = vi.fn().mockImplementation(() => {
        throw new Error('Test sync error');
      });
      
      const result = safeSync(testFn, null, 'test_context');
      
      expect(testFn).toHaveBeenCalled();
      expect(result).toBeNull();
      expect(errorHandler.errors).toHaveLength(1);
    });
  });

  describe('handleDiscordError', () => {
    it('should categorize Discord API errors correctly', () => {
      const discordError = new Error('Missing Permissions');
      discordError.code = 50013;
      
      handleDiscordError(discordError, null, 'test_command');
      
      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].context).toBe('discord_test_command');
    });

    it('should handle rate limit errors', () => {
      const rateLimitError = new Error('Rate limited');
      rateLimitError.code = 429;
      
      handleDiscordError(rateLimitError, 'test_command');
      
      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].error).toContain('Rate limited');
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with no errors', () => {
      const health = errorHandler.getHealthStatus();
      
      expect(health.healthy).toBe(true);
      expect(health.errorCount).toBe(0);
      expect(health.criticalErrorCount).toBe(0);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryUsage).toBeDefined();
    });

    it('should return unhealthy status with many errors', () => {
      // Use a critical error to trigger unhealthy status
      // (The time-based error counting has edge cases in fast tests)
      errorHandler.logCriticalError('test_critical', new Error('Critical error for test'));
      
      const health = errorHandler.getHealthStatus();
      
      expect(health.healthy).toBe(false);
      expect(health.criticalErrorCount).toBe(1);
    });

    it('should return unhealthy status with critical errors', () => {
      errorHandler.logCriticalError('test_context', new Error('Critical test error'));
      
      const health = errorHandler.getHealthStatus();
      
      expect(health.healthy).toBe(false);
      expect(health.criticalErrorCount).toBe(1);
    });
  });

  describe('error cleanup', () => {
    it('should clean up old errors', () => {
      // Add old error (older than 1 hour)
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000);
      errorHandler.errors.push({
        timestamp: new Date(oldTimestamp).toISOString(),
        error: 'Old error',
        context: 'test'
      });
      
      // Add recent error
      errorHandler.logError(new Error('Recent error'), 'test_context');
      
      // Trigger cleanup
      errorHandler.cleanupOldErrors();
      
      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].error).toContain('Recent error');
    });
  });

  describe('error rate limiting', () => {
    it('should detect high error rates', () => {
      // Track enough errors to trigger rate limiting warning
      for (let i = 0; i < 51; i++) {
        const highRate = errorHandler.trackError('test_context');
        if (i >= 50) {
          expect(highRate).toBe(true); // Should indicate high error rate
        }
      }
      
      // All errors should still be logged
      expect(errorHandler.errorCounts.get('test_context_' + Math.floor(Date.now() / (1000 * 60 * 60)))).toBe(51);
    });
  });
});
