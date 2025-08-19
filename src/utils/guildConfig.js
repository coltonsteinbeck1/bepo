/**
 * Multi-Guild Configuration Management System
 * Replaces hardcoded guild dependencies with flexible per-guild configuration
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

/**
 * Guild Configuration Management
 */
export class GuildConfigManager {
    /**
     * Initialize a new guild configuration
     * @param {string} guildId - Discord guild ID
     * @param {string} guildName - Discord guild name
     * @param {string} ownerUserId - Initial admin user ID
     * @returns {Object} Configuration result
     */
    static async initializeGuild(guildId, guildName, ownerUserId) {
        try {
            // Check if guild already exists
            const existing = await this.getGuildConfig(guildId);
            if (existing) {
                return { success: false, error: 'Guild already configured' };
            }

            // Create guild configuration
            const { data, error } = await supabase
                .from('guild_configs')
                .insert([{
                    guild_id: guildId,
                    guild_name: guildName,
                    owner_user_id: ownerUserId,
                    role_commands_enabled: true,
                    notifications_enabled: true,
                    memory_system_enabled: true,
                    voice_features_enabled: true
                }])
                .select()
                .single();

            if (error) throw error;

            // Add owner as admin
            await this.addGuildAdmin(guildId, ownerUserId, 'owner', ownerUserId);

            return { success: true, config: data };
        } catch (error) {
            console.error('Error initializing guild:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get guild configuration
     * @param {string} guildId - Discord guild ID
     * @returns {Object|null} Guild configuration or null
     */
    static async getGuildConfig(guildId) {
        try {
            const { data, error } = await supabase
                .from('guild_configs')
                .select('*')
                .eq('guild_id', guildId)
                .single();

            if (error && error.code !== 'PGRST116') { // Not found error is OK
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching guild config:', error);
            return null;
        }
    }

    /**
     * Update guild configuration
     * @param {string} guildId - Discord guild ID
     * @param {Object} updates - Configuration updates
     * @returns {Object} Update result
     */
    static async updateGuildConfig(guildId, updates) {
        try {
            const { data, error } = await supabase
                .from('guild_configs')
                .update(updates)
                .eq('guild_id', guildId)
                .select()
                .single();

            if (error) throw error;

            return { success: true, config: data };
        } catch (error) {
            console.error('Error updating guild config:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if guild is configured and feature is enabled
     * @param {string} guildId - Discord guild ID
     * @param {string} feature - Feature name (e.g., 'role_commands_enabled')
     * @returns {boolean} Whether feature is enabled
     */
    static async isFeatureEnabled(guildId, feature) {
        const config = await this.getGuildConfig(guildId);
        return config ? config[feature] === true : false;
    }

}



/**
 * Guild Banned Roles Management (replaces getBZBannedRoles)
 */
export class GuildBannedRolesManager {
    /**
     * Get banned roles for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Array} List of banned role IDs
     */
    static async getBannedRoles(guildId) {
        try {
            const { data, error } = await supabase
                .from('guild_banned_roles')
                .select('role_id')
                .eq('guild_id', guildId);

            if (error) throw error;

            return data?.map(row => row.role_id) || [];
        } catch (error) {
            console.error('Error fetching banned roles:', error);
            return [];
        }
    }

    /**
     * Ban a role in a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} roleId - Role ID to ban
     * @param {string} roleName - Role name
     * @param {string} bannedBy - User ID who banned the role
     * @param {string} reason - Reason for banning
     * @returns {Object} Result
     */
    static async banRole(guildId, roleId, roleName, bannedBy, reason = null) {
        try {
            const { data, error } = await supabase
                .from('guild_banned_roles')
                .insert([{
                    guild_id: guildId,
                    role_id: roleId,
                    role_name: roleName,
                    banned_by: bannedBy,
                    reason: reason
                }])
                .select()
                .single();

            if (error) throw error;

            return { success: true, bannedRole: data };
        } catch (error) {
            console.error('Error banning role:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Unban a role in a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} roleId - Role ID to unban
     * @returns {Object} Result
     */
    static async unbanRole(guildId, roleId) {
        try {
            const { error } = await supabase
                .from('guild_banned_roles')
                .delete()
                .eq('guild_id', guildId)
                .eq('role_id', roleId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error unbanning role:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a role is banned in a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} roleId - Role ID to check
     * @returns {boolean} Whether role is banned
     */
    static async isRoleBanned(guildId, roleId) {
        try {
            const { data, error } = await supabase
                .from('guild_banned_roles')
                .select('role_id')
                .eq('guild_id', guildId)
                .eq('role_id', roleId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return !!data;
        } catch (error) {
            console.error('Error checking banned role:', error);
            return false;
        }
    }
}

/**
 * Permission Helper Functions
 */
export class PermissionManager {
    /**
     * Check if user has permission for an action in a guild
     * @param {Object} member - Discord guild member
     * @param {string} guildId - Discord guild ID
     * @param {string} action - Action to check ('admin', 'moderate', 'use_commands')
     * @returns {boolean} Whether user has permission
     */
    static async hasPermission(member, guildId, action) {
        if (!member || !guildId) return false;

        // Check Discord Administrator permission (always grants all permissions)
        if (member.permissions.has('Administrator')) {
            return true;
        }

        // Check if user is server owner
        if (member.guild.ownerId === member.user.id) {
            return true;
        }

        // Check legacy CODE_MONKEY admin user
        const codeMonkeyId = process.env.CODE_MONKEY;
        if (codeMonkeyId && member.user.id === codeMonkeyId) {
            return true;
        }

        switch (action) {
            case 'admin':
                // Only Discord Administrator and server owner have admin permissions
                return false;
            case 'moderate':
                // Check for Manage Guild permission for moderation
                return member.permissions.has('ManageGuild');
            case 'use_commands':
                // Check if guild allows the feature and user has basic permissions
                const config = await GuildConfigManager.getGuildConfig(guildId);
                return config && config.role_commands_enabled;
            default:
                return false;
        }
    }

    /**
     * Get user's permission level in a guild
     * @param {Object} member - Discord guild member
     * @param {string} guildId - Discord guild ID
     * @returns {string} Permission level ('owner', 'admin', 'moderator', 'user')
     */
    static async getUserPermissionLevel(member, guildId) {
        if (!member || !guildId) return 'user';

        // Check if user is server owner
        if (member.guild.ownerId === member.user.id) {
            return 'owner';
        }

        // Check Discord Administrator permission
        if (member.permissions.has('Administrator')) {
            return 'admin';
        }

        // Check legacy CODE_MONKEY admin user
        const codeMonkeyId = process.env.CODE_MONKEY;
        if (codeMonkeyId && member.user.id === codeMonkeyId) {
            return 'admin';
        }

        // Check for Manage Guild permission for moderation
        if (member.permissions.has('ManageGuild')) {
            return 'moderator';
        }

        return 'user';
    }
}
