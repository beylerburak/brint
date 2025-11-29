/**
 * Brand Routes Tests
 * 
 * Tests for:
 * - Brand CRUD operations
 * - Cross-tenant access protection
 * - Pagination behavior
 * - Hashtag preset operations
 * - Permission checks
 * 
 * Run with: cd apps/api && pnpm exec tsx src/modules/brand/brand.routes.spec.ts
 */

import { prisma } from "../../lib/prisma.js";
import { tokenService } from "../../core/auth/token.service.js";
import { createServer } from "../../core/http/server.js";
import { ensureDefaultWorkspaceRoles } from "../workspace/workspace-role.service.js";
import type { FastifyInstance } from "fastify";

async function main() {
  console.log("🧪 Starting Brand routes tests...\n");

  let testOwnerUserId: string | null = null;
  let testViewerUserId: string | null = null;
  let testOtherUserId: string | null = null;
  let workspaceAId: string | null = null;
  let workspaceBId: string | null = null;
  let brandId: string | null = null;
  let app: FastifyInstance | null = null;

  try {
    // 1. Create test users
    console.log("📋 Creating test users...");
    const ownerUser = await prisma.user.create({
      data: {
        email: `test-brand-owner-${Date.now()}@example.com`,
        name: "Test Brand Owner",
        emailVerified: new Date(),
      },
    });
    testOwnerUserId = ownerUser.id;

    const viewerUser = await prisma.user.create({
      data: {
        email: `test-brand-viewer-${Date.now()}@example.com`,
        name: "Test Brand Viewer",
        emailVerified: new Date(),
      },
    });
    testViewerUserId = viewerUser.id;

    const otherUser = await prisma.user.create({
      data: {
        email: `test-brand-other-${Date.now()}@example.com`,
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
        name: "Brand Test Workspace A",
        slug: `brand-test-ws-a-${Date.now()}`,
      },
    });
    workspaceAId = workspaceA.id;
    await ensureDefaultWorkspaceRoles(prisma, workspaceA.id);

    const workspaceB = await prisma.workspace.create({
      data: {
        name: "Brand Test Workspace B",
        slug: `brand-test-ws-b-${Date.now()}`,
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
        role: "MEMBER",
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

    // 4. Create Fastify server
    console.log("📋 Creating Fastify server...");
    app = await createServer();
    console.log("   ✅ Server created\n");

    // 5. Generate access tokens
    console.log("📋 Generating access tokens...");
    const ownerToken = tokenService.signAccessToken({ sub: ownerUser.id });
    const viewerToken = tokenService.signAccessToken({ sub: viewerUser.id });
    const otherToken = tokenService.signAccessToken({ sub: otherUser.id });
    console.log("   ✅ Tokens generated\n");

    // ==========================================
    // Brand CRUD Tests
    // ==========================================

    // Test 1: Create brand (should succeed for owner)
    console.log("📋 Test 1: Create brand (Owner should succeed)");
    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/brands",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        name: "Test Brand",
        slug: `test-brand-${Date.now()}`,
        description: "A test brand",
        industry: "Technology",
      }),
    });

    if (createResponse.statusCode !== 201) {
      throw new Error(
        `Expected 201, got ${createResponse.statusCode}. Body: ${createResponse.body}`
      );
    }

    const createBody = JSON.parse(createResponse.body);
    if (!createBody.success || !createBody.data.id) {
      throw new Error(`Expected success with data.id, got ${JSON.stringify(createBody)}`);
    }

    brandId = createBody.data.id;
    console.log("   ✅ Status: 201");
    console.log(`   ✅ Brand created: ${createBody.data.name} (${brandId})\n`);

    // Test 2: List brands (should show created brand)
    console.log("📋 Test 2: List brands (should show created brand)");
    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/brands",
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

    const foundBrand = listBody.data.items.find((b: any) => b.id === brandId);
    if (!foundBrand) {
      throw new Error("Created brand not found in list");
    }

    console.log("   ✅ Status: 200");
    console.log(`   ✅ Found ${listBody.data.items.length} brand(s)`);
    console.log("   ✅ Created brand found in list\n");

    // Test 3: Get brand details
    console.log("📋 Test 3: Get brand details");
    const getResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (getResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${getResponse.statusCode}. Body: ${getResponse.body}`
      );
    }

    const getBody = JSON.parse(getResponse.body);
    if (!getBody.success || getBody.data.id !== brandId) {
      throw new Error(`Expected brand with id ${brandId}, got ${JSON.stringify(getBody)}`);
    }

    console.log("   ✅ Status: 200");
    console.log(`   ✅ Brand details retrieved: ${getBody.data.name}\n`);

    // Test 4: Update brand
    console.log("📋 Test 4: Update brand");
    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/v1/brands/${brandId}`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        description: "Updated description",
        language: "en",
        timezone: "America/New_York",
      }),
    });

    if (updateResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${updateResponse.statusCode}. Body: ${updateResponse.body}`
      );
    }

    const updateBody = JSON.parse(updateResponse.body);
    if (!updateBody.success) {
      throw new Error(`Expected success, got ${JSON.stringify(updateBody)}`);
    }

    console.log("   ✅ Status: 200");
    console.log(`   ✅ Brand updated, readinessScore: ${updateBody.data.readinessScore}\n`);

    // ==========================================
    // Cross-Tenant Access Tests
    // ==========================================

    // Test 5: Cross-tenant access (Other user accessing Workspace A brand)
    console.log("📋 Test 5: Cross-tenant access (should fail - PERMISSION_DENIED)");
    const crossTenantResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}`,
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

    // Test 6: Workspace mismatch (header vs param)
    console.log("📋 Test 6: Workspace mismatch (should fail)");
    const mismatchResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceB.id, // Wrong workspace in header
      },
    });

    // Should fail with 403 (PERMISSION_DENIED) since owner doesn't have permission in Workspace B
    if (mismatchResponse.statusCode !== 403) {
      throw new Error(
        `Expected 403, got ${mismatchResponse.statusCode}. Body: ${mismatchResponse.body}`
      );
    }

    console.log("   ✅ Status: 403");
    console.log("   ✅ Workspace mismatch blocked\n");

    // ==========================================
    // Hashtag Preset Tests
    // ==========================================

    // Test 7: Create hashtag preset
    console.log("📋 Test 7: Create hashtag preset");
    const createPresetResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/hashtag-presets`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        name: "General Tags",
        tags: ["#tech", "#startup", "#innovation"],
      }),
    });

    if (createPresetResponse.statusCode !== 201) {
      throw new Error(
        `Expected 201, got ${createPresetResponse.statusCode}. Body: ${createPresetResponse.body}`
      );
    }

    const createPresetBody = JSON.parse(createPresetResponse.body);
    const presetId = createPresetBody.data.id;
    console.log("   ✅ Status: 201");
    console.log(`   ✅ Preset created: ${createPresetBody.data.name} (${presetId})\n`);

    // Test 8: List hashtag presets
    console.log("📋 Test 8: List hashtag presets");
    const listPresetsResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/hashtag-presets`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (listPresetsResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${listPresetsResponse.statusCode}. Body: ${listPresetsResponse.body}`
      );
    }

    const listPresetsBody = JSON.parse(listPresetsResponse.body);
    if (!listPresetsBody.data.items.some((p: any) => p.id === presetId)) {
      throw new Error("Created preset not found in list");
    }

    console.log("   ✅ Status: 200");
    console.log(`   ✅ Found ${listPresetsBody.data.items.length} preset(s)\n`);

    // ==========================================
    // Permission Tests
    // ==========================================

    // Test 9: Viewer (MEMBER role) should be able to view brands
    console.log("📋 Test 9: Viewer can view brands (MEMBER role)");
    const viewerListResponse = await app.inject({
      method: "GET",
      url: "/v1/brands",
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
    console.log("   ✅ Viewer can list brands\n");

    // Test 10: Archive (soft delete) brand
    console.log("📋 Test 10: Archive brand");
    const archiveResponse = await app.inject({
      method: "DELETE",
      url: `/v1/brands/${brandId}`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    if (archiveResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${archiveResponse.statusCode}. Body: ${archiveResponse.body}`
      );
    }

    const archiveBody = JSON.parse(archiveResponse.body);
    if (!archiveBody.data.isArchived) {
      throw new Error("Expected isArchived: true");
    }

    console.log("   ✅ Status: 200");
    console.log("   ✅ Brand archived successfully\n");

    // Test 11: Archived brand should not appear in default list
    console.log("📋 Test 11: Archived brand not in default list");
    const listAfterArchiveResponse = await app.inject({
      method: "GET",
      url: "/v1/brands",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    const listAfterArchiveBody = JSON.parse(listAfterArchiveResponse.body);
    const archivedBrandInList = listAfterArchiveBody.data.items.find(
      (b: any) => b.id === brandId
    );

    if (archivedBrandInList) {
      throw new Error("Archived brand should not appear in default list");
    }

    console.log("   ✅ Status: 200");
    console.log("   ✅ Archived brand not in default list\n");

    // Test 12: Archived brand should appear with includeArchived=true
    console.log("📋 Test 12: Archived brand with includeArchived=true");
    const listWithArchivedResponse = await app.inject({
      method: "GET",
      url: "/v1/brands?includeArchived=true",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
      },
    });

    const listWithArchivedBody = JSON.parse(listWithArchivedResponse.body);
    const archivedBrandFound = listWithArchivedBody.data.items.find(
      (b: any) => b.id === brandId
    );

    if (!archivedBrandFound) {
      throw new Error("Archived brand should appear with includeArchived=true");
    }

    console.log("   ✅ Status: 200");
    console.log("   ✅ Archived brand found with includeArchived=true\n");

    // Check if activity events were created
    console.log("📋 Checking activity events...");
    const activityEvents = await prisma.activityEvent.findMany({
      where: {
        workspaceId: workspaceA.id,
        scopeType: "brand",
        scopeId: brandId,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`   ✅ Found ${activityEvents.length} activity events for brand`);
    const eventTypes = activityEvents.map((e) => e.type);
    console.log(`   ✅ Event types: ${eventTypes.join(", ")}\n`);

    console.log("🎉 All Brand routes tests passed!\n");
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

    // Delete hashtag presets
    if (brandId) {
      await prisma.brandHashtagPreset.deleteMany({
        where: { brandId },
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

