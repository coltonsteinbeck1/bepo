/**
 * User Cache Service
 * 
 * 3-Tier Caching Strategy to eliminate N+1 queries and prevent memory corruption:
 * - L1: Memory cache (5 min TTL) - Instant (<1ms)
 * - L2: Database cache (24 hr TTL) - Fast (~20ms) 
 * - L3: Discord API (fallback) - Slow (~100-150ms)
 * 
 * This service ensures:
 * 1. Clear user attribution in memories (prevents "bot said" confusion)
 * 2. Fast username resolution (no N+1 problem)
 * 3. Support for custom display names (personalization)
 */

import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
let supabase = null;
const getSupabaseClient = () => {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return supabase;
};

class UserCacheService {
  constructor() {
    // L1: Memory cache (Map for O(1) lookups)
    this.memoryCache = new Map();
    this.MEMORY_TTL = 5 * 60 * 1000; // 5 minutes
    this.DB_TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup interval to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, 60 * 1000); // Every minute
  }

  /**
   * Get user info with 3-tier caching
   * @param {Object} client - Discord client
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object>} User info object
   */
  async getUserInfo(client, userId) {
    try {
      // L1: Check memory cache
      const cached = this.memoryCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.MEMORY_TTL) {
        return cached.data;
      }

      // L2: Check database cache
      const { data: dbUser, error: dbError } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('discord_id', userId)
        .single();

      if (!dbError && dbUser) {
        const cacheAge = Date.now() - new Date(dbUser.last_seen).getTime();

        // If DB cache is fresh (< 24 hours), use it
        if (cacheAge < this.DB_TTL) {
          const userInfo = {
            id: dbUser.discord_id,
            username: dbUser.username,
            displayName: dbUser.display_name,
            customName: dbUser.custom_name,
            avatarURL: dbUser.avatar_url
          };

          // Store in memory cache
          this.memoryCache.set(userId, {
            data: userInfo,
            timestamp: Date.now()
          });

          return userInfo;
        }
      }

      // L3: Fetch from Discord API (fallback)
      const discordUser = await client.users.fetch(userId).catch(() => null);

      if (!discordUser) {
        // Return minimal info if Discord fetch fails
        return {
          id: userId,
          username: `User${userId.slice(-4)}`,
          displayName: null,
          customName: null,
          avatarURL: null
        };
      }

      const userInfo = {
        id: discordUser.id,
        username: discordUser.username,
        displayName: discordUser.displayName || discordUser.globalName,
        customName: dbUser?.custom_name || null,
        avatarURL: discordUser.displayAvatarURL()
      };

      // Update database cache (upsert)
      await getSupabaseClient()
        .from('users')
        .upsert({
          discord_id: discordUser.id,
          username: discordUser.username,
          display_name: userInfo.displayName,
          custom_name: userInfo.customName,
          avatar_url: userInfo.avatarURL,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'discord_id'
        });

      // Store in memory cache
      this.memoryCache.set(userId, {
        data: userInfo,
        timestamp: Date.now()
      });

      return userInfo;
    } catch (error) {
      console.error(`[UserCache] Error fetching user ${userId}:`, error);
      return {
        id: userId,
        username: `User${userId.slice(-4)}`,
        displayName: null,
        customName: null,
        avatarURL: null
      };
    }
  }

  /**
   * Batch fetch multiple users in parallel
   * Eliminates N+1 query problem
   * @param {Object} client - Discord client
   * @param {string[]} userIds - Array of Discord user IDs
   * @returns {Promise<Map>} Map of userId -> userInfo
   */
  async batchGetUsers(client, userIds) {
    if (!userIds || userIds.length === 0) {
      return new Map();
    }

    // Remove duplicates
    const uniqueIds = [...new Set(userIds)];

    // Fetch all users in parallel
    const userPromises = uniqueIds.map(id =>
      this.getUserInfo(client, id)
        .then(info => ({ id, info }))
        .catch(error => {
          console.error(`[UserCache] Failed to fetch user ${id}:`, error);
          return {
            id,
            info: {
              id,
              username: `User${id.slice(-4)}`,
              displayName: null,
              customName: null,
              avatarURL: null
            }
          };
        })
    );

    const results = await Promise.all(userPromises);

    // Convert to Map for O(1) lookups
    const userMap = new Map();
    results.forEach(({ id, info }) => {
      userMap.set(id, info);
    });

    return userMap;
  }

  /**
   * Get the display name for a user (priority: custom > display > username)
   * @param {Object} userInfo - User info object
   * @returns {string} Display name
   */
  getDisplayName(userInfo) {
    if (!userInfo) return 'Unknown User';
    return userInfo.customName || userInfo.displayName || userInfo.username;
  }

  /**
   * Set custom name for personalized responses (future /setname command)
   * @param {string} userId - Discord user ID
   * @param {string} customName - Custom name to set
   * @returns {Promise<boolean>} Success status
   */
  async setCustomName(userId, customName) {
    try {
      const { error } = await getSupabaseClient()
        .from('users')
        .update({
          custom_name: customName,
          updated_at: new Date().toISOString()
        })
        .eq('discord_id', userId);

      if (error) throw error;

      // Invalidate memory cache to force refresh
      this.memoryCache.delete(userId);

      return true;
    } catch (error) {
      console.error(`[UserCache] Error setting custom name for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup expired entries from memory cache
   * Prevents memory leaks
   */
  cleanupExpiredCache() {
    const now = Date.now();
    let removed = 0;

    for (const [userId, cached] of this.memoryCache.entries()) {
      if (now - cached.timestamp > this.MEMORY_TTL) {
        this.memoryCache.delete(userId);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[UserCache] Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Clear all caches (for testing/debugging)
   */
  clearCache() {
    this.memoryCache.clear();
    console.log('[UserCache] All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      memoryTTL: this.MEMORY_TTL,
      dbTTL: this.DB_TTL
    };
  }

  /**
   * Cleanup on service shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.memoryCache.clear();
  }
}

// Singleton instance
const userCacheService = new UserCacheService();

export default userCacheService;
