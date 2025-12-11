/**
 * Publication Routes
 *
 * Handles publication-related endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PublicationService } from './publication.service';
import { prisma } from '../../lib/prisma.js';
import { getPublishableUrlForMedia } from '../../core/media/media-url.helper.js';

export async function registerPublicationRoutes(app: FastifyInstance): Promise<void> {
  const service = new PublicationService();

  // POST /v1/publications/:id/publish-now - Publish a publication immediately
  app.post('/v1/publications/:id/publish-now', {
    schema: {
      tags: ['Publication'],
      summary: 'Publish publication immediately',
      description: 'Publishes a publication immediately, bypassing scheduled time.',
      response: {
        202: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      // TODO: Add workspace/brand authentication guard to ensure user has access
      // to the publication's workspace/brand
      await service.publishNow(id);

      return reply.status(202).send({
        success: true,
      });
    } catch (error: any) {
      request.log.error(error, 'Error publishing publication now');

      if (error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PUBLICATION_NOT_FOUND',
            message: error.message,
          },
        });
      }

      if (error.message.includes('cannot be published')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PUBLICATION_STATUS',
            message: error.message,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'PUBLISH_NOW_ERROR',
          message: error.message || 'Failed to publish publication now',
        },
      });
    }
  });

  // GET /v1/publications/:id/debug - Debug publication details
  app.get('/v1/publications/:id/debug', {
    schema: {
      tags: ['Publication'],
      summary: 'Debug publication',
      description: 'Returns detailed debug information about a publication including media URLs and account details.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const publication = await prisma.publication.findUnique({
        where: { id },
        include: {
          content: {
            include: {
              contentMedia: {
                include: { media: true },
                orderBy: { sortOrder: 'asc' },
              },
              accountOptions: true,
              brand: true,
            },
          },
          socialAccount: true,
        },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PUBLICATION_NOT_FOUND',
            message: 'Publication not found',
          },
        });
      }

      // Check media URLs
      const mediaChecks = await Promise.all(
        publication.content.contentMedia.map(async (cm) => {
          if (!cm.media) {
            return {
              contentMediaId: cm.id,
              status: 'error',
              error: 'Media not found',
            };
          }

          try {
            const url = await getPublishableUrlForMedia(cm.media);
            return {
              contentMediaId: cm.id,
              mediaId: cm.media.id,
              status: 'ok',
              url: url.substring(0, 100) + '...', // Truncate for display
              urlLength: url.length,
              isPublic: cm.media.isPublic,
              bucket: cm.media.bucket,
              baseKey: cm.media.baseKey,
            };
          } catch (error: any) {
            return {
              contentMediaId: cm.id,
              mediaId: cm.media.id,
              status: 'error',
              error: error.message,
            };
          }
        })
      );

      return reply.status(200).send({
        success: true,
        publication: {
          id: publication.id,
          status: publication.status,
          platform: publication.platform,
          scheduledAt: publication.scheduledAt,
          errorCode: publication.errorCode,
          errorMessage: publication.errorMessage,
          payloadSnapshot: publication.payloadSnapshot,
        },
        socialAccount: {
          id: publication.socialAccount.id,
          platform: publication.socialAccount.platform,
          platformAccountId: publication.socialAccount.platformAccountId,
          hasAccessToken: !!publication.socialAccount.accessToken,
          accessTokenLength: publication.socialAccount.accessToken?.length || 0,
        },
        content: {
          id: publication.content.id,
          formFactor: publication.content.formFactor,
          hasBaseCaption: !!publication.content.baseCaption,
          hasPlatformCaptions: !!publication.content.platformCaptions,
        },
        mediaChecks,
      });
    } catch (error: any) {
      request.log.error(error, 'Error debugging publication');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DEBUG_ERROR',
          message: error.message || 'Failed to debug publication',
        },
      });
    }
  });

  // POST /v1/workspaces/:workspaceId/publications/recalculate-statuses - Recalculate all content statuses
  app.post('/v1/workspaces/:workspaceId/publications/recalculate-statuses', {
    schema: {
      tags: ['Publication'],
      summary: 'Recalculate content statuses',
      description: 'Recalculates and updates content statuses based on their publications. Useful for fixing inconsistencies.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    try {
      const updatedCount = await service.recalculateAllContentStatuses(workspaceId);

      return reply.status(200).send({
        success: true,
        updatedCount,
        message: `Updated ${updatedCount} content statuses`,
      });
    } catch (error: any) {
      request.log.error(error, 'Error recalculating content statuses');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'RECALCULATE_ERROR',
          message: error.message || 'Failed to recalculate content statuses',
        },
      });
    }
  });
}