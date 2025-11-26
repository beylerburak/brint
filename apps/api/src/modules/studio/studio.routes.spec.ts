/**
 * Studio Routes Tests
 * 
 * Integration tests for /studio/brands endpoint.
 * Run with: cd apps/api && pnpm exec tsx src/modules/studio/studio.routes.spec.ts
 */

import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';
import { createServer } from '../../core/http/server.js';
import { brandRepository } from '../brand/brand.repository.js';
import type { FastifyInstance } from 'fastify';

async function main() {
  console.log('🧪 Starting TS-23 Studio routes tests...\n');

  let testBrandId1: string | null = null;
  let testBrandId2: string | null = null;
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

    // 2. Create test brands for the workspace
    console.log('📋 Creating test brands...');
    const brand1 = await brandRepository.createBrand({
      workspaceId: demoWorkspace.id,
      name: 'Test Brand 1',
      slug: 'test-brand-1',
      description: 'First test brand',
    });
    testBrandId1 = brand1.id;

    const brand2 = await brandRepository.createBrand({
      workspaceId: demoWorkspace.id,
      name: 'Test Brand 2',
      slug: 'test-brand-2',
      description: 'Second test brand',
    });
    testBrandId2 = brand2.id;

    console.log(`   ✅ Created brand 1: ${brand1.name} (${brand1.id})`);
    console.log(`   ✅ Created brand 2: ${brand2.name} (${brand2.id})\n`);

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

    // ==========================================
    // Test 1: Happy path (owner user)
    // ==========================================
    console.log('📋 Test 1: Happy path - Owner accessing /studio/brands');
    const happyResponse = await app.inject({
      method: 'GET',
      url: '/studio/brands',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'X-Workspace-Id': demoWorkspace.id,
      },
    });

    if (happyResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${happyResponse.statusCode}. Body: ${happyResponse.body}`
      );
    }

    const happyBody = JSON.parse(happyResponse.body);
    if (!happyBody.success) {
      throw new Error(`Expected success: true, got ${JSON.stringify(happyBody)}`);
    }

    if (!happyBody.data) {
      throw new Error(`Expected data object, got ${JSON.stringify(happyBody)}`);
    }

    if (happyBody.data.userId !== ownerUser.id) {
      throw new Error(
        `Expected userId to be ${ownerUser.id}, got ${happyBody.data.userId}`
      );
    }

    if (happyBody.data.workspaceId !== demoWorkspace.id) {
      throw new Error(
        `Expected workspaceId to be ${demoWorkspace.id}, got ${happyBody.data.workspaceId}`
      );
    }

    if (happyBody.data.hasBrandViewPermission !== true) {
      throw new Error(
        `Expected hasBrandViewPermission to be true, got ${happyBody.data.hasBrandViewPermission}`
      );
    }

    if (!Array.isArray(happyBody.data.brands)) {
      throw new Error(
        `Expected brands to be an array, got ${typeof happyBody.data.brands}`
      );
    }

    if (happyBody.data.brands.length < 2) {
      throw new Error(
        `Expected at least 2 brands, got ${happyBody.data.brands.length}`
      );
    }

    // Verify all brands belong to the workspace
    for (const brand of happyBody.data.brands) {
      if (brand.workspaceId !== demoWorkspace.id) {
        throw new Error(
          `Brand ${brand.id} has wrong workspaceId: ${brand.workspaceId}`
        );
      }
    }

    // Verify effectivePermissions includes STUDIO_BRAND_VIEW
    if (!Array.isArray(happyBody.data.effectivePermissions)) {
      throw new Error(
        `Expected effectivePermissions to be an array, got ${typeof happyBody.data.effectivePermissions}`
      );
    }

    if (!happyBody.data.effectivePermissions.includes('studio:brand.view')) {
      throw new Error(
        `Expected effectivePermissions to include 'studio:brand.view', got ${JSON.stringify(happyBody.data.effectivePermissions)}`
      );
    }

    // Verify brand structure
    const firstBrand = happyBody.data.brands[0];
    if (!firstBrand.id || !firstBrand.name || !firstBrand.slug) {
      throw new Error(
        `Brand structure incomplete: ${JSON.stringify(firstBrand)}`
      );
    }

    console.log('   ✅ Status: 200');
    console.log('   ✅ Body: success: true');
    console.log('   ✅ data.userId matches owner.id');
    console.log('   ✅ data.workspaceId matches workspace.id');
    console.log('   ✅ data.hasBrandViewPermission === true');
    console.log('   ✅ data.brands is an array with at least 2 brands');
    console.log('   ✅ All brands have correct workspaceId');
    console.log('   ✅ data.effectivePermissions includes studio:brand.view');
    console.log('   ✅ Brand structure is correct\n');

    // ==========================================
    // Test 2: Unauthorized (no auth header)
    // ==========================================
    console.log('📋 Test 2: Unauthorized - No auth header');
    const unauthorizedResponse = await app.inject({
      method: 'GET',
      url: '/studio/brands',
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

    if (unauthorizedBody.error?.code !== 'UNAUTHORIZED') {
      throw new Error(
        `Expected error.code: "UNAUTHORIZED", got "${unauthorizedBody.error?.code}"`
      );
    }

    console.log('   ✅ Status: 401');
    console.log('   ✅ Body: success: false');
    console.log('   ✅ Error code: UNAUTHORIZED\n');

    // ==========================================
    // Test 3: Unauthorized (no workspace header)
    // ==========================================
    console.log('📋 Test 3: Unauthorized - No workspace header');
    const noWorkspaceResponse = await app.inject({
      method: 'GET',
      url: '/studio/brands',
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

    if (noWorkspaceBody.error?.code !== 'UNAUTHORIZED') {
      throw new Error(
        `Expected error.code: "UNAUTHORIZED", got "${noWorkspaceBody.error?.code}"`
      );
    }

    console.log('   ✅ Status: 401');
    console.log('   ✅ Body: success: false');
    console.log('   ✅ Error code: UNAUTHORIZED\n');

    console.log('🎉 TS-23 Studio routes tests: OK');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup: close server
    if (app) {
      await app.close();
    }

    // Cleanup: delete test brands
    if (testBrandId1) {
      await prisma.brand.delete({
        where: { id: testBrandId1 },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    if (testBrandId2) {
      await prisma.brand.delete({
        where: { id: testBrandId2 },
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

