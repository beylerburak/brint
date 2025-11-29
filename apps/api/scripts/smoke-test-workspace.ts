#!/usr/bin/env tsx
/**
 * Smoke test for workspace endpoints
 * Tests:
 * 1. Workspace create (valid, invalid, without plan)
 * 2. Workspace invite (valid, invalid email)
 */

import { randomUUID } from 'crypto';
import { prisma } from '../src/lib/prisma.js';
import { tokenService } from '../src/core/auth/token.service.js';
import { sessionService } from '../src/core/auth/session.service.js';
import { createServer } from '../src/core/http/server.js';
import type { FastifyInstance } from 'fastify';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

interface TestResult {
  name: string;
  passed: boolean;
  status?: number;
  response?: any;
  error?: string;
}

const results: TestResult[] = [];
let testUserId: string | null = null;
let testWorkspaceId: string | null = null;
let app: FastifyInstance | null = null;

async function makeRequest(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; data: any }> {
  if (!app) {
    throw new Error('Server not initialized');
  }

  const response = await app.inject({
    method,
    url: path,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    payload: body ? JSON.stringify(body) : undefined,
  });

  // Parse JSON from body string
  let data: any;
  try {
    // Fastify inject returns body as string, parse it
    if (typeof response.body === 'string') {
      data = response.body ? JSON.parse(response.body) : {};
    } else {
      data = response.body || {};
    }
  } catch (e) {
    console.error('Failed to parse response body:', response.body);
    data = {};
  }
  
  return { status: response.statusCode, data };
}

