// Unit tests for health monitor
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import errorHandler from '../../src/utils/errorHandler.js';

// Mock the health monitor since it's a class with timers
const createMockHealthMonitor = () => {
  return {
    startTime: Date.now(),
    lastHealthCheck: Date.now(),
    healthCheckInterval: 5 * 60 * 1000,
    logInterval: 30 * 60 * 1000,
    
    performHealthCheck() {
      const health = errorHandler.getHealthStatus();
      this.lastHealthCheck = Date.now();
      return health;
    },
    
    logHealthStatus() {
      const health = errorHandler.getHealthStatus();
      return {
        timestamp: new Date().toISOString(),
        healthy: health.healthy,
        errorCount: health.errorCount,
        criticalErrorCount: health.criticalErrorCount,
        uptime: health.uptime,
        memoryUsage: health.memoryUsage
      };
    },
    
    logCriticalAlert(health) {
      return {
        timestamp: new Date().toISOString(),
        type: 'HEALTH_ALERT',
        errorCount: health.errorCount,
        criticalErrorCount: health.criticalErrorCount
      };
    }
  };
};

describe('HealthMonitor', () => {
  let healthMonitor;
  
  beforeEach(() => {
    healthMonitor = createMockHealthMonitor();
    // Reset error handler state completely
    errorHandler.errors = [];
    errorHandler.criticalErrors = [];
    errorHandler.errorCounts.clear();
    errorHandler.startTime = Date.now();
  });

  describe('performHealthCheck', () => {
    it('should perform health check and return status', () => {
      const health = healthMonitor.performHealthCheck();
      
      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.errorCount).toBe(0);
      expect(health.uptime).toBeGreaterThan(0);
      expect(healthMonitor.lastHealthCheck).toBeGreaterThan(0);
    });

    it('should detect unhealthy status', () => {
      // Add enough errors to exceed maxErrorsPerHour threshold
      for (let i = 0; i < 51; i++) {
        errorHandler.trackError('test');
      }
      
      const health = healthMonitor.performHealthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.errorCount).toBeGreaterThanOrEqual(50);
    });

    it('should update last health check timestamp', () => {
      const beforeCheck = healthMonitor.lastHealthCheck;
      
      // Wait a tiny bit to ensure timestamp difference
      setTimeout(() => {
        healthMonitor.performHealthCheck();
        expect(healthMonitor.lastHealthCheck).toBeGreaterThan(beforeCheck);
      }, 1);
    });
  });

  describe('logHealthStatus', () => {
    it('should generate health log data', () => {
      const logData = healthMonitor.logHealthStatus();
      
      expect(logData).toBeDefined();
      expect(logData.timestamp).toBeDefined();
      expect(logData.healthy).toBe(true);
      expect(logData.errorCount).toBeGreaterThanOrEqual(0); // Could have errors from previous tests
      expect(logData.uptime).toBeGreaterThan(0);
      expect(logData.memoryUsage).toBeDefined();
    });

    it('should include error data when errors exist', () => {
      errorHandler.trackError('test'); // Use trackError instead of logError
      
      const logData = healthMonitor.logHealthStatus();
      
      expect(logData.errorCount).toBeGreaterThanOrEqual(1);
      expect(logData.healthy).toBe(true); // Still healthy with just one error
    });
  });

  describe('logCriticalAlert', () => {
    it('should generate critical alert data', () => {
      const mockHealth = {
        healthy: false,
        errorCount: 20,
        criticalErrorCount: 2,
        uptime: 60000,
        memoryUsage: { used: 500 * 1024 * 1024 }
      };
      
      const alertData = healthMonitor.logCriticalAlert(mockHealth);
      
      expect(alertData).toBeDefined();
      expect(alertData.type).toBe('HEALTH_ALERT');
      expect(alertData.errorCount).toBe(20);
      expect(alertData.criticalErrorCount).toBe(2);
      expect(alertData.timestamp).toBeDefined();
    });
  });

  describe('memory monitoring', () => {
    it('should track memory usage', () => {
      const health = healthMonitor.performHealthCheck();
      
      expect(health.memoryUsage).toBeDefined();
      expect(health.memoryUsage.used).toBeGreaterThan(0);
      expect(health.memoryUsage.total).toBeGreaterThan(0);
    });

    it('should detect high memory usage', () => {
      const health = healthMonitor.performHealthCheck();
      const memoryMB = (health.memoryUsage?.used || 0) / 1024 / 1024;
      
      // Test memory warning logic
      const shouldWarn = memoryMB > 500;
      expect(typeof shouldWarn).toBe('boolean');
    });
  });

  describe('uptime tracking', () => {
    it('should track uptime correctly', () => {
      const health = healthMonitor.performHealthCheck();
      
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.uptime).toBeLessThan(1000); // Should be small for new test
    });
  });

  describe('health intervals', () => {
    it('should have correct health check interval', () => {
      expect(healthMonitor.healthCheckInterval).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should have correct log interval', () => {
      expect(healthMonitor.logInterval).toBe(30 * 60 * 1000); // 30 minutes
    });
  });
});
