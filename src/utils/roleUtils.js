/**
 * Role Management Utilities
 * Handles Discord role operations and permissions with multi-guild support
 */
import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { safeAsync } from './errorHandler.js';
import { getBZBannedRoles } from '../supabase/supabase.js';

/**
 * Role Management Operations
 */
export class RoleManager {
  /**
   * Check if a member has admin permissions
   * @param {GuildMember} member - Discord guild member
   * @param {string} guildId - Discord guild ID
   * @param {string} level - Required permission level ('owner', 'admin', 'moderator')
   * @returns {boolean} True if member has admin permissions
   */
  static async isAdmin(member, guildId, level = 'moderator') {
    if (!member) return false;
    
    // Check if user has Discord Administrator permission
    if (member.permissions.has('Administrator')) {
      return true;
    }
    
    // Check if user is the CODE_MONKEY admin
    const codeMonkeyId = process.env.CODE_MONKEY;
    if (codeMonkeyId && member.user.id === codeMonkeyId) {
      return true;
    }
    
    return false;
  }

  /**
   * Get available roles for adding (not banned, not managed, user doesn't have)
   */
  static async getAvailableRoles(guild, member) {
    return await safeAsync(async () => {
      await guild.roles.fetch();
      
      const bannedRolesData = await getBZBannedRoles();
      const bannedRoleIds = bannedRolesData.map(role => role.role_id); // Keep as integers
      const bannedRolesSet = new Set(bannedRoleIds);

      const availableRoles = guild.roles.cache.filter(role => {
        try {
          const roleIdAsInt = parseInt(role.id); // Convert Discord role ID to integer
          const isBanned = bannedRolesSet.has(roleIdAsInt);

          return !role.managed &&
                 role.id !== guild.id &&
                 !isBanned &&
                 !member.roles.cache.has(role.id);
        } catch (error) {
          return false;
        }
      });

      return Array.from(availableRoles.values());
    }, [], 'get_available_roles');
  }

  /**
   * Get removable roles (not banned, not managed, user has)
   */
  static async getRemovableRoles(guild, member) {
    return await safeAsync(async () => {
      await guild.roles.fetch();
      
      const bannedRolesData = await getBZBannedRoles();
      const bannedRoleIds = bannedRolesData.map(role => role.role_id); // Keep as integers
      const bannedRolesSet = new Set(bannedRoleIds);

      const removableRoles = guild.roles.cache.filter(role => {
        try {
          const roleIdAsInt = parseInt(role.id); // Convert Discord role ID to integer
          const isBanned = bannedRolesSet.has(roleIdAsInt);

          return !role.managed &&
                 role.id !== guild.id &&
                 !isBanned &&
                 member.roles.cache.has(role.id);
        } catch (error) {
          return false;
        }
      });

      return Array.from(removableRoles.values());
    }, [], 'get_removable_roles');
  }

  /**
   * Create role buttons for interaction
   */
  static createRoleButtons(roles, action = 'add') {
    if (!roles || roles.length === 0) {
      return [];
    }

    const buttons = roles.map(role => {
      const customId = action === 'add' ? `roleToggle:${role.id}` : `removeRole:${role.id}`;
      const style = action === 'add' ? ButtonStyle.Primary : ButtonStyle.Danger;
      
      return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(role.name)
        .setStyle(style);
    });

    // Group buttons into rows (max 5 per row)
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    return rows;
  }

  /**
   * Add role to member
   */
  static async addRole(member, roleId) {
    return await safeAsync(async () => {
      // Check if role is banned
      const bannedRolesData = await getBZBannedRoles();
      const bannedRoleIds = bannedRolesData.map(role => role.role_id); // Keep as integers
      const roleIdAsInt = parseInt(roleId); // Convert Discord role ID to integer
      const isBanned = bannedRoleIds.includes(roleIdAsInt);
      
      if (isBanned) {
        return {
          success: false,
          message: 'This role is not available for assignment.'
        };
      }

      if (member.roles.cache.has(roleId)) {
        return {
          success: false,
          message: 'You already have this role.'
        };
      }

      await member.roles.add(roleId);
      
      return {
        success: true,
        message: 'Role added successfully.'
      };
    }, { success: false, message: 'Failed to add role. The bot might not have the required permissions.' }, 'add_role');
  }

