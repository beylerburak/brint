import Fastify, { FastifyInstance } from 'fastify';
import { logger } from '../../lib/logger.js';
import { globalErrorHandler, notFoundHandler } from '../../lib/error-handler.js';
import swaggerPlugin from '../../plugins/swagger.js';
import cookiePlugin from '../../plugins/cookie.js';
import authContextPlugin from '../auth/auth.context.js';
import { registerHealthRoutes } from '../../modules/health/health.routes.js';
import { registerDebugRoutes } from '../../modules/debug/debug.routes.js';
import { registerAuthRoutes } from '../../modules/auth/auth.routes.js';
import { registerStudioRoutes } from '../../modules/studio/studio.routes.js';

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

  // Register cookie plugin
  await app.register(cookiePlugin);

  // Register auth context plugin (runs before all routes)
  await app.register(authContextPlugin);

  // Register module routes
  await registerHealthRoutes(app);
  await registerDebugRoutes(app);
  await registerAuthRoutes(app);
  await app.register(registerStudioRoutes, { prefix: '/studio' });

  return app;
}

