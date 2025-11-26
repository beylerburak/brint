import Fastify from 'fastify';
import { appConfig } from './config/index.js';
import { logger } from './lib/logger.js';

const fastify = Fastify({
  logger,
});

// Health check endpoint
fastify.get('/health/basic', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: appConfig.port, host: appConfig.host });
    logger.info({ host: appConfig.host, port: appConfig.port }, 'API server started');
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
};

start();

