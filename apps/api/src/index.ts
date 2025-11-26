import Fastify from 'fastify';
import { appConfig } from './config/index.js';
import { logger } from './lib/logger.js';
import { globalErrorHandler, notFoundHandler } from './lib/error-handler.js';

const fastify = Fastify({
  logger,
});

// Register global error handler
fastify.setErrorHandler(globalErrorHandler);

// Register 404 handler
fastify.setNotFoundHandler(notFoundHandler);

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

