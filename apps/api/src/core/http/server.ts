import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { logger } from '../../lib/logger.js';
import { globalErrorHandler, notFoundHandler } from '../../lib/error-handler.js';
import multipart from '@fastify/multipart';
import swaggerPlugin from '../../plugins/swagger.js';
import cookiePlugin from '../../plugins/cookie.js';
import authContextPlugin from '../auth/auth.context.js';
import { registerHealthRoutes } from '../../modules/health/health.routes.js';
import { registerAuthRoutes } from '../../modules/auth/auth.routes.js';
import { registerWorkspaceRoutes } from '../../modules/workspace/workspace.routes.js';
import { registerBrandRoutes } from '../../modules/brand/brand.routes.js';
import { registerMediaRoutes } from '../../modules/media/media.routes.js';
import { registerUserRoutes } from '../../modules/user/user.routes.js';
import { registerCommentRoutes } from '../../modules/comment/comment.routes.js';
import { registerProjectRoutes } from '../../modules/project/project.routes.js';
import { registerTaskRoutes } from '../../modules/task/task.routes.js';
import { registerTaskStatusRoutes } from '../../modules/task/task-status.routes.js';
import { registerTaskWebSocketRoutes } from '../../modules/task/task-websocket.routes.js';

/**
 * Creates and configures a Fastify server instance
 * - Sets up global error handlers
 * - Registers plugins (CORS, Swagger, Cookies)
 * - Registers module routes (Health, Auth, Studio)
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ 
    logger: logger as any 
  });

  // Register CORS plugin (must be first)
  await app.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      // Add production frontend URL from env if exists
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Brand-Id'],
  });

  // Register global error handler
  app.setErrorHandler(globalErrorHandler);

  // Register 404 handler
  app.setNotFoundHandler(notFoundHandler);

  // Register Swagger plugin BEFORE defining routes
  await app.register(swaggerPlugin);

  // Register cookie plugin
  await app.register(cookiePlugin);

  // Register multipart plugin for file uploads
  const { APP_CONFIG } = await import('../../config/app-config.js');
  await app.register(multipart, {
    limits: {
      fileSize: APP_CONFIG.media.upload.maxFileSizeBytes,
    },
  });

  // Register auth context plugin (runs before all routes)
  await app.register(authContextPlugin);

  // Register module routes
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerBrandRoutes(app);
  await registerMediaRoutes(app);
  await registerCommentRoutes(app);
  await registerProjectRoutes(app);
  await registerTaskRoutes(app);
  await registerTaskStatusRoutes(app);
  await registerTaskWebSocketRoutes(app);

  return app;
}

