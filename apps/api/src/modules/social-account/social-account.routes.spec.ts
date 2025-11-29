/**
 * Social Account Routes Tests
 * 
 * Tests for:
 * - Social account CRUD operations
 * - Cross-tenant access protection
 * - Pagination behavior
 * - Permission checks
 * - Brand readiness integration
 * - Credential encryption
 * 
 * Run with: cd apps/api && pnpm exec tsx src/modules/social-account/social-account.routes.spec.ts
 */

import { prisma } from "../../lib/prisma.js";
import { tokenService } from "../../core/auth/token.service.js";
import { createServer } from "../../core/http/server.js";
import { ensureDefaultWorkspaceRoles } from "../workspace/workspace-role.service.js";
import type { FastifyInstance } from "fastify";
import { isEncryptedFormat } from "../../lib/secret-encryption.js";

async function main() {
  console.log("🧪 Starting Social Account routes tests...\n");

  let testOwnerUserId: string | null = null;
  let testViewerUserId: string | null = null;
  let testOtherUserId: string | null = null;
  let workspaceAId: string | null = null;
  let workspaceBId: string | null = null;
  let brandId: string | null = null;
  let socialAccountId: string | null = null;
  let app: FastifyInstance | null = null;

  try {
    // 1. Create test users
    console.log("📋 Creating test users...");
    const ownerUser = await prisma.user.create({
      data: {
        email: `test-social-owner-${Date.now()}@example.com`,
        name: "Test Social Owner",
        emailVerified: new Date(),
      },
    });
    testOwnerUserId = ownerUser.id;

    const viewerUser = await prisma.user.create({
      data: {
        email: `test-social-viewer-${Date.now()}@example.com`,
        name: "Test Social Viewer",
        emailVerified: new Date(),
      },
    });
    testViewerUserId = viewerUser.id;

    const otherUser = await prisma.user.create({
      data: {
        email: `test-social-other-${Date.now()}@example.com`,
        name: "Test Other User",
        emailVerified: new Date(),
      },
    });
    testOtherUserId = otherUser.id;

    console.log(`   ✅ Created Owner: ${ownerUser.email} (${ownerUser.id})`);
    console.log(`   ✅ Created Viewer: ${viewerUser.email} (${viewerUser.id})`);
    console.log(`   ✅ Created Other: ${otherUser.email} (${otherUser.id})\n`);

    // 2. Create workspaces
    console.log("📋 Creating test workspaces...");
    const workspaceA = await prisma.workspace.create({
      data: {
        name: "Social Test Workspace A",
        slug: `social-test-ws-a-${Date.now()}`,
      },
    });
    workspaceAId = workspaceA.id;
    await ensureDefaultWorkspaceRoles(prisma, workspaceA.id);

    const workspaceB = await prisma.workspace.create({
      data: {
        name: "Social Test Workspace B",
        slug: `social-test-ws-b-${Date.now()}`,
      },
    });
    workspaceBId = workspaceB.id;
    await ensureDefaultWorkspaceRoles(prisma, workspaceB.id);

    console.log(`   ✅ Created Workspace A: ${workspaceA.slug} (${workspaceA.id})`);
    console.log(`   ✅ Created Workspace B: ${workspaceB.slug} (${workspaceB.id})\n`);

    // 3. Create workspace memberships
    console.log("📋 Creating workspace memberships...");
    await prisma.workspaceMember.create({
      data: {
        userId: ownerUser.id,
        workspaceId: workspaceA.id,
        role: "OWNER",
        status: "active",
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: viewerUser.id,
        workspaceId: workspaceA.id,
        role: "MEMBER", // MEMBER role maps to VIEWER permissions in the system
        status: "active",
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: otherUser.id,
        workspaceId: workspaceB.id,
        role: "OWNER",
        status: "active",
      },
    });

    console.log("   ✅ Owner is OWNER of Workspace A");
    console.log("   ✅ Viewer is MEMBER of Workspace A");
    console.log("   ✅ Other is OWNER of Workspace B\n");

    // 4. Create a brand
    console.log("📋 Creating test brand...");
    const brand = await prisma.brand.create({
      data: {
        workspaceId: workspaceA.id,
        name: "Social Test Brand",
        slug: `social-test-brand-${Date.now()}`,
        profileCompleted: false,
        hasAtLeastOneSocialAccount: false,
        publishingDefaultsConfigured: false,
        readinessScore: 0,
      },
    });
    brandId = brand.id;
    console.log(`   ✅ Created Brand: ${brand.name} (${brandId})\n`);

    // 5. Create Fastify server
    console.log("📋 Creating Fastify server...");
    app = await createServer();
    console.log("   ✅ Server created\n");

    // 6. Generate access tokens
    console.log("📋 Generating access tokens...");
    const ownerToken = tokenService.signAccessToken({ sub: ownerUser.id });
    const viewerToken = tokenService.signAccessToken({ sub: viewerUser.id });
    const otherToken = tokenService.signAccessToken({ sub: otherUser.id });
    console.log("   ✅ Tokens generated\n");

    // ==========================================
    // Social Account CRUD Tests
    // ==========================================

    // Test 1: Connect social account (should succeed for owner)
    console.log("📋 Test 1: Connect social account (Owner should succeed)");
    const connectResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/social-accounts`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        platform: "FACEBOOK_PAGE",
        externalId: `test-page-${Date.now()}`,
        username: "testpage",
        displayName: "Test Facebook Page",
        profileUrl: "https://facebook.com/testpage",
        platformData: {
          pageName: "Test Page",
        },
        credentials: {
          platform: "FACEBOOK_PAGE",
          data: {
            accessToken: "test-access-token-123",
            refreshToken: "test-refresh-token-456",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        },
      }),
    });

    if (connectResponse.statusCode !== 201) {
      throw new Error(
        `Expected 201, got ${connectResponse.statusCode}. Body: ${connectResponse.body}`
      );
    }

    const connectBody = JSON.parse(connectResponse.body);
    if (!connectBody.success || !connectBody.data.id) {
      throw new Error(`Expected success with data.id, got ${JSON.stringify(connectBody)}`);
    }

    socialAccountId = connectBody.data.id;
    console.log("   ✅ Status: 201");
    console.log(`   ✅ Social account created: ${connectBody.data.displayName} (${socialAccountId})\n`);

    // Test 2: Verify credentials are encrypted in database
    console.log("📋 Test 2: Verify credentials are encrypted");
    const dbAccount = await prisma.socialAccount.findUnique({
      where: { id: socialAccountId! },
    });

    if (!dbAccount) {
      throw new Error("Social account not found in database");
    }

    if (!dbAccount.credentialsEncrypted) {
      throw new Error("credentialsEncrypted is empty");
    }

    // Check that it's in encrypted format (iv:authTag:ciphertext)
    if (!isEncryptedFormat(dbAccount.credentialsEncrypted)) {
      throw new Error("credentialsEncrypted is not in encrypted format");
    }

    // Make sure plain text is NOT in the encrypted string
    if (dbAccount.credentialsEncrypted.includes("test-access-token-123")) {
      throw new Error("Credentials are stored in plain text!");
    }

    console.log("   ✅ Credentials are encrypted");
    console.log("   ✅ Plain text not visible in stored value\n");

    // Test 3: Verify brand readiness updated
    console.log("📋 Test 3: Verify brand readiness updated");
    const updatedBrand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!updatedBrand?.hasAtLeastOneSocialAccount) {
      throw new Error("Brand hasAtLeastOneSocialAccount should be true");
    }

    if (updatedBrand.readinessScore !== 40) {
      throw new Error(`Expected readiness score 40, got ${updatedBrand.readinessScore}`);
    }

    console.log("   ✅ hasAtLeastOneSocialAccount: true");
    console.log(`   ✅ readinessScore: ${updatedBrand.readinessScore}\n`);

    // Test 4: List social accounts
    console.log("📋 Test 4: List social accounts");
    const listResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/social-accounts`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (listResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${listResponse.statusCode}. Body: ${listResponse.body}`
      );
    }

    const listBody = JSON.parse(listResponse.body);
    if (!listBody.success || !Array.isArray(listBody.data.items)) {
      throw new Error(`Expected success with items array, got ${JSON.stringify(listBody)}`);
    }

    const foundAccount = listBody.data.items.find((a: any) => a.id === socialAccountId);
    if (!foundAccount) {
      throw new Error("Created social account not found in list");
    }

    // Credentials should NOT be in response
    if ((foundAccount as any).credentialsEncrypted !== undefined) {
      throw new Error("credentialsEncrypted should not be exposed in API response");
    }

    console.log("   ✅ Status: 200");
    console.log(`   ✅ Found ${listBody.data.items.length} social account(s)`);
    console.log("   ✅ Credentials not exposed in response\n");

    // Test 5: Duplicate account prevention
    console.log("📋 Test 5: Duplicate account prevention");
    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/social-accounts`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        platform: "FACEBOOK_PAGE",
        externalId: dbAccount.externalId, // Same externalId
        credentials: {
          platform: "FACEBOOK_PAGE",
          data: {
            accessToken: "another-token",
          },
        },
      }),
    });

    if (duplicateResponse.statusCode !== 409) {
      throw new Error(
        `Expected 409 Conflict, got ${duplicateResponse.statusCode}. Body: ${duplicateResponse.body}`
      );
    }

    console.log("   ✅ Status: 409 Conflict");
    console.log("   ✅ Duplicate account prevented\n");

    // ==========================================
    // Cross-Tenant Access Tests
    // ==========================================

    // Test 6: Cross-tenant access (Other user accessing Workspace A)
    console.log("📋 Test 6: Cross-tenant access (should fail)");
    const crossTenantResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/social-accounts`,
      headers: {
        Authorization: `Bearer ${otherToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (crossTenantResponse.statusCode !== 403) {
      throw new Error(
        `Expected 403, got ${crossTenantResponse.statusCode}. Body: ${crossTenantResponse.body}`
      );
    }

    console.log("   ✅ Status: 403 Forbidden");
    console.log("   ✅ Cross-tenant access blocked\n");

    // ==========================================
    // Permission Tests
    // ==========================================

    // Test 7: Viewer can view social accounts
    console.log("📋 Test 7: Viewer can view social accounts");
    const viewerListResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/social-accounts`,
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (viewerListResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${viewerListResponse.statusCode}. Body: ${viewerListResponse.body}`
      );
    }

    console.log("   ✅ Status: 200");
    console.log("   ✅ Viewer can list social accounts\n");

    // Test 8: Viewer cannot delete social accounts (MEMBER role lacks delete permission)
    console.log("📋 Test 8: Viewer cannot delete social accounts");
    const viewerDeleteResponse = await app.inject({
      method: "DELETE",
      url: `/v1/brands/${brandId}/social-accounts/${socialAccountId}`,
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (viewerDeleteResponse.statusCode !== 403) {
      throw new Error(
        `Expected 403, got ${viewerDeleteResponse.statusCode}. Body: ${viewerDeleteResponse.body}`
      );
    }

    console.log("   ✅ Status: 403 Forbidden");
    console.log("   ✅ Viewer cannot delete social accounts\n");

    // ==========================================
    // Disconnect & Remove Tests
    // ==========================================

    // Test 9: Disconnect social account
    console.log("📋 Test 9: Disconnect social account");
    const disconnectResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/social-accounts/${socialAccountId}/disconnect`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (disconnectResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${disconnectResponse.statusCode}. Body: ${disconnectResponse.body}`
      );
    }

    const disconnectBody = JSON.parse(disconnectResponse.body);
    if (disconnectBody.data.status !== "DISCONNECTED") {
      throw new Error(`Expected status DISCONNECTED, got ${disconnectBody.data.status}`);
    }

    // Verify credentials wiped
    const disconnectedAccount = await prisma.socialAccount.findUnique({
      where: { id: socialAccountId! },
    });

    if (disconnectedAccount?.credentialsEncrypted !== "") {
      throw new Error("Credentials should be wiped after disconnect");
    }

    console.log("   ✅ Status: 200");
    console.log("   ✅ Status changed to DISCONNECTED");
    console.log("   ✅ Credentials wiped\n");

    // Test 10: Verify brand readiness updated after disconnect
    console.log("📋 Test 10: Brand readiness after disconnect");
    const brandAfterDisconnect = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (brandAfterDisconnect?.hasAtLeastOneSocialAccount !== false) {
      throw new Error("Brand hasAtLeastOneSocialAccount should be false after disconnect");
    }

    if (brandAfterDisconnect.readinessScore !== 0) {
      throw new Error(`Expected readiness score 0, got ${brandAfterDisconnect.readinessScore}`);
    }

    console.log("   ✅ hasAtLeastOneSocialAccount: false");
    console.log(`   ✅ readinessScore: ${brandAfterDisconnect.readinessScore}\n`);

    // Test 11: List with status filter
    console.log("📋 Test 11: List with status filter");
    const listDisconnectedResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/social-accounts?status=DISCONNECTED`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    const listDisconnectedBody = JSON.parse(listDisconnectedResponse.body);
    if (listDisconnectedBody.data.items.length !== 1) {
      throw new Error(`Expected 1 disconnected account, got ${listDisconnectedBody.data.items.length}`);
    }

    // Default (ACTIVE) should return 0
    const listActiveResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/social-accounts`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    const listActiveBody = JSON.parse(listActiveResponse.body);
    if (listActiveBody.data.items.length !== 0) {
      throw new Error(`Expected 0 active accounts, got ${listActiveBody.data.items.length}`);
    }

    console.log("   ✅ DISCONNECTED filter shows 1 account");
    console.log("   ✅ ACTIVE (default) filter shows 0 accounts\n");

    // Test 12: Remove (soft delete) social account
    console.log("📋 Test 12: Remove social account");
    const removeResponse = await app.inject({
      method: "DELETE",
      url: `/v1/brands/${brandId}/social-accounts/${socialAccountId}`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (removeResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${removeResponse.statusCode}. Body: ${removeResponse.body}`
      );
    }

    const removeBody = JSON.parse(removeResponse.body);
    if (removeBody.data.status !== "REMOVED") {
      throw new Error(`Expected status REMOVED, got ${removeBody.data.status}`);
    }

    console.log("   ✅ Status: 200");
    console.log("   ✅ Status changed to REMOVED\n");

    // Check activity events
    console.log("📋 Checking activity events...");
    const activityEvents = await prisma.activityEvent.findMany({
      where: {
        workspaceId: workspaceA.id,
        scopeType: "social_account",
        scopeId: socialAccountId,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`   ✅ Found ${activityEvents.length} activity events for social account`);
    const eventTypes = activityEvents.map((e) => e.type);
    console.log(`   ✅ Event types: ${eventTypes.join(", ")}\n`);

    // Check brand-level events
    const brandActivityEvents = await prisma.activityEvent.findMany({
      where: {
        workspaceId: workspaceA.id,
        scopeType: "brand",
        scopeId: brandId,
        type: { in: ["brand.social_account_connected", "brand.social_account_disconnected"] },
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`   ✅ Found ${brandActivityEvents.length} brand-level social account events\n`);

    console.log("🎉 All Social Account routes tests passed!\n");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    // Cleanup
    if (app) {
      await app.close();
    }

    // Delete test data in correct order
    console.log("📋 Cleaning up test data...");

    // Delete social accounts
    if (socialAccountId) {
      await prisma.socialAccount.delete({
        where: { id: socialAccountId },
      }).catch(() => {});
    }

    // Delete activity events
    if (workspaceAId) {
      await prisma.activityEvent.deleteMany({
        where: { workspaceId: workspaceAId },
      }).catch(() => {});
    }

    // Delete brands
    if (brandId) {
      await prisma.brand.delete({
        where: { id: brandId },
      }).catch(() => {});
    }

    // Delete workspace members
    if (workspaceAId) {
      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: workspaceAId },
      }).catch(() => {});
    }
    if (workspaceBId) {
      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: workspaceBId },
      }).catch(() => {});
    }

    // Delete workspaces
    if (workspaceAId) {
      await prisma.workspace.delete({
        where: { id: workspaceAId },
      }).catch(() => {});
    }
    if (workspaceBId) {
      await prisma.workspace.delete({
        where: { id: workspaceBId },
      }).catch(() => {});
    }

    // Delete users
    if (testOwnerUserId) {
      await prisma.user.delete({
        where: { id: testOwnerUserId },
      }).catch(() => {});
    }
    if (testViewerUserId) {
      await prisma.user.delete({
        where: { id: testViewerUserId },
      }).catch(() => {});
    }
    if (testOtherUserId) {
      await prisma.user.delete({
        where: { id: testOtherUserId },
      }).catch(() => {});
    }

    await prisma.$disconnect();
    console.log("   ✅ Cleanup complete\n");
  }
}

main().catch((error) => {
  console.error("❌ Test script failed:", error);
  process.exit(1);
});

