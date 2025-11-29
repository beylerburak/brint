import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTest } from '../../test/utils/build-app.js';
import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';

describe('User endpoints', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let testUserToken: string;

  beforeAll(async () => {
    app = await buildAppForTest();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-user-${Date.now()}@example.com`,
        name: 'Test User',
        emailVerified: new Date(),
        locale: 'en',
        timezone: 'UTC',
      },
    });
    testUserId = testUser.id;
    testUserToken = tokenService.signAccessToken({ sub: testUser.id });
  });

  afterEach(async () => {
    // Cleanup test user
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  describe('GET /v1/users/me', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 200 with user data when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id', testUserId);
      expect(body.data).toHaveProperty('email');
      expect(body.data).toHaveProperty('name', 'Test User');
      expect(body.data).toHaveProperty('locale', 'en');
      expect(body.data).toHaveProperty('timezone', 'UTC');
    });

    it('should return 404 if user not found', async () => {
      // Delete the user first
      await prisma.user.delete({ where: { id: testUserId } });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');

      // Prevent afterEach from trying to delete again
      testUserId = '';
    });
  });

  describe('PATCH /v1/users/me', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should update user name successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
    });

    it('should update user locale and timezone', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: { 
          locale: 'tr',
          timezone: 'Europe/Istanbul',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.locale).toBe('tr');
      expect(body.data.timezone).toBe('Europe/Istanbul');
    });

    it('should update completedOnboarding flag', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/users/me',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: { completedOnboarding: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.completedOnboarding).toBe(true);
      expect(body.data.firstOnboardedAt).toBeTruthy();
    });
  });

  describe('GET /v1/users/check-username/:username', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/users/check-username/testuser',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return available: true for unused username', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/users/check-username/unused-${Date.now()}`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.available).toBe(true);
    });

    it('should return available: false for taken username', async () => {
      // First set a username for the test user
      const username = `taken-${Date.now()}`;
      await prisma.user.update({
        where: { id: testUserId },
        data: { username },
      });

      // Create another user to check the username
      const otherUser = await prisma.user.create({
        data: {
          email: `other-${Date.now()}@example.com`,
          name: 'Other User',
          emailVerified: new Date(),
          locale: 'en',
          timezone: 'UTC',
        },
      });
      const otherUserToken = tokenService.signAccessToken({ sub: otherUser.id });

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/v1/users/check-username/${username}`,
          headers: {
            Authorization: `Bearer ${otherUserToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.available).toBe(false);
      } finally {
        await prisma.user.delete({ where: { id: otherUser.id } }).catch(() => {});
      }
    });

    it('should return available: true for own username', async () => {
      // Set username for test user
      const username = `myown-${Date.now()}`;
      await prisma.user.update({
        where: { id: testUserId },
        data: { username },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/users/check-username/${username}`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.available).toBe(true);
    });
  });
});

