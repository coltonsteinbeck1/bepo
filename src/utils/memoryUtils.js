/**
 * Memory Management Utilities
 * Handles user and server memory operations with business logic
 */
import { 
  getUserMemories, 
  searchUserMemories, 
  deleteUserMemories, 
  setUserPreference, 
  getUserMemoryStats,
  getTimeAgo,
  storeServerMemory,
  getServerMemories,
  searchServerMemories,
  deleteServerMemory,
  getServerMemoryStats,
  getUserServerMemories,
  updateUserMemory,
  updateServerMemory,
  getUserMemoryById,
  getServerMemoryById,
  getServerMemoryByPartialId
} from '../supabase/supabase.js';
import { safeAsync } from './errorHandler.js';

/**
 * User Memory Operations
 */
export class UserMemoryManager {
  /**
   * Get formatted memory display
   */
  static async getFormattedMemories(userId, type = 'all', limit = 10) {
    return await safeAsync(async () => {
      let memories;
      if (type === 'all') {
        memories = await getUserMemories(userId, null, limit);
      } else {
        memories = await searchUserMemories(userId, '', type, limit);
      }

      if (memories.length === 0) {
        return {
          success: true,
          message: `No ${type === 'all' ? '' : type + ' '}memories found.`,
          memories: []
        };
      }

      const formattedMemories = memories.map((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        return {
          index: index + 1,
          id: memory.id,
          type: memory.context_type,
          timeAgo,
          content: memory.memory_content,
          preview: memory.memory_content.substring(0, 100) + 
                  (memory.memory_content.length > 100 ? '...' : '')
        };
      });

      return {
        success: true,
        memories: formattedMemories,
        total: memories.length,
        hasMore: memories.length >= limit
      };
    }, { success: false, error: 'Failed to fetch memories' }, 'user_memory_get');
  }

  /**
   * Clear user memories with count
   */
  static async clearMemories(userId, type = null) {
    return await safeAsync(async () => {
      const deletedCount = await deleteUserMemories(userId, type);
      
      return {
        success: true,
        deletedCount,
        message: `Cleared ${deletedCount} ${type || ''} memories.`
      };
    }, { success: false, error: 'Failed to clear memories' }, 'user_memory_clear');
  }

  /**
   * Set user preference
   */
  static async setPreference(userId, key, value) {
    return await safeAsync(async () => {
      await setUserPreference(userId, key, value);
      
      return {
        success: true,
        message: `Preference "${key}" set to "${value}".`
      };
    }, { success: false, error: 'Failed to set preference' }, 'user_preference_set');
  }

  /**
   * Get memory statistics
   */
  static async getStats(userId) {
    return await safeAsync(async () => {
      const stats = await getUserMemoryStats(userId);
      
      return {
        success: true,
        stats
      };
    }, { success: false, error: 'Failed to get memory stats' }, 'user_memory_stats');
  }

  /**
   * Search memories
   */
  static async searchMemories(userId, searchTerm, type = null, limit = 10) {
    return await safeAsync(async () => {
      const memories = await searchUserMemories(userId, searchTerm, type, limit);
      
      if (memories.length === 0) {
        return {
          success: true,
          message: `No memories found matching "${searchTerm}".`,
          memories: []
        };
      }

      const formattedMemories = memories.map((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        return {
          index: index + 1,
          id: memory.id,
          type: memory.context_type,
          timeAgo,
          content: memory.memory_content,
          preview: memory.memory_content.substring(0, 100) + 
                  (memory.memory_content.length > 100 ? '...' : '')
        };
      });

      return {
        success: true,
        memories: formattedMemories,
        searchTerm,
        total: memories.length
      };
    }, { success: false, error: 'Failed to search memories' }, 'user_memory_search');
  }

