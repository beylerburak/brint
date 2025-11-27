import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env first, then apps/api/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { prisma } from '../src/lib/prisma.js';
import { PERMISSIONS, getAllPermissionKeys } from '../src/core/auth/permissions.registry.js';

/**
 * Assigns permissions for a specific user across two workspaces:
 * - ws_beyler → OWNER with all permissions
 * - e0e6960b-8ed1-49c7-a5bd-12e3e334d10c → MEMBER with view-only permissions
 */

const USER_ID = 'cmigmuicp0000dklfgn2x7fp2';
const OWNER_WORKSPACE_ID = 'ws_beyler';
const VIEW_WORKSPACE_ID = 'e0e6960b-8ed1-49c7-a5bd-12e3e334d10c';

type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

async function getPermissionIds(permissionKeys: string[]) {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true, key: true },
  });

  const missing = permissionKeys.filter(
    (k) => !permissions.some((p) => p.key === k)
  );

  if (missing.length > 0) {
    throw new Error(`Missing permission records for keys: ${missing.join(', ')}`);
  }

  return permissions;
}

async function upsertRoleWithPermissions(params: {
  workspaceId: string;
  roleKey: string;
  roleName: string;
  permissionKeys: string[];
}) {
  const { workspaceId, roleKey, roleName, permissionKeys } = params;

  const role = await prisma.role.upsert({
    where: {
      workspaceId_key: {
        workspaceId,
        key: roleKey,
      },
    },
    update: {
      name: roleName,
    },
    create: {
      workspaceId,
      key: roleKey,
      name: roleName,
      builtIn: false,
    },
  });

  // Reset existing permissions for this role and reattach
  await prisma.rolePermission.deleteMany({
    where: { roleId: role.id },
  });

  const permissions = await getPermissionIds(permissionKeys);
  await prisma.rolePermission.createMany({
    data: permissions.map((perm) => ({
      roleId: role.id,
      permissionId: perm.id,
    })),
  });

  return { role, permissions: permissions.map((p) => p.key) };
}

async function upsertWorkspaceMember(workspaceId: string, role: WorkspaceRole) {
  return prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: USER_ID,
        workspaceId,
      },
    },
    update: {
      role,
    },
    create: {
      userId: USER_ID,
      workspaceId,
      role,
      joinedAt: new Date(),
    },
  });
}

async function main() {
  // Owner workspace: all permissions
  const ownerPerms = getAllPermissionKeys();
  const ownerRole = await upsertRoleWithPermissions({
    workspaceId: OWNER_WORKSPACE_ID,
    roleKey: 'workspace-owner',
    roleName: 'Workspace Owner (all)',
    permissionKeys: ownerPerms,
  });
  const ownerMember = await upsertWorkspaceMember(OWNER_WORKSPACE_ID, 'OWNER');

  console.log('✅ ws_beyler updated');
  console.log('   role:', ownerRole.role.key);
  console.log('   permissions:', ownerRole.permissions.length);
  console.log('   member role:', ownerMember.role);

  // View-only workspace: settings.view + brand.view
  const viewPerms = [
    PERMISSIONS.WORKSPACE_SETTINGS_VIEW,
    PERMISSIONS.STUDIO_BRAND_VIEW,
  ];
  const memberRole = await upsertRoleWithPermissions({
    workspaceId: VIEW_WORKSPACE_ID,
    roleKey: 'workspace-member',
    roleName: 'Workspace Member (view-only)',
    permissionKeys: viewPerms,
  });
  const member = await upsertWorkspaceMember(VIEW_WORKSPACE_ID, 'MEMBER');

  console.log('✅ e0e6960b-8ed1-49c7-a5bd-12e3e334d10c updated');
  console.log('   role:', memberRole.role.key);
  console.log('   permissions:', memberRole.permissions);
  console.log('   member role:', member.role);
}

main()
  .catch((err) => {
    console.error('❌ Failed to assign permissions', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
