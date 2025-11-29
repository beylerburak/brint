import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { sessionService } from './session.service.js';
import { prisma } from '../../lib/prisma.js';

describe('SessionService', () => {
  let testUserId: string;
  let createdSessionIds: string[] = [];

  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `session-test-user-${Date.now()}@example.com`,
        name: 'Session Test User',
        emailVerified: new Date(),
        locale: 'en',
        timezone: 'UTC',
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  beforeEach(() => {
    createdSessionIds = [];
  });

  afterEach(async () => {
    // Cleanup sessions
    for (const tid of createdSessionIds) {
      await prisma.session.delete({ where: { id: tid } }).catch(() => {});
    }
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const tid = `session-${Date.now()}`;
      const session = await sessionService.createSession({
        userId: testUserId,
        tid,
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      });

      createdSessionIds.push(tid);

      expect(session).toHaveProperty('id', tid);
      expect(session).toHaveProperty('userId', testUserId);
      expect(session).toHaveProperty('userAgent', 'Mozilla/5.0');
      expect(session).toHaveProperty('ipAddress', '127.0.0.1');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('lastActiveAt');
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create session without optional fields', async () => {
      const tid = `session-${Date.now()}`;
      const session = await sessionService.createSession({
        userId: testUserId,
        tid,
      });

      createdSessionIds.push(tid);

      expect(session).toHaveProperty('id', tid);
      expect(session).toHaveProperty('userId', testUserId);
      expect(session.userAgent).toBeNull();
      expect(session.ipAddress).toBeNull();
    });

    it('should update existing session if tid already exists', async () => {
      const tid = `session-${Date.now()}`;
      
      // Create first session
      const firstSession = await sessionService.createSession({
        userId: testUserId,
        tid,
        userAgent: 'Mozilla/5.0',
      });
      createdSessionIds.push(tid);

      // Create again with same tid (should update)
      const secondSession = await sessionService.createSession({
        userId: testUserId,
        tid,
        userAgent: 'Chrome/1.0',
        ipAddress: '192.168.1.1',
      });

      expect(secondSession.id).toBe(firstSession.id);
      expect(secondSession.userAgent).toBe('Chrome/1.0');
      expect(secondSession.ipAddress).toBe('192.168.1.1');
      // ExpiresAt should be updated
      expect(secondSession.expiresAt.getTime()).toBeGreaterThan(firstSession.expiresAt.getTime());
    });
  });

  describe('revokeSession', () => {
    it('should delete an existing session', async () => {
      const tid = `session-${Date.now()}`;
      await sessionService.createSession({
        userId: testUserId,
        tid,
      });

      await sessionService.revokeSession(tid);

      // Verify session is deleted
      const session = await prisma.session.findUnique({
        where: { id: tid },
      });
      expect(session).toBeNull();
    });

    it('should be idempotent (no error if session does not exist)', async () => {
      const tid = `non-existent-session-${Date.now()}`;
      
      // Should not throw
      await expect(sessionService.revokeSession(tid)).resolves.not.toThrow();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      // Create multiple sessions
      const tid1 = `session-1-${Date.now()}`;
      const tid2 = `session-2-${Date.now()}`;
      const tid3 = `session-3-${Date.now()}`;

      await sessionService.createSession({ userId: testUserId, tid: tid1 });
      await sessionService.createSession({ userId: testUserId, tid: tid2 });
      await sessionService.createSession({ userId: testUserId, tid: tid3 });

      createdSessionIds.push(tid1, tid2, tid3);

      // Revoke all sessions
      await sessionService.revokeAllUserSessions(testUserId);

      // Verify all sessions are deleted
      const sessions = await prisma.session.findMany({
        where: { userId: testUserId },
      });
      expect(sessions.length).toBe(0);
    });

    it('should not affect other users sessions', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: `other-user-${Date.now()}@example.com`,
          name: 'Other User',
          emailVerified: new Date(),
          locale: 'en',
          timezone: 'UTC',
        },
      });

      try {
        const tid1 = `session-test-${Date.now()}`;
        const tid2 = `session-other-${Date.now()}`;

        await sessionService.createSession({ userId: testUserId, tid: tid1 });
        await sessionService.createSession({ userId: otherUser.id, tid: tid2 });

        // Revoke only test user's sessions
        await sessionService.revokeAllUserSessions(testUserId);

        // Test user's session should be deleted
        const testSession = await prisma.session.findUnique({
          where: { id: tid1 },
        });
        expect(testSession).toBeNull();

        // Other user's session should still exist
        const otherSession = await prisma.session.findUnique({
          where: { id: tid2 },
        });
        expect(otherSession).not.toBeNull();

        // Cleanup
        await prisma.session.delete({ where: { id: tid2 } });
      } finally {
        await prisma.user.delete({ where: { id: otherUser.id } });
      }
    });
  });

  describe('touchSession', () => {
    it('should update lastActiveAt timestamp', async () => {
      const tid = `session-${Date.now()}`;
      const session = await sessionService.createSession({
        userId: testUserId,
        tid,
      });
      createdSessionIds.push(tid);

      const originalLastActiveAt = session.lastActiveAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await sessionService.touchSession(tid);

      const updatedSession = await prisma.session.findUnique({
        where: { id: tid },
      });

      expect(updatedSession).not.toBeNull();
      expect(updatedSession!.lastActiveAt.getTime()).toBeGreaterThan(originalLastActiveAt.getTime());
    });

    it('should be idempotent (no error if session does not exist)', async () => {
      const tid = `non-existent-session-${Date.now()}`;
      
      // Should not throw
      await expect(sessionService.touchSession(tid)).resolves.not.toThrow();
    });
  });
});
