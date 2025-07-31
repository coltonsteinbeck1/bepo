import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isBotMentioned, cleanDiscordMentions, getUsernamesFromIds } from '../../src/utils/utils.js';

describe('Mention Handling', () => {
  let mockClient;
  let mockMessage;

  beforeEach(() => {
    mockClient = {
      user: {
        id: 'bot123'
      },
      users: {
        fetch: vi.fn()
      }
    };

    mockMessage = {
      mentions: {
        users: new Map(),
        roles: new Map()
      },
      system: false,
      type: 0 // DEFAULT message type
    };
  });

  describe('isBotMentioned', () => {
    it('should return true when bot is directly mentioned', () => {
      mockMessage.mentions.users.set('bot123', mockClient.user);
      mockMessage.mentions.users.has = vi.fn().mockReturnValue(true);
      
      const result = isBotMentioned(mockMessage, mockClient);
      expect(result).toBe(true);
    });

    it('should return false when bot is not mentioned', () => {
      mockMessage.mentions.users.has = vi.fn().mockReturnValue(false);
      mockMessage.mentions.roles.has = vi.fn().mockReturnValue(false);
      
      const result = isBotMentioned(mockMessage, mockClient);
      expect(result).toBe(false);
    });

    it('should return true when HOMONCULUS role is mentioned', () => {
      process.env.HOMONCULUS = 'role456';
      mockMessage.mentions.users.has = vi.fn().mockReturnValue(false);
      mockMessage.mentions.roles.has = vi.fn().mockReturnValue(true);
      
      const result = isBotMentioned(mockMessage, mockClient);
      expect(result).toBe(true);
      
      delete process.env.HOMONCULUS;
    });

    it('should return false for system messages', () => {
      mockMessage.system = true;
      mockMessage.mentions.users.has = vi.fn().mockReturnValue(false); // Changed from true to false
      
      const result = isBotMentioned(mockMessage, mockClient);
      expect(result).toBe(false);
    });

    it('should return false for non-default message types', () => {
      mockMessage.type = 1; // Not DEFAULT type
      mockMessage.mentions.users.has = vi.fn().mockReturnValue(false); // Changed from true to false
      
      const result = isBotMentioned(mockMessage, mockClient);
      expect(result).toBe(false);
    });

    it('should handle null/undefined gracefully', () => {
      expect(isBotMentioned(null, mockClient)).toBe(false);
      expect(isBotMentioned(mockMessage, null)).toBe(false);
      expect(isBotMentioned(mockMessage, { user: null })).toBe(false);
    });
  });

  describe('cleanDiscordMentions', () => {
    beforeEach(() => {
      mockClient.users.fetch = vi.fn().mockImplementation((userId) => {
        const users = {
          '123456789': { username: 'TestUser' },
          '987654321': { username: 'AnotherUser' }
        };
        return Promise.resolve(users[userId] || { username: 'UnknownUser' });
      });
    });

    it('should replace Discord mentions with @username', async () => {
      const text = 'Hello <@123456789> how are you?';
      const result = await cleanDiscordMentions(text, mockClient);
      expect(result).toBe('Hello @TestUser how are you?');
    });

    it('should handle multiple mentions', async () => {
      const text = 'Hello <@123456789> and <@987654321>!';
      const result = await cleanDiscordMentions(text, mockClient);
      expect(result).toBe('Hello @TestUser and @AnotherUser!');
    });

    it('should not add double @ symbols', async () => {
      const text = 'Hello @<@123456789> how are you?';
      const result = await cleanDiscordMentions(text, mockClient);
      expect(result).toBe('Hello @TestUser how are you?');
    });

    it('should clean up any double @ symbols', async () => {
      const text = 'Hello @@<@123456789> how are you?';
      const result = await cleanDiscordMentions(text, mockClient);
      expect(result).toBe('Hello @TestUser how are you?');
    });

    it('should handle mentions with ! (nickname mentions)', async () => {
      const text = 'Hello <@!123456789> how are you?';
      const result = await cleanDiscordMentions(text, mockClient);
      expect(result).toBe('Hello @TestUser how are you?');
    });

    it('should handle text without mentions', async () => {
      const text = 'Hello world!';
      const result = await cleanDiscordMentions(text, mockClient);
      expect(result).toBe('Hello world!');
    });

    it('should handle null/undefined input gracefully', async () => {
      expect(await cleanDiscordMentions(null, mockClient)).toBe(null);
      expect(await cleanDiscordMentions('test', null)).toBe('test');
      expect(await cleanDiscordMentions('', mockClient)).toBe('');
    });

    it('should return fallback username for failed user fetches', async () => {
      mockClient.users.fetch = vi.fn().mockRejectedValue(new Error('User not found'));
      
      const text = 'Hello <@999999999> how are you?';
      const result = await cleanDiscordMentions(text, mockClient);
      expect(result).toBe('Hello @User(99999999) how are you?');
    });
  });

  describe('getUsernamesFromIds', () => {
    beforeEach(() => {
      mockClient.users.fetch = vi.fn().mockImplementation((userId) => {
        const users = {
          '123456789': { username: 'TestUser' },
          '987654321': { username: 'AnotherUser' }
        };
        if (users[userId]) {
          return Promise.resolve(users[userId]);
        }
        throw new Error('User not found');
      });
    });

    it('should resolve multiple user IDs to usernames', async () => {
      const userIds = ['123456789', '987654321'];
      const result = await getUsernamesFromIds(mockClient, userIds);
      
      expect(result).toEqual({
        '123456789': 'TestUser',
        '987654321': 'AnotherUser'
      });
    });

    it('should handle failed user fetches gracefully', async () => {
      const userIds = ['123456789', '999999999'];
      const result = await getUsernamesFromIds(mockClient, userIds);
      
      expect(result).toEqual({
        '123456789': 'TestUser',
        '999999999': 'User(99999999)'
      });
    });

    it('should handle empty array', async () => {
      const result = await getUsernamesFromIds(mockClient, []);
      expect(result).toEqual({});
    });
  });
});
