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
import { registerPreferenceRoutes } from '../../modules/preference/preference.routes.js';
import { registerCommentRoutes } from '../../modules/comment/comment.routes.js';
import { registerProjectRoutes } from '../../modules/project/project.routes.js';
import { registerTaskRoutes } from '../../modules/task/task.routes.js';
import { registerTaskStatusRoutes } from '../../modules/task/task-status.routes.js';
import { registerTaskWebSocketRoutes } from '../../modules/task/task-websocket.routes.js';
import { registerPublicationWebSocketRoutes } from '../../modules/publication/publication-websocket.routes.js';
import { registerSocialAccountRoutes } from '../../modules/social-account/social-account.routes.js';
import websocket from '@fastify/websocket';
import { registerFacebookRoutes } from '../../modules/social-account/facebook/facebook.routes.js';
import { registerLinkedInRoutes } from '../../modules/social-account/linkedin/linkedin.routes.js';
import { registerXRoutes } from '../../modules/social-account/x/x.routes.js';
import { registerTikTokRoutes } from '../../modules/social-account/tiktok/tiktok.routes.js';
import { registerYouTubeRoutes } from '../../modules/social-account/youtube/youtube.routes.js';
import { registerPinterestRoutes } from '../../modules/social-account/pinterest/pinterest.routes.js';
import { registerTagRoutes } from '../../modules/tag/tag.routes.js';
import { registerContentRoutes } from '../../modules/content/content.routes.js';
import { registerPublicationRoutes } from '../../modules/publication/publication.routes.js';
import { registerIntegrationRoutes } from '../../modules/integration/integration.routes.js';
import { registerGoogleDriveIntegrationRoutes } from '../../modules/integration/google-drive/google-drive.routes.js';

/**
 * Creates and configures a Fastify server instance
 * - Sets up global error handlers
 * - Registers plugins (CORS, Swagger, Cookies)
 * - Registers module routes (Health, Auth, Studio)
 */
export async function createServer(): Promise<FastifyInstance> {
  // Import APP_CONFIG for bodyLimit and multipart limits
  const { APP_CONFIG } = await import('../../config/app-config.js');
  
  const app = Fastify({ 
    logger: logger as any,
    bodyLimit: APP_CONFIG.media.upload.maxFileSizeBytes, // Allow large file uploads
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
  await app.register(multipart, {
    limits: {
      fileSize: APP_CONFIG.media.upload.maxFileSizeBytes,
    },
  });

  // Register auth context plugin (runs before all routes)
  await app.register(authContextPlugin);

  // Register WebSocket plugin once (shared by all WebSocket routes)
  await app.register(websocket);

  // Register module routes
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerPreferenceRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerBrandRoutes(app);
  await registerMediaRoutes(app);
  await registerCommentRoutes(app);
  await registerProjectRoutes(app);
  await registerTaskRoutes(app);
  await registerTaskStatusRoutes(app);
  await registerTaskWebSocketRoutes(app);
  await registerPublicationWebSocketRoutes(app);
  await registerSocialAccountRoutes(app);
  await registerFacebookRoutes(app);
  await registerLinkedInRoutes(app);
  await registerXRoutes(app);
  await registerTikTokRoutes(app);
  await registerYouTubeRoutes(app);
  await registerPinterestRoutes(app);
  await registerTagRoutes(app);
  await registerContentRoutes(app);
  await registerPublicationRoutes(app);
  await registerIntegrationRoutes(app);
  await registerGoogleDriveIntegrationRoutes(app);

  return app;
}
