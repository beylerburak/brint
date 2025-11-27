/**
 * Permission Service
 * 
 * Resolves effective permissions for a user + workspace combination.
 * This service will be used by the requirePermission middleware (TS-21).
 */

import { PermissionKey, isPermissionKey, getAllPermissionKeys } from './permissions.registry.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export interface EffectivePermissionsInput {
  userId: string;
  workspaceId: string;
}

export interface EffectivePermissionsResult {
  userId: string;
  workspaceId: string;
  permissions: PermissionKey[];
}

/**
 * Maps WorkspaceMember.role values to Role.key values
 * Based on seed scenario: OWNER -> workspace-owner, ADMIN -> workspace-admin, MEMBER -> workspace-member
 */
const MEMBER_ROLE_TO_ROLE_KEY = {
  OWNER: 'workspace-owner',
  ADMIN: 'workspace-admin',
  MEMBER: 'workspace-member',
} as const;

type MemberRole = keyof typeof MEMBER_ROLE_TO_ROLE_KEY;

/**
 * Gets effective permissions for a user in a workspace
 * 
 * Logic:
 * 1. Find WorkspaceMember for userId + workspaceId
 * 2. Map WorkspaceMember.role to Role.key
 * 3. Query Role + RolePermission + Permission to get all permission keys
 * 4. Filter and validate permissions using registry
 * 5. Return unique, validated PermissionKey array
 */
async function getEffectivePermissionsForUserWorkspace(
  input: EffectivePermissionsInput
): Promise<EffectivePermissionsResult> {
  const { userId, workspaceId } = input;

  // 1. Check WorkspaceMember
  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });

  if (!workspaceMember) {
    // User is not a member of this workspace
    return {
      userId,
      workspaceId,
      permissions: [],
    };
  }

  // 2. Map WorkspaceMember.role to Role.key
  const memberRole = workspaceMember.role as MemberRole;
  const roleKey = MEMBER_ROLE_TO_ROLE_KEY[memberRole];

  if (!roleKey) {
    logger.warn(
      { userId, workspaceId, memberRole },
      'Unknown member role, returning empty permissions'
    );
    return {
      userId,
      workspaceId,
      permissions: [],
    };
  }

  // 3. Query Role + RolePermission + Permission
  const role = await prisma.role.findUnique({
    where: {
      workspaceId_key: {
        workspaceId,
        key: roleKey,
      },
    },
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!role) {
    logger.warn(
      { userId, workspaceId, roleKey },
      'Role not found, returning empty permissions'
    );
    return {
      userId,
      workspaceId,
      permissions: [],
    };
  }

  // 4. Extract permission keys and validate
  const rawPermissionKeys = role.rolePermissions.map(
    (rp) => rp.permission.key
  );

  const validPermissions: PermissionKey[] = [];
  const invalidKeys: string[] = [];

  for (const key of rawPermissionKeys) {
    if (isPermissionKey(key)) {
      validPermissions.push(key);
    } else {
      invalidKeys.push(key);
    }
  }

  if (invalidKeys.length > 0) {
    logger.warn(
      { userId, workspaceId, invalidKeys },
      'Found invalid permission keys in database, ignoring them'
    );
  }

  // 5. Make unique and sort alphabetically
  const uniquePermissions = Array.from(new Set(validPermissions)).sort();

  return {
    userId,
    workspaceId,
    permissions: uniquePermissions,
  };
}

/**
 * Checks if a user has a specific permission in a workspace
 * 
 * @param input - userId, workspaceId, and permission to check
 * @returns true if user has the permission, false otherwise
 */
async function hasPermission(input: {
  userId: string;
  workspaceId: string;
  permission: PermissionKey;
}): Promise<boolean> {
  const effectivePermissions = await getEffectivePermissionsForUserWorkspace({
    userId: input.userId,
    workspaceId: input.workspaceId,
  });

  return effectivePermissions.permissions.includes(input.permission);
}

export const permissionService = {
  getEffectivePermissionsForUserWorkspace,
  hasPermission,
};
