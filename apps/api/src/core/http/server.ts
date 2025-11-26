import Fastify, { FastifyInstance } from 'fastify';
import { logger } from '../../lib/logger.js';
import { globalErrorHandler, notFoundHandler } from '../../lib/error-handler.js';
import swaggerPlugin from '../../plugins/swagger.js';
import { registerHealthRoutes } from '../../modules/health/health.routes.js';

/**
 * Creates and configures a Fastify server instance
 * - Sets up global error handlers
 * - Registers plugins (Swagger)
 * - Registers module routes (Health)
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ 
    logger: logger as any 
  });

  // Register global error handler
  app.setErrorHandler(globalErrorHandler);

  // Register 404 handler
  app.setNotFoundHandler(notFoundHandler);

  // Register Swagger plugin BEFORE defining routes
  await app.register(swaggerPlugin);

  // Register module routes
  await registerHealthRoutes(app);

  return app;
}

