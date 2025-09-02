import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies first
vi.mock('discord.js', () => ({
  EmbedBuilder: vi.fn().mockImplementation(() => ({
    setColor: vi.fn().mockReturnThis(),
    setTitle: vi.fn().mockReturnThis(),
    setTimestamp: vi.fn().mockReturnThis(),
    setThumbnail: vi.fn().mockReturnThis(),
    setDescription: vi.fn().mockReturnThis(),
    setURL: vi.fn().mockReturnThis(),
    setAuthor: vi.fn().mockReturnThis(),
    addFields: vi.fn().mockReturnThis(),
    setFooter: vi.fn().mockReturnThis(),
    setImage: vi.fn().mockReturnThis()
  }))
}));

vi.mock('../../src/utils/apexUtils.js', () => ({
  getCachedPatchNotes: vi.fn()
}));

vi.mock('fs/promises');

describe('Apex Notification Service', () => {
  let apexNotificationService;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock file system operations
    fs.readFile.mockRejectedValue(new Error('File not found'));
    fs.writeFile.mockResolvedValue();
    fs.mkdir.mockResolvedValue();
    
    // Dynamically import the service after mocks are set up
    apexNotificationService = await import('../../src/utils/apexNotificationService.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNotificationChannels', () => {
    it('should return empty array when config file does not exist', async () => {
      const channels = await apexNotificationService.getNotificationChannels();
      expect(channels).toEqual([]);
    });

    it('should return channels from config file', async () => {
      const mockConfig = { channels: ['123456789', '987654321'] };
      fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      
      const channels = await apexNotificationService.getNotificationChannels();
      expect(channels).toEqual(['123456789', '987654321']);
    });

    it('should handle invalid JSON in config file', async () => {
      fs.readFile.mockResolvedValue('invalid json');
      
      const channels = await apexNotificationService.getNotificationChannels();
      expect(channels).toEqual([]);
    });
  });

  describe('setNotificationChannel', () => {
    it('should add new channel to config', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found')); // No existing config
      
      const result = await apexNotificationService.setNotificationChannel('123456789', 'guild123');
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
      
      const writeCall = fs.writeFile.mock.calls[0];
      const configData = JSON.parse(writeCall[1]);
      expect(configData.channels).toContain('123456789');
      expect(configData.guilds['123456789']).toBe('guild123');
    });

    it('should not duplicate existing channels', async () => {
      const existingConfig = { 
        channels: ['123456789'], 
        guilds: { '123456789': 'guild123' } 
      };
      fs.readFile.mockResolvedValue(JSON.stringify(existingConfig));
      
      const result = await apexNotificationService.setNotificationChannel('123456789', 'guild123');
      
      expect(result).toBe(true);
      const writeCall = fs.writeFile.mock.calls[0];
      const configData = JSON.parse(writeCall[1]);
      expect(configData.channels).toEqual(['123456789']); // Should not duplicate
    });
  });

  describe('manualCheckForUpdates', () => {
    it('should return success when no new patches found', async () => {
      const { getCachedPatchNotes } = await import('../../src/utils/apexUtils.js');
      const mockPatches = [
        { 
          id: 'apex-2025-06-25-test', 
          title: 'Test Patch',
          date: new Date('2025-06-25')
        }
      ];
      
      getCachedPatchNotes.mockResolvedValue(mockPatches);
      
      // Mock last patch info to match current patch
      fs.readFile.mockResolvedValue(JSON.stringify(mockPatches[0]));
      
      const result = await apexNotificationService.manualCheckForUpdates();
      
      expect(result.success).toBe(true);
      expect(result.newPatchCount).toBe(0);
      expect(result.message).toContain('No new');
    });

    it('should return error when patch fetching fails', async () => {
      const { getCachedPatchNotes } = await import('../../src/utils/apexUtils.js');
      getCachedPatchNotes.mockResolvedValue([]);
      
      const result = await apexNotificationService.manualCheckForUpdates();
      
      expect(result.success).toBe(false);
      expect(result.newPatchCount).toBe(0);
      expect(result.message).toContain('No Apex patch notes found');
    });

    it('should detect new patches', async () => {
      const { getCachedPatchNotes } = await import('../../src/utils/apexUtils.js');
      const mockPatches = [
        { 
          id: 'apex-2025-06-26-new', 
          title: 'New Patch',
          date: new Date('2025-06-26')
        },
        { 
          id: 'apex-2025-06-25-old', 
          title: 'Old Patch',
          date: new Date('2025-06-25')
        }
      ];
      
      getCachedPatchNotes.mockResolvedValue(mockPatches);
      
      // Mock last patch info to be the old patch
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('apex-channel-config.json')) {
          return Promise.resolve(JSON.stringify({ channels: [] })); // No channels to avoid notification sending
        }
        if (filePath.includes('last-apex-patch.json')) {
          return Promise.resolve(JSON.stringify(mockPatches[1]));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await apexNotificationService.manualCheckForUpdates();
      
      expect(result.success).toBe(true);
      expect(result.newPatchCount).toBe(1);
      expect(result.message).toContain('Found');
    });

    it('should send only most recent patch by default', async () => {
      const { getCachedPatchNotes } = await import('../../src/utils/apexUtils.js');
      const mockPatches = [
        { 
          id: 'apex-2025-06-28-newest', 
          title: 'Newest Patch',
          date: new Date('2025-06-28')
        },
        { 
          id: 'apex-2025-06-27-newer', 
          title: 'Newer Patch',
          date: new Date('2025-06-27')
        },
        { 
          id: 'apex-2025-06-26-old', 
          title: 'Old Patch',
          date: new Date('2025-06-26')
        }
      ];
      
      getCachedPatchNotes.mockResolvedValue(mockPatches);
      
      // Mock last patch info to be the old patch (so 2 new patches are available)
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('apex-channel-config.json')) {
          return Promise.resolve(JSON.stringify({ channels: [] })); // No channels to avoid notification sending
        }
        if (filePath.includes('last-apex-patch.json')) {
          return Promise.resolve(JSON.stringify(mockPatches[2]));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Call with default showAllNew = false
      const result = await apexNotificationService.manualCheckForUpdates(false);
      
      expect(result.success).toBe(true);
      expect(result.newPatchCount).toBe(1); // Should only send 1 even though 2 are new
      expect(result.totalNewFound).toBe(2); // Should detect 2 new patches
      expect(result.message).toContain('Found 2 new patches');
    });

    it('should send all new patches when showAllNew is true', async () => {
      const { getCachedPatchNotes } = await import('../../src/utils/apexUtils.js');
      const mockPatches = [
        { 
          id: 'apex-2025-06-28-newest', 
          title: 'Newest Patch',
          date: new Date('2025-06-28')
        },
        { 
          id: 'apex-2025-06-27-newer', 
          title: 'Newer Patch',
          date: new Date('2025-06-27')
        },
        { 
          id: 'apex-2025-06-26-old', 
          title: 'Old Patch',
          date: new Date('2025-06-26')
        }
      ];
      
      getCachedPatchNotes.mockResolvedValue(mockPatches);
      
      // Mock last patch info to be the old patch (so 2 new patches are available)
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('apex-channel-config.json')) {
          return Promise.resolve(JSON.stringify({ channels: [] })); // No channels to avoid notification sending
        }
        if (filePath.includes('last-apex-patch.json')) {
          return Promise.resolve(JSON.stringify(mockPatches[2]));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Call with showAllNew = true
      const result = await apexNotificationService.manualCheckForUpdates(true);
      
      expect(result.success).toBe(true);
      expect(result.newPatchCount).toBe(2); // Should send all 2 new patches
      expect(result.message).toContain('Found and sent 2 new');
    });
  });

  describe('getMonitoringStatus', () => {
    it('should return current monitoring status', async () => {
      // Mock config file
      const mockConfig = { 
        channels: ['123456789'], 
        guilds: { '123456789': 'guild123' } 
      };
      const mockLastPatch = {
        id: 'apex-2025-06-25-test',
        title: 'Test Patch',
        date: '2025-06-25T10:00:00.000Z'
      };
      
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('apex-channel-config.json')) {
          return Promise.resolve(JSON.stringify(mockConfig));
        }
        if (filePath.includes('last-apex-patch.json')) {
          return Promise.resolve(JSON.stringify(mockLastPatch));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const status = await apexNotificationService.getMonitoringStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('channels');
      expect(status).toHaveProperty('lastPatch');
      expect(status).toHaveProperty('checkInterval');
      expect(status.channels).toEqual(['123456789']);
      expect(status.lastPatch).toEqual(mockLastPatch);
    });
  });
});
