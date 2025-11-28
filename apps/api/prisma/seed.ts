import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, getAllPermissionKeys } from '../src/core/auth/permissions.registry.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. User
  const user = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      name: 'Seed Owner',
    },
  });
  console.log('✅ User:', user.email);

  // 2. Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      slug: 'demo-workspace',
      name: 'Demo Workspace',
    },
  });
  console.log('✅ Workspace:', workspace.slug);

  // 3. WorkspaceMember
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    },
  });
  console.log('✅ WorkspaceMember created');

  // 4. Permissions
  // Use registry to ensure consistency between code and database
  const permissionKeys = getAllPermissionKeys();

  const permissionDescriptions: Record<string, string> = {
    [PERMISSIONS.WORKSPACE_SETTINGS_VIEW]: 'View workspace settings',
    [PERMISSIONS.WORKSPACE_MEMBERS_MANAGE]: 'Manage workspace members',
    [PERMISSIONS.STUDIO_BRAND_VIEW]: 'View brands in studio',
    [PERMISSIONS.STUDIO_BRAND_CREATE]: 'Create new brands',
    [PERMISSIONS.STUDIO_CONTENT_CREATE]: 'Create content',
    [PERMISSIONS.STUDIO_CONTENT_PUBLISH]: 'Publish content',
  };

  const permissions = [];
  for (const key of permissionKeys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        description: permissionDescriptions[key] || `Permission: ${key}`,
      },
    });
    permissions.push(permission);
  }
  console.log(`✅ Created ${permissions.length} permissions`);

  // 5. Roles
  // workspace-owner role (all permissions)
  const ownerRole = await prisma.role.upsert({
    where: {
      workspaceId_key: {
        workspaceId: workspace.id,
        key: 'workspace-owner',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      key: 'workspace-owner',
      name: 'Workspace Owner',
      description: 'Full access to all workspace features',
    },
  });
  console.log('✅ Role: workspace-owner');

  // workspace-admin role (limited permissions)
  const adminRole = await prisma.role.upsert({
    where: {
      workspaceId_key: {
        workspaceId: workspace.id,
        key: 'workspace-admin',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      key: 'workspace-admin',
      name: 'Workspace Admin',
      description: 'Can manage content and view brands',
    },
  });
  console.log('✅ Role: workspace-admin');

  // workspace-member role (minimal permissions)
  const memberRole = await prisma.role.upsert({
    where: {
      workspaceId_key: {
        workspaceId: workspace.id,
        key: 'workspace-member',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      key: 'workspace-member',
      name: 'Workspace Member',
      description: 'Basic access to workspace content',
    },
  });
  console.log('✅ Role: workspace-member');

  // 6. RolePermission
  // workspace-owner → all permissions
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: ownerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: ownerRole.id,
        permissionId: permission.id,
      },
    });
  }
  console.log(`✅ workspace-owner → ${permissions.length} permissions`);

  // workspace-admin → only: studio:brand.view, studio:content.create, studio:content.publish
  const adminPermissionKeys = new Set([
    PERMISSIONS.STUDIO_BRAND_VIEW,
    PERMISSIONS.STUDIO_CONTENT_CREATE,
    PERMISSIONS.STUDIO_CONTENT_PUBLISH,
  ]);
  const adminPermissions = permissions.filter((p) =>
    adminPermissionKeys.has(p.key)
  );

  for (const permission of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }
  console.log(`✅ workspace-admin → ${adminPermissions.length} permissions`);

  // workspace-member → minimal permissions (brand view)
  const memberPermissionKeys = new Set([PERMISSIONS.STUDIO_BRAND_VIEW]);
  const memberPermissions = permissions.filter((p) =>
    memberPermissionKeys.has(p.key)
  );

  for (const permission of memberPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: memberRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: memberRole.id,
        permissionId: permission.id,
      },
    });
  }
  console.log(`✅ workspace-member → ${memberPermissions.length} permissions`);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
