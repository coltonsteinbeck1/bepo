// Unit tests for memory utils updates
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserMemoryManager, ServerMemoryManager } from '../../src/utils/memoryUtils.js';

// Mock the supabase functions
vi.mock('../../src/supabase/supabase.js', () => ({
  getUserMemoryById: vi.fn(),
  updateUserMemory: vi.fn(),
  getServerMemoryById: vi.fn(),
  getServerMemoryByPartialId: vi.fn(),
  updateServerMemory: vi.fn()
}));

describe('UserMemoryManager', () => {
  describe('updateMemory', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should update user memory for regular user', async () => {
      const mockMemory = { id: 'test-id', user_id: 'user123', memory_content: 'old content' };
      const { getUserMemoryById, updateUserMemory } = await import('../../src/supabase/supabase.js');
      
      getUserMemoryById.mockResolvedValue(mockMemory);
      updateUserMemory.mockResolvedValue(true);

      const result = await UserMemoryManager.updateMemory('test-id', { content: 'new content' }, 'user123');
      
      expect(result.success).toBe(true);
      expect(result.wasAdminUpdate).toBe(false);
      expect(getUserMemoryById).toHaveBeenCalledWith('test-id', 'user123');
      expect(updateUserMemory).toHaveBeenCalledWith('test-id', { content: 'new content' });
    });

    it('should update memory for admin user', async () => {
      const mockMemory = { id: 'test-id', user_id: 'user123', memory_content: 'old content' };
      const { getUserMemoryById, updateUserMemory } = await import('../../src/supabase/supabase.js');
      
      getUserMemoryById.mockResolvedValue(mockMemory);
      updateUserMemory.mockResolvedValue(true);

      const result = await UserMemoryManager.updateMemory('test-id', { content: 'new content' }, null);
      
      expect(result.success).toBe(true);
      expect(result.wasAdminUpdate).toBe(true);
      expect(result.originalUserId).toBe('user123');
      expect(getUserMemoryById).toHaveBeenCalledWith('test-id');
    });

    it('should fail when memory not found', async () => {
      const { getUserMemoryById } = await import('../../src/supabase/supabase.js');
      getUserMemoryById.mockResolvedValue(null);

      const result = await UserMemoryManager.updateMemory('invalid-id', { content: 'new content' }, 'user123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Memory not found');
    });

    it('should fail when user tries to update another user\'s memory', async () => {
      const mockMemory = { id: 'test-id', user_id: 'user123', memory_content: 'old content' };
      const { getUserMemoryById } = await import('../../src/supabase/supabase.js');
      getUserMemoryById.mockResolvedValue(null); // No memory found for user456

      const result = await UserMemoryManager.updateMemory('test-id', { content: 'new content' }, 'user456');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });
  });
});

describe('ServerMemoryManager', () => {
  describe('updateMemory', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should resolve partial ID and update memory', async () => {
      const mockMemory = { 
        id: 'full-uuid-12345678', 
        user_id: 'user123', 
        memory_content: 'old content',
        server_id: 'server123'
      };
      const { getServerMemoryByPartialId, updateServerMemory } = await import('../../src/supabase/supabase.js');
      
      getServerMemoryByPartialId.mockResolvedValue(mockMemory);
      updateServerMemory.mockResolvedValue(true);

      const result = await ServerMemoryManager.updateMemory(
        'full-uui', // partial ID
        { content: 'new content' }, 
        'user123', 
        'server123',
        false
      );
      
      expect(result.success).toBe(true);
      expect(result.memoryId).toBe('full-uuid-12345678');
      expect(result.displayId).toBe('full-uui');
      expect(getServerMemoryByPartialId).toHaveBeenCalledWith('full-uui', 'server123');
      expect(updateServerMemory).toHaveBeenCalledWith('full-uuid-12345678', { content: 'new content' }, 'user123');
    });

    it('should allow admin to update any memory', async () => {
      const mockMemory = { 
        id: 'test-id', 
        user_id: 'user123', 
        memory_content: 'old content',
        server_id: 'server123'
      };
      const { getServerMemoryById, updateServerMemory } = await import('../../src/supabase/supabase.js');
      
      getServerMemoryById.mockResolvedValue(mockMemory);
      updateServerMemory.mockResolvedValue(true);

      const result = await ServerMemoryManager.updateMemory(
        'test-id',
        { content: 'new content' }, 
        'admin456', // different user
        'server123',
        true // is admin
      );
      
      expect(result.success).toBe(true);
      expect(result.wasAdminUpdate).toBe(true);
      expect(result.originalUserId).toBe('user123');
    });

    it('should fail when non-admin tries to update another user\'s memory', async () => {
      const mockMemory = { 
        id: 'test-id', 
        user_id: 'user123', 
        memory_content: 'old content',
        server_id: 'server123'
      };
      const { getServerMemoryById } = await import('../../src/supabase/supabase.js');
      getServerMemoryById.mockResolvedValue(mockMemory);

      const result = await ServerMemoryManager.updateMemory(
        'test-id',
        { content: 'new content' }, 
        'user456', // different user
        'server123',
        false // not admin
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('You can only update server memories that you created');
    });

    it('should handle memory not found', async () => {
      const { getServerMemoryById, getServerMemoryByPartialId } = await import('../../src/supabase/supabase.js');
      getServerMemoryById.mockResolvedValue(null);
      getServerMemoryByPartialId.mockResolvedValue(null);

      const result = await ServerMemoryManager.updateMemory(
        'invalid-id',
        { content: 'new content' }, 
        'user123',
        'server123',
        false
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Server memory not found');
    });
  });
});
