/**
 * Permission Service Tests
 * 
 * Smoke tests for permission service using seed data.
 * Run with: cd apps/api && pnpm exec tsx src/core/auth/permission.service.spec.ts
 */

import { prisma } from '../../lib/prisma.js';
import { permissionService } from './permission.service.js';
import {
  PERMISSIONS,
  getAllPermissionKeys,
} from './permissions.registry.js';

async function main() {
  console.log('🧪 Starting TS-20 permission service tests...\n');

  let testUserId: string | null = null;
  let testWorkspaceMemberId: string | null = null;

  try {
    // Find seed data
    const ownerUser = await prisma.user.findUnique({
      where: { email: 'owner@example.com' },
    });

    if (!ownerUser) {
      throw new Error('Seed user (owner@example.com) not found. Run seed first.');
    }

    const demoWorkspace = await prisma.workspace.findUnique({
      where: { slug: 'demo-workspace' },
    });

    if (!demoWorkspace) {
      throw new Error('Seed workspace (demo-workspace) not found. Run seed first.');
    }

    console.log('✅ Found seed data:');
    console.log(`   User: ${ownerUser.email} (${ownerUser.id})`);
    console.log(`   Workspace: ${demoWorkspace.slug} (${demoWorkspace.id})\n`);

    // Test 1: Owner user → full permission list
    console.log('📋 Test 1: Owner user → full permission list');
    const ownerPermissions = await permissionService.getEffectivePermissionsForUserWorkspace({
      userId: ownerUser.id,
      workspaceId: demoWorkspace.id,
    });

    const allRegistryPermissions = getAllPermissionKeys();
    const expectedPermissions = new Set(allRegistryPermissions);
    const actualPermissions = new Set(ownerPermissions.permissions);

    // Check that all registry permissions are present
    const missingPermissions = allRegistryPermissions.filter(
      (p) => !actualPermissions.has(p)
    );

    if (missingPermissions.length > 0) {
      throw new Error(
        `Owner should have all permissions, but missing: ${missingPermissions.join(', ')}`
      );
    }

    if (ownerPermissions.permissions.length !== allRegistryPermissions.length) {
      throw new Error(
        `Expected ${allRegistryPermissions.length} permissions, got ${ownerPermissions.permissions.length}`
      );
    }

    console.log(`   ✅ Owner has ${ownerPermissions.permissions.length} permissions`);
    console.log(`   ✅ All registry permissions present\n`);

    // Test 2: Unknown user → empty list
    console.log('📋 Test 2: Unknown user → empty list');
    const fakeUserId = 'fake-user-id-that-does-not-exist';
    const fakeUserPermissions = await permissionService.getEffectivePermissionsForUserWorkspace({
      userId: fakeUserId,
      workspaceId: demoWorkspace.id,
    });

    if (fakeUserPermissions.permissions.length !== 0) {
      throw new Error(
        `Unknown user should have 0 permissions, got ${fakeUserPermissions.permissions.length}`
      );
    }

    console.log('   ✅ Unknown user has 0 permissions\n');

    // Test 3: Create workspace-admin member and test
    console.log('📋 Test 3: Workspace-admin member → limited permissions');
    
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'workspace-admin@example.com',
        name: 'Test Workspace Admin',
      },
    });
    testUserId = testUser.id;

    // Create WorkspaceMember with admin role
    const testMember = await prisma.workspaceMember.create({
      data: {
        userId: testUser.id,
        workspaceId: demoWorkspace.id,
        role: 'ADMIN',
      },
    });
    testWorkspaceMemberId = testMember.id;

    console.log(`   ✅ Created test user: ${testUser.email}`);
    console.log(`   ✅ Created workspace member with role: ADMIN\n`);

    // Get permissions for admin
    const adminPermissions = await permissionService.getEffectivePermissionsForUserWorkspace({
      userId: testUser.id,
      workspaceId: demoWorkspace.id,
    });

    // Expected permissions for admin (from seed)
    const expectedAdminPermissions = new Set([
      PERMISSIONS.STUDIO_BRAND_VIEW,
      PERMISSIONS.STUDIO_CONTENT_CREATE,
      PERMISSIONS.STUDIO_CONTENT_PUBLISH,
    ]);

    const actualAdminPermissions = new Set(adminPermissions.permissions);

    // Check that all expected permissions are present
    for (const expectedPerm of expectedAdminPermissions) {
      if (!actualAdminPermissions.has(expectedPerm)) {
        throw new Error(
          `Workspace admin should have ${expectedPerm}, but it's missing`
        );
      }
    }

    // Check that admin has fewer permissions than owner
    if (adminPermissions.permissions.length >= ownerPermissions.permissions.length) {
      throw new Error(
        `Workspace admin should have fewer permissions than owner, but has ${adminPermissions.permissions.length} (owner has ${ownerPermissions.permissions.length})`
      );
    }

    // Check that admin does NOT have workspace permissions
    if (actualAdminPermissions.has(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)) {
      throw new Error(
        'Workspace admin should NOT have workspace:settings.view permission'
      );
    }

    if (actualAdminPermissions.has(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE)) {
      throw new Error(
        'Workspace admin should NOT have workspace:members.manage permission'
      );
    }

    console.log(`   ✅ Workspace admin has ${adminPermissions.permissions.length} permissions`);
    console.log(`   ✅ All expected permissions present`);
    console.log(`   ✅ Has fewer permissions than owner\n`);

    // Test 4: hasPermission helper
    console.log('📋 Test 4: hasPermission helper');
    
    // Owner should have workspace:settings.view
    const ownerHasSettingsView = await permissionService.hasPermission({
      userId: ownerUser.id,
      workspaceId: demoWorkspace.id,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_VIEW,
    });

    if (!ownerHasSettingsView) {
      throw new Error('Owner should have workspace:settings.view permission');
    }

    console.log('   ✅ Owner has workspace:settings.view');

    // Fake user should NOT have workspace:settings.view
    const fakeUserHasSettingsView = await permissionService.hasPermission({
      userId: fakeUserId,
      workspaceId: demoWorkspace.id,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_VIEW,
    });

    if (fakeUserHasSettingsView) {
      throw new Error('Fake user should NOT have workspace:settings.view permission');
    }

    console.log('   ✅ Fake user does NOT have workspace:settings.view');

    // Content manager should have studio:brand.view
    const contentManagerHasBrandView = await permissionService.hasPermission({
      userId: testUser.id,
      workspaceId: demoWorkspace.id,
      permission: PERMISSIONS.STUDIO_BRAND_VIEW,
    });

    if (!contentManagerHasBrandView) {
      throw new Error('Content manager should have studio:brand.view permission');
    }

    console.log('   ✅ Content manager has studio:brand.view');

    // Content manager should NOT have workspace:settings.view
    const contentManagerHasSettingsView = await permissionService.hasPermission({
      userId: testUser.id,
      workspaceId: demoWorkspace.id,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_VIEW,
    });

    if (contentManagerHasSettingsView) {
      throw new Error('Content manager should NOT have workspace:settings.view permission');
    }

    console.log('   ✅ Content manager does NOT have workspace:settings.view\n');

    console.log('🎉 TS-20 permission service tests: OK');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup: delete test user and workspace member
    if (testWorkspaceMemberId) {
      await prisma.workspaceMember.delete({
        where: { id: testWorkspaceMemberId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
