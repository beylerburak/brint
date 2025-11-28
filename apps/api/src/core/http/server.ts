import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { logger } from '../../lib/logger.js';
import { globalErrorHandler, notFoundHandler } from '../../lib/error-handler.js';
import swaggerPlugin from '../../plugins/swagger.js';
import cookiePlugin from '../../plugins/cookie.js';
import authContextPlugin from '../auth/auth.context.js';
import { registerHealthRoutes } from '../../modules/health/health.routes.js';
import { registerDebugRoutes } from '../../modules/debug/debug.routes.js';
import { registerAuthRoutes } from '../../modules/auth/auth.routes.js';
import { registerStudioRoutes } from '../../modules/studio/studio.routes.js';
import { registerUserRoutes } from '../../modules/user/user.routes.js';
import { workspaceInviteRoutes } from '../../modules/workspace/workspace-invite.routes.js';
import { registerSubscriptionRoutes } from '../../modules/workspace/subscription.routes.js';
import { registerWorkspaceMemberRoutes } from '../../modules/workspace/workspace-member.routes.js';
import { registerWorkspaceRoleRoutes } from '../../modules/workspace/workspace-role.routes.js';
import { registerUsageRoutes } from '../../modules/workspace/usage.routes.js';
import { registerWorkspaceRoutes } from '../../modules/workspace/workspace.routes.js';
import { appConfig } from '../../config/index.js';
import { registerMediaRoutes } from '../../modules/media/media.routes.js';

/**
 * Creates and configures a Fastify server instance
 * - Sets up global error handlers
 * - Registers plugins (Swagger)
 * - Registers module routes (Health)
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ 
    logger,
  });

  // Register global error handler
  app.setErrorHandler(globalErrorHandler);

  // Register 404 handler
  app.setNotFoundHandler(notFoundHandler);

  // Register CORS plugin (must be before other plugins)
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return cb(null, true);
      }

      // In development, allow localhost on any port
      if (appConfig.env === 'development') {
        const hostname = new URL(origin).hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return cb(null, true);
        }
      }

      // In production, you would check against a whitelist
      // For now, allow all origins in development
      if (appConfig.env === 'development') {
        return cb(null, true);
      }

      // Reject in production if not whitelisted
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
  });

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
  await registerStudioRoutes(app);
  await registerUserRoutes(app);
  await registerSubscriptionRoutes(app);
  await registerWorkspaceMemberRoutes(app);
  await registerWorkspaceRoleRoutes(app);
  await workspaceInviteRoutes(app);
  await registerUsageRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerMediaRoutes(app);

  return app;
}
