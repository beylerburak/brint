import Fastify from 'fastify';
import { appConfig } from './config/index.js';
import { logger } from './lib/logger.js';
import { globalErrorHandler, notFoundHandler } from './lib/error-handler.js';
import { redis } from './lib/redis.js';
import swaggerPlugin from './plugins/swagger.js';

const fastify = Fastify({
  logger,
});

// Register global error handler
fastify.setErrorHandler(globalErrorHandler);

// Register 404 handler
fastify.setNotFoundHandler(notFoundHandler);

// Health check endpoint
fastify.get('/health/basic', {
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
fastify.get('/health/redis', {
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

const start = async () => {
  try {
    // Register Swagger plugin before starting server
    await fastify.register(swaggerPlugin);
    
    await fastify.listen({ port: appConfig.port, host: appConfig.host });
    logger.info({ host: appConfig.host, port: appConfig.port }, 'API server started');
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
};

start();

