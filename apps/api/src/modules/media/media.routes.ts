import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { S3StorageService } from '../../lib/storage/s3.storage.service.js';
import { MediaUploadService } from './application/media-upload.service.js';
import { storageConfig } from '../../config/index.js';
import { createHash } from 'crypto';

const storage = new S3StorageService();
const mediaUploadService = new MediaUploadService(storage);

const mediaConfigPayload = {
  presign: storageConfig.presign,
  cdnBaseUrl: storageConfig.cdnBaseUrl,
  assets: storageConfig.assets,
  allowedAssetTypes: Object.keys(storageConfig.assets),
};
const mediaConfigVersion = createHash('sha256')
  .update(JSON.stringify(mediaConfigPayload))
  .digest('hex')
  .slice(0, 12);

export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  if (!prisma.media) {
    app.log.error('Prisma client does not have media model (did you run prisma generate?)');
    throw new Error('PRISMA_MEDIA_MODEL_MISSING');
  }

  // GET /media/config
  app.get('/media/config', {
    schema: {
      tags: ['Media'],
      summary: 'Public media config (limits, variants, presign durations)',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                version: { type: 'string' },
                presign: {
                  type: 'object',
                  properties: {
                    uploadExpireSeconds: { type: 'number' },
                    downloadExpireSeconds: { type: 'number' },
                  },
                },
                cdnBaseUrl: { type: ['string', 'null'] },
                allowedAssetTypes: { type: 'array', items: { type: 'string' } },
                assets: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      limits: {
                        type: 'object',
                        properties: {
                          maxFileSizeBytes: { type: 'number' },
                          allowedExtensions: { type: 'array', items: { type: 'string' } },
                          allowedMimeTypes: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['maxFileSizeBytes'],
                        additionalProperties: true,
                      },
                      variants: {
                        type: 'object',
                        additionalProperties: {
                          type: 'object',
                          properties: {
                            width: { type: 'number' },
                            height: { type: 'number' },
                            quality: { type: 'number' },
                          },
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['limits', 'variants'],
                    additionalProperties: true,
                  },
                },
              },
              required: ['version', 'presign', 'allowedAssetTypes', 'assets'],
            },
          },
          required: ['success', 'data'],
        },
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: {
        version: mediaConfigVersion,
        ...mediaConfigPayload,
      },
    });
  });

  // POST /media/presign-upload
  app.post('/media/presign-upload', {
    schema: {
      tags: ['Media'],
      body: {
        type: 'object',
        required: ['workspaceId', 'fileName', 'contentType', 'sizeBytes'],
        properties: {
          workspaceId: { type: 'string', description: 'Workspace ID or slug' },
          brandId: { type: 'string' },
          fileName: { type: 'string' },
          contentType: { type: 'string' },
          sizeBytes: { type: 'number' },
          assetType: { type: 'string', enum: ['avatar', 'content-image', 'content-video'], description: 'Asset type for validation; defaults to content-image' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { workspaceId: string; brandId?: string; fileName: string; contentType: string; sizeBytes: number; assetType?: 'avatar' | 'content-image' | 'content-video' } }>, reply: FastifyReply) => {
    try {
      // Look up workspace by ID or slug
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: request.body.workspaceId },
            { slug: request.body.workspaceId },
          ],
        },
        select: { id: true },
      });
      if (!workspace) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'WORKSPACE_NOT_FOUND',
            message: 'Workspace not found',
          },
        });
      }

      const presign = await storage.getPresignedUploadUrl({
        workspaceId: workspace.id,
        brandId: request.body.brandId,
        fileName: request.body.fileName,
        contentType: request.body.contentType,
        sizeBytes: request.body.sizeBytes,
        assetType: request.body.assetType,
      });

      return reply.send({ success: true, data: presign });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: error?.message ?? 'MEDIA_PRESIGN_ERROR',
          message: 'Failed to create presigned upload URL',
        },
      });
    }
  });

  // POST /media/presign-download
  app.post('/media/presign-download', {
    schema: {
      tags: ['Media'],
      body: {
        type: 'object',
        required: ['objectKey'],
        properties: {
          objectKey: { type: 'string', description: 'S3 object key' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { objectKey: string } }>, reply: FastifyReply) => {
    try {
      const { objectKey } = request.body;

      // Verify media exists and user has access
      const media = await prisma.media.findUnique({
        where: { objectKey },
        select: { 
          id: true, 
          workspaceId: true,
          objectKey: true,
        },
      });

      if (!media) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'MEDIA_NOT_FOUND',
            message: 'Media file not found',
          },
        });
      }

      // Get presigned download URL
      const downloadUrl = await storage.getPresignedDownloadUrl(
        objectKey,
        storageConfig.presign.downloadExpireSeconds
      );

      return reply.send({
        success: true,
        data: {
          downloadUrl,
          expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
        },
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'PRESIGN_DOWNLOAD_FAILED',
          message: error.message || 'Failed to presign download',
        },
      });
    }
  });

  // POST /media/finalize
  app.post('/media/finalize', {
    schema: {
      tags: ['Media'],
      body: {
        type: 'object',
        required: ['objectKey', 'workspaceId', 'originalName'],
        properties: {
          objectKey: { type: 'string' },
          workspaceId: { type: 'string', description: 'Workspace ID or slug' },
          brandId: { type: 'string' },
          originalName: { type: 'string' },
          contentType: { type: 'string' },
          assetType: { type: 'string', enum: ['avatar', 'content-image', 'content-video'], description: 'Asset type for variants and processing; defaults to content-image' },
          isPublic: { type: 'boolean', description: 'Whether the media should be publicly accessible; defaults to false' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { objectKey: string; workspaceId: string; brandId?: string; originalName: string; contentType?: string; assetType?: 'avatar' | 'content-image' | 'content-video'; isPublic?: boolean } }>, reply: FastifyReply) => {
    try {
      const { media, variants } = await mediaUploadService.finalizeUpload({
        objectKey: request.body.objectKey,
        workspaceId: request.body.workspaceId,
        brandId: request.body.brandId,
        originalName: request.body.originalName,
        contentType: request.body.contentType,
        assetType: request.body.assetType,
        isPublic: request.body.isPublic,
      });

      return reply.send({ success: true, data: { media, variants } });
    } catch (error: any) {
      request.log.error({ 
        error, 
        errorMessage: error?.message,
        errorCode: error?.code,
        objectKey: request.body.objectKey, 
        workspaceId: request.body.workspaceId 
      }, 'Media finalize failed');
      
      // Map specific error codes to appropriate responses
      let code = 'MEDIA_FINALIZE_ERROR';
      let status = 500;
      let message = 'Failed to finalize media upload';
      let details: any = undefined;

      if (error?.message === 'MEDIA_OBJECT_NOT_FOUND') {
        code = 'MEDIA_OBJECT_NOT_FOUND';
        status = 404;
        message = 'Original file not found in S3. Possible causes: 1) PUT request failed (check CORS/bucket policy), 2) Upload not completed, 3) Wrong objectKey. Check browser console for CORS errors.';
        details = {
          objectKey: request.body.objectKey,
          suggestion: 'Verify S3 bucket CORS configuration allows PUT from your frontend origin, and bucket policy allows presigned URL uploads'
        };
      } else if (error?.message === 'WORKSPACE_NOT_FOUND') {
        code = 'WORKSPACE_NOT_FOUND';
        status = 404;
        message = 'Workspace not found';
        details = { workspaceId: request.body.workspaceId };
      } else if (error?.message === 'BRAND_NOT_FOUND') {
        code = 'BRAND_NOT_FOUND';
        status = 404;
        message = 'Brand not found';
        details = { brandId: request.body.brandId };
      } else if (error?.message === 'BRAND_WORKSPACE_MISMATCH') {
        code = 'BRAND_WORKSPACE_MISMATCH';
        status = 400;
        message = 'Brand does not belong to the specified workspace';
      } else if (error?.message === 'FOREIGN_KEY_CONSTRAINT_VIOLATION') {
        code = 'FOREIGN_KEY_CONSTRAINT_VIOLATION';
        status = 400;
        message = 'Invalid workspace or brand reference';
        details = error.details;
      } else if (error?.message === 'MEDIA_OBJECT_KEY_ALREADY_EXISTS') {
        code = 'MEDIA_OBJECT_KEY_ALREADY_EXISTS';
        status = 409;
        message = 'Media with this object key already exists';
        details = error.details;
      }
      
      return reply.status(status).send({
        success: false,
        error: {
          code,
          message,
          ...(details && { details }),
        },
      });
    }
  });

  // GET /media/:id
  app.get('/media/:id', {
    schema: {
      tags: ['Media'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const media = await prisma.media.findUnique({ where: { id: request.params.id } });
    if (!media) {
      return reply.status(404).send({ success: false, error: { code: 'MEDIA_NOT_FOUND', message: 'Media not found' } });
    }

    const url = await storage.getPresignedDownloadUrl(media.objectKey, {
      expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
    });

    return reply.send({ success: true, data: { media, url } });
  });

  // GET /media/:id/variants
  app.get('/media/:id/variants', {
    schema: {
      tags: ['Media'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const media = await prisma.media.findUnique({ where: { id: request.params.id } });
    if (!media) {
      return reply.status(404).send({ success: false, error: { code: 'MEDIA_NOT_FOUND', message: 'Media not found' } });
    }

    const variants = media.variants as Record<string, { key: string }> | null;
    const variantUrls: Record<string, string> = {};

    if (variants) {
      for (const [name, meta] of Object.entries(variants)) {
        if (!meta?.key) continue;
        variantUrls[name] = await storage.getPresignedDownloadUrl(meta.key, {
          expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
        });
      }
    }

    return reply.send({ success: true, data: { mediaId: media.id, variants: variantUrls } });
  });
}
