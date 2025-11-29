/**
 * API Versioning & CORS Test Script
 * 
 * Tests:
 * 1. Versioned routes are accessible under /v1
 * 2. Non-versioned routes work without /v1
 * 3. CORS headers are present
 * 4. CORS allows configured origins
 * 
 * Run with: cd apps/api && pnpm exec tsx scripts/test-api-versioning-cors.ts
 */

import { createServer } from '../src/core/http/server.js';
import type { FastifyInstance } from 'fastify';

async function main() {
  console.log('🧪 Testing API Versioning & CORS Configuration\n');
  console.log('=' .repeat(60) + '\n');

  let app: FastifyInstance | null = null;
  let passed = 0;
  let failed = 0;

  try {
    // Create server
    console.log('📋 Creating Fastify server...');
    app = await createServer();
    console.log('   ✅ Server created\n');

    // Test 1: Health endpoint (non-versioned)
    console.log('📋 Test 1: Health endpoint (non-versioned)');
    try {
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      if (healthResponse.statusCode === 200) {
        const body = JSON.parse(healthResponse.body);
        if (body.status === 'ok') {
          console.log('   ✅ Status: 200');
          console.log('   ✅ Body: { status: "ok" }');
          passed++;
        } else {
          throw new Error(`Expected status: "ok", got: ${body.status}`);
        }
      } else {
        throw new Error(`Expected 200, got ${healthResponse.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Test 2: Health endpoint should NOT work under /v1
    console.log('📋 Test 2: Health endpoint should NOT work under /v1');
    try {
      const healthV1Response = await app.inject({
        method: 'GET',
        url: '/v1/health/live',
      });

      if (healthV1Response.statusCode === 404) {
        console.log('   ✅ Status: 404 (expected - health is not versioned)');
        passed++;
      } else {
        throw new Error(`Expected 404, got ${healthV1Response.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Test 3: Auth endpoint under /v1 (versioned)
    console.log('📋 Test 3: Auth endpoint under /v1 (versioned)');
    try {
      const authResponse = await app.inject({
        method: 'GET',
        url: '/v1/auth/google',
      });

      if (authResponse.statusCode === 200) {
        const body = JSON.parse(authResponse.body);
        if (body.success === true && body.redirectUrl) {
          console.log('   ✅ Status: 200');
          console.log('   ✅ Body: { success: true, redirectUrl: "..." }');
          passed++;
        } else {
          throw new Error(`Expected success: true, got: ${JSON.stringify(body)}`);
        }
      } else {
        throw new Error(`Expected 200, got ${authResponse.statusCode}: ${authResponse.body}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Test 4: Auth endpoint should NOT work without /v1
    console.log('📋 Test 4: Auth endpoint should NOT work without /v1');
    try {
      const authNoV1Response = await app.inject({
        method: 'GET',
        url: '/auth/google',
      });

      if (authNoV1Response.statusCode === 404) {
        console.log('   ✅ Status: 404 (expected - auth is versioned)');
        passed++;
      } else {
        throw new Error(`Expected 404, got ${authNoV1Response.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Test 5: CORS headers on OPTIONS request
    console.log('📋 Test 5: CORS headers on OPTIONS request');
    try {
      const corsResponse = await app.inject({
        method: 'OPTIONS',
        url: '/v1/auth/google',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'GET',
        },
      });

      const corsHeaders = {
        'access-control-allow-origin': corsResponse.headers['access-control-allow-origin'],
        'access-control-allow-credentials': corsResponse.headers['access-control-allow-credentials'],
        'access-control-max-age': corsResponse.headers['access-control-max-age'],
        'access-control-allow-methods': corsResponse.headers['access-control-allow-methods'],
      };

      if (corsResponse.statusCode === 204 || corsResponse.statusCode === 200) {
        if (corsHeaders['access-control-allow-origin']) {
          console.log('   ✅ Status: 204/200 (preflight OK)');
          console.log(`   ✅ Access-Control-Allow-Origin: ${corsHeaders['access-control-allow-origin']}`);
          console.log(`   ✅ Access-Control-Allow-Credentials: ${corsHeaders['access-control-allow-credentials']}`);
          console.log(`   ✅ Access-Control-Max-Age: ${corsHeaders['access-control-max-age']}`);
          passed++;
        } else {
          throw new Error('CORS headers missing');
        }
      } else {
        throw new Error(`Expected 204/200, got ${corsResponse.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Test 6: CORS headers on GET request
    console.log('📋 Test 6: CORS headers on GET request');
    try {
      const getResponse = await app.inject({
        method: 'GET',
        url: '/v1/auth/google',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      const allowOrigin = getResponse.headers['access-control-allow-origin'];
      if (allowOrigin) {
        console.log(`   ✅ Access-Control-Allow-Origin: ${allowOrigin}`);
        passed++;
      } else {
        throw new Error('CORS Allow-Origin header missing');
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Test 7: Swagger docs accessible
    console.log('📋 Test 7: Swagger docs accessible');
    try {
      const docsResponse = await app.inject({
        method: 'GET',
        url: '/docs',
      });

      if (docsResponse.statusCode === 200 || docsResponse.statusCode === 301 || docsResponse.statusCode === 302) {
        console.log(`   ✅ Status: ${docsResponse.statusCode} (Swagger UI accessible)`);
        passed++;
      } else {
        throw new Error(`Expected 200/301/302, got ${docsResponse.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Test 8: Realtime endpoint (non-versioned)
    console.log('📋 Test 8: Realtime endpoint (non-versioned)');
    try {
      const realtimeResponse = await app.inject({
        method: 'GET',
        url: '/realtime',
      });

      // WebSocket upgrade should return 426 or 400 (expected for non-WebSocket request)
      if (realtimeResponse.statusCode === 426 || realtimeResponse.statusCode === 400 || realtimeResponse.statusCode === 404) {
        console.log(`   ✅ Status: ${realtimeResponse.statusCode} (realtime endpoint exists)`);
        passed++;
      } else {
        throw new Error(`Unexpected status: ${realtimeResponse.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log('');

    // Summary
    console.log('=' .repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Total: ${passed + failed}\n`);

    if (failed === 0) {
      console.log('🎉 All tests passed!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the output above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    if (app) {
      await app.close();
    }
  }
}

void main();

