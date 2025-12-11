// apps/api/src/modules/integration/google-drive/google-drive.routes.ts

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleDriveIntegrationService } from './google-drive.service.js';
import { requireWorkspaceRoleFor } from '../../../core/auth/workspace-guard.js';
import { getWorkspaceIdFromRequest } from '../../../core/auth/workspace-context.js';

export async function registerGoogleDriveIntegrationRoutes(app: FastifyInstance) {
  const service = new GoogleDriveIntegrationService();

  // 1) Google Drive auth URL al
  app.get(
    '/integrations/google-drive/auth-url',
    {
      preHandler: requireWorkspaceRoleFor('workspace:settings'),
      schema: {
        tags: ['Integrations'],
        summary: 'Get Google Drive OAuth URL',
        description: 'Returns the OAuth URL to initiate Google Drive connection',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const userId = (request as any).auth?.userId;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      try {
        const url = service.getAuthUrl({ workspaceId, userId });
        return reply.send({
          success: true,
          url,
        });
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'CONFIGURATION_ERROR',
            message: err.message || 'Google Drive configuration error. Please check environment variables.',
          },
        });
      }
    },
  );

  // 2) OAuth callback (public path — guard'ı burada workspaceId/state üzerinden sen kontrol ettin)
  app.get(
    '/integrations/google-drive/callback',
    {
      schema: {
        tags: ['Integrations'],
        summary: 'Google Drive OAuth callback',
        description: 'Handles OAuth callback from Google',
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { code?: string; state?: string } }>, reply: FastifyReply) => {
      const { code, state } = request.query;
      if (!code || !state) {
        return reply.code(400).send({ 
          success: false, 
          error: { 
            code: 'INVALID_CALLBACK', 
            message: 'Missing code or state' 
          } 
        });
      }

      // Burada user'ı auth cookie üzerinden al (login olmuş user)
      const userId = (request as any).auth?.userId;
      if (!userId) {
        return reply.code(401).send({ 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'User not authenticated' 
          } 
        });
      }

      const svc = new GoogleDriveIntegrationService();

      try {
        await svc.handleOAuthCallback({ code, state, userId });
        // Frontend'e redirect et - workspace slug'ını almak için workspace'i fetch et
        const workspaceId = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')).workspaceId;
        const { prisma } = await import('../../../lib/prisma.js');
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { slug: true },
        });
        
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const locale = 'en'; // Default locale, could be extracted from request if available
        const redirectUrl = workspace 
          ? `${frontendUrl}/${locale}/${workspace.slug}/settings/integrations?connected=google-drive`
          : `${frontendUrl}/settings/integrations?connected=google-drive`;
        
        return reply.redirect(redirectUrl);
      } catch (err: any) {
        request.log.error(err);
        // Try to get workspace slug for error redirect too
        try {
          const workspaceId = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')).workspaceId;
          const { prisma } = await import('../../../lib/prisma.js');
          const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { slug: true },
          });
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const locale = 'en';
          const redirectUrl = workspace 
            ? `${frontendUrl}/${locale}/${workspace.slug}/settings/integrations?error=google-drive`
            : `${frontendUrl}/settings/integrations?error=google-drive`;
          return reply.redirect(redirectUrl);
        } catch {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          return reply.redirect(`${frontendUrl}/settings/integrations?error=google-drive`);
        }
      }
    },
  );

  // 3) Disconnect
  app.post(
    '/integrations/google-drive/disconnect',
    {
      preHandler: requireWorkspaceRoleFor('workspace:settings'),
      schema: {
        tags: ['Integrations'],
        summary: 'Disconnect Google Drive',
        description: 'Disconnects Google Drive integration for the workspace',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const userId = (request as any).auth?.userId;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const svc = new GoogleDriveIntegrationService();
      await svc.disconnect({ workspaceId, userId });

      return reply.send({ success: true });
    },
  );

  // 4) Status
  app.get(
    '/integrations/google-drive/status',
    {
      preHandler: requireWorkspaceRoleFor('workspace:view'),
      schema: {
        tags: ['Integrations'],
        summary: 'Get Google Drive status',
        description: 'Returns the connection status of Google Drive integration',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const userId = (request as any).auth?.userId;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const svc = new GoogleDriveIntegrationService();
      const status = await svc.getStatus({ workspaceId, userId });

      return reply.send({
        success: true,
        status,
      });
    },
  );

  // 5) Basit file list testi (sadece demo amaçlı)
  app.get(
    '/integrations/google-drive/files',
    {
      preHandler: requireWorkspaceRoleFor('workspace:settings'),
      schema: {
        tags: ['Integrations'],
        summary: 'List Google Drive files',
        description: 'Lists files from Google Drive (test endpoint)',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const userId = (request as any).auth?.userId;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const svc = new GoogleDriveIntegrationService();

      try {
        const query = (request.query as any)?.query;
        const pageSize = (request.query as any)?.pageSize ? parseInt((request.query as any).pageSize, 10) : undefined;
        const pageToken = (request.query as any)?.pageToken;
        const folderId = (request.query as any)?.folderId; // 'root' or folder ID
        const driveId = (request.query as any)?.driveId; // Shared drive ID

        request.log.info({
          query,
          pageSize,
          pageToken,
          folderId,
          driveId,
          workspaceId,
          driveIdType: typeof driveId,
          driveIdValue: driveId,
        }, 'Google Drive listFiles request');
        
        // Debug: Log the actual query parameters received
        console.log('[GoogleDriveRoutes] Received query params:', {
          query,
          pageSize,
          pageToken,
          folderId,
          driveId,
          rawQuery: request.query,
        });

        const result = await svc.listFiles(
          { workspaceId, userId },
          { query, pageSize, pageToken, folderId, driveId }
        );
        return reply.send({
          success: true,
          files: result.files ?? [],
          nextPageToken: result.nextPageToken,
        });
      } catch (err: any) {
        request.log.error({ err, workspaceId, userId }, 'Google Drive listFiles error');
        
        // Check if it's a specific error
        if (err.message?.includes('GOOGLE_DRIVE_NOT_CONNECTED')) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_NOT_CONNECTED',
              message: 'Google Drive is not connected for this workspace',
            },
          });
        }
        
        if (err.message?.includes('GOOGLE_DRIVE_REFRESH_FAILED')) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_REFRESH_FAILED',
              message: 'Failed to refresh Google Drive access token. Please reconnect.',
            },
          });
        }

        // Check for 403 Forbidden (insufficient permissions)
        if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
          return reply.code(403).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_INSUFFICIENT_PERMISSIONS',
              message: err.message || 'Insufficient permissions to access Google Drive. Please reconnect with proper permissions.',
            },
          });
        }

        return reply.code(400).send({
          success: false,
          error: {
            code: 'GOOGLE_DRIVE_ERROR',
            message: err.message ?? 'Google Drive integration error',
          },
        });
      }
    },
  );

  // 6) List Shared Drives
  app.get(
    '/integrations/google-drive/shared-drives',
    {
      preHandler: requireWorkspaceRoleFor('workspace:view'),
      schema: {
        tags: ['Integrations'],
        summary: 'List Google Drive shared drives',
        description: 'Returns list of shared drives (Team Drives)',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const userId = (request as any).auth?.userId;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const svc = new GoogleDriveIntegrationService();

      try {
        const result = await svc.listSharedDrives({ workspaceId, userId });
        return reply.send({
          success: true,
          drives: result.drives || [],
        });
      } catch (err: any) {
        request.log.error({ err, workspaceId, userId }, 'Google Drive listSharedDrives error');
        
        if (err.message?.includes('GOOGLE_DRIVE_NOT_CONNECTED')) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_NOT_CONNECTED',
              message: 'Google Drive is not connected for this workspace',
            },
          });
        }

        return reply.code(400).send({
          success: false,
          error: {
            code: 'GOOGLE_DRIVE_ERROR',
            message: err.message ?? 'Failed to list shared drives',
          },
        });
      }
    },
  );

  // 7) Get thumbnail for a Google Drive file
  app.get(
    '/integrations/google-drive/thumbnail/:fileId',
    {
      preHandler: requireWorkspaceRoleFor('workspace:view'),
      schema: {
        tags: ['Integrations'],
        summary: 'Get Google Drive file thumbnail',
        description: 'Returns the thumbnail image for a Google Drive file',
        params: {
          type: 'object',
          properties: {
            fileId: { type: 'string' },
          },
          required: ['fileId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const userId = (request as any).auth?.userId;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const svc = new GoogleDriveIntegrationService();

      try {
        const { buffer, contentType } = await svc.getThumbnail(
          { workspaceId, userId },
          request.params.fileId
        );

        reply.type(contentType);
        return reply.send(buffer);
      } catch (err: any) {
        request.log.error({ err, workspaceId, userId, fileId: request.params.fileId }, 'Google Drive thumbnail error');
        
        if (err.message?.includes('GOOGLE_DRIVE_NOT_CONNECTED')) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_NOT_CONNECTED',
              message: 'Google Drive is not connected for this workspace',
            },
          });
        }
        
        if (err.message?.includes('GOOGLE_DRIVE_REFRESH_FAILED')) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_REFRESH_FAILED',
              message: 'Failed to refresh Google Drive access token. Please reconnect.',
            },
          });
        }

        if (err.message?.includes('THUMBNAIL_NOT_AVAILABLE')) {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'THUMBNAIL_NOT_AVAILABLE',
              message: 'Thumbnail is not available for this file',
            },
          });
        }

        return reply.code(400).send({
          success: false,
          error: {
            code: 'GOOGLE_DRIVE_THUMBNAIL_ERROR',
            message: err.message ?? 'Failed to get thumbnail from Google Drive',
          },
        });
      }
    },
  );

  // 8) Import Drive file to Media
  app.post(
    '/integrations/google-drive/import',
    {
      preHandler: requireWorkspaceRoleFor('content:create'), // EDITOR+ can import
      schema: {
        tags: ['Integrations'],
        summary: 'Import Google Drive file to Media',
        description: 'Downloads a file from Google Drive and creates a Media record',
        body: {
          type: 'object',
          required: ['fileId'],
          properties: {
            fileId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { fileId: string } }>, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const userId = (request as any).auth?.userId;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const svc = new GoogleDriveIntegrationService();

      try {
        const result = await svc.importFile({ workspaceId, userId }, request.body.fileId);
        return reply.send({
          success: true,
          media: result,
        });
      } catch (err: any) {
        request.log.error({ err, workspaceId, userId, fileId: request.body.fileId }, 'Google Drive import error');
        
        if (err.message?.includes('GOOGLE_DRIVE_NOT_CONNECTED')) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_NOT_CONNECTED',
              message: 'Google Drive is not connected for this workspace',
            },
          });
        }
        
        if (err.message?.includes('GOOGLE_DRIVE_REFRESH_FAILED')) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'GOOGLE_DRIVE_REFRESH_FAILED',
              message: 'Failed to refresh Google Drive access token. Please reconnect.',
            },
          });
        }

        return reply.code(400).send({
          success: false,
          error: {
            code: 'GOOGLE_DRIVE_IMPORT_ERROR',
            message: err.message ?? 'Failed to import file from Google Drive',
          },
        });
      }
    },
  );
}
