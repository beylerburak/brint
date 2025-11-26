/**
 * Session Service Tests (TS-21.5)
 *
 * Smoke tests for session service using temporary test data.
 * Run with: cd apps/api && pnpm exec tsx src/core/auth/session.service.spec.ts
 */

import { prisma } from '../../lib/prisma.js';
import { sessionService } from './session.service.js';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🧪 Starting TS-21.5 session service tests...\n');

  let testUserId: string | null = null;
  const testSessionTids: string[] = [];

  try {
    // Test 1: createSession & fetch
    console.log('📋 Test 1: createSession & fetch');
    const timestamp = Date.now();
    const testUser = await prisma.user.create({
      data: {
        email: `session-test+${timestamp}@example.com`,
        name: 'Session Test User',
      },
    });
    testUserId = testUser.id;

    const tid1 = randomUUID();
    const userAgent = 'Mozilla/5.0 (Test Browser)';
    const ipAddress = '192.168.1.1';

    const session = await sessionService.createSession({
      userId: testUser.id,
      tid: tid1,
      userAgent,
      ipAddress,
    });
    testSessionTids.push(tid1);

    // Verify session in DB
    const dbSession = await prisma.session.findUnique({
      where: { id: tid1 },
    });

    if (!dbSession) {
      throw new Error('Session not found in database');
    }

    if (dbSession.id !== tid1) {
      throw new Error(`Expected session id ${tid1}, got ${dbSession.id}`);
    }

    if (dbSession.userId !== testUser.id) {
      throw new Error(
        `Expected userId ${testUser.id}, got ${dbSession.userId}`
      );
    }

    if (dbSession.userAgent !== userAgent) {
      throw new Error(
        `Expected userAgent ${userAgent}, got ${dbSession.userAgent}`
      );
    }

    if (dbSession.ipAddress !== ipAddress) {
      throw new Error(
        `Expected ipAddress ${ipAddress}, got ${dbSession.ipAddress}`
      );
    }

    // Check expiresAt is in the future
    const now = new Date();
    if (dbSession.expiresAt <= now) {
      throw new Error(
        `Expected expiresAt to be in the future, got ${dbSession.expiresAt.toISOString()}`
      );
    }

    console.log('   ✅ Session created successfully');
    console.log(`   ✅ Session id matches tid: ${tid1}`);
    console.log(`   ✅ UserId matches: ${testUser.id}`);
    console.log(`   ✅ ExpiresAt is in the future: ${dbSession.expiresAt.toISOString()}\n`);

    // Test 2: revokeSession
    console.log('📋 Test 2: revokeSession');
    const tid2 = randomUUID();
    await sessionService.createSession({
      userId: testUser.id,
      tid: tid2,
      userAgent: null,
      ipAddress: null,
    });
    testSessionTids.push(tid2);

    // Verify session exists
    const sessionBeforeRevoke = await prisma.session.findUnique({
      where: { id: tid2 },
    });
    if (!sessionBeforeRevoke) {
      throw new Error('Session should exist before revoke');
    }

    // Revoke the session
    await sessionService.revokeSession(tid2);

    // Verify session is deleted
    const sessionAfterRevoke = await prisma.session.findUnique({
      where: { id: tid2 },
    });
    if (sessionAfterRevoke) {
      throw new Error('Session should be deleted after revoke');
    }

    // Test idempotency: revoke non-existent session
    await sessionService.revokeSession('non-existent-tid');

    console.log('   ✅ Session revoked successfully');
    console.log('   ✅ Idempotent revoke (non-existent session) handled gracefully\n');

    // Test 3: revokeAllUserSessions
    console.log('📋 Test 3: revokeAllUserSessions');
    const tid3 = randomUUID();
    const tid4 = randomUUID();
    const tid5 = randomUUID();

    await sessionService.createSession({
      userId: testUser.id,
      tid: tid3,
    });
    testSessionTids.push(tid3);

    await sessionService.createSession({
      userId: testUser.id,
      tid: tid4,
    });
    testSessionTids.push(tid4);

    await sessionService.createSession({
      userId: testUser.id,
      tid: tid5,
    });
    testSessionTids.push(tid5);

    // Verify we have multiple sessions
    const sessionsBeforeRevokeAll = await prisma.session.findMany({
      where: { userId: testUser.id },
    });
    if (sessionsBeforeRevokeAll.length < 3) {
      throw new Error(
        `Expected at least 3 sessions, got ${sessionsBeforeRevokeAll.length}`
      );
    }

    // Revoke all user sessions
    await sessionService.revokeAllUserSessions(testUser.id);

    // Verify all sessions are deleted
    const sessionsAfterRevokeAll = await prisma.session.findMany({
      where: { userId: testUser.id },
    });
    if (sessionsAfterRevokeAll.length !== 0) {
      throw new Error(
        `Expected 0 sessions after revokeAll, got ${sessionsAfterRevokeAll.length}`
      );
    }

    console.log('   ✅ All user sessions revoked successfully');
    console.log(`   ✅ Remaining sessions for user: ${sessionsAfterRevokeAll.length}\n`);

    // Test 4: touchSession
    console.log('📋 Test 4: touchSession');
    const tid6 = randomUUID();
    const newSession = await sessionService.createSession({
      userId: testUser.id,
      tid: tid6,
    });
    testSessionTids.push(tid6);

    const initialLastActiveAt = newSession.lastActiveAt;
    console.log(`   Initial lastActiveAt: ${initialLastActiveAt.toISOString()}`);

    // Wait a bit (at least 1 second) to ensure time difference
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Touch the session
    await sessionService.touchSession(tid6);

    // Verify lastActiveAt is updated
    const touchedSession = await prisma.session.findUnique({
      where: { id: tid6 },
    });
    if (!touchedSession) {
      throw new Error('Session should exist after touch');
    }

    if (touchedSession.lastActiveAt <= initialLastActiveAt) {
      throw new Error(
        `Expected lastActiveAt to be greater than initial value. Initial: ${initialLastActiveAt.toISOString()}, After touch: ${touchedSession.lastActiveAt.toISOString()}`
      );
    }

    // Test idempotency: touch non-existent session
    await sessionService.touchSession('non-existent-tid-2');

    console.log('   ✅ Session touched successfully');
    console.log(`   ✅ lastActiveAt updated: ${touchedSession.lastActiveAt.toISOString()}`);
    console.log('   ✅ Idempotent touch (non-existent session) handled gracefully\n');

    // Test 5: createSession idempotency (create with existing tid)
    console.log('📋 Test 5: createSession idempotency');
    const tid7 = randomUUID();
    const session1 = await sessionService.createSession({
      userId: testUser.id,
      tid: tid7,
      userAgent: 'Agent1',
    });
    testSessionTids.push(tid7);

    // Try to create again with same tid but different userAgent
    const session2 = await sessionService.createSession({
      userId: testUser.id,
      tid: tid7,
      userAgent: 'Agent2',
    });

    if (session1.id !== session2.id) {
      throw new Error('Session id should remain the same when creating with existing tid');
    }

    // Verify the session was updated (not created)
    const finalSession = await prisma.session.findUnique({
      where: { id: tid7 },
    });
    if (!finalSession) {
      throw new Error('Session should exist');
    }

    if (finalSession.userAgent !== 'Agent2') {
      throw new Error(
        `Expected userAgent to be updated to 'Agent2', got ${finalSession.userAgent}`
      );
    }

    // Verify we still have only one session with this tid
    const allSessionsWithTid7 = await prisma.session.findMany({
      where: { id: tid7 },
    });
    if (allSessionsWithTid7.length !== 1) {
      throw new Error(
        `Expected 1 session with tid ${tid7}, got ${allSessionsWithTid7.length}`
      );
    }

    console.log('   ✅ createSession is idempotent (updates existing session)');
    console.log(`   ✅ Session updated correctly: userAgent = ${finalSession.userAgent}\n`);

    console.log('🎉 TS-21.5 session service tests: OK');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup: delete test sessions and user
    try {
      // Delete any remaining test sessions
      if (testSessionTids.length > 0) {
        await prisma.session.deleteMany({
          where: {
            id: {
              in: testSessionTids,
            },
          },
        });
      }

      // Delete all sessions for test user (in case some weren't tracked)
      if (testUserId) {
        await prisma.session.deleteMany({
          where: { userId: testUserId },
        });
      }

      // Delete test user
      if (testUserId) {
        await prisma.user.delete({
          where: { id: testUserId },
        }).catch(() => {
          // Ignore errors during cleanup
        });
      }
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError);
      // Don't throw - cleanup errors are non-fatal
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});

