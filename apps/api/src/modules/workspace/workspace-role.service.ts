import { Prisma, PrismaClient } from '@prisma/client';
import { PERMISSIONS, getAllPermissionKeys } from '../../core/auth/permissions.registry.js';

type TxClient = PrismaClient | Prisma.TransactionClient;

const permissionDescriptions: Record<string, string> = {
  [PERMISSIONS.WORKSPACE_SETTINGS_MANAGE]: 'Manage workspace settings',
  [PERMISSIONS.WORKSPACE_MEMBERS_MANAGE]: 'Manage workspace members',
  [PERMISSIONS.STUDIO_BRAND_VIEW]: 'View brands in studio',
  [PERMISSIONS.STUDIO_BRAND_CREATE]: 'Create new brands',
  [PERMISSIONS.STUDIO_CONTENT_CREATE]: 'Create content',
  [PERMISSIONS.STUDIO_CONTENT_PUBLISH]: 'Publish content',
  [PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW]: 'View social accounts',
};

const ADMIN_PERMISSION_KEYS = [
  PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
  PERMISSIONS.STUDIO_BRAND_VIEW,
  PERMISSIONS.STUDIO_CONTENT_CREATE,
  PERMISSIONS.STUDIO_CONTENT_PUBLISH,
] as const;

const MEMBER_PERMISSION_KEYS = [
  PERMISSIONS.STUDIO_BRAND_VIEW,
  PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
] as const;

interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  order: number;
  permissionKeys: readonly string[];
}

/**
 * Ensures built-in workspace roles and their permissions exist for the given workspace.
 * Idempotent: safe to call on every workspace creation or before listing roles.
 */
export async function ensureDefaultWorkspaceRoles(
  tx: TxClient,
  workspaceId: string
): Promise<void> {
  // Ensure all permissions exist using registry as source of truth
  const permissionKeys = getAllPermissionKeys();
  const permissions = await Promise.all(
    permissionKeys.map((key) =>
      tx.permission.upsert({
        where: { key },
        update: {},
        create: {
          key,
          description: permissionDescriptions[key] ?? `Permission: ${key}`,
        },
      })
    )
  );

  const permissionByKey = new Map(permissions.map((p) => [p.key, p]));

  const roles: RoleDefinition[] = [
    {
      key: 'workspace-owner',
      name: 'Workspace Owner',
      description: 'Full access to all workspace features',
      order: 0,
      permissionKeys,
    },
    {
      key: 'workspace-admin',
      name: 'Workspace Admin',
      description: 'Manage content and brands',
      order: 10,
      permissionKeys: ADMIN_PERMISSION_KEYS,
    },
    {
      key: 'workspace-member',
      name: 'Workspace Member',
      description: 'Basic access to workspace content',
      order: 20,
      permissionKeys: MEMBER_PERMISSION_KEYS,
    },
  ];

  for (const roleDef of roles) {
    const role = await tx.role.upsert({
      where: {
        workspaceId_key: {
          workspaceId,
          key: roleDef.key,
        },
      },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        builtIn: true,
        order: roleDef.order,
      },
      create: {
        workspaceId,
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        builtIn: true,
        order: roleDef.order,
      },
    });

    for (const permissionKey of roleDef.permissionKeys) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) continue;

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}
