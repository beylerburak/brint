/**
 * User Repository Smoke Tests
 * 
 * Basic tests to verify User repository functions work with Prisma.
 * 
 * To run manually:
 *   tsx src/modules/user/user.repository.spec.ts
 */

import { userRepository } from './user.repository.js';
import { workspaceRepository } from '../workspace/workspace.repository.js';
import { prisma } from '../../lib/prisma.js';

async function cleanup() {
  // Clean up test data
  await prisma.workspaceMember.deleteMany({
    where: {
      user: {
        email: {
          in: ['test-user@example.com', 'test-owner@example.com'],
        },
      },
    },
  });
  await prisma.workspace.deleteMany({
    where: {
      slug: {
        in: ['test-workspace', 'test-workspace-with-owner'],
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['test-user@example.com', 'test-owner@example.com'],
      },
    },
  });
}

async function runSmokeTests() {
  console.log('🧪 Starting User & Workspace Repository Smoke Tests...\n');

  try {
    // Test 1: Create User
    console.log('Test 1: Creating a user...');
    const createdUser = await userRepository.createUser({
      email: 'test-user@example.com',
      name: 'Test User',
    });
    console.log('✅ User created:', {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
    });

    // Test 2: Find User by ID
    console.log('\nTest 2: Finding user by ID...');
    const foundById = await userRepository.findUserById(createdUser.id);
    if (!foundById) {
      throw new Error('User not found by ID');
    }
    console.log('✅ User found by ID:', foundById.email);

    // Test 3: Find User by Email
    console.log('\nTest 3: Finding user by email...');
    const foundByEmail = await userRepository.findUserByEmail(
      'test-user@example.com'
    );
    if (!foundByEmail) {
      throw new Error('User not found by email');
    }
    console.log('✅ User found by email:', foundByEmail.id);

    // Test 4: Create Workspace
    console.log('\nTest 4: Creating a workspace...');
    const createdWorkspace = await workspaceRepository.createWorkspace({
      name: 'Test Workspace',
      slug: 'test-workspace',
    });
    console.log('✅ Workspace created:', {
      id: createdWorkspace.id,
      name: createdWorkspace.name,
      slug: createdWorkspace.slug,
    });

    // Test 5: Find Workspace by ID
    console.log('\nTest 5: Finding workspace by ID...');
    const foundWorkspaceById =
      await workspaceRepository.findWorkspaceById(createdWorkspace.id);
    if (!foundWorkspaceById) {
      throw new Error('Workspace not found by ID');
    }
    console.log('✅ Workspace found by ID:', foundWorkspaceById.slug);

    // Test 6: Find Workspace by Slug
    console.log('\nTest 6: Finding workspace by slug...');
    const foundWorkspaceBySlug =
      await workspaceRepository.findWorkspaceBySlug('test-workspace');
    if (!foundWorkspaceBySlug) {
      throw new Error('Workspace not found by slug');
    }
    console.log('✅ Workspace found by slug:', foundWorkspaceBySlug.id);

    // Test 7: Create Workspace with Owner (transaction)
    console.log('\nTest 7: Creating workspace with owner (transaction)...');
    const workspaceWithOwner =
      await workspaceRepository.createWorkspaceWithOwner({
        userEmail: 'test-owner@example.com',
        userName: 'Test Owner',
        workspaceName: 'Test Workspace with Owner',
        workspaceSlug: 'test-workspace-with-owner',
      });
    console.log('✅ Workspace with owner created:', {
      userId: workspaceWithOwner.user.id,
      userEmail: workspaceWithOwner.user.email,
      workspaceId: workspaceWithOwner.workspace.id,
      workspaceSlug: workspaceWithOwner.workspace.slug,
      memberRole: workspaceWithOwner.member.role,
    });

    // Test 8: Verify transaction created all entities
    console.log('\nTest 8: Verifying transaction created all entities...');
    const verifyUser = await userRepository.findUserByEmail(
      'test-owner@example.com'
    );
    const verifyWorkspace =
      await workspaceRepository.findWorkspaceBySlug(
        'test-workspace-with-owner'
      );
    if (!verifyUser || !verifyWorkspace) {
      throw new Error('Transaction did not create all entities');
    }
    console.log('✅ All entities verified');

    console.log('\n🎉 All smoke tests passed!');
  } catch (error) {
    console.error('\n❌ Smoke test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await cleanup();
    console.log('✅ Cleanup complete');
  }
}

// Run tests if this file is executed directly
// Check if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('user.repository.spec.ts');

if (isMainModule) {
  runSmokeTests()
    .then(() => {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

export { runSmokeTests };

