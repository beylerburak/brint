/**
 * Brand Studio Service Tests
 * 
 * Smoke tests for brand studio service and brand repository using seed data.
 * Run with: cd apps/api && pnpm exec tsx src/modules/brand/brand-studio.service.spec.ts
 */

import { prisma } from '../../lib/prisma.js';
import { brandStudioService } from './brand-studio.service.js';
import { brandRepository } from './brand.repository.js';
import { PERMISSIONS } from '../../core/auth/permissions.registry.js';

async function main() {
  console.log('🧪 Starting TS-22 brand studio service tests...\n');

  let testUserId: string | null = null;
  let testBrandIds: string[] = [];

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

    // Test 1: Owner user → brand list accessible
    console.log('📋 Test 1: Owner user → brand list accessible');
    
    // Create test brands for the workspace
    const brand1 = await brandRepository.createBrand({
      workspaceId: demoWorkspace.id,
      name: 'Test Brand 1',
      slug: 'test-brand-1',
      description: 'First test brand',
    });
    testBrandIds.push(brand1.id);

    const brand2 = await brandRepository.createBrand({
      workspaceId: demoWorkspace.id,
      name: 'Test Brand 2',
      slug: 'test-brand-2',
      description: 'Second test brand',
    });
    testBrandIds.push(brand2.id);

    const brand3 = await brandRepository.createBrand({
      workspaceId: demoWorkspace.id,
      name: 'Test Brand 3',
      slug: 'test-brand-3',
    });
    testBrandIds.push(brand3.id);

    console.log(`   ✅ Created ${testBrandIds.length} test brands\n`);

    // Get accessible brands for owner
    const ownerAccess = await brandStudioService.getAccessibleBrands({
      userId: ownerUser.id,
      workspaceId: demoWorkspace.id,
    });

    // Verify results
    if (!ownerAccess.hasBrandViewPermission) {
      throw new Error('Owner should have brand view permission');
    }

    if (ownerAccess.brands.length < testBrandIds.length) {
      throw new Error(
        `Expected at least ${testBrandIds.length} brands, got ${ownerAccess.brands.length}`
      );
    }

    // Verify all brands belong to the correct workspace
    for (const brand of ownerAccess.brands) {
      if (brand.workspaceId !== demoWorkspace.id) {
        throw new Error(
          `Brand ${brand.id} belongs to wrong workspace: ${brand.workspaceId} != ${demoWorkspace.id}`
        );
      }
    }

    // Verify effective permissions include STUDIO_BRAND_VIEW
    if (!ownerAccess.effectivePermissions.includes(PERMISSIONS.STUDIO_BRAND_VIEW)) {
      throw new Error('Owner effective permissions should include STUDIO_BRAND_VIEW');
    }

    console.log(`   ✅ Owner has brand view permission`);
    console.log(`   ✅ Owner can see ${ownerAccess.brands.length} brands`);
    console.log(`   ✅ All brands belong to correct workspace`);
    console.log(`   ✅ Effective permissions include STUDIO_BRAND_VIEW\n`);

    // Test 2: Non-member user → no brands accessible
    console.log('📋 Test 2: Non-member user → no brands accessible');
    
    // Create a user that is NOT a member of the workspace
    const nonMemberUser = await prisma.user.create({
      data: {
        email: 'brand-test+no-member@example.com',
        name: 'Non-Member User',
      },
    });
    testUserId = nonMemberUser.id;

    console.log(`   ✅ Created non-member user: ${nonMemberUser.email}\n`);

    // Get accessible brands for non-member
    const nonMemberAccess = await brandStudioService.getAccessibleBrands({
      userId: nonMemberUser.id,
      workspaceId: demoWorkspace.id,
    });

    // Verify results
    if (nonMemberAccess.hasBrandViewPermission) {
      throw new Error('Non-member should NOT have brand view permission');
    }

    if (nonMemberAccess.brands.length !== 0) {
      throw new Error(
        `Non-member should see 0 brands, got ${nonMemberAccess.brands.length}`
      );
    }

    // Non-member should have no permissions (or empty permissions)
    if (nonMemberAccess.effectivePermissions.includes(PERMISSIONS.STUDIO_BRAND_VIEW)) {
      throw new Error('Non-member should NOT have STUDIO_BRAND_VIEW permission');
    }

    console.log(`   ✅ Non-member does NOT have brand view permission`);
    console.log(`   ✅ Non-member sees 0 brands`);
    console.log(`   ✅ Non-member has no STUDIO_BRAND_VIEW permission\n`);

    // Test 3: BrandRepository slug invariants
    console.log('📋 Test 3: BrandRepository slug invariants');
    
    // Test slug normalization
    const brandWithWeirdSlug = await brandRepository.createBrand({
      workspaceId: demoWorkspace.id,
      name: '  My Brand  ',
      slug: 'My Brand  _Test',
    });
    testBrandIds.push(brandWithWeirdSlug.id);

    // Verify name is trimmed
    if (brandWithWeirdSlug.name !== 'My Brand') {
      throw new Error(
        `Expected name to be trimmed to "My Brand", got "${brandWithWeirdSlug.name}"`
      );
    }

    // Verify slug is normalized
    const expectedSlug = 'my-brand-test';
    if (brandWithWeirdSlug.slug !== expectedSlug) {
      throw new Error(
        `Expected slug to be normalized to "${expectedSlug}", got "${brandWithWeirdSlug.slug}"`
      );
    }

    console.log(`   ✅ Name trimmed: "${brandWithWeirdSlug.name}"`);
    console.log(`   ✅ Slug normalized: "${brandWithWeirdSlug.slug}"`);

    // Test unique constraint violation
    try {
      await brandRepository.createBrand({
        workspaceId: demoWorkspace.id,
        name: 'Duplicate Slug Brand',
        slug: brandWithWeirdSlug.slug, // Same slug
      });
      throw new Error('Should have thrown error for duplicate slug');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`   ✅ Duplicate slug correctly rejected`);
      } else {
        throw error;
      }
    }

    console.log('');

    console.log('🎉 TS-22 brand studio service tests: OK');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup: delete test brands
    for (const brandId of testBrandIds) {
      await prisma.brand
        .delete({
          where: { id: brandId },
        })
        .catch(() => {
          // Ignore errors during cleanup
        });
    }

    // Cleanup: delete test user
    if (testUserId) {
      await prisma.user
        .delete({
          where: { id: testUserId },
        })
        .catch(() => {
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