  /**
   * Update user memory
   */
  static async updateMemory(memoryId, updates, userId = null) {
    return await safeAsync(async () => {
      let existing;
      let wasAdminUpdate = false;
      
      if (userId === null) {
        // Admin update - can update any memory
        existing = await getUserMemoryById(memoryId);
        wasAdminUpdate = true;
      } else {
        // Regular user - can only update their own memories
        existing = await getUserMemoryById(memoryId, userId);
      }
      
      if (!existing) {
        return {
          success: false,
          error: userId === null 
            ? 'Memory not found with that ID.'
            : 'Memory not found or you don\'t have permission to update it.'
        };
      }

      await updateUserMemory(memoryId, updates);
      
      return {
        success: true,
        message: 'Memory updated successfully.',
        memoryId,
        wasAdminUpdate,
        originalUserId: existing.user_id
      };
    }, { success: false, error: 'Failed to update memory' }, 'user_memory_update');
  }
}

/**
 * Server Memory Operations
 */
export class ServerMemoryManager {
  /**
   * Store server memory with validation
   */
  static async storeMemory(serverId, userId, content, title = null, contextType = 'server', metadata = {}, expiresAt = null) {
    return await safeAsync(async () => {
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: 'Memory content cannot be empty.'
        };
      }

      if (content.length > 2000) {
        return {
          success: false,
          error: 'Memory content is too long (max 2000 characters).'
        };
      }

      const result = await storeServerMemory(serverId, userId, content, title, contextType, metadata, expiresAt);
      
      return {
        success: true,
        message: 'Server memory stored successfully.',
        memoryId: result?.id
      };
    }, { success: false, error: 'Failed to store server memory' }, 'server_memory_store');
  }

  /**
   * Get formatted server memories
   */
  static async getFormattedMemories(serverId, type = null, limit = 20) {
    return await safeAsync(async () => {
      const memories = await getServerMemories(serverId, type, limit);
      
      if (memories.length === 0) {
        return {
          success: true,
          message: `No ${type || ''} server memories found.`,
          memories: []
        };
      }

      const formattedMemories = memories.map((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        return {
          index: index + 1,
          id: memory.id,
          title: memory.title,
          type: memory.context_type,
          timeAgo,
          content: memory.memory_content,
          preview: memory.memory_content.substring(0, 100) + 
                  (memory.memory_content.length > 100 ? '...' : ''),
          userId: memory.user_id
        };
      });

      return {
        success: true,
        memories: formattedMemories,
        total: memories.length,
        hasMore: memories.length >= limit
      };
    }, { success: false, error: 'Failed to fetch server memories' }, 'server_memory_get');
  }

  /**
   * Search server memories
   */
  static async searchMemories(serverId, searchTerm, type = null, limit = 10) {
    return await safeAsync(async () => {
      const memories = await searchServerMemories(serverId, searchTerm, type, limit);
      
      if (memories.length === 0) {
        return {
          success: true,
          message: `No server memories found matching "${searchTerm}".`,
          memories: []
        };
      }

      const formattedMemories = memories.map((memory, index) => {
        const timeAgo = getTimeAgo(new Date(memory.updated_at));
        return {
          index: index + 1,
          id: memory.id,
          title: memory.title,
          type: memory.context_type,
          timeAgo,
          content: memory.memory_content,
          preview: memory.memory_content.substring(0, 100) + 
                  (memory.memory_content.length > 100 ? '...' : ''),
          userId: memory.user_id
        };
      });

      return {
        success: true,
        memories: formattedMemories,
        searchTerm,
        total: memories.length
      };
    }, { success: false, error: 'Failed to search server memories' }, 'server_memory_search');
  }

  /**
   * Delete server memory
   */
  static async deleteMemory(memoryId, userId = null) {
    return await safeAsync(async () => {
      const result = await deleteServerMemory(memoryId, userId);
      
      if (!result) {
        return {
          success: false,
          error: 'Memory not found or access denied.'
        };
      }

      return {
        success: true,
        message: 'Server memory deleted successfully.',
        memoryId
      };
    }, { success: false, error: 'Failed to delete server memory' }, 'server_memory_delete');
  }

  /**
   * Get server memory statistics
   */
  static async getStats(serverId) {
    return await safeAsync(async () => {
      const stats = await getServerMemoryStats(serverId);
      
      return {
        success: true,
        stats
      };
    }, { success: false, error: 'Failed to get server memory stats' }, 'server_memory_stats');
  }

  /**
   * Update server memory
   */
  static async updateMemory(memoryId, updates, userId, serverId, isAdmin = false) {
    return await safeAsync(async () => {
      let existing;
      let resolvedMemoryId = memoryId;
      let wasAdminUpdate = false;
      
      // Try to resolve memory by ID (full or partial)
      if (memoryId.length <= 8) {
        // Try partial ID lookup first
        existing = await getServerMemoryByPartialId(memoryId, serverId);
        if (existing) {
          resolvedMemoryId = existing.id;
        }
      } else {
        // Try full ID first
        try {
          existing = await getServerMemoryById(memoryId, serverId);
        } catch (error) {
          // Fallback to partial ID
          existing = await getServerMemoryByPartialId(memoryId, serverId);
          if (existing) {
            resolvedMemoryId = existing.id;
          }
        }
      }
      
      if (!existing) {
        return {
          success: false,
          error: 'Server memory not found. Make sure you\'re using the correct ID from `/servermemory list`.'
        };
      }

      // Check permissions
      if (!isAdmin && existing.user_id !== userId) {
        return {
          success: false,
          error: 'You can only update server memories that you created. Admins can update any memory.'
        };
      }

      wasAdminUpdate = isAdmin && existing.user_id !== userId;

      await updateServerMemory(resolvedMemoryId, updates, isAdmin ? null : userId);
      
      return {
        success: true,
        message: 'Server memory updated successfully.',
        memoryId: resolvedMemoryId,
        displayId: memoryId.length <= 8 ? memoryId : resolvedMemoryId.substring(0, 8),
        wasAdminUpdate,
        originalUserId: existing.user_id
      };
    }, { success: false, error: 'Failed to update server memory' }, 'server_memory_update');
  }

  /**
   * Get memory by partial ID (for admin use)
   */
  static async getByPartialId(partialId, serverId = null) {
    return await safeAsync(async () => {
      const memory = await getServerMemoryByPartialId(partialId, serverId);
      
      if (!memory) {
        return {
          success: false,
          error: 'No memory found with that ID.'
        };
      }

      const timeAgo = getTimeAgo(new Date(memory.updated_at));
      
      return {
        success: true,
        memory: {
          id: memory.id,
          title: memory.title,
          type: memory.context_type,
          timeAgo,
          content: memory.memory_content,
          userId: memory.user_id
        }
      };
    }, { success: false, error: 'Failed to find memory' }, 'server_memory_find');
  }
}

/**
 * Memory utilities and helpers
 */
export const MemoryUtils = {
  /**
   * Validate memory content
   */
  validateContent(content) {
    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Content must be a non-empty string.' };
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Content cannot be empty.' };
    }

    if (trimmed.length > 2000) {
      return { valid: false, error: 'Content is too long (max 2000 characters).' };
    }

    return { valid: true, content: trimmed };
  },

  /**
   * Format memory list for display
   */
  formatMemoryList(memories, showMore = false) {
    if (!memories || memories.length === 0) {
      return 'No memories found.';
    }

    const formatted = memories.map(memory => {
      return `${memory.index}. **${memory.type}** (${memory.timeAgo}) \`ID: ${memory.id}\`\n   ${memory.preview}`;
    }).join('\n\n');

    if (showMore && memories.length >= 10) {
      return formatted + `\n\n... and more available`;
    }

    return formatted;
  },

  /**
   * Parse memory ID from user input
   */
  parseMemoryId(input) {
    if (!input) return null;
    
    // Extract ID from various formats
    const match = input.match(/\b([a-f0-9-]{8,})\b/i);
    return match ? match[1] : null;
  }
};
