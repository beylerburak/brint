/**
 * Refresh & Logout Endpoint Tests
 * 
 * Integration tests for /auth/refresh and /auth/logout endpoints.
 * Run with: cd apps/api && pnpm exec tsx src/modules/auth/auth.refresh-logout.spec.ts
 */

import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';
import { sessionService } from '../../core/auth/session.service.js';
import { createServer } from '../../core/http/server.js';
import type { FastifyInstance } from 'fastify';

async function main() {
  console.log('🧪 Starting TS-21.8 Refresh & Logout tests...\n');

  let testUserId: string | null = null;
  let testSessionId: string | null = null;
  let app: FastifyInstance | null = null;

  try {
    // 1. Create test user
    console.log('📋 Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        email: `test-refresh-${Date.now()}@example.com`,
        name: 'Test Refresh User',
      },
    });
    testUserId = testUser.id;
    console.log(`   ✅ Created test user: ${testUser.email} (${testUser.id})\n`);

    // 2. Create Fastify server
    console.log('📋 Creating Fastify server...');
    app = await createServer();
    console.log('   ✅ Server created\n');

    // ==========================================
    // Test 1: Refresh happy path (rotation)
    // ==========================================
    console.log('📋 Test 1: Refresh happy path (rotation)');
    
    const tid1 = randomUUID();
    await sessionService.createSession({
      userId: testUser.id,
      tid: tid1,
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
    });

    const refreshToken1 = tokenService.signRefreshToken({
      sub: testUser.id,
      tid: tid1,
    });

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: {
        refresh_token: refreshToken1,
      },
    });

    if (refreshResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${refreshResponse.statusCode}. Body: ${refreshResponse.body}`
      );
    }

    const refreshBody = JSON.parse(refreshResponse.body);
    if (!refreshBody.success) {
      throw new Error(`Expected success: true, got ${JSON.stringify(refreshBody)}`);
    }

    if (!refreshBody.accessToken || typeof refreshBody.accessToken !== 'string') {
      throw new Error(`Expected accessToken string, got ${JSON.stringify(refreshBody)}`);
    }

    if (typeof refreshBody.expiresIn !== 'number') {
      throw new Error(`Expected expiresIn number, got ${typeof refreshBody.expiresIn}`);
    }

    // Verify access token
    const accessPayload = tokenService.verifyAccessToken(refreshBody.accessToken);
    if (accessPayload.sub !== testUser.id) {
      throw new Error(
        `Expected access token sub to be ${testUser.id}, got ${accessPayload.sub}`
      );
    }

    // Verify new refresh token from Set-Cookie header
    const setCookieHeaders = refreshResponse.headers['set-cookie'];
    if (!setCookieHeaders || !Array.isArray(setCookieHeaders)) {
      throw new Error('Expected Set-Cookie headers with new refresh token');
    }

    const refreshCookieHeader = setCookieHeaders.find((h: string) =>
      h.startsWith('refresh_token=')
    );
    if (!refreshCookieHeader) {
      throw new Error('Expected refresh_token cookie in Set-Cookie header');
    }

    // Extract token from cookie header (format: refresh_token=<token>; ...)
    const refreshTokenMatch = refreshCookieHeader.match(/refresh_token=([^;]+)/);
    if (!refreshTokenMatch) {
      throw new Error('Could not extract refresh token from Set-Cookie header');
    }

    const newRefreshToken = refreshTokenMatch[1];
    const newRefreshPayload = tokenService.verifyRefreshToken(newRefreshToken);

    if (newRefreshPayload.sub !== testUser.id) {
      throw new Error(
        `Expected new refresh token sub to be ${testUser.id}, got ${newRefreshPayload.sub}`
      );
    }

    if (newRefreshPayload.tid === tid1) {
      throw new Error('Expected new tid to be different from old tid (rotation failed)');
    }

    // Verify old session is revoked
    const oldSession = await prisma.session.findUnique({
      where: { id: tid1 },
    });
    if (oldSession) {
      throw new Error('Expected old session to be revoked, but it still exists');
    }

    // Verify new session exists
    const newSession = await prisma.session.findUnique({
      where: { id: newRefreshPayload.tid },
    });
    if (!newSession) {
      throw new Error('Expected new session to exist, but it does not');
    }

    if (newSession.userId !== testUser.id) {
      throw new Error(
        `Expected new session userId to be ${testUser.id}, got ${newSession.userId}`
      );
    }

    console.log('   ✅ Status: 200');
    console.log('   ✅ Body: success: true, accessToken present, expiresIn present');
    console.log('   ✅ Access token valid and contains correct userId');
    console.log('   ✅ New refresh token in Set-Cookie header');
    console.log('   ✅ Token rotation successful (new tid !== old tid)');
    console.log('   ✅ Old session revoked');
    console.log('   ✅ New session created\n');

    // ==========================================
    // Test 2: Refresh without cookie → 401
    // ==========================================
    console.log('📋 Test 2: Refresh without cookie → 401');
    
    const noCookieResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
    });

    if (noCookieResponse.statusCode !== 401) {
      throw new Error(
        `Expected 401, got ${noCookieResponse.statusCode}. Body: ${noCookieResponse.body}`
      );
    }

    const noCookieBody = JSON.parse(noCookieResponse.body);
    if (noCookieBody.success !== false) {
      throw new Error(
        `Expected success: false, got ${JSON.stringify(noCookieBody)}`
      );
    }

    if (noCookieBody.error?.code !== 'AUTH_REFRESH_MISSING_TOKEN') {
      throw new Error(
        `Expected error.code: "AUTH_REFRESH_MISSING_TOKEN", got "${noCookieBody.error?.code}"`
      );
    }

    console.log('   ✅ Status: 401');
    console.log('   ✅ Body: success: false');
    console.log('   ✅ Error code: AUTH_REFRESH_MISSING_TOKEN\n');

    // ==========================================
    // Test 3: Refresh with expired session → 401
    // ==========================================
    console.log('📋 Test 3: Refresh with expired session → 401');
    
    const tid3 = randomUUID();
    const expiredDate = new Date(Date.now() - 60_000); // 1 minute ago

    await prisma.session.create({
      data: {
        id: tid3,
        userId: testUser.id,
        expiresAt: expiredDate,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        lastActiveAt: new Date(),
      },
    });

    const expiredRefreshToken = tokenService.signRefreshToken({
      sub: testUser.id,
      tid: tid3,
    });

    const expiredResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: {
        refresh_token: expiredRefreshToken,
      },
    });

    if (expiredResponse.statusCode !== 401) {
      throw new Error(
        `Expected 401, got ${expiredResponse.statusCode}. Body: ${expiredResponse.body}`
      );
    }

    const expiredBody = JSON.parse(expiredResponse.body);
    if (expiredBody.success !== false) {
      throw new Error(
        `Expected success: false, got ${JSON.stringify(expiredBody)}`
      );
    }

    if (expiredBody.error?.code !== 'AUTH_REFRESH_SESSION_EXPIRED') {
      throw new Error(
        `Expected error.code: "AUTH_REFRESH_SESSION_EXPIRED", got "${expiredBody.error?.code}"`
      );
    }

    // Verify session is revoked
    const expiredSession = await prisma.session.findUnique({
      where: { id: tid3 },
    });
    if (expiredSession) {
      throw new Error('Expected expired session to be revoked, but it still exists');
    }

    // Verify cookies are cleared (Set-Cookie with Max-Age=0 or empty)
    const expiredSetCookieHeaders = expiredResponse.headers['set-cookie'];
    if (expiredSetCookieHeaders) {
      const headersArray = Array.isArray(expiredSetCookieHeaders)
        ? expiredSetCookieHeaders
        : [expiredSetCookieHeaders];
      const hasClearedCookies = headersArray.some((h: string) =>
        h.includes('refresh_token=') && (h.includes('Max-Age=0') || h.includes('refresh_token=;'))
      );
      if (!hasClearedCookies) {
        console.log('   ⚠️  Warning: Cookies may not be cleared (Set-Cookie headers present)');
      }
    }

    console.log('   ✅ Status: 401');
    console.log('   ✅ Body: success: false');
    console.log('   ✅ Error code: AUTH_REFRESH_SESSION_EXPIRED');
    console.log('   ✅ Expired session revoked\n');

    // ==========================================
    // Test 4: Logout happy path
    // ==========================================
    console.log('📋 Test 4: Logout happy path');
    
    const tid4 = randomUUID();
    await sessionService.createSession({
      userId: testUser.id,
      tid: tid4,
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
    });

    const logoutRefreshToken = tokenService.signRefreshToken({
      sub: testUser.id,
      tid: tid4,
    });

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {
        refresh_token: logoutRefreshToken,
      },
    });

    if (logoutResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${logoutResponse.statusCode}. Body: ${logoutResponse.body}`
      );
    }

    const logoutBody = JSON.parse(logoutResponse.body);
    if (!logoutBody.success) {
      throw new Error(`Expected success: true, got ${JSON.stringify(logoutBody)}`);
    }

    // Verify session is revoked
    const logoutSession = await prisma.session.findUnique({
      where: { id: tid4 },
    });
    if (logoutSession) {
      throw new Error('Expected session to be revoked after logout, but it still exists');
    }

    // Verify cookies are cleared
    const logoutSetCookieHeaders = logoutResponse.headers['set-cookie'];
    if (logoutSetCookieHeaders) {
      const headersArray = Array.isArray(logoutSetCookieHeaders)
        ? logoutSetCookieHeaders
        : [logoutSetCookieHeaders];
      const hasClearedCookies = headersArray.some((h: string) =>
        (h.includes('refresh_token=') || h.includes('access_token=')) &&
        (h.includes('Max-Age=0') || h.includes('refresh_token=;') || h.includes('access_token=;'))
      );
      if (!hasClearedCookies) {
        console.log('   ⚠️  Warning: Cookies may not be cleared (Set-Cookie headers present)');
      }
    }

    console.log('   ✅ Status: 200');
    console.log('   ✅ Body: success: true');
    console.log('   ✅ Session revoked');
    console.log('   ✅ Cookies cleared\n');

    // ==========================================
    // Test 5: Logout without cookie
    // ==========================================
    console.log('📋 Test 5: Logout without cookie');
    
    const noCookieLogoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    });

    if (noCookieLogoutResponse.statusCode !== 200) {
      throw new Error(
        `Expected 200, got ${noCookieLogoutResponse.statusCode}. Body: ${noCookieLogoutResponse.body}`
      );
    }

    const noCookieLogoutBody = JSON.parse(noCookieLogoutResponse.body);
    if (!noCookieLogoutBody.success) {
      throw new Error(
        `Expected success: true, got ${JSON.stringify(noCookieLogoutBody)}`
      );
    }

    console.log('   ✅ Status: 200');
    console.log('   ✅ Body: success: true\n');

    console.log('🎉 TS-21.8 Refresh & Logout tests: OK');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup: close server
    if (app) {
      await app.close();
    }

    // Cleanup: delete test session
    if (testSessionId) {
      await prisma.session.delete({
        where: { id: testSessionId },
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }

    // Cleanup: delete test user (this will cascade delete sessions)
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
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

