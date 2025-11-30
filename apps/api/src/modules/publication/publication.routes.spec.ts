/**
 * Publication Routes Tests
 * 
 * Tests for:
 * - Instagram publication scheduling
 * - Facebook publication scheduling
 * - Platform mismatch errors
 * - Permission checks
 * - Cross-tenant access protection
 * 
 * Run with: cd apps/api && pnpm exec tsx src/modules/publication/publication.routes.spec.ts
 */

import { prisma } from "../../lib/prisma.js";
import { tokenService } from "../../core/auth/token.service.js";
import { createServer } from "../../core/http/server.js";
import { ensureDefaultWorkspaceRoles } from "../workspace/workspace-role.service.js";
import { encryptSocialCredentials } from "../social-account/social-account.types.js";
import type { FastifyInstance } from "fastify";

// Mock the queue enqueue functions to prevent actual job creation
let enqueuedJobs: { queue: string; data: any; delay: number }[] = [];

// We'll mock the enqueue functions
const mockEnqueueInstagramPublish = async (data: any, delay: number) => {
  enqueuedJobs.push({ queue: "instagram-publish", data, delay });
  return { id: `mock-job-${Date.now()}` };
};

const mockEnqueueFacebookPublish = async (data: any, delay: number) => {
  enqueuedJobs.push({ queue: "facebook-publish", data, delay });
  return { id: `mock-job-${Date.now()}` };
};

