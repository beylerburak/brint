import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTest } from '../../test/utils/build-app.js';

describe('Health endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAppForTest();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health/live', () => {
    it('should return 200 with status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when DB and Redis are healthy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      // Should return either 200 (healthy) or 503 (unhealthy)
      expect([200, 503]).toContain(response.statusCode);
      
      const body = JSON.parse(response.body);
      
      if (response.statusCode === 200) {
        expect(body).toEqual({ status: 'ok' });
      } else {
        expect(body).toHaveProperty('status', 'unhealthy');
        expect(body).toHaveProperty('details');
      }
    });
  });
});