async function getAuthToken(userId: string): Promise<string> {
  return tokenService.signAccessToken({ sub: userId });
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  try {
    await testFn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message,
      status: error.status,
      response: error.response,
    });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function testWorkspaceCreateValid() {
  if (!testUserId) throw new Error('Test user not created');
  
  const token = await getAuthToken(testUserId);
  const slug = `test-workspace-${randomUUID().substring(0, 8)}`;
  
  const { status, data } = await makeRequest(
    'POST',
    '/workspaces',
    {
      name: 'Beyler Interactive',
      slug,
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  if (status !== 201) {
    throw new Error(`Expected 201, got ${status}. Response: ${JSON.stringify(data)}`);
  }

  if (!data.success) {
    throw new Error(`Expected success: true, got ${JSON.stringify(data)}`);
  }

  if (!data.data?.workspace) {
    throw new Error(`Expected workspace in response, got ${JSON.stringify(data)}`);
  }

  if (!data.data?.subscription) {
    throw new Error(`Expected subscription in response, got ${JSON.stringify(data)}`);
  }

  // Check that plan is FREE (default)
  if (data.data.subscription.plan !== 'FREE') {
    throw new Error(`Expected plan to be FREE, got ${data.data.subscription.plan}`);
  }

  // Store workspace ID for invite tests
  testWorkspaceId = data.data.workspace.id;
}

async function testWorkspaceCreateInvalidName() {
  // Create a new user for this test to avoid limit issues
  const testUser3 = await prisma.user.create({
    data: {
      email: `test-smoke-3-${Date.now()}@example.com`,
      name: 'Test Smoke User 3',
      emailVerified: new Date(),
    },
  });

  const tid3 = randomUUID();
  await sessionService.createSession({
    userId: testUser3.id,
    tid: tid3,
    userAgent: 'smoke-test',
    ipAddress: '127.0.0.1',
  });

  const token = await getAuthToken(testUser3.id);
  
  try {
    // Test with empty name
    const { status, data } = await makeRequest(
      'POST',
      '/workspaces',
      {
        name: '',
        slug: 'beyler',
      },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    if (status !== 400) {
      throw new Error(`Expected 400, got ${status}. Response: ${JSON.stringify(data)}`);
    }

    // Issues are in error.details.issues
    const issues = data.error?.details?.issues || data.issues;
    if (!issues || !Array.isArray(issues)) {
      throw new Error(`Expected issues array in response, got ${JSON.stringify(data)}`);
    }

    const nameError = issues.find((issue: any) => {
      const path = issue.path || [];
      return Array.isArray(path) && path.includes('name');
    });

    if (!nameError) {
      throw new Error(`Expected name error in issues, got: ${JSON.stringify(issues)}`);
    }
  } finally {
    // Cleanup test user 3
    try {
      await prisma.session.deleteMany({
        where: { userId: testUser3.id },
      });
      await prisma.user.delete({
        where: { id: testUser3.id },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function testWorkspaceCreateWithoutPlan() {
  // Create a new user for this test to avoid limit issues
  const testUser2 = await prisma.user.create({
    data: {
      email: `test-smoke-2-${Date.now()}@example.com`,
      name: 'Test Smoke User 2',
      emailVerified: new Date(),
    },
  });

  const tid2 = randomUUID();
  await sessionService.createSession({
    userId: testUser2.id,
    tid: tid2,
    userAgent: 'smoke-test',
    ipAddress: '127.0.0.1',
  });

  const token = await getAuthToken(testUser2.id);
  const slug = `test-workspace-${randomUUID().substring(0, 8)}`;
  
  let workspaceId: string | null = null;
  try {
    // Test with name and slug only (no plan)
    const { status, data } = await makeRequest(
      'POST',
      '/workspaces',
      {
        name: 'Test Workspace',
        slug,
      },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    if (status !== 201) {
      throw new Error(`Expected 201, got ${status}. Response: ${JSON.stringify(data)}`);
    }

    // Check that plan is FREE (default from Zod schema)
    if (data.data?.subscription?.plan !== 'FREE') {
      throw new Error(`Expected plan to be FREE, got ${data.data?.subscription?.plan}`);
    }

    workspaceId = data.data?.workspace?.id || null;
  } finally {
    // Cleanup test user 2
    try {
      // Delete workspace first if created
      if (workspaceId) {
        await prisma.workspaceMember.deleteMany({
          where: { workspaceId },
        });
        await prisma.subscription.deleteMany({
          where: { workspaceId },
        });
        await prisma.workspaceInvite.deleteMany({
          where: { workspaceId },
        });
        await prisma.workspace.delete({
          where: { id: workspaceId },
        });
      }
      await prisma.session.deleteMany({
        where: { userId: testUser2.id },
      });
      await prisma.user.delete({
        where: { id: testUser2.id },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function testWorkspaceInviteValid() {
  if (!testUserId || !testWorkspaceId) {
    throw new Error('Test user or workspace not created');
  }
  
  const token = await getAuthToken(testUserId);
  
  // Make request and get raw response for debugging
  if (!app) throw new Error('Server not initialized');
  
  const response = await app.inject({
    method: 'POST',
    url: `/workspaces/${testWorkspaceId}/invites`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': testWorkspaceId,
    },
    payload: JSON.stringify({
      email: 'test@example.com',
    }),
  });

  let data: any;
  try {
    // Debug: log raw response
    if (response.statusCode === 200 && (!response.body || response.body === '{}')) {
      console.error('DEBUG: Response body is empty or {}:', response.body);
      console.error('DEBUG: Response headers:', response.headers);
    }
    data = typeof response.body === 'string' && response.body ? JSON.parse(response.body) : (response.body || {});
  } catch (e) {
    console.error('Response body:', response.body);
    console.error('Response status:', response.statusCode);
    throw new Error(`Failed to parse response: ${e}`);
  }

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}. Response: ${JSON.stringify(data, null, 2)}`);
  }

  if (!data.success) {
    throw new Error(`Expected success: true, got ${JSON.stringify(data, null, 2)}`);
  }

  // Check if data exists and has email field
  if (!data.data) {
    throw new Error(`Expected data in response, got ${JSON.stringify(data, null, 2)}`);
  }

  // The email should be in data.data.email
  if (!data.data.email || data.data.email !== 'test@example.com') {
    throw new Error(`Expected email 'test@example.com' in response.data.email, got ${JSON.stringify(data.data, null, 2)}`);
  }
}

async function testWorkspaceInviteInvalidEmail() {
  if (!testUserId || !testWorkspaceId) {
    throw new Error('Test user or workspace not created');
  }
  
  const token = await getAuthToken(testUserId);
  
  // Test with invalid email
  const { status, data } = await makeRequest(
    'POST',
    `/workspaces/${testWorkspaceId}/invites`,
    {
      email: 'not-an-email',
    },
    {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': testWorkspaceId,
    }
  );

  if (status !== 400) {
    throw new Error(`Expected 400, got ${status}. Response: ${JSON.stringify(data)}`);
  }

  // Issues are in error.details.issues
  const issues = data.error?.details?.issues || data.issues;
  if (!issues || !Array.isArray(issues)) {
    throw new Error(`Expected issues array in response, got ${JSON.stringify(data)}`);
  }

  const emailError = issues.find((issue: any) => {
    const path = issue.path || [];
    return Array.isArray(path) && path.includes('email');
  });

  if (!emailError) {
    throw new Error(`Expected email error in issues, got: ${JSON.stringify(issues)}`);
  }
}

async function main() {
  console.log('🧪 Starting workspace smoke tests...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  try {
    // 1. Create test user
    console.log('📋 Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        email: `test-smoke-${Date.now()}@example.com`,
        name: 'Test Smoke User',
        emailVerified: new Date(),
      },
    });
    testUserId = testUser.id;
    console.log(`   ✅ Created test user: ${testUser.email} (${testUser.id})\n`);

    // 2. Create session for the user
    const tid = randomUUID();
    await sessionService.createSession({
      userId: testUser.id,
      tid,
      userAgent: 'smoke-test',
      ipAddress: '127.0.0.1',
    });

    // 3. Create Fastify server
    console.log('📋 Creating Fastify server...');
    app = await createServer();
    console.log('   ✅ Server created\n');

    // Test 1: Workspace create with valid data
    await runTest('Workspace Create - Valid (name + slug)', testWorkspaceCreateValid);

    // Test 2: Workspace create with invalid name (empty)
    await runTest('Workspace Create - Invalid Name (Empty)', testWorkspaceCreateInvalidName);

    // Test 3: Workspace create without plan
    await runTest('Workspace Create - Without Plan', testWorkspaceCreateWithoutPlan);

    // Test 4: Workspace invite with valid email
    await runTest('Workspace Invite - Valid Email', testWorkspaceInviteValid);

    // Test 5: Workspace invite with invalid email
    await runTest('Workspace Invite - Invalid Email', testWorkspaceInviteInvalidEmail);

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('='.repeat(50));
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Total: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.name}`);
          if (r.error) console.log(`    Error: ${r.error}`);
          if (r.status) console.log(`    Status: ${r.status}`);
          if (r.response) console.log(`    Response: ${JSON.stringify(r.response, null, 2)}`);
        });
    }
  } catch (error: any) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    // Cleanup
    if (testWorkspaceId && testUserId) {
      try {
        // Delete workspace members first
        await prisma.workspaceMember.deleteMany({
          where: { workspaceId: testWorkspaceId },
        });
        // Delete subscriptions
        await prisma.subscription.deleteMany({
          where: { workspaceId: testWorkspaceId },
        });
        // Delete workspace invites
        await prisma.workspaceInvite.deleteMany({
          where: { workspaceId: testWorkspaceId },
        });
        // Delete workspace
        await prisma.workspace.delete({
          where: { id: testWorkspaceId },
        });
        console.log('\n🧹 Cleaned up test workspace');
      } catch (e) {
        console.error('Failed to cleanup workspace:', e);
      }
    }

    if (testUserId) {
      try {
        // Delete workspace members for this user
        await prisma.workspaceMember.deleteMany({
          where: { userId: testUserId },
        });
        // Delete sessions
        await prisma.session.deleteMany({
          where: { userId: testUserId },
        });
        // Delete user
        await prisma.user.delete({
          where: { id: testUserId },
        });
        console.log('🧹 Cleaned up test user');
      } catch (e) {
        console.error('Failed to cleanup user:', e);
      }
    }

    if (app) {
      await app.close();
    }

    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