async function main() {
  console.log("🧪 Starting Publication routes tests...\n");

  let testOwnerUserId: string | null = null;
  let testOtherUserId: string | null = null;
  let workspaceAId: string | null = null;
  let workspaceBId: string | null = null;
  let brandId: string | null = null;
  let igSocialAccountId: string | null = null;
  let fbSocialAccountId: string | null = null;
  let mediaId: string | null = null;
  let publicationIds: string[] = [];
  let app: FastifyInstance | null = null;

  try {
    // 1. Create test users
    console.log("📋 Creating test users...");
    const ownerUser = await prisma.user.create({
      data: {
        email: `test-pub-owner-${Date.now()}@example.com`,
        name: "Test Publication Owner",
        emailVerified: new Date(),
      },
    });
    testOwnerUserId = ownerUser.id;

    const otherUser = await prisma.user.create({
      data: {
        email: `test-pub-other-${Date.now()}@example.com`,
        name: "Test Other User",
        emailVerified: new Date(),
      },
    });
    testOtherUserId = otherUser.id;

    console.log(`   ✅ Created Owner: ${ownerUser.email} (${ownerUser.id})`);
    console.log(`   ✅ Created Other: ${otherUser.email} (${otherUser.id})\n`);

    // 2. Create workspaces
    console.log("📋 Creating test workspaces...");
    const workspaceA = await prisma.workspace.create({
      data: {
        name: "Publication Test Workspace A",
        slug: `pub-test-ws-a-${Date.now()}`,
      },
    });
    workspaceAId = workspaceA.id;
    await ensureDefaultWorkspaceRoles(prisma, workspaceA.id);

    const workspaceB = await prisma.workspace.create({
      data: {
        name: "Publication Test Workspace B",
        slug: `pub-test-ws-b-${Date.now()}`,
      },
    });
    workspaceBId = workspaceB.id;
    await ensureDefaultWorkspaceRoles(prisma, workspaceB.id);

    console.log(`   ✅ Created Workspace A: ${workspaceA.slug}`);
    console.log(`   ✅ Created Workspace B: ${workspaceB.slug}\n`);

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
        userId: otherUser.id,
        workspaceId: workspaceB.id,
        role: "OWNER",
        status: "active",
      },
    });

    console.log("   ✅ Owner is OWNER of Workspace A");
    console.log("   ✅ Other is OWNER of Workspace B\n");

    // 4. Create test brand
    console.log("📋 Creating test brand...");
    const brand = await prisma.brand.create({
      data: {
        workspaceId: workspaceA.id,
        name: "Publication Test Brand",
        slug: `pub-test-brand-${Date.now()}`,
        status: "ACTIVE",
      },
    });
    brandId = brand.id;
    console.log(`   ✅ Created Brand: ${brand.name} (${brand.id})\n`);

    // 5. Create test media
    console.log("📋 Creating test media...");
    const media = await prisma.media.create({
      data: {
        workspaceId: workspaceA.id,
        brandId: brand.id,
        objectKey: `test/pub-image-${Date.now()}.jpg`,
        originalName: "test-image.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1024,
        isPublic: true,
        variants: {},
      },
    });
    mediaId = media.id;
    console.log(`   ✅ Created Media: ${media.id}\n`);

    // 6. Create test social accounts
    console.log("📋 Creating test social accounts...");
    
    // Instagram Business Account
    const igCredentials = encryptSocialCredentials({
      platform: "INSTAGRAM_BUSINESS",
      data: {
        accessToken: "test-ig-access-token",
        igBusinessAccountId: "123456789",
      },
    });

    const igAccount = await prisma.socialAccount.create({
      data: {
        workspaceId: workspaceA.id,
        brandId: brand.id,
        platform: "INSTAGRAM_BUSINESS",
        externalId: "ig_123456789",
        username: "test_ig_account",
        displayName: "Test IG Account",
        status: "ACTIVE",
        credentialsEncrypted: igCredentials,
        platformData: {
          igBusinessAccountId: "123456789",
          facebookPageId: "987654321",
        },
      },
    });
    igSocialAccountId = igAccount.id;
    console.log(`   ✅ Created Instagram Account: ${igAccount.username} (${igAccount.id})`);

    // Facebook Page Account
    const fbCredentials = encryptSocialCredentials({
      platform: "FACEBOOK_PAGE",
      data: {
        accessToken: "test-fb-access-token",
        pageId: "fb_page_123",
      },
    });

    const fbAccount = await prisma.socialAccount.create({
      data: {
        workspaceId: workspaceA.id,
        brandId: brand.id,
        platform: "FACEBOOK_PAGE",
        externalId: "fb_page_123",
        username: "Test FB Page",
        displayName: "Test Facebook Page",
        status: "ACTIVE",
        credentialsEncrypted: fbCredentials,
        platformData: {
          pageId: "fb_page_123",
          pageName: "Test Facebook Page",
        },
      },
    });
    fbSocialAccountId = fbAccount.id;
    console.log(`   ✅ Created Facebook Page: ${fbAccount.displayName} (${fbAccount.id})\n`);

    // 7. Create Fastify server
    console.log("📋 Creating Fastify server...");
    app = await createServer();
    console.log("   ✅ Server created\n");

    // 8. Generate access tokens
    console.log("📋 Generating access tokens...");
    const ownerToken = tokenService.signAccessToken({ sub: ownerUser.id });
    const otherToken = tokenService.signAccessToken({ sub: otherUser.id });
    console.log("   ✅ Tokens generated\n");

    // ==========================================
    // Instagram Publication Tests
    // ==========================================

    // Test 1: Schedule Instagram IMAGE publication (immediate)
    console.log("📋 Test 1: Schedule Instagram IMAGE publication (immediate)");
    const igImageResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/instagram`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: igSocialAccountId,
        payload: {
          contentType: "IMAGE",
          imageMediaId: mediaId,
          caption: "Test Instagram post #brint",
        },
      }),
    });

    if (igImageResponse.statusCode !== 201) {
      throw new Error(
        `Expected 201, got ${igImageResponse.statusCode}. Body: ${igImageResponse.body}`
      );
    }

    const igImageBody = JSON.parse(igImageResponse.body);
    if (!igImageBody.success || !igImageBody.data.id) {
      throw new Error(`Expected success with data.id, got ${JSON.stringify(igImageBody)}`);
    }

    publicationIds.push(igImageBody.data.id);
    console.log("   ✅ Status: 201");
    console.log(`   ✅ Publication created: ${igImageBody.data.id}`);
    console.log(`   ✅ Status: ${igImageBody.data.status}\n`);

    // Test 2: Schedule Instagram REEL publication (scheduled)
    console.log("📋 Test 2: Schedule Instagram REEL publication (scheduled)");
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const igReelResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/instagram`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: igSocialAccountId,
        publishAt: futureDate.toISOString(),
        payload: {
          contentType: "REEL",
          videoMediaId: mediaId, // Using image as video for test
          caption: "Test Instagram Reel #brint",
          shareToFeed: true,
        },
      }),
    });

    if (igReelResponse.statusCode !== 201) {
      throw new Error(
        `Expected 201, got ${igReelResponse.statusCode}. Body: ${igReelResponse.body}`
      );
    }

    const igReelBody = JSON.parse(igReelResponse.body);
    publicationIds.push(igReelBody.data.id);
    console.log("   ✅ Status: 201");
    console.log(`   ✅ Publication created: ${igReelBody.data.id}`);
    console.log(`   ✅ Scheduled at: ${igReelBody.data.scheduledAt}\n`);

    // ==========================================
    // Facebook Publication Tests
    // ==========================================

    // Test 3: Schedule Facebook PHOTO publication
    console.log("📋 Test 3: Schedule Facebook PHOTO publication");
    const fbPhotoResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/facebook`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: fbSocialAccountId,
        payload: {
          contentType: "PHOTO",
          imageMediaId: mediaId,
          message: "Test Facebook post #brint",
        },
      }),
    });

    if (fbPhotoResponse.statusCode !== 201) {
      throw new Error(
        `Expected 201, got ${fbPhotoResponse.statusCode}. Body: ${fbPhotoResponse.body}`
      );
    }

    const fbPhotoBody = JSON.parse(fbPhotoResponse.body);
    publicationIds.push(fbPhotoBody.data.id);
    console.log("   ✅ Status: 201");
    console.log(`   ✅ Publication created: ${fbPhotoBody.data.id}\n`);

    // Test 4: Schedule Facebook LINK publication
    console.log("📋 Test 4: Schedule Facebook LINK publication");
    const fbLinkResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/facebook`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: fbSocialAccountId,
        payload: {
          contentType: "LINK",
          linkUrl: "https://example.com",
          message: "Check out this link!",
        },
      }),
    });

    if (fbLinkResponse.statusCode !== 201) {
      throw new Error(
        `Expected 201, got ${fbLinkResponse.statusCode}. Body: ${fbLinkResponse.body}`
      );
    }

    const fbLinkBody = JSON.parse(fbLinkResponse.body);
    publicationIds.push(fbLinkBody.data.id);
    console.log("   ✅ Status: 201");
    console.log(`   ✅ Publication created: ${fbLinkBody.data.id}\n`);

    // ==========================================
    // Error Case Tests
    // ==========================================

    // Test 5: Platform mismatch - Instagram endpoint with Facebook account
    console.log("📋 Test 5: Platform mismatch (Instagram endpoint with FB account)");
    const mismatchResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/instagram`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: fbSocialAccountId, // Wrong! FB account for IG endpoint
        payload: {
          contentType: "IMAGE",
          imageMediaId: mediaId,
        },
      }),
    });

    if (mismatchResponse.statusCode !== 400) {
      throw new Error(
        `Expected 400, got ${mismatchResponse.statusCode}. Body: ${mismatchResponse.body}`
      );
    }

    const mismatchBody = JSON.parse(mismatchResponse.body);
    if (mismatchBody.error?.code !== "SOCIAL_ACCOUNT_PLATFORM_MISMATCH") {
      throw new Error(`Expected SOCIAL_ACCOUNT_PLATFORM_MISMATCH, got ${mismatchBody.error?.code}`);
    }

    console.log("   ✅ Status: 400 Bad Request");
    console.log("   ✅ Error code: SOCIAL_ACCOUNT_PLATFORM_MISMATCH\n");

    // Test 6: Cross-tenant access (Other user accessing Workspace A publication)
    console.log("📋 Test 6: Cross-tenant access (should fail)");
    const crossTenantResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/instagram`,
      headers: {
        Authorization: `Bearer ${otherToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: igSocialAccountId,
        payload: {
          contentType: "IMAGE",
          imageMediaId: mediaId,
        },
      }),
    });

    if (crossTenantResponse.statusCode !== 403) {
      throw new Error(
        `Expected 403, got ${crossTenantResponse.statusCode}. Body: ${crossTenantResponse.body}`
      );
    }

    console.log("   ✅ Status: 403 Forbidden");
    console.log("   ✅ Cross-tenant access blocked\n");

    // Test 7: Missing workspace header
    console.log("📋 Test 7: Missing workspace header");
    const noHeaderResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/instagram`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: igSocialAccountId,
        payload: {
          contentType: "IMAGE",
          imageMediaId: mediaId,
        },
      }),
    });

    if (noHeaderResponse.statusCode !== 400) {
      throw new Error(
        `Expected 400, got ${noHeaderResponse.statusCode}. Body: ${noHeaderResponse.body}`
      );
    }

    console.log("   ✅ Status: 400 Bad Request");
    console.log("   ✅ Missing workspace header handled\n");

    // ==========================================
    // List and Get Tests
    // ==========================================

    // Test 8: List publications
    console.log("📋 Test 8: List publications");
    const listResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/publications`,
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

    console.log("   ✅ Status: 200");
    console.log(`   ✅ Found ${listBody.data.items.length} publication(s)\n`);

    // Test 9: Get publication details
    console.log("📋 Test 9: Get publication details");
    const getResponse = await app.inject({
      method: "GET",
      url: `/v1/brands/${brandId}/publications/${publicationIds[0]}`,
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
    if (!getBody.success || getBody.data.id !== publicationIds[0]) {
      throw new Error(`Expected publication ${publicationIds[0]}, got ${JSON.stringify(getBody)}`);
    }

    console.log("   ✅ Status: 200");
    console.log(`   ✅ Publication details retrieved: ${getBody.data.id}\n`);

    // ==========================================
    // Idempotency Test
    // ==========================================

    // Test 10: Idempotency with clientRequestId
    console.log("📋 Test 10: Idempotency with clientRequestId");
    const clientRequestId = `test-idempotency-${Date.now()}`;
    
    const firstIdempotentResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/instagram`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: igSocialAccountId,
        clientRequestId,
        payload: {
          contentType: "IMAGE",
          imageMediaId: mediaId,
          caption: "Idempotent test post",
        },
      }),
    });

    if (firstIdempotentResponse.statusCode !== 201) {
      throw new Error(`First idempotent request failed: ${firstIdempotentResponse.body}`);
    }

    const firstBody = JSON.parse(firstIdempotentResponse.body);
    const firstPublicationId = firstBody.data.id;
    publicationIds.push(firstPublicationId);

    // Second request with same clientRequestId
    const secondIdempotentResponse = await app.inject({
      method: "POST",
      url: `/v1/brands/${brandId}/publications/instagram`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "X-Workspace-Id": workspaceA.id,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        socialAccountId: igSocialAccountId,
        clientRequestId,
        payload: {
          contentType: "IMAGE",
          imageMediaId: mediaId,
          caption: "Different caption",
        },
      }),
    });

    if (secondIdempotentResponse.statusCode !== 201) {
      throw new Error(`Second idempotent request failed: ${secondIdempotentResponse.body}`);
    }

    const secondBody = JSON.parse(secondIdempotentResponse.body);
    
    if (firstPublicationId !== secondBody.data.id) {
      throw new Error(`Idempotency failed: expected ${firstPublicationId}, got ${secondBody.data.id}`);
    }

    console.log("   ✅ First request created publication");
    console.log("   ✅ Second request returned same publication (idempotent)");
    console.log(`   ✅ Publication ID: ${firstPublicationId}\n`);

    // Check activity events
    console.log("📋 Checking activity events...");
    const activityEvents = await prisma.activityEvent.findMany({
      where: {
        workspaceId: workspaceA.id,
        scopeType: "publication",
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`   ✅ Found ${activityEvents.length} activity events for publications`);
    const eventTypes = activityEvents.map((e) => e.type);
    console.log(`   ✅ Event types: ${[...new Set(eventTypes)].join(", ")}\n`);

    console.log("🎉 All Publication routes tests passed!\n");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    // Cleanup
    if (app) {
      await app.close();
    }

    console.log("📋 Cleaning up test data...");

    // Delete publications
    if (publicationIds.length > 0) {
      await prisma.publication.deleteMany({
        where: { id: { in: publicationIds } },
      }).catch(() => {});
    }

    // Delete activity events
    if (workspaceAId) {
      await prisma.activityEvent.deleteMany({
        where: { workspaceId: workspaceAId },
      }).catch(() => {});
    }

    // Delete social accounts
    if (igSocialAccountId) {
      await prisma.socialAccount.delete({ where: { id: igSocialAccountId } }).catch(() => {});
    }
    if (fbSocialAccountId) {
      await prisma.socialAccount.delete({ where: { id: fbSocialAccountId } }).catch(() => {});
    }

    // Delete media
    if (mediaId) {
      await prisma.media.delete({ where: { id: mediaId } }).catch(() => {});
    }

    // Delete brand
    if (brandId) {
      await prisma.brand.delete({ where: { id: brandId } }).catch(() => {});
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
      await prisma.workspace.delete({ where: { id: workspaceAId } }).catch(() => {});
    }
    if (workspaceBId) {
      await prisma.workspace.delete({ where: { id: workspaceBId } }).catch(() => {});
    }

    // Delete users
    if (testOwnerUserId) {
      await prisma.user.delete({ where: { id: testOwnerUserId } }).catch(() => {});
    }
    if (testOtherUserId) {
      await prisma.user.delete({ where: { id: testOtherUserId } }).catch(() => {});
    }

    await prisma.$disconnect();
    console.log("   ✅ Cleanup complete\n");
  }
}

main().catch((error) => {
  console.error("❌ Test script failed:", error);
  process.exit(1);
});

