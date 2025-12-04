/**
 * Media Routes
 * 
 * Handles media upload and retrieval endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { uploadMedia } from './media-upload.service.js';
import { deleteMedia } from './media-delete.service.js';
import { prisma } from '../../lib/prisma.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';

export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  // POST /workspaces/:workspaceId/media - Upload media
  app.post('/workspaces/:workspaceId/media', {
    preHandler: requireWorkspaceRoleFor('content:create'),
    schema: {
      tags: ['Media'],
      summary: 'Upload media file',
      description: 'Upload a media file to S3 and create a database record. Requires EDITOR role or higher.',
      consumes: ['multipart/form-data'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = request.auth!.tokenPayload!.sub;

    try {
      // Get the file from multipart form data
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file uploaded',
          },
        });
      }

      // Convert stream to buffer
      const buffer = await data.toBuffer();

      // Extract metadata from fields
      const getFieldValue = (fieldName: string): string | undefined => {
        const field = data.fields[fieldName];
        if (!field) return undefined;
        return typeof field === 'object' && 'value' in field ? String(field.value) : undefined;
      };

      const brandId = getFieldValue('brandId');
      const title = getFieldValue('title');
      const alt = getFieldValue('alt');
      const description = getFieldValue('description');
      const isPublic = getFieldValue('isPublic') === 'true';

      // Upload media
      const result = await uploadMedia({
        workspaceId,
        brandId: brandId || null,
        ownerUserId: userId,
        file: {
          buffer,
          originalname: data.filename,
          mimetype: data.mimetype,
          size: buffer.length,
        },
        metadata: {
          title,
          alt,
          description,
          isPublic,
        },
      });

      return reply.status(201).send({
        success: true,
        media: result,
      });
    } catch (error) {
      request.log.error({ error, workspaceId }, 'Media upload failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload media',
        },
      });
    }
  });

  // GET /workspaces/:workspaceId/media - List media
  app.get('/workspaces/:workspaceId/media', {
    preHandler: requireWorkspaceRoleFor('content:view'),
    schema: {
      tags: ['Media'],
      summary: 'List workspace media',
      description: 'Returns all media files in the workspace. Requires VIEWER role or higher.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    const mediaList = await prisma.media.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        status: true,
        originalFilename: true,
        extension: true,
        mimeType: true,
        sizeBytes: true,
        width: true,
        height: true,
        durationMs: true,
        baseKey: true,
        bucket: true,
        variants: true,
        isPublic: true,
        title: true,
        alt: true,
        description: true,
        brandId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.status(200).send({
      success: true,
      media: mediaList,
    });
  });

  // GET /workspaces/:workspaceId/media/:mediaId - Get media details
  app.get('/workspaces/:workspaceId/media/:mediaId', {
    preHandler: requireWorkspaceRoleFor('content:view'),
    schema: {
      tags: ['Media'],
      summary: 'Get media details',
      description: 'Returns detailed information about a specific media file.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, mediaId } = request.params as { workspaceId: string; mediaId: string };

    const media = await prisma.media.findFirst({
      where: {
        id: mediaId,
        workspaceId,
      },
    });

    if (!media) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'MEDIA_NOT_FOUND',
          message: 'Media not found',
        },
      });
    }

    return reply.status(200).send({
      success: true,
      media,
    });
  });

  // DELETE /workspaces/:workspaceId/media/:mediaId - Delete media
  app.delete('/workspaces/:workspaceId/media/:mediaId', {
    preHandler: requireWorkspaceRoleFor('media:delete'),
    schema: {
      tags: ['Media'],
      summary: 'Delete media',
      description: 'Deletes a media file from S3 and database. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, mediaId } = request.params as { workspaceId: string; mediaId: string };
    const userId = request.auth!.tokenPayload!.sub;

    try {
      await deleteMedia({
        mediaId,
        workspaceId,
        userId,
      });

      return reply.status(200).send({
        success: true,
        message: 'Media deleted successfully',
      });
    } catch (error) {
      request.log.error({ error, workspaceId, mediaId }, 'Media deletion failed');
      
      if (error instanceof Error && error.message === 'Media not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'MEDIA_NOT_FOUND',
            message: 'Media not found',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete media',
        },
      });
    }
  });
}