  /**
   * Remove role from member
   */
  static async removeRole(member, roleId) {
    return await safeAsync(async () => {
      // Check if role is banned
      const bannedRolesData = await getBZBannedRoles();
      const bannedRoleIds = bannedRolesData.map(role => role.role_id); // Keep as integers
      const roleIdAsInt = parseInt(roleId); // Convert Discord role ID to integer
      const isBanned = bannedRoleIds.includes(roleIdAsInt);
      
      if (isBanned) {
        return {
          success: false,
          message: 'This role is not available for removal.'
        };
      }

      if (!member.roles.cache.has(roleId)) {
        return {
          success: false,
          message: 'You do not have this role.'
        };
      }

      await member.roles.remove(roleId);
      
      return {
        success: true,
        message: 'Role removed successfully.'
      };
    }, { success: false, message: 'Failed to remove role. The bot might not have the required permissions.' }, 'remove_role');
  }

  /**
   * Validate role operation permissions
   */
  static validatePermissions(guild, bot, role) {
    if (!guild || !bot || !role) {
      return { valid: false, error: 'Missing required parameters.' };
    }

    const botMember = guild.members.cache.get(bot.id);
    if (!botMember) {
      return { valid: false, error: 'Bot member not found in guild.' };
    }

    // Check if bot has permission to manage roles
    if (!botMember.permissions.has('ManageRoles')) {
      return { valid: false, error: 'Bot does not have permission to manage roles.' };
    }

    // Check if the role is manageable (bot's highest role must be higher)
    const botHighestRole = botMember.roles.highest;
    if (role.position >= botHighestRole.position) {
      return { valid: false, error: 'Cannot manage this role due to hierarchy restrictions.' };
    }

    return { valid: true };
  }

  /**
   * Check if server allows role commands
   */
  static async isRoleCommandAllowed(guildId) {
    // For now, allow role commands in all servers
    // This can be expanded later with a proper guild config system
    return true;
  }

  /**
   * Get role statistics
   */
  static async getRoleStats(guild) {
    return await safeAsync(async () => {
      await guild.roles.fetch();
      
      const bannedRolesData = await getBZBannedRoles();
      const bannedRoleIds = bannedRolesData.map(role => role.role_id); // Keep as integers
      const bannedRolesSet = new Set(bannedRoleIds);

      const allRoles = guild.roles.cache;
      const managedRoles = allRoles.filter(role => role.managed);
      const bannedRoles = allRoles.filter(role => {
        const roleIdAsInt = parseInt(role.id);
        return bannedRolesSet.has(roleIdAsInt);
      });
      const assignableRoles = allRoles.filter(role => {
        const roleIdAsInt = parseInt(role.id);
        return !role.managed && 
               role.id !== guild.id && 
               !bannedRolesSet.has(roleIdAsInt);
      });

      return {
        total: allRoles.size,
        managed: managedRoles.size,
        banned: bannedRoles.size,
        assignable: assignableRoles.size
      };
    }, { total: 0, managed: 0, banned: 0, assignable: 0 }, 'get_role_stats');
  }

  /**
   * Check if a member has admin permissions
   * @param {GuildMember} member - Discord guild member
   * @returns {boolean} True if member has admin permissions
   */
  static isAdmin(member) {
    if (!member) return false;
    
    // Check if user has Discord Administrator permission
    if (member.permissions.has('Administrator')) {
      return true;
    }
    
    // Check if user is the CODE_MONKEY admin
    const codeMonkeyId = process.env.CODE_MONKEY;
    if (codeMonkeyId && member.user.id === codeMonkeyId) {
      return true;
    }
    
    return false;
  }
}

/**
 * Role utilities and helpers
 */
export const RoleUtils = {
  /**
   * Format role list for display
   */
  formatRoleList(roles, includeId = false) {
    if (!roles || roles.length === 0) {
      return 'No roles found.';
    }

    return roles.map(role => {
      const display = includeId ? `${role.name} (${role.id})` : role.name;
      return `• ${display}`;
    }).join('\n');
  },

  /**
   * Chunk roles for pagination
   */
  chunkRoles(roles, chunkSize = 25) {
    if (!roles || roles.length === 0) return [];
    
    const chunks = [];
    for (let i = 0; i < roles.length; i += chunkSize) {
      chunks.push(roles.slice(i, i + chunkSize));
    }
    return chunks;
  },

  /**
   * Find role by name or ID
   */
  findRole(guild, identifier) {
    if (!guild || !identifier) return null;

    // Try to find by ID first
    let role = guild.roles.cache.get(identifier);
    if (role) return role;

    // Try to find by name (case insensitive)
    role = guild.roles.cache.find(r => 
      r.name.toLowerCase() === identifier.toLowerCase()
    );
    
    return role || null;
  },

  /**
   * Validate role name
   */
  validateRoleName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Role name must be a non-empty string.' };
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Role name cannot be empty.' };
    }

    if (trimmed.length > 100) {
      return { valid: false, error: 'Role name is too long (max 100 characters).' };
    }

    return { valid: true, name: trimmed };
  }
};
