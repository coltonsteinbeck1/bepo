import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoleManager } from '../../src/utils/roleUtils.js';
import { getBZBannedRoles } from '../../src/supabase/supabase.js';
import { Collection } from 'discord.js';

// Mock the dependencies
vi.mock('../../src/supabase/supabase.js', () => ({
  getBZBannedRoles: vi.fn()
}));

vi.mock('../../src/utils/errorHandler.js', () => ({
  safeAsync: vi.fn((fn, fallback) => fn())
}));

describe('RoleSupport - Banned Roles Protection', () => {
  const mockRoles = new Collection();
  // Use realistic Discord snowflake IDs
  mockRoles.set('123456789012345678', { id: '123456789012345678', name: 'Test Role 1', managed: false, position: 1 });
  mockRoles.set('234567890123456789', { id: '234567890123456789', name: 'Test Role 2', managed: false, position: 2 });
  mockRoles.set('345678901234567890', { id: '345678901234567890', name: 'Banned Role', managed: false, position: 3 });
  mockRoles.set('456789012345678901', { id: '456789012345678901', name: 'Managed Role', managed: true, position: 4 });
  mockRoles.set('test-guild-123', { id: 'test-guild-123', name: '@everyone', managed: false, position: 0 });

  const mockGuild = {
    id: 'test-guild-123',
    roles: {
      cache: mockRoles,
      fetch: vi.fn()
    }
  };

  const mockMemberRoles = new Collection();
  mockMemberRoles.set('123456789012345678', true); // Member already has role1

  const mockMember = {
    guild: mockGuild,
    roles: {
      cache: mockMemberRoles,
      add: vi.fn(),
      remove: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no roles are banned
    getBZBannedRoles.mockResolvedValue([]);
  });

  describe('getAvailableRoles', () => {
    it('should exclude banned roles from available roles list', async () => {
      // Mock banned roles - role_id as integer (stored as bigint in DB)
      getBZBannedRoles.mockResolvedValue([{ role_id: 345678901234567890 }]);

      const availableRoles = await RoleManager.getAvailableRoles(mockGuild, mockMember);
      
      expect(availableRoles).toHaveLength(1);
      expect(availableRoles[0].id).toBe('234567890123456789');
      expect(availableRoles.some(role => role.id === '345678901234567890')).toBe(false);
    });

    it('should exclude managed roles and roles user already has', async () => {
      const availableRoles = await RoleManager.getAvailableRoles(mockGuild, mockMember);
      
      // Should not include 123456789012345678 (user has it), 456789012345678901 (managed), or guild.id role (@everyone)
      expect(availableRoles.some(role => role.id === '123456789012345678')).toBe(false);
      expect(availableRoles.some(role => role.id === '456789012345678901')).toBe(false);
    });
  });

  describe('getRemovableRoles', () => {
    it('should exclude banned roles from removable roles list', async () => {
      // Set up member to have both roles
      const memberRolesWithBoth = new Collection();
      memberRolesWithBoth.set('123456789012345678', true);
      memberRolesWithBoth.set('345678901234567890', true);
      mockMember.roles.cache = memberRolesWithBoth;

      // Mock role as banned
      getBZBannedRoles.mockResolvedValue([{ role_id: 345678901234567890 }]);

      const removableRoles = await RoleManager.getRemovableRoles(mockGuild, mockMember);
      
      expect(removableRoles).toHaveLength(1);
      expect(removableRoles[0].id).toBe('123456789012345678');
      expect(removableRoles.some(role => role.id === '345678901234567890')).toBe(false);
    });
  });

  describe('addRole', () => {
    it('should prevent adding banned roles', async () => {
      getBZBannedRoles.mockResolvedValue([{ role_id: 345678901234567890 }]);

      const result = await RoleManager.addRole(mockMember, '345678901234567890');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('This role is not available for assignment.');
      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('should allow adding non-banned roles', async () => {
      getBZBannedRoles.mockResolvedValue([]);
      const emptyRoles = new Collection();
      mockMember.roles.cache = emptyRoles; // Member has no roles

      const result = await RoleManager.addRole(mockMember, '234567890123456789');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Role added successfully.');
      expect(mockMember.roles.add).toHaveBeenCalledWith('234567890123456789');
    });

    it('should handle case when user already has the role', async () => {
      getBZBannedRoles.mockResolvedValue([]);
      const rolesWithRole2 = new Collection();
      rolesWithRole2.set('234567890123456789', true);
      mockMember.roles.cache = rolesWithRole2;

      const result = await RoleManager.addRole(mockMember, '234567890123456789');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('You already have this role.');
      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });
  });

  describe('removeRole', () => {
    it('should prevent removing banned roles', async () => {
      getBZBannedRoles.mockResolvedValue([{ role_id: 345678901234567890 }]);
      const rolesWithRole3 = new Collection();
      rolesWithRole3.set('345678901234567890', true);
      mockMember.roles.cache = rolesWithRole3;

      const result = await RoleManager.removeRole(mockMember, '345678901234567890');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('This role is not available for removal.');
      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });

    it('should allow removing non-banned roles', async () => {
      getBZBannedRoles.mockResolvedValue([]);
      const rolesWithRole2 = new Collection();
      rolesWithRole2.set('234567890123456789', true);
      mockMember.roles.cache = rolesWithRole2;

      const result = await RoleManager.removeRole(mockMember, '234567890123456789');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Role removed successfully.');
      expect(mockMember.roles.remove).toHaveBeenCalledWith('234567890123456789');
    });

    it('should handle case when user does not have the role', async () => {
      getBZBannedRoles.mockResolvedValue([]);
      const emptyRoles = new Collection();
      mockMember.roles.cache = emptyRoles;

      const result = await RoleManager.removeRole(mockMember, '234567890123456789');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('You do not have this role.');
      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });
  });
});
