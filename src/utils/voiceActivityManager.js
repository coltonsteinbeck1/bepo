// Voice Activity Manager for coordinating between music and yap commands
// Ensures mutual exclusion - only one type of voice activity per guild

class VoiceActivityManager {
    constructor() {
        // guildId -> { type: 'music'|'yap', channelId: string, data: any }
        this.activeGuilds = new Map();
    }

    /**
     * Check if a guild has any active voice activity
     * @param {string} guildId - The guild ID to check
     * @returns {Object|null} - Activity info or null if none
     */
    getActiveActivity(guildId) {
        return this.activeGuilds.get(guildId) || null;
    }

    /**
     * Check if a specific type of activity can start in a guild
     * @param {string} guildId - The guild ID
     * @param {string} activityType - 'music' or 'yap'
     * @returns {Object} - { canStart: boolean, conflictType?: string, channelId?: string }
     */
    canStartActivity(guildId, activityType) {
        const existingActivity = this.activeGuilds.get(guildId);
        
        if (!existingActivity) {
            return { canStart: true };
        }

        // Same type is allowed (for music queue management)
        if (existingActivity.type === activityType) {
            return { canStart: true };
        }

        // Different type is blocked
        return {
            canStart: false,
            conflictType: existingActivity.type,
            channelId: existingActivity.channelId
        };
    }

    /**
     * Register a new voice activity
     * @param {string} guildId - The guild ID
     * @param {string} activityType - 'music' or 'yap'
     * @param {string} channelId - The voice channel ID
     * @param {any} data - Additional data (queue, session, etc.)
     * @returns {boolean} - Success status
     */
    startActivity(guildId, activityType, channelId, data = null) {
        const canStart = this.canStartActivity(guildId, activityType);
        
        if (!canStart.canStart) {
            return false;
        }

        this.activeGuilds.set(guildId, {
            type: activityType,
            channelId: channelId,
            data: data,
            startTime: Date.now()
        });

        console.log(`[VOICE_ACTIVITY] Started ${activityType} activity in guild ${guildId}, channel ${channelId}`);
        return true;
    }

    /**
     * Update activity data (for things like queue updates)
     * @param {string} guildId - The guild ID
     * @param {any} data - New data to store
     */
    updateActivity(guildId, data) {
        const activity = this.activeGuilds.get(guildId);
        if (activity) {
            activity.data = data;
        }
    }

    /**
     * Stop voice activity in a guild
     * @param {string} guildId - The guild ID
     * @param {string} activityType - The type that's stopping (for validation)
     * @returns {boolean} - Success status
     */
    stopActivity(guildId, activityType = null) {
        const activity = this.activeGuilds.get(guildId);
        
        if (!activity) {
            return false;
        }

        // If type is specified, only stop if it matches
        if (activityType && activity.type !== activityType) {
            return false;
        }

        this.activeGuilds.delete(guildId);
        console.log(`[VOICE_ACTIVITY] Stopped ${activity.type} activity in guild ${guildId}`);
        return true;
    }

    /**
     * Get a user-friendly error message for blocked activities
     * @param {string} requestedType - The type trying to start
     * @param {string} conflictType - The blocking type
     * @param {string} channelId - The channel with existing activity
     * @param {Object} client - Discord client (optional, for channel name lookup)
     * @returns {string} - Error message
     */
    getBlockedMessage(requestedType, conflictType, channelId, client = null) {
        let conflictName = conflictType;
        let requestedName = requestedType;
        let channelName = `<#${channelId}>`;

        // Get friendlier names
        if (conflictType === 'music') conflictName = 'music playback';
        if (conflictType === 'yap') conflictName = 'voice chat (yap)';
        if (requestedType === 'music') requestedName = 'music';
        if (requestedType === 'yap') requestedName = 'voice chat';

        // Try to get channel name if client provided
        if (client) {
            try {
                const channel = client.channels.cache.get(channelId);
                if (channel) {
                    channelName = `#${channel.name}`;
                }
            } catch (error) {
                // Fallback to mention format
            }
        }

        return `❌ Cannot start ${requestedName} because ${conflictName} is already active in ${channelName}. Please stop the existing activity first.`;
    }

    /**
     * Get all active activities (for debugging/admin)
     * @returns {Map} - All active activities
     */
    getAllActivities() {
        return new Map(this.activeGuilds);
    }

    /**
     * Force stop all activities (cleanup/emergency)
     */
    stopAllActivities() {
        console.log(`[VOICE_ACTIVITY] Force stopping ${this.activeGuilds.size} activities`);
        this.activeGuilds.clear();
    }
}

// Export a singleton instance
const voiceActivityManager = new VoiceActivityManager();
export default voiceActivityManager;
