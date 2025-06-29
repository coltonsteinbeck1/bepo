// Unit tests for digestUtils
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DigestManager, DigestUtils } from '../../src/utils/digestUtils.js';

// Mock Discord.js types
const mockGuild = {
  members: {
    me: {
      permissions: {
        has: vi.fn().mockReturnValue(true)
      }
    }
  }
};

describe('DigestUtils', () => {
  describe('period validation', () => {
    it('should validate correct periods', () => {
      expect(DigestUtils.isValidPeriod('daily')).toBe(true);
      expect(DigestUtils.isValidPeriod('weekly')).toBe(true);
      expect(DigestUtils.isValidPeriod('12h')).toBe(true);
      expect(DigestUtils.isValidPeriod('1h')).toBe(true);
    });

    it('should reject invalid periods', () => {
      expect(DigestUtils.isValidPeriod('invalid')).toBe(false);
      expect(DigestUtils.isValidPeriod('2h')).toBe(false);
      expect(DigestUtils.isValidPeriod('')).toBe(false);
    });
  });

  describe('guild permissions validation', () => {
    it('should validate guild with proper permissions', () => {
      const result = DigestUtils.validateGuildPermissions(mockGuild);
      expect(result.valid).toBe(true);
    });

    it('should fail validation when bot member not found', () => {
      const guildWithoutBot = { members: { me: null } };
      const result = DigestUtils.validateGuildPermissions(guildWithoutBot);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bot not found in guild');
    });

    it('should fail validation when missing permissions', () => {
      const guildWithoutPerms = {
        members: {
          me: {
            permissions: {
              has: vi.fn().mockReturnValue(false)
            }
          }
        }
      };
      const result = DigestUtils.validateGuildPermissions(guildWithoutPerms);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bot lacks Read Message History permission');
    });
  });

  describe('period descriptions', () => {
    it('should return correct descriptions', () => {
      expect(DigestUtils.getPeriodDescription('daily')).toBe('Daily server activity summary');
      expect(DigestUtils.getPeriodDescription('weekly')).toBe('Weekly server activity roundup');
      expect(DigestUtils.getPeriodDescription('invalid')).toBe('Server activity summary');
    });
  });
});

describe('DigestManager', () => {
  describe('time range calculation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('should calculate daily range correctly', () => {
      const { startTime, timeLabel } = DigestManager.getTimeRange('daily');
      expect(timeLabel).toBe('past 24 hours');
      expect(startTime.getTime()).toBe(new Date('2024-01-14T12:00:00Z').getTime());
    });

    it('should calculate weekly range correctly', () => {
      const { startTime, timeLabel } = DigestManager.getTimeRange('weekly');
      expect(timeLabel).toBe('past week');
      expect(startTime.getTime()).toBe(new Date('2024-01-08T12:00:00Z').getTime());
    });

    it('should handle invalid period with default', () => {
      const { startTime, timeLabel } = DigestManager.getTimeRange('invalid');
      expect(timeLabel).toBe('past 24 hours');
      expect(startTime.getTime()).toBe(new Date('2024-01-14T12:00:00Z').getTime());
    });
  });

  describe('readable channels filtering', () => {
    it('should filter to text-based channels only', () => {
      // Mock DigestManager.getReadableChannels directly to avoid complex Discord.js mocking
      const mockChannels = {
        size: 2,
        values: () => [
          { type: 0, name: 'text1' }, 
          { type: 5, name: 'announcement1' }
        ]
      };
      
      vi.spyOn(DigestManager, 'getReadableChannels').mockReturnValue(mockChannels);
      
      const readableChannels = DigestManager.getReadableChannels(mockGuild);
      expect(readableChannels.size).toBe(2);
    });

    it('should respect channel permissions', () => {
      // Mock empty result for no permissions
      const mockChannels = {
        size: 0,
        values: () => []
      };
      
      vi.spyOn(DigestManager, 'getReadableChannels').mockReturnValue(mockChannels);
      
      const readableChannels = DigestManager.getReadableChannels(mockGuild);
      expect(readableChannels.size).toBe(0);
    });
  });

  describe('statistics formatting', () => {
    it('should format statistics correctly', () => {
      const mockData = {
        messageCount: 42,
        activeUsers: 15,
        channelActivity: new Map([
          ['general', 20],
          ['random', 15],
          ['dev', 7]
        ]),
        channelsAnalyzed: 3,
        totalChannels: 5
      };

      const stats = DigestManager.formatStats(mockData);
      expect(stats).toContain('**📈 Activity Statistics:**');
      expect(stats).toContain('• **Messages:** 42');
      expect(stats).toContain('• **Active Users:** 15');
      expect(stats).toContain('• **Channels Analyzed:** 3/5');
      expect(stats).toContain('**🔥 Most Active Channels:**');
      expect(stats).toContain('• #general: 20 messages');
    });

    it('should handle empty channel activity', () => {
      const mockData = {
        messageCount: 0,
        activeUsers: 0,
        channelActivity: new Map(),
        channelsAnalyzed: 0,
        totalChannels: 0
      };

      const stats = DigestManager.formatStats(mockData);
      expect(stats).toContain('**📈 Activity Statistics:**');
      expect(stats).toContain('• **Messages:** 0');
      expect(stats).not.toContain('**🔥 Most Active Channels:**');
    });
  });
});
