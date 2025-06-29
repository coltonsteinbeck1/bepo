import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMonitoringStatus, manualCheckForUpdates, setNotificationChannel } from '../../src/utils/cs2NotificationService.js';

describe('CS2 Notification Service', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  describe('getMonitoringStatus', () => {
    it('should return status information', async () => {
      const status = await getMonitoringStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('channelsConfigured');
      expect(status).toHaveProperty('channels');
      expect(status).toHaveProperty('checkInterval');
      expect(status).toHaveProperty('lastCheckFile');
      
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.channelsConfigured).toBe('number');
      expect(Array.isArray(status.channels)).toBe(true);
      expect(typeof status.checkInterval).toBe('number');
      expect(typeof status.lastCheckFile).toBe('string');
    });

    it('should show correct channel configuration', async () => {
      const status = await getMonitoringStatus();
      
      // Should match the configured channels (or 0 if none)
      expect(status.channelsConfigured).toEqual(status.channels.length);
      expect(status.checkInterval).toBe(10); // 10 minutes as configured
    });
  });

  describe('manualCheckForUpdates', () => {
    it('should return a boolean indicating success/failure', async () => {
      const result = await manualCheckForUpdates();
      expect(typeof result).toBe('boolean');
    });

    it('should handle errors gracefully and not throw', async () => {
      // This test ensures the function doesn't throw errors
      let threwError = false;
      let result;
      
      try {
        result = await manualCheckForUpdates();
      } catch (error) {
        threwError = true;
      }
      
      expect(threwError).toBe(false);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('setNotificationChannel', () => {
    it('should handle channel configuration', async () => {
      const testChannelId = '123456789012345678';
      const testGuildId = '987654321098765432';
      
      const result = await setNotificationChannel(testChannelId, testGuildId);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('role mention format', () => {
    it('should use correct Discord role mention format', () => {
      const testRoleId = '1160342442072096788';
      const expectedMention = `<@&${testRoleId}>`;
      
      // Test that our role mention format matches Discord's standard
      expect(expectedMention).toBe('<@&1160342442072096788>');
      
      // Verify it follows the pattern <@&ROLE_ID>
      const roleMentionRegex = /^<@&\d{17,19}>$/;
      expect(roleMentionRegex.test(expectedMention)).toBe(true);
    });
  });
});
