import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, getAllPermissionKeys } from '../src/core/auth/permissions.registry.js';

const prisma = new PrismaClient();

// Role-Permission Matrix (from @brint/core-permissions)
const ROLE_PERMISSION_MATRIX = {
    OWNER: [
        PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
        PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
        PERMISSIONS.STUDIO_BRAND_VIEW,
        PERMISSIONS.STUDIO_BRAND_CREATE,
        PERMISSIONS.STUDIO_BRAND_UPDATE,
        PERMISSIONS.STUDIO_BRAND_DELETE,
        PERMISSIONS.STUDIO_BRAND_MANAGE_SOCIAL_ACCOUNTS,
        PERMISSIONS.STUDIO_BRAND_MANAGE_PUBLISHING_DEFAULTS,
        PERMISSIONS.STUDIO_CONTENT_VIEW,
        PERMISSIONS.STUDIO_CONTENT_CREATE,
        PERMISSIONS.STUDIO_CONTENT_UPDATE,
        PERMISSIONS.STUDIO_CONTENT_DELETE,
        PERMISSIONS.STUDIO_CONTENT_PUBLISH,
        PERMISSIONS.STUDIO_CONTENT_MANAGE_PUBLICATIONS,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_CONNECT,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DISCONNECT,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DELETE,
    ],
    ADMIN: [
        PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
        PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
        PERMISSIONS.STUDIO_BRAND_VIEW,
        PERMISSIONS.STUDIO_BRAND_CREATE,
        PERMISSIONS.STUDIO_BRAND_UPDATE,
        PERMISSIONS.STUDIO_BRAND_DELETE,
        PERMISSIONS.STUDIO_BRAND_MANAGE_SOCIAL_ACCOUNTS,
        PERMISSIONS.STUDIO_BRAND_MANAGE_PUBLISHING_DEFAULTS,
        PERMISSIONS.STUDIO_CONTENT_VIEW,
        PERMISSIONS.STUDIO_CONTENT_CREATE,
        PERMISSIONS.STUDIO_CONTENT_UPDATE,
        PERMISSIONS.STUDIO_CONTENT_DELETE,
        PERMISSIONS.STUDIO_CONTENT_PUBLISH,
        PERMISSIONS.STUDIO_CONTENT_MANAGE_PUBLICATIONS,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_CONNECT,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DISCONNECT,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DELETE,
    ],
    EDITOR: [
        PERMISSIONS.STUDIO_BRAND_VIEW,
        PERMISSIONS.STUDIO_BRAND_CREATE,
        PERMISSIONS.STUDIO_BRAND_UPDATE,
        PERMISSIONS.STUDIO_BRAND_MANAGE_SOCIAL_ACCOUNTS,
        PERMISSIONS.STUDIO_BRAND_MANAGE_PUBLISHING_DEFAULTS,
        PERMISSIONS.STUDIO_CONTENT_VIEW,
        PERMISSIONS.STUDIO_CONTENT_CREATE,
        PERMISSIONS.STUDIO_CONTENT_UPDATE,
        PERMISSIONS.STUDIO_CONTENT_DELETE,
        PERMISSIONS.STUDIO_CONTENT_PUBLISH,
        PERMISSIONS.STUDIO_CONTENT_MANAGE_PUBLICATIONS,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_CONNECT,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DISCONNECT,
    ],
    VIEWER: [
        PERMISSIONS.STUDIO_BRAND_VIEW,
        PERMISSIONS.STUDIO_CONTENT_VIEW,
        PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
    ],
};

async function main() {
    const workspaceId = 'cmimpb1x7000058hf46tq85bn';

    // Check if workspace exists
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
    });

    if (!workspace) {
        console.error(`❌ Workspace with ID ${workspaceId} not found`);
        process.exit(1);
    }

    console.log(`✅ Found workspace: ${workspace.name}`);

    // 1. Create all permissions (these should be global, workspaceId = null)
    const permissionKeys = getAllPermissionKeys();
    const permissions = [];

    for (const key of permissionKeys) {
        const permission = await prisma.permission.upsert({
            where: { key },
            update: {},
            create: {
                key,
                description: `Permission: ${key}`,
            },
        });
        permissions.push(permission);
    }
    console.log(`✅ Created/updated ${permissions.length} permissions`);

    // 2. Create roles for this workspace
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
            builtIn: true,
            order: 1,
        },
    });
    console.log('✅ Role: workspace-owner');

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
            description: 'Full access to all workspace features',
            builtIn: true,
            order: 2,
        },
    });
    console.log('✅ Role: workspace-admin');

    const editorRole = await prisma.role.upsert({
        where: {
            workspaceId_key: {
                workspaceId: workspace.id,
                key: 'workspace-editor',
            },
        },
        update: {},
        create: {
            workspaceId: workspace.id,
            key: 'workspace-editor',
            name: 'Editor',
            description: 'Can manage brands and content, but cannot delete brands',
            builtIn: true,
            order: 3,
        },
    });
    console.log('✅ Role: workspace-editor');

    const viewerRole = await prisma.role.upsert({
        where: {
            workspaceId_key: {
                workspaceId: workspace.id,
                key: 'workspace-viewer',
            },
        },
        update: {},
        create: {
            workspaceId: workspace.id,
            key: 'workspace-viewer',
            name: 'Viewer',
            description: 'Read-only access to workspace content',
            builtIn: true,
            order: 4,
        },
    });
    console.log('✅ Role: workspace-viewer');

    // 3. Assign permissions to roles based on ROLE_PERMISSION_MATRIX

    // OWNER permissions
    const ownerPermissionKeys = new Set(ROLE_PERMISSION_MATRIX.OWNER);
    const ownerPermissions = permissions.filter((p) => ownerPermissionKeys.has(p.key));

    for (const permission of ownerPermissions) {
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
    console.log(`✅ workspace-owner → ${ownerPermissions.length} permissions`);

    // ADMIN permissions
    const adminPermissionKeys = new Set(ROLE_PERMISSION_MATRIX.ADMIN);
    const adminPermissions = permissions.filter((p) => adminPermissionKeys.has(p.key));

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

    // EDITOR permissions
    const editorPermissionKeys = new Set(ROLE_PERMISSION_MATRIX.EDITOR);
    const editorPermissions = permissions.filter((p) => editorPermissionKeys.has(p.key));

    for (const permission of editorPermissions) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: editorRole.id,
                    permissionId: permission.id,
                },
            },
            update: {},
            create: {
                roleId: editorRole.id,
                permissionId: permission.id,
            },
        });
    }
    console.log(`✅ workspace-editor → ${editorPermissions.length} permissions`);

    // VIEWER permissions
    const viewerPermissionKeys = new Set(ROLE_PERMISSION_MATRIX.VIEWER);
    const viewerPermissions = permissions.filter((p) => viewerPermissionKeys.has(p.key));

    for (const permission of viewerPermissions) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: viewerRole.id,
                    permissionId: permission.id,
                },
            },
            update: {},
            create: {
                roleId: viewerRole.id,
                permissionId: permission.id,
            },
        });
    }
    console.log(`✅ workspace-viewer → ${viewerPermissions.length} permissions`);

    console.log('\n🎉 Roles and permissions setup completed!');
    console.log('─────────────────────────────────────────');
    console.log(`Workspace: ${workspace.name}`);
    console.log(`Total Permissions: ${permissions.length}`);
    console.log(`Roles Created: 4 (Owner, Admin, Editor, Viewer)`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
