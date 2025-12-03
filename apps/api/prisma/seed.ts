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
    [PERMISSIONS.WORKSPACE_SETTINGS_MANAGE]: 'Manage workspace settings',
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

  // workspace-admin → workspace:settings.manage, studio:brand.view, studio:content.create, studio:content.publish
  const adminPermissionKeys = new Set([
    PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
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

  // 7. Default Task Statuses (3 essential, non-deletable but renameable)
  const defaultStatuses = [
    // TODO Group - Essential default
    {
      name: 'Not Started',
      slug: 'not-started',
      group: 'TODO' as const,
      color: '#6B7280', // gray
      icon: 'circle',
      description: 'Tasks that have not been started yet',
      order: 0,
    },
    // IN_PROGRESS Group - Essential default
    {
      name: 'In Progress',
      slug: 'in-progress',
      group: 'IN_PROGRESS' as const,
      color: '#8B5CF6', // purple
      icon: 'circle-dot',
      description: 'Currently being worked on',
      order: 0,
    },
    // DONE Group - Essential default
    {
      name: 'Completed',
      slug: 'completed',
      group: 'DONE' as const,
      color: '#10B981', // green
      icon: 'check-circle',
      description: 'Completed successfully',
      order: 0,
    },
  ];

  // Create or update default statuses
  const createdStatuses: any[] = [];
  
  for (const statusData of defaultStatuses) {
    const existing = await prisma.taskStatus.findFirst({
      where: {
        workspaceId: workspace.id,
        brandId: null,
        slug: statusData.slug,
      },
    });

    if (existing) {
      // Update existing status
      const updated = await prisma.taskStatus.update({
        where: { id: existing.id },
        data: {
          name: statusData.name,
          group: statusData.group,
          color: statusData.color,
          icon: statusData.icon,
          description: statusData.description,
          isDefault: true,
          order: statusData.order,
        },
      });
      createdStatuses.push(updated);
      console.log(`✅ Updated status: ${statusData.name}`);
    } else {
      // Create new status
      const created = await prisma.taskStatus.create({
        data: {
          workspaceId: workspace.id,
          brandId: null,
          name: statusData.name,
          slug: statusData.slug,
          group: statusData.group,
          color: statusData.color,
          icon: statusData.icon,
          description: statusData.description,
          isDefault: true,
          order: statusData.order,
        },
      });
      createdStatuses.push(created);
      console.log(`✅ Created status: ${statusData.name}`);
    }
  }

  // Migrate tasks from old statuses to new ones
  const notStartedStatus = createdStatuses.find((s) => s.slug === 'not-started');
  
  if (notStartedStatus) {
    // Find old statuses that should map to "Not Started"
    const oldTodoStatuses = await prisma.taskStatus.findMany({
      where: {
        workspaceId: workspace.id,
        isDefault: true,
        slug: { in: ['backlog', 'todo'] },
      },
    });

    for (const oldStatus of oldTodoStatuses) {
      if (oldStatus.id !== notStartedStatus.id) {
        // Migrate tasks
        await prisma.task.updateMany({
          where: { statusId: oldStatus.id },
          data: { statusId: notStartedStatus.id },
        });
        
        // Delete old status
        await prisma.taskStatus.delete({
          where: { id: oldStatus.id },
        });
        console.log(`🔄 Migrated tasks from "${oldStatus.name}" to "Not Started"`);
      }
    }
  }

  console.log(`✅ Configured ${defaultStatuses.length} essential default task statuses`);

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
