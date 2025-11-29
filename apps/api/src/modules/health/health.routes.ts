import { FastifyInstance } from 'fastify';
import { redis } from '../../lib/redis.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getRequestId } from '../../core/http/request-id.js';

/**
 * Registers health check routes
 * - GET /health/live - Liveness check (process is running)
 * - GET /health/ready - Readiness check (dependencies are healthy)
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness check - process is running
  app.get('/health/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness check',
      description: 'Returns ok if the process is running',
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
    return reply.status(200).send({ status: 'ok' });
  });

  // Readiness check - dependencies are healthy
  app.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness check',
      description: 'Returns ok if all dependencies (DB, Redis) are healthy',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            details: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const requestId = getRequestId(request);
    const checks: Record<string, string> = {};
    let allHealthy = true;

    // Check PostgreSQL connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch (error) {
      checks.db = 'down';
      allHealthy = false;
      logger.error(
        {
          msg: 'Database health check failed',
          requestId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Readiness check: DB failed'
      );
    }

    // Check Redis connection
    try {
      const ping = await redis.ping();
      checks.redis = ping === 'PONG' ? 'ok' : 'down';
      if (ping !== 'PONG') {
        allHealthy = false;
      }
    } catch (error) {
      checks.redis = 'down';
      allHealthy = false;
      logger.error(
        {
          msg: 'Redis health check failed',
          requestId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Readiness check: Redis failed'
      );
    }

    if (allHealthy) {
      return reply.status(200).send({ status: 'ok' });
    } else {
      logger.error(
        {
          msg: 'Readiness check failed',
          requestId,
          details: checks,
        },
        'Health check: Service unhealthy'
      );
      return reply.status(503).send({
        status: 'unhealthy',
        details: checks,
      });
    }
  });
}

