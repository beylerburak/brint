/**
 * requirePermission Middleware Tests
 * 
 * Integration tests for requirePermission middleware using seed data.
 * Run with: cd apps/api && pnpm exec tsx src/core/auth/require-permission.spec.ts
 */

import { prisma } from '../../lib/prisma.js';
import { tokenService } from './token.service.js';
import { permissionService } from './permission.service.js';
import { PERMISSIONS } from './permissions.registry.js';
import { createServer } from '../http/server.js';
import type { FastifyInstance } from 'fastify';

async function main() {
  console.log('🧪 Starting TS-21 requirePermission tests...\n');

  let testUserId: string | null = null;
  let testWorkspaceMemberId: string | null = null;
  let app: FastifyInstance | null = null;

  try {
    // 1. Find seed data
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

    // 2. Verify owner has workspace:settings.view permission (sanity check)
    console.log('📋 Sanity check: Owner has workspace:settings.view permission');
    const ownerHasPermission = await permissionService.hasPermission({
      userId: ownerUser.id,
      workspaceId: demoWorkspace.id,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_VIEW,
    });

    if (!ownerHasPermission) {
      throw new Error('Owner should have workspace:settings.view permission');
    }

    console.log('   ✅ Owner has workspace:settings.view permission\n');

    // 3. Create Fastify server
    console.log('📋 Creating Fastify server...');
    app = await createServer();
    console.log('   ✅ Server created\n');

    // 4. Generate access token for owner
    console.log('📋 Generating access token for owner...');
    const ownerToken = tokenService.signAccessToken({
      sub: ownerUser.id,
      wid: demoWorkspace.id,
    });
    console.log('   ✅ Owner token generated\n');

    // 5. Test allowed case: Owner accessing /debug/protected
    console.log('📋 Test 1: Allowed case - Owner accessing /debug/protected');
    const allowedResponse = await app.inject({
      method: 'GET',
      url: '/debug/protected',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'X-Workspace-Id': demoWorkspace.id,
      },
    });

    if (allowedResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${allowedResponse.statusCode}. Body: ${allowedResponse.body}`
      );
    }

    const allowedBody = JSON.parse(allowedResponse.body);
    if (!allowedBody.success) {
      throw new Error(`Expected success: true, got ${JSON.stringify(allowedBody)}`);
    }

    if (allowedBody.message !== 'You have workspace:settings.view') {
      throw new Error(
        `Expected message "You have workspace:settings.view", got "${allowedBody.message}"`
      );
    }

    console.log('   ✅ Status: 200');
    console.log('   ✅ Body: success: true');
    console.log('   ✅ Message correct\n');

    // 6. Create workspace-admin user for forbidden test
    console.log('📋 Test 2: Forbidden case - Workspace admin accessing /debug/protected');
    
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test-workspace-admin@example.com',
        name: 'Test Workspace Admin',
      },
    });
    testUserId = testUser.id;

    // Create WorkspaceMember with ADMIN role
    const testMember = await prisma.workspaceMember.create({
      data: {
        userId: testUser.id,
        workspaceId: demoWorkspace.id,
        role: 'ADMIN',
      },
    });
    testWorkspaceMemberId = testMember.id;

    console.log(`   ✅ Created test user: ${testUser.email}`);
    console.log(`   ✅ Created workspace member with role: ADMIN`);

    // Verify admin does NOT have workspace:settings.view
    const adminHasPermission = await permissionService.hasPermission({
      userId: testUser.id,
      workspaceId: demoWorkspace.id,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_VIEW,
    });

    if (adminHasPermission) {
      throw new Error(
        'Workspace admin should NOT have workspace:settings.view permission'
      );
    }

    console.log('   ✅ Verified: Workspace admin does NOT have workspace:settings.view\n');

    // 7. Generate access token for workspace-admin
    console.log('📋 Generating access token for workspace-admin...');
    const adminToken = tokenService.signAccessToken({
      sub: testUser.id,
      wid: demoWorkspace.id,
    });
    console.log('   ✅ Workspace admin token generated\n');

    // 8. Test forbidden case: Workspace admin accessing /debug/protected
    console.log('📋 Test 2 (continued): Forbidden case - Workspace admin accessing /debug/protected');
    const forbiddenResponse = await app.inject({
      method: 'GET',
      url: '/debug/protected',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Workspace-Id': demoWorkspace.id,
      },
    });

    if (forbiddenResponse.statusCode !== 403) {
      throw new Error(
        `Expected 403, got ${forbiddenResponse.statusCode}. Body: ${forbiddenResponse.body}`
      );
    }

    const forbiddenBody = JSON.parse(forbiddenResponse.body);
    if (forbiddenBody.success !== false) {
      throw new Error(
        `Expected success: false, got ${JSON.stringify(forbiddenBody)}`
      );
    }

    if (forbiddenBody.error?.code !== 'PERMISSION_DENIED') {
      throw new Error(
        `Expected error.code: "PERMISSION_DENIED", got "${forbiddenBody.error?.code}"`
      );
    }

    if (
      !forbiddenBody.error?.message ||
      !forbiddenBody.error.message.includes('permission')
    ) {
      throw new Error(
        `Expected error message about permission, got "${forbiddenBody.error?.message}"`
      );
    }

    console.log('   ✅ Status: 403');
    console.log('   ✅ Body: success: false');
    console.log('   ✅ Error code: FORBIDDEN');
    console.log('   ✅ Error message correct\n');

    // 9. Test unauthorized case: No auth header
    console.log('📋 Test 3: Unauthorized case - No auth header');
    const unauthorizedResponse = await app.inject({
      method: 'GET',
      url: '/debug/protected',
      headers: {
        'X-Workspace-Id': demoWorkspace.id,
      },
    });

    if (unauthorizedResponse.statusCode !== 401) {
      throw new Error(
        `Expected 401, got ${unauthorizedResponse.statusCode}. Body: ${unauthorizedResponse.body}`
      );
    }

    const unauthorizedBody = JSON.parse(unauthorizedResponse.body);
    if (unauthorizedBody.success !== false) {
      throw new Error(
        `Expected success: false, got ${JSON.stringify(unauthorizedBody)}`
      );
    }

    if (unauthorizedBody.error?.code !== 'AUTH_REQUIRED') {
      throw new Error(
        `Expected error.code: "AUTH_REQUIRED", got "${unauthorizedBody.error?.code}"`
      );
    }

    console.log('   ✅ Status: 401');
    console.log('   ✅ Body: success: false');
    console.log('   ✅ Error code: AUTH_REQUIRED\n');

    // 10. Test unauthorized case: No workspace header
    console.log('📋 Test 4: Unauthorized case - No workspace header');
    const noWorkspaceResponse = await app.inject({
      method: 'GET',
      url: '/debug/protected',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    if (noWorkspaceResponse.statusCode !== 401) {
      throw new Error(
        `Expected 401, got ${noWorkspaceResponse.statusCode}. Body: ${noWorkspaceResponse.body}`
      );
    }

    const noWorkspaceBody = JSON.parse(noWorkspaceResponse.body);
    if (noWorkspaceBody.success !== false) {
      throw new Error(
        `Expected success: false, got ${JSON.stringify(noWorkspaceBody)}`
      );
    }

    if (noWorkspaceBody.error?.code !== 'AUTH_REQUIRED') {
      throw new Error(
        `Expected error.code: "AUTH_REQUIRED", got "${noWorkspaceBody.error?.code}"`
      );
    }

    console.log('   ✅ Status: 401');
    console.log('   ✅ Body: success: false');
    console.log('   ✅ Error code: AUTH_REQUIRED\n');

    console.log('🎉 TS-21 requirePermission tests: OK');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup: close server
    if (app) {
      await app.close();
    }

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
