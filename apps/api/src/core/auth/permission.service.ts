import { PermissionKey, isPermissionKey } from './permissions.registry.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { redis } from '../../lib/redis.js';

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
 * Permission service:
 * - Source of truth is DB
 * - Cached in Redis per user + workspace
 * - Cache key: permissions:${userId}:${workspaceId}
 */
class PermissionService {
  private readonly ttlSeconds = 300;

  private buildCacheKey(userId: string, workspaceId: string): string {
    return `permissions:${userId}:${workspaceId}`;
  }

  private async readFromCache(
    cacheKey: string
  ): Promise<PermissionKey[] | null> {
    try {
      const cached = await redis.get(cacheKey);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      if (
        Array.isArray(parsed) &&
        parsed.every((p) => typeof p === 'string' && isPermissionKey(p))
      ) {
        return parsed as PermissionKey[];
      }

      // Cache is malformed → drop it
      await redis.del(cacheKey);
    } catch (error) {
      logger.warn({ err: error, cacheKey }, 'Permission cache read failed');
    }

    return null;
  }

  private async writeToCache(
    cacheKey: string,
    permissions: PermissionKey[]
  ): Promise<void> {
    try {
      await redis.set(cacheKey, JSON.stringify(permissions), 'EX', this.ttlSeconds);
    } catch (error) {
      logger.warn({ err: error, cacheKey }, 'Permission cache write failed');
    }
  }

  /**
   * Gets effective permissions for a user in a workspace
   * Resolution order:
   * 1. Redis cache
   * 2. DB: WorkspaceMember -> Role -> RolePermission -> Permission
   */
  async getEffectivePermissionsForUserWorkspace(
    input: EffectivePermissionsInput
  ): Promise<EffectivePermissionsResult> {
    const { userId, workspaceId } = input;
    const cacheKey = this.buildCacheKey(userId, workspaceId);

    const cachedPermissions = await this.readFromCache(cacheKey);
    if (cachedPermissions) {
      return { userId, workspaceId, permissions: cachedPermissions };
    }

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
      const result = {
        userId,
        workspaceId,
        permissions: [],
      };
      await this.writeToCache(cacheKey, result.permissions);
      return result;
    }

    // 2. Map WorkspaceMember.role to Role.key
    const memberRole = workspaceMember.role as MemberRole;
    const roleKey = MEMBER_ROLE_TO_ROLE_KEY[memberRole];

    if (!roleKey) {
      logger.warn(
        { userId, workspaceId, memberRole },
        'Unknown member role, returning empty permissions'
      );
      const result = {
        userId,
        workspaceId,
        permissions: [],
      };
      await this.writeToCache(cacheKey, result.permissions);
      return result;
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
      const result = {
        userId,
        workspaceId,
        permissions: [],
      };
      await this.writeToCache(cacheKey, result.permissions);
      return result;
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

    // Cache result for subsequent requests
    await this.writeToCache(cacheKey, uniquePermissions);

    return {
      userId,
      workspaceId,
      permissions: uniquePermissions,
    };
  }

  /**
   * Checks if a user has a specific permission in a workspace
   */
  async hasPermission(input: {
    userId: string;
    workspaceId: string;
    permission: PermissionKey;
  }): Promise<boolean> {
    const effectivePermissions = await this.getEffectivePermissionsForUserWorkspace({
      userId: input.userId,
      workspaceId: input.workspaceId,
    });

    return effectivePermissions.permissions.includes(input.permission);
  }

  /**
   * Invalidates cached permissions for a user + workspace
   */
  async invalidateUserWorkspace(userId: string, workspaceId: string): Promise<void> {
    const cacheKey = this.buildCacheKey(userId, workspaceId);
    try {
      await redis.del(cacheKey);
    } catch (error) {
      logger.warn({ err: error, cacheKey }, 'Permission cache invalidate failed');
    }
  }
}

export const permissionService = new PermissionService();
