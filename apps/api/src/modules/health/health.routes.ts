import { FastifyInstance } from 'fastify';
import { redis } from '../../lib/redis.js';

/**
 * Registers health check routes
 * - GET /health/basic - Basic liveness check
 * - GET /health/redis - Redis health check
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // Basic health check endpoint
  app.get('/health/basic', {
    schema: {
      tags: ['Health'],
      summary: 'Basic liveness check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return { status: 'ok' };
  });

  // Redis health check endpoint
  app.get('/health/redis', {
    schema: {
      tags: ['Health'],
      summary: 'Redis health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            redis: {
              type: 'object',
              properties: {
                ping: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const ping = await redis.ping();
    return reply.status(200).send({
      status: ping === 'PONG' ? 'ok' : 'degraded',
      redis: { ping },
    });
  });
}

