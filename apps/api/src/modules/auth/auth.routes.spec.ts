import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTest } from '../../test/utils/build-app.js';

describe('Auth endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAppForTest();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/auth/magic-link', () => {
    it('should return 200 with success message for valid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: { email: 'test@example.com' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message');
      expect(typeof body.message).toBe('string');
    });

    it('should return 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: { email: '' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
    });

    it('should accept optional redirectTo parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/magic-link',
        payload: { 
          email: 'test@example.com',
          redirectTo: '/dashboard'
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
    });
  });

  describe('GET /v1/auth/google', () => {
    it('should return 200 with redirectUrl', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/google',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('redirectUrl');
      expect(typeof body.redirectUrl).toBe('string');
      expect(body.redirectUrl).toContain('accounts.google.com');
    });
  });
});

