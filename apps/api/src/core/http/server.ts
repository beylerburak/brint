import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { logger } from '../../lib/logger.js';
import { globalErrorHandler, notFoundHandler } from '../../lib/error-handler.js';
import swaggerPlugin from '../../plugins/swagger.js';
import cookiePlugin from '../../plugins/cookie.js';
import authContextPlugin from '../auth/auth.context.js';
import { registerHealthRoutes } from '../../modules/health/health.routes.js';
import { registerDebugRoutes } from '../../modules/debug/debug.routes.js';
import { registerAuthRoutes } from '../../modules/auth/auth.routes.js';
import { registerUserRoutes } from '../../modules/user/user.routes.js';
import { workspaceInviteRoutes } from '../../modules/workspace/workspace-invite.routes.js';
import { registerSubscriptionRoutes } from '../../modules/workspace/subscription.routes.js';
import { registerWorkspaceMemberRoutes } from '../../modules/workspace/workspace-member.routes.js';
import { registerWorkspaceRoleRoutes } from '../../modules/workspace/workspace-role.routes.js';
import { registerUsageRoutes } from '../../modules/workspace/usage.routes.js';
import { registerWorkspaceRoutes } from '../../modules/workspace/workspace.routes.js';
import { appConfig } from '../../config/app-config.js';
import { registerMediaRoutes } from '../../modules/media/media.routes.js';
import { registerRealtimeRoutes } from '../../core/realtime/realtime.routes.js';
import { registerActivityRoutes } from '../../modules/activity/activity.routes.js';
import { redis } from '../../lib/redis.js';
import { setupFastifyErrorHandler } from '../observability/sentry.js';
import { requestIdHook } from './request-id.js';

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

  // Register request ID hook (must be early, before other hooks)
  requestIdHook(app);

  // Setup Sentry Fastify error handler (if Sentry is initialized)
  setupFastifyErrorHandler(app);

  // Register global error handler (our custom handler, Sentry is already integrated)
  app.setErrorHandler(globalErrorHandler);

  // Register 404 handler
  app.setNotFoundHandler(notFoundHandler);

  // Build allowed origins whitelist
  // Priority: CORS_ALLOWED_ORIGINS (prod) > ADDITIONAL_ALLOWED_ORIGINS > default (appUrl, frontendUrl)
  const allowedOrigins = appConfig.isProd && appConfig.corsAllowedOrigins
    ? appConfig.corsAllowedOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [
        appConfig.appUrl,
        appConfig.frontendUrl,
        ...(appConfig.additionalAllowedOrigins
          ? appConfig.additionalAllowedOrigins.split(',').map((origin) => origin.trim())
          : []),
      ].filter(Boolean);

  // Register CORS plugin (must be before other plugins)
  await app.register(cors, {
    credentials: appConfig.corsAllowCredentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Requested-With', 'X-Request-Id'],
    maxAge: 600, // Preflight cache for 10 minutes

    origin: (origin, cb) => {
      // Allow requests with no origin (curl, mobile app vs.)
      if (!origin) {
        return cb(null, true);
      }

      // Whitelist'te varsa
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      // Dev ortamında localhost'a izin ver
      if (appConfig.isDev) {
        try {
          const hostname = new URL(origin).hostname;
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return cb(null, true);
          }
        } catch {
          // URL parse edilemezse dev'de bile reject edelim
          return cb(new Error('INVALID_ORIGIN'), false);
        }
      }

      // Prod'da whitelist dışı her şeyi reddet
      return cb(new Error('CORS_NOT_ALLOWED'), false);
    },
  });

  // Register global rate limiting (skip in test environment)
  if (!appConfig.isTest) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
      redis,
      skipOnError: true,
      onExceeding: (req, key) => {
        logger.warn(
          {
            ip: req.ip,
            method: req.method,
            url: req.url,
            key,
          },
          'Rate limit approaching'
        );
      },
      onExceeded: (req, key) => {
        logger.warn(
          {
            ip: req.ip,
            method: req.method,
            url: req.url,
            key,
          },
          'Rate limit exceeded'
        );
      },
    });
  }

  // Register Swagger plugin BEFORE defining routes
  await app.register(swaggerPlugin);

  // Register cookie plugin
  await app.register(cookiePlugin);

  // Register auth context plugin (runs before all routes)
  await app.register(authContextPlugin);

  // Register non-versioned routes (health, debug, realtime)
  await registerHealthRoutes(app);
  await registerDebugRoutes(app);
  await registerRealtimeRoutes(app);

  // Register v1 API routes under /v1 prefix
  await app.register(async function v1Routes(fastify) {
    // All public API routes go under /v1
    await registerAuthRoutes(fastify);
    await registerUserRoutes(fastify);
    await registerSubscriptionRoutes(fastify);
    await registerWorkspaceMemberRoutes(fastify);
    await registerWorkspaceRoleRoutes(fastify);
    await workspaceInviteRoutes(fastify);
    await registerUsageRoutes(fastify);
    await registerWorkspaceRoutes(fastify);
    await registerMediaRoutes(fastify);
    await registerActivityRoutes(fastify);
  }, { prefix: '/v1' });

  return app;
}
