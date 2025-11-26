/**
 * Auth Context Middleware Unit Tests (TS-17)
 * 
 * Tests to verify auth context middleware extracts and attaches
 * auth context correctly from JWT tokens and headers.
 * 
 * To run manually:
 *   tsx src/core/auth/auth.context.spec.ts
 */

import Fastify, { FastifyInstance } from 'fastify';
import { tokenService } from './token.service.js';
import authContextPlugin from './auth.context.js';
import { registerDebugRoutes } from '../../modules/debug/debug.routes.js';

async function runTests() {
  console.log('🧪 Starting TS-17 Auth Context Tests...\n');

  try {
    // Test 1: Valid token with workspace and brand headers
    console.log('Test 1: Valid token with workspace and brand headers');
    const testServer1 = await createTestServer();

    const testUserId = 'test-user-id';
    const testWorkspaceId = 'ws_test_123';
    const testBrandId = 'br_test_456';

    const token = tokenService.signAccessToken({ sub: testUserId });

    const response1 = await testServer1.inject({
      method: 'GET',
      url: '/debug/auth',
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': testWorkspaceId,
        'x-brand-id': testBrandId,
      },
    });

    if (response1.statusCode !== 200) {
      throw new Error(`Expected 200, got ${response1.statusCode}: ${response1.body}`);
    }

    const body1 = JSON.parse(response1.body);
    if (!body1.success) {
      throw new Error(`Expected success: true, got: ${body1.success}`);
    }

    if (!body1.auth) {
      throw new Error('Expected auth context to be present');
    }

    if (body1.auth.userId !== testUserId) {
      throw new Error(`Expected userId: ${testUserId}, got: ${body1.auth.userId}`);
    }

    if (body1.auth.workspaceId !== testWorkspaceId) {
      throw new Error(`Expected workspaceId: ${testWorkspaceId}, got: ${body1.auth.workspaceId}`);
    }

    if (body1.auth.brandId !== testBrandId) {
      throw new Error(`Expected brandId: ${testBrandId}, got: ${body1.auth.brandId}`);
    }

    if (body1.auth.tokenType !== 'access') {
      throw new Error(`Expected tokenType: 'access', got: ${body1.auth.tokenType}`);
    }

    if (!body1.auth.tokenPayload || body1.auth.tokenPayload.sub !== testUserId) {
      throw new Error('Token payload does not match');
    }

    console.log('✅ Valid token with headers correctly parsed');

    // Test 2: Valid token without workspace/brand headers
    console.log('\nTest 2: Valid token without workspace/brand headers');
    const testServer2 = await createTestServer();

    const token2 = tokenService.signAccessToken({ sub: testUserId });

    const response2 = await testServer2.inject({
      method: 'GET',
      url: '/debug/auth',
      headers: {
        authorization: `Bearer ${token2}`,
      },
    });

    if (response2.statusCode !== 200) {
      throw new Error(`Expected 200, got ${response2.statusCode}: ${response2.body}`);
    }

    const body2 = JSON.parse(response2.body);
    if (!body2.auth) {
      throw new Error('Expected auth context to be present even without workspace/brand');
    }

    if (body2.auth.workspaceId !== undefined && body2.auth.workspaceId !== null) {
      throw new Error(`Expected workspaceId to be undefined/null, got: ${body2.auth.workspaceId}`);
    }

    if (body2.auth.brandId !== undefined && body2.auth.brandId !== null) {
      throw new Error(`Expected brandId to be undefined/null, got: ${body2.auth.brandId}`);
    }

    console.log('✅ Valid token without headers correctly handled');

    // Test 3: No authorization header (public request)
    console.log('\nTest 3: No authorization header (public request)');
    const testServer3 = await createTestServer();

    const response3 = await testServer3.inject({
      method: 'GET',
      url: '/debug/auth',
    });

    if (response3.statusCode !== 200) {
      throw new Error(`Expected 200, got ${response3.statusCode}: ${response3.body}`);
    }

    const body3 = JSON.parse(response3.body);
    if (body3.auth !== null) {
      throw new Error(`Expected auth to be null for public request, got: ${JSON.stringify(body3.auth)}`);
    }

    console.log('✅ Public request correctly returns null auth');

    // Test 4: Invalid token format
    console.log('\nTest 4: Invalid token format');
    const testServer4 = await createTestServer();

    const response4 = await testServer4.inject({
      method: 'GET',
      url: '/debug/auth',
      headers: {
        authorization: 'InvalidFormat token',
      },
    });

    if (response4.statusCode !== 200) {
      throw new Error(`Expected 200 (should not fail), got ${response4.statusCode}: ${response4.body}`);
    }

    const body4 = JSON.parse(response4.body);
    if (body4.auth !== null) {
      throw new Error(`Expected auth to be null for invalid format, got: ${JSON.stringify(body4.auth)}`);
    }

    console.log('✅ Invalid token format correctly handled (no error)');

    // Test 5: Invalid/expired token
    console.log('\nTest 5: Invalid/expired token');
    const testServer5 = await createTestServer();

    const response5 = await testServer5.inject({
      method: 'GET',
      url: '/debug/auth',
      headers: {
        authorization: 'Bearer invalid.token.here',
      },
    });

    if (response5.statusCode !== 200) {
      throw new Error(`Expected 200 (should not fail), got ${response5.statusCode}: ${response5.body}`);
    }

    const body5 = JSON.parse(response5.body);
    if (body5.auth !== null) {
      throw new Error(`Expected auth to be null for invalid token, got: ${JSON.stringify(body5.auth)}`);
    }

    console.log('✅ Invalid token correctly handled (no error)');

    await testServer1.close();
    await testServer2.close();
    await testServer3.close();
    await testServer4.close();
    await testServer5.close();

    console.log('\n🎉 All TS-17 auth context tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

/**
 * Creates a test Fastify server instance with auth context plugin and debug routes
 */
async function createTestServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register auth context plugin
  await app.register(authContextPlugin);

  // Register debug routes
  await registerDebugRoutes(app);

  await app.ready();

  return app;
}

// Run tests if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('auth.context.spec.ts');

if (isMainModule) {
  runTests()
    .then(() => {
      console.log('\n✅ TS-17 auth context tests: OK');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ TS-17 auth context tests: FAILED');
      console.error(error);
      process.exitCode = 1;
      process.exit(1);
    });
}

export { runTests };

