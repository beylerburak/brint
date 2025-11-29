/**
 * Workspace Invite Routes Tests
 * 
 * Tests for:
 * - Cross-tenant access protection in workspace invite endpoints
 * - Pagination behavior in workspace invite endpoints
 * 
 * Run with: cd apps/api && pnpm exec tsx src/modules/workspace/workspace-invite.routes.spec.ts
 */

import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';
import { createServer } from '../../core/http/server.js';
import { ensureDefaultWorkspaceRoles } from './workspace-role.service.js';
import type { FastifyInstance } from 'fastify';

async function main() {
  console.log('🧪 Starting workspace invite routes cross-tenant access tests...\n');

  let testUserAId: string | null = null;
  let testUserBId: string | null = null;
  let workspaceAId: string | null = null;
  let workspaceBId: string | null = null;
  let memberAWorkspaceAId: string | null = null;
  let inviteAWorkspaceAId: string | null = null;
  let app: FastifyInstance | null = null;

  try {
    // 1. Create test users
    console.log('📋 Creating test users...');
    const userA = await prisma.user.create({
      data: {
        email: `test-user-a-${Date.now()}@example.com`,
        name: 'Test User A',
        emailVerified: new Date(),
      },
    });
    testUserAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `test-user-b-${Date.now()}@example.com`,
        name: 'Test User B',
        emailVerified: new Date(),
      },
    });
    testUserBId = userB.id;

    console.log(`   ✅ Created User A: ${userA.email} (${userA.id})`);
    console.log(`   ✅ Created User B: ${userB.email} (${userB.id})\n`);

    // 2. Create workspaces
    console.log('📋 Creating test workspaces...');
    const workspaceA = await prisma.workspace.create({
      data: {
        name: 'Workspace A',
        slug: `workspace-a-${Date.now()}`,
      },
    });
    workspaceAId = workspaceA.id;
    
    // Ensure default roles exist for workspace A
    await ensureDefaultWorkspaceRoles(prisma, workspaceA.id);

    const workspaceB = await prisma.workspace.create({
      data: {
        name: 'Workspace B',
        slug: `workspace-b-${Date.now()}`,
      },
    });
    workspaceBId = workspaceB.id;
    
    // Ensure default roles exist for workspace B
    await ensureDefaultWorkspaceRoles(prisma, workspaceB.id);

    console.log(`   ✅ Created Workspace A: ${workspaceA.slug} (${workspaceA.id})`);
    console.log(`   ✅ Created Workspace B: ${workspaceB.slug} (${workspaceB.id})\n`);

    // 3. Create workspace memberships
    console.log('📋 Creating workspace memberships...');
    const memberAWorkspaceA = await prisma.workspaceMember.create({
      data: {
        userId: userA.id,
        workspaceId: workspaceA.id,
        role: 'OWNER',
        status: 'active',
      },
    });
    memberAWorkspaceAId = memberAWorkspaceA.id;

    console.log(`   ✅ User A is OWNER of Workspace A`);
    console.log(`   ✅ User A is NOT a member of Workspace B`);
    console.log(`   ✅ User B is NOT a member of any workspace\n`);

    // 4. Create Fastify server
    console.log('📋 Creating Fastify server...');
    app = await createServer();
    console.log('   ✅ Server created\n');

    // 5. Generate access tokens
    console.log('📋 Generating access tokens...');
    const userAToken = tokenService.signAccessToken({
      sub: userA.id,
    });
    console.log('   ✅ User A token generated\n');

    // 6. Create an invite in Workspace A for testing
    console.log('📋 Creating test invite in Workspace A...');
    const inviteA = await prisma.workspaceInvite.create({
      data: {
        email: 'invitee@example.com',
        workspaceId: workspaceA.id,
        invitedBy: userA.id,
        token: 'test-token-workspace-a',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'PENDING',
      },
    });
    inviteAWorkspaceAId = inviteA.id;
    console.log(`   ✅ Created invite in Workspace A: ${inviteA.id}\n`);

    // Test 1: User A accessing their own workspace invites (should succeed)
    console.log('📋 Test 1: User A accessing Workspace A invites (should succeed)');
    const response1 = await app.inject({
      method: 'GET',
      url: `/workspaces/${workspaceA.id}/invites`,
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'X-Workspace-Id': workspaceA.id,
      },
    });

    if (response1.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${response1.statusCode}. Body: ${response1.body}`
      );
    }

    const body1 = JSON.parse(response1.body);
    if (!body1.success) {
      throw new Error(`Expected success: true, got ${JSON.stringify(body1)}`);
    }

    if (!body1.data || typeof body1.data !== 'object') {
      throw new Error(`Expected data to be an object, got ${typeof body1.data}`);
    }

    if (!Array.isArray(body1.data.items)) {
      throw new Error(`Expected data.items to be an array, got ${typeof body1.data.items}`);
    }

    // Should return at least the invite we created
    const hasInviteA = body1.data.items.some((inv: any) => inv.id === inviteA.id);
    if (!hasInviteA) {
      throw new Error('Expected to find invite in list');
    }

    console.log('   ✅ Status: 200');
    console.log('   ✅ Response structure correct');
    console.log('   ✅ Invite found in list\n');

    // Test 2: User A accessing Workspace B invites (should fail - cross-tenant access)
    console.log('📋 Test 2: User A accessing Workspace B invites (should fail - cross-tenant)');
    const response2 = await app.inject({
      method: 'GET',
      url: `/workspaces/${workspaceB.id}/invites`,
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'X-Workspace-Id': workspaceA.id, // User A's workspace in header
      },
    });

    // Should fail with either 403 Forbidden or 404 Not Found
    // The endpoint uses requirePermission which checks membership,
    // so it should return 403 PERMISSION_DENIED
    if (response2.statusCode !== 403) {
      throw new Error(
        `Expected 403 Forbidden (cross-tenant access), got ${response2.statusCode}. Body: ${response2.body}`
      );
    }

    const body2 = JSON.parse(response2.body);
    if (body2.success !== false) {
      throw new Error(`Expected success: false, got ${JSON.stringify(body2)}`);
    }

    // Should be either PERMISSION_DENIED or WORKSPACE_MISMATCH
    const errorCode = body2.error?.code;
    if (errorCode !== 'PERMISSION_DENIED' && errorCode !== 'WORKSPACE_MISMATCH') {
      throw new Error(
        `Expected error.code to be PERMISSION_DENIED or WORKSPACE_MISMATCH, got ${errorCode}`
      );
    }

    console.log('   ✅ Status: 403 Forbidden');
    console.log(`   ✅ Error code: ${errorCode}`);
    console.log('   ✅ Cross-tenant access blocked\n');

    // Test 3: User A accessing Workspace B with Workspace B in header (should fail - no membership)
    console.log('📋 Test 3: User A accessing Workspace B with Workspace B in header (should fail - no membership)');
    const response3 = await app.inject({
      method: 'GET',
      url: `/workspaces/${workspaceB.id}/invites`,
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'X-Workspace-Id': workspaceB.id, // Workspace B in header
      },
    });

    // Should fail with 403 - User A is not a member of Workspace B
    if (response3.statusCode !== 403) {
      throw new Error(
        `Expected 403 Forbidden, got ${response3.statusCode}. Body: ${response3.body}`
      );
    }

    const body3 = JSON.parse(response3.body);
    if (body3.success !== false) {
      throw new Error(`Expected success: false, got ${JSON.stringify(body3)}`);
    }

    console.log('   ✅ Status: 403 Forbidden');
    console.log(`   ✅ Error code: ${body3.error?.code}`);
    console.log('   ✅ Access denied (User A is not a member of Workspace B)\n');

    // Test 4: User A trying to create invite in Workspace B (should fail)
    console.log('📋 Test 4: User A trying to create invite in Workspace B (should fail)');
    const response4 = await app.inject({
      method: 'POST',
      url: `/workspaces/${workspaceB.id}/invites`,
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'X-Workspace-Id': workspaceA.id, // User A's workspace
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        email: 'new-invitee@example.com',
      }),
    });

    // Should fail with 403
    if (response4.statusCode !== 403) {
      throw new Error(
        `Expected 403 Forbidden, got ${response4.statusCode}. Body: ${response4.body}`
      );
    }

    console.log('   ✅ Status: 403 Forbidden');
    console.log('   ✅ Cross-tenant invite creation blocked\n');

    // Test 5: No authorization header (should fail)
    console.log('📋 Test 5: No authorization header (should fail)');
    const response5 = await app.inject({
      method: 'GET',
      url: `/workspaces/${workspaceA.id}/invites`,
      headers: {
        'X-Workspace-Id': workspaceA.id,
      },
    });

    if (response5.statusCode !== 401 && response5.statusCode !== 403) {
      throw new Error(
        `Expected 401 or 403, got ${response5.statusCode}. Body: ${response5.body}`
      );
    }

    console.log(`   ✅ Status: ${response5.statusCode} (Unauthorized/Forbidden)\n`);

    console.log('🎉 Workspace invite routes cross-tenant access tests: OK\n');

    // ==========================================
    // Pagination Tests
    // ==========================================
    console.log('🧪 Starting workspace invite routes pagination tests...\n');

    // Setup for pagination tests
    let paginationWorkspaceId: string | null = null;
    let paginationOwnerId: string | null = null;
    let paginationInviteIds: string[] = [];

    try {
      // Create pagination test workspace
      console.log('📋 Creating pagination test workspace...');
      const paginationWorkspace = await prisma.workspace.create({
        data: {
          name: 'Pagination Test Workspace',
          slug: `pagination-invites-ws-${Date.now()}`,
        },
      });
      paginationWorkspaceId = paginationWorkspace.id;
      
      // Ensure default roles exist for pagination workspace
      await ensureDefaultWorkspaceRoles(prisma, paginationWorkspace.id);
      
      console.log(`   ✅ Created workspace: ${paginationWorkspace.slug}\n`);

      // Create owner user
      console.log('📋 Creating pagination test owner...');
      const paginationOwner = await prisma.user.create({
        data: {
          email: `pagination-invites-owner-${Date.now()}@example.com`,
          name: 'Pagination Invites Owner',
          emailVerified: new Date(),
        },
      });
      paginationOwnerId = paginationOwner.id;
      console.log(`   ✅ Created owner: ${paginationOwner.email}\n`);

      // Create owner membership
      await prisma.workspaceMember.create({
        data: {
          userId: paginationOwner.id,
          workspaceId: paginationWorkspace.id,
          role: 'OWNER',
          status: 'active',
        },
      });
      console.log('   ✅ Owner added to workspace\n');

      // Create 5-6 test invites for pagination
      console.log('📋 Creating test invites for pagination...');
      for (let i = 1; i <= 6; i++) {
        const invite = await prisma.workspaceInvite.create({
          data: {
            email: `pagination-invitee-${i}-${Date.now()}@example.com`,
            workspaceId: paginationWorkspace.id,
            invitedBy: paginationOwner.id,
            token: `pagination-token-${i}-${Date.now()}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            status: 'PENDING',
            createdAt: new Date(Date.now() - i * 1000), // Stagger createdAt for deterministic ordering
          },
        });
        paginationInviteIds.push(invite.id);
      }
      console.log(`   ✅ Created ${paginationInviteIds.length} test invites\n`);

      // Generate access token for owner
      const paginationOwnerToken = tokenService.signAccessToken({
        sub: paginationOwner.id,
      });

      // Test 1: Default limit
      console.log('📋 Pagination Test 1: Default limit when no limit is provided');
      const defaultLimitRes = await app.inject({
        method: 'GET',
        url: `/workspaces/${paginationWorkspace.id}/invites`,
        headers: {
          Authorization: `Bearer ${paginationOwnerToken}`,
          'X-Workspace-Id': paginationWorkspace.id,
        },
      });

      if (defaultLimitRes.statusCode !== 200) {
        throw new Error(
          `Expected 200, got ${defaultLimitRes.statusCode}. Body: ${defaultLimitRes.body}`
        );
      }

      const defaultLimitBody = defaultLimitRes.json();
      if (!defaultLimitBody.success) {
        throw new Error(`Expected success: true, got ${JSON.stringify(defaultLimitBody)}`);
      }

      if (!defaultLimitBody.data || typeof defaultLimitBody.data !== 'object') {
        throw new Error(`Expected data to be an object, got ${typeof defaultLimitBody.data}`);
      }

      if (!Array.isArray(defaultLimitBody.data.items)) {
        throw new Error(`Expected data.items to be an array, got ${typeof defaultLimitBody.data.items}`);
      }

      // Default limit is 50, should have <= 50 items
      if (defaultLimitBody.data.items.length > 50) {
        throw new Error(
          `Expected items.length <= 50 (default limit), got ${defaultLimitBody.data.items.length}`
        );
      }

      if (!Object.prototype.hasOwnProperty.call(defaultLimitBody.data, 'nextCursor')) {
        throw new Error('Expected data.nextCursor to exist');
      }

      console.log('   ✅ Status: 200');
      console.log(`   ✅ Items length: ${defaultLimitBody.data.items.length} (should be <= 50)`);
      console.log(`   ✅ nextCursor field exists: ${defaultLimitBody.data.nextCursor !== undefined}\n`);

      // Test 2: Limit clamp (Fastify schema validation rejects values > 100, which is expected)
      console.log('📋 Pagination Test 2: Limit clamp - schema validation rejects values > 100');
      const clampRes = await app.inject({
        method: 'GET',
        url: `/workspaces/${paginationWorkspace.id}/invites?limit=9999`,
        headers: {
          Authorization: `Bearer ${paginationOwnerToken}`,
          'X-Workspace-Id': paginationWorkspace.id,
        },
      });

      // Schema validation should reject limit > 100 before it reaches our handler
      if (clampRes.statusCode !== 400) {
        throw new Error(
          `Expected 400 (validation error), got ${clampRes.statusCode}. Body: ${clampRes.body}`
        );
      }

      const clampBody = clampRes.json();
      if (!clampBody.error || !clampBody.error.code || clampBody.error.code !== 'FST_ERR_VALIDATION') {
        throw new Error(
          `Expected validation error, got ${JSON.stringify(clampBody)}`
        );
      }

      console.log('   ✅ Status: 400 (validation error)');
      console.log('   ✅ Limit > 100 correctly rejected by schema validation\n');

      // Test 3: Two-page pagination
      console.log('📋 Pagination Test 3: Two-page cursor pagination');
      
      // First page
      const firstPageRes = await app.inject({
        method: 'GET',
        url: `/workspaces/${paginationWorkspace.id}/invites?limit=2`,
        headers: {
          Authorization: `Bearer ${paginationOwnerToken}`,
          'X-Workspace-Id': paginationWorkspace.id,
        },
      });

      if (firstPageRes.statusCode !== 200) {
        throw new Error(
          `Expected 200, got ${firstPageRes.statusCode}. Body: ${firstPageRes.body}`
        );
      }

      const firstPageBody = firstPageRes.json();
      if (firstPageBody.data.items.length > 2) {
        throw new Error(
          `Expected items.length <= 2, got ${firstPageBody.data.items.length}`
        );
      }

      // Should have nextCursor since we have 6 invites
      if (firstPageBody.data.nextCursor === null) {
        throw new Error(
          'Expected nextCursor to be non-null (we have 6 invites)'
        );
      }

      const nextCursor = firstPageBody.data.nextCursor as string;
      console.log('   ✅ First page: Status 200');
      console.log(`   ✅ First page items: ${firstPageBody.data.items.length}`);
      console.log(`   ✅ First page nextCursor: ${nextCursor}`);

      // Second page
      const secondPageRes = await app.inject({
        method: 'GET',
        url: `/workspaces/${paginationWorkspace.id}/invites?limit=2&cursor=${nextCursor}`,
        headers: {
          Authorization: `Bearer ${paginationOwnerToken}`,
          'X-Workspace-Id': paginationWorkspace.id,
        },
      });

      if (secondPageRes.statusCode !== 200) {
        throw new Error(
          `Expected 200, got ${secondPageRes.statusCode}. Body: ${secondPageRes.body}`
        );
      }

      const secondPageBody = secondPageRes.json();
      if (secondPageBody.data.items.length > 2) {
        throw new Error(
          `Expected items.length <= 2, got ${secondPageBody.data.items.length}`
        );
      }

      // Verify items are different from first page
      const firstPageIds = firstPageBody.data.items.map((inv: any) => inv.id).sort();
      const secondPageIds = secondPageBody.data.items.map((inv: any) => inv.id).sort();
      const hasOverlap = firstPageIds.some((id: string) => secondPageIds.includes(id));
      if (hasOverlap) {
        throw new Error('Second page should not contain items from first page');
      }

      console.log('   ✅ Second page: Status 200');
      console.log(`   ✅ Second page items: ${secondPageBody.data.items.length}`);
      console.log(`   ✅ Second page nextCursor: ${secondPageBody.data.nextCursor}`);
      console.log('   ✅ No overlap between pages\n');

      // Cleanup pagination test data
      console.log('📋 Cleaning up pagination test data...');
      
      // Delete invites first
      for (const inviteId of paginationInviteIds) {
        await prisma.workspaceInvite.delete({
          where: { id: inviteId },
        }).catch(() => {});
      }

      // Delete workspace members first (to avoid foreign key constraint)
      if (paginationWorkspaceId) {
        await prisma.workspaceMember.deleteMany({
          where: { workspaceId: paginationWorkspaceId },
        }).catch(() => {});
      }

      // Delete workspace
      if (paginationWorkspaceId) {
        await prisma.workspace.delete({
          where: { id: paginationWorkspaceId },
        }).catch(() => {});
      }

      // Delete owner user
      if (paginationOwnerId) {
        await prisma.user.delete({
          where: { id: paginationOwnerId },
        }).catch(() => {});
      }

      console.log('🎉 Workspace invite routes pagination tests: OK');
    } catch (paginationError) {
      console.error('❌ Pagination test failed:', paginationError);
      
      // Cleanup on error
      try {
        if (paginationInviteIds.length > 0) {
          for (const inviteId of paginationInviteIds) {
            await prisma.workspaceInvite.delete({ where: { id: inviteId } }).catch(() => {});
          }
        }
        if (paginationWorkspaceId) {
          await prisma.workspaceMember.deleteMany({
            where: { workspaceId: paginationWorkspaceId },
          }).catch(() => {});
          await prisma.workspace.delete({ where: { id: paginationWorkspaceId } }).catch(() => {});
        }
        if (paginationOwnerId) {
          await prisma.user.delete({ where: { id: paginationOwnerId } }).catch(() => {});
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup pagination test data:', cleanupError);
      }
      
      throw paginationError;
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    if (app) {
      await app.close();
    }

    // Delete invites
    if (inviteAWorkspaceAId) {
      await prisma.workspaceInvite.delete({
        where: { id: inviteAWorkspaceAId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    // Delete workspace members
    if (memberAWorkspaceAId) {
      await prisma.workspaceMember.delete({
        where: { id: memberAWorkspaceAId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    // Delete workspaces (will cascade delete members and invites)
    if (workspaceAId) {
      await prisma.workspace.delete({
        where: { id: workspaceAId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    if (workspaceBId) {
      await prisma.workspace.delete({
        where: { id: workspaceBId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    // Delete users
    if (testUserAId) {
      await prisma.user.delete({
        where: { id: testUserAId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    if (testUserBId) {
      await prisma.user.delete({
        where: { id: testUserBId },
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

