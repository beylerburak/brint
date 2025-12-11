/**
 * Content Routes
 * 
 * Handles content creation, update, and retrieval endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { upsertTagsForWorkspace, setTagsForContent, getTagsForContent, getTagsForContents } from '../tag/tag.service.js';
import { TagEntityType, ContentStatus, PublicationStatus } from '@prisma/client';
import { PublicationService } from '../publication/publication.service.js';
import { getCache, setCache, deleteCachePattern } from '../../lib/redis.js';
import { broadcastPublicationEvent } from '../publication/publication-websocket.routes.js';
import { deleteMedia } from '../media/media-delete.service.js';
import { logger } from '../../lib/logger.js';

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  const publicationService = new PublicationService();

  // POST /workspaces/:workspaceId/brands/:brandSlug/contents - Create content
  app.post('/workspaces/:workspaceId/brands/:brandSlug/contents', {
    preHandler: requireWorkspaceRoleFor('content:create'),
    schema: {
      tags: ['Content'],
      summary: 'Create content',
      description: 'Creates a new content with tags support.',
      body: {
        type: 'object',
        properties: {
          formFactor: {
            type: 'string',
            enum: ['FEED_POST', 'STORY', 'VERTICAL_VIDEO', 'BLOG_ARTICLE', 'LONG_VIDEO'],
          },
          baseCaption: { type: ['string', 'null'] },
          platformCaptions: { type: ['object', 'null'] },
          accountIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of social account IDs',
          },
          scheduledAt: { type: ['string', 'null'], format: 'date-time' },
          status: {
            type: 'string',
            enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'ARCHIVED'],
            default: 'DRAFT',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of tag names (e.g., ["Black Friday 2025", "urun-x-launch"])',
          },
          mediaIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of media IDs to attach to content',
          },
        },
        required: ['formFactor', 'accountIds'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            content: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandSlug } = request.params as { workspaceId: string; brandSlug: string };
    const body = request.body as {
      formFactor: string;
      title?: string | null;
      baseCaption?: string | null;
      platformCaptions?: Record<string, string> | null;
      accountIds: string[];
      scheduledAt?: string | null;
      status?: string;
      tags?: string[];
      mediaIds?: string[];
    };

    try {
      // Find brand
      const brand = await prisma.brand.findFirst({
        where: {
          workspaceId,
          slug: brandSlug,
        },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      // Determine initial status: if scheduledAt is in the future, set to SCHEDULED
      const scheduledAtDate = body.scheduledAt ? new Date(body.scheduledAt) : null;
      const isScheduledForFuture = scheduledAtDate && scheduledAtDate > new Date();
      const initialStatus = body.status 
        ? (body.status as any)
        : (isScheduledForFuture ? ContentStatus.SCHEDULED : ContentStatus.DRAFT);

      // Create content
      const content = await prisma.content.create({
        data: {
          brandId: brand.id,
          workspaceId,
          formFactor: body.formFactor as any,
          title: body.title || null,
          baseCaption: body.baseCaption || null,
          platformCaptions: body.platformCaptions || undefined,
          scheduledAt: scheduledAtDate,
          status: initialStatus,
          // Create content accounts
          contentAccounts: {
            create: body.accountIds.map(accountId => ({
              socialAccountId: accountId,
            })),
          },
          // Create content media
          contentMedia: body.mediaIds && body.mediaIds.length > 0 ? {
            create: body.mediaIds.map(mediaId => ({
              mediaId,
            })),
          } : undefined,
        },
        include: {
          contentAccounts: {
            include: {
              socialAccount: true,
            },
          },
          contentMedia: {
            include: {
              media: true,
            },
          },
        },
      });

      // Handle tags
      if (body.tags && body.tags.length > 0) {
        const tagEntities = await upsertTagsForWorkspace(workspaceId, body.tags);
        await setTagsForContent(workspaceId, content.id, tagEntities);
      }

      // Sync publications if content has scheduledAt (creates publication records)
      if (content.scheduledAt) {
        await publicationService.syncPublicationsForContent(content.id);
        
        // Ensure status is SCHEDULED if we just created publications for future date
        if (content.scheduledAt > new Date() && content.status !== ContentStatus.SCHEDULED) {
          await prisma.content.update({
            where: { id: content.id },
            data: { status: ContentStatus.SCHEDULED },
          });
          // Update content object for response
          content.status = ContentStatus.SCHEDULED;
        }
      }

      // Invalidate contents cache for this brand
      await deleteCachePattern(`contents:workspace:${workspaceId}:brand:${brandSlug}`);

      // Broadcast content created/updated event
      broadcastPublicationEvent(
        workspaceId,
        {
          type: 'content.status.changed',
          data: {
            id: content.id,
            status: content.status,
            publications: [], // Will be populated if needed
          },
        },
        brand.id
      );

      // Fetch tags for response
      const tags = await getTagsForContent(workspaceId, content.id);

      return reply.status(201).send({
        success: true,
        content: {
          ...content,
          tags: tags.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            color: t.color,
          })),
        },
      });
    } catch (error: any) {
      request.log.error(error, 'Error creating content');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CONTENT_CREATE_ERROR',
          message: error.message || 'Failed to create content',
        },
      });
    }
  });

  // PUT /workspaces/:workspaceId/brands/:brandSlug/contents/:contentId - Update content
  app.put('/workspaces/:workspaceId/brands/:brandSlug/contents/:contentId', {
    preHandler: requireWorkspaceRoleFor('content:create'),
    schema: {
      tags: ['Content'],
      summary: 'Update content',
      description: 'Updates an existing content, including tags.',
      body: {
        type: 'object',
        properties: {
          formFactor: {
            type: 'string',
            enum: ['FEED_POST', 'STORY', 'VERTICAL_VIDEO', 'BLOG_ARTICLE', 'LONG_VIDEO'],
          },
          baseCaption: { type: ['string', 'null'] },
          platformCaptions: { type: ['object', 'null'] },
          accountIds: {
            type: 'array',
            items: { type: 'string' },
          },
          scheduledAt: { type: ['string', 'null'], format: 'date-time' },
          status: {
            type: 'string',
            enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'ARCHIVED'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          mediaIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of media IDs to attach to content',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            content: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandSlug, contentId } = request.params as {
      workspaceId: string;
      brandSlug: string;
      contentId: string;
    };
    const body = request.body as {
      formFactor?: string;
      title?: string | null;
      baseCaption?: string | null;
      platformCaptions?: Record<string, string> | null;
      accountIds?: string[];
      scheduledAt?: string | null;
      status?: string;
      tags?: string[];
      mediaIds?: string[];
    };

    try {
      // Find brand
      const brand = await prisma.brand.findFirst({
        where: {
          workspaceId,
          slug: brandSlug,
        },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      // Find content
      const existingContent = await prisma.content.findFirst({
        where: {
          id: contentId,
          brandId: brand.id,
          workspaceId,
          deletedAt: null,
        },
      });

      if (!existingContent) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found',
          },
        });
      }

      // Update content
      const updateData: any = {};
      if (body.formFactor !== undefined) updateData.formFactor = body.formFactor;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.baseCaption !== undefined) updateData.baseCaption = body.baseCaption;
      if (body.platformCaptions !== undefined) updateData.platformCaptions = body.platformCaptions;
      if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (body.status !== undefined) updateData.status = body.status;

      const content = await prisma.content.update({
        where: { id: contentId },
        data: updateData,
        include: {
          contentAccounts: {
            include: {
              socialAccount: true,
            },
          },
          contentMedia: {
            include: {
              media: true,
            },
          },
        },
      });

      // Update content accounts if provided
      if (body.accountIds !== undefined) {
        // Get current active account IDs
        const currentAccounts = await prisma.contentAccount.findMany({
          where: {
            contentId,
            deletedAt: null,
          },
          select: {
            socialAccountId: true,
          },
        });

        const currentAccountIds = currentAccounts.map((ca: { socialAccountId: string }) => ca.socialAccountId);
        const newAccountIds = body.accountIds;

        // Check if accounts actually changed
        const accountsChanged = currentAccountIds.length !== newAccountIds.length ||
          !currentAccountIds.every((id: string) => newAccountIds.includes(id)) ||
          !newAccountIds.every((id: string) => currentAccountIds.includes(id));

        if (accountsChanged) {
          // Soft delete existing
          await prisma.contentAccount.updateMany({
            where: {
              contentId,
              deletedAt: null,
            },
            data: {
              deletedAt: new Date(),
            },
          });

          // Create new ones using individual creates to handle potential conflicts
          if (newAccountIds.length > 0) {
            for (const accountId of newAccountIds) {
              await prisma.contentAccount.upsert({
                where: {
                  contentId_socialAccountId: {
                    contentId,
                    socialAccountId: accountId,
                  },
                },
                update: {
                  deletedAt: null, // Restore if it was soft deleted
                },
                create: {
                  contentId,
                  socialAccountId: accountId,
                },
              });
            }
          }
        }
      }

      // Handle mediaIds - update content media if provided
      if (body.mediaIds !== undefined) {
        // Get current content media
        const currentContentMedia = await prisma.contentMedia.findMany({
          where: {
            contentId,
          },
          select: {
            id: true,
            mediaId: true,
          },
        });

        const currentMediaIds = currentContentMedia.map((cm: { mediaId: string }) => cm.mediaId);
        const newMediaIds = body.mediaIds || [];

        // Check if media actually changed
        const mediaChanged = 
          currentMediaIds.length !== newMediaIds.length ||
          !currentMediaIds.every((id: string) => newMediaIds.includes(id)) ||
          !newMediaIds.every((id: string) => currentMediaIds.includes(id));

        if (mediaChanged) {
          // Delete all existing content media (ContentMedia doesn't have soft delete)
          await prisma.contentMedia.deleteMany({
            where: {
              contentId,
            },
          });

          // Create new content media entries
          if (newMediaIds.length > 0) {
            await prisma.contentMedia.createMany({
              data: newMediaIds.map((mediaId: string, index: number) => ({
                contentId,
                mediaId,
                sortOrder: index, // Preserve order
              })),
            });
          }
        }
      }

      // Handle tags
      if (body.tags !== undefined) {
        const tagEntities = await upsertTagsForWorkspace(workspaceId, body.tags);
        await setTagsForContent(workspaceId, content.id, tagEntities);
      }

      // Sync publications if content status changed to scheduled/published or scheduledAt was set
      const wasScheduled = existingContent.scheduledAt;
      const isNowScheduled = content.scheduledAt;
      const statusChangedToScheduled = body.status === 'SCHEDULED' || body.status === 'PUBLISHED';
      const scheduledAtChanged = wasScheduled?.getTime() !== isNowScheduled?.getTime();

      if ((statusChangedToScheduled || (!wasScheduled && isNowScheduled) || scheduledAtChanged) && content.scheduledAt) {
        await publicationService.syncPublicationsForContent(content.id);
        
        // Update status to SCHEDULED if scheduledAt is in the future
        if (content.scheduledAt > new Date() && content.status !== ContentStatus.SCHEDULED && !body.status) {
          await prisma.content.update({
            where: { id: content.id },
            data: { status: ContentStatus.SCHEDULED },
          });
          content.status = ContentStatus.SCHEDULED;
        }
      }

      // Invalidate contents cache for this brand
      await deleteCachePattern(`contents:workspace:${workspaceId}:brand:${brandSlug}`);

      // Fetch tags for response
      const tags = await getTagsForContent(workspaceId, content.id);

      // Re-fetch content with updated contentMedia if mediaIds were updated
      let contentWithMedia = content;
      if (body.mediaIds !== undefined) {
        contentWithMedia = await prisma.content.findUnique({
          where: { id: content.id },
          include: {
            contentAccounts: {
              include: {
                socialAccount: true,
              },
            },
            contentMedia: {
              include: {
                media: true,
              },
            },
          },
        }) || content;
      }

      // Generate media URLs for response (similar to getContent)
      const { getMediaVariantUrlAsync } = await import('../../core/storage/s3-url.js');
      const contentMediaWithUrls = await Promise.all(
        ((contentWithMedia as any).contentMedia || []).map(async (cm: any) => {
          const media = cm.media;
          if (!media) return cm;
          
          // Generate preview URL (use small variant if available, otherwise original)
          let previewUrl: string | null = null;
          if (media.variants && typeof media.variants === 'object') {
            previewUrl = await getMediaVariantUrlAsync(
              media.bucket,
              media.variants,
              'small',
              media.isPublic
            ) || await getMediaVariantUrlAsync(
              media.bucket,
              media.variants,
              'thumbnail',
              media.isPublic
            );
          }
          
          // Fallback to original if no variant available
          if (!previewUrl && media.isPublic) {
            const { getS3PublicUrl } = await import('../../core/storage/s3-url.js');
            previewUrl = getS3PublicUrl(media.bucket, media.baseKey);
          } else if (!previewUrl) {
            // For private media, generate presigned URL
            const { generatePresignedUrl } = await import('../../core/storage/s3-client.js');
            previewUrl = await generatePresignedUrl(media.bucket, media.baseKey, 3600);
          }
          
          return {
            ...cm,
            media: {
              ...media,
              previewUrl,
            },
          };
        })
      );

      // Get updated content with publications for broadcast
      const contentForBroadcast = await prisma.content.findUnique({
        where: { id: content.id },
        include: {
          publications: {
            where: { deletedAt: null },
            select: { id: true, status: true, platform: true },
          },
        },
      });

      // Broadcast content status changed event
      if (contentForBroadcast) {
        broadcastPublicationEvent(
          workspaceId,
          {
            type: 'content.status.changed',
            data: {
              id: contentForBroadcast.id,
              status: contentForBroadcast.status,
              publications: contentForBroadcast.publications,
            },
          },
          brand.id
        );
      }

      return reply.status(200).send({
        success: true,
        content: {
          ...contentWithMedia,
          contentMedia: contentMediaWithUrls,
          tags: tags.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            color: t.color,
          })),
        },
      });
    } catch (error: any) {
      request.log.error(error, 'Error updating content');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CONTENT_UPDATE_ERROR',
          message: error.message || 'Failed to update content',
        },
      });
    }
  });

  // GET /workspaces/:workspaceId/brands/:brandSlug/contents - List contents
  app.get('/workspaces/:workspaceId/brands/:brandSlug/contents', {
    preHandler: requireWorkspaceRoleFor('content:view'),
    schema: {
      tags: ['Content'],
      summary: 'List contents',
      description: 'Returns a list of contents for a brand.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandSlug } = request.params as { workspaceId: string; brandSlug: string };

    // Build cache key
    const cacheKey = `contents:workspace:${workspaceId}:brand:${brandSlug}`;

    // Try to get from cache first (cache will be invalidated when publications change)
    const cached = await getCache<{ success: true; contents: any[] }>(cacheKey);
    if (cached) {
      return reply.status(200).send(cached);
    }

    try {
      const brand = await prisma.brand.findFirst({
        where: {
          workspaceId,
          slug: brandSlug,
        },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      const contents = await prisma.content.findMany({
        where: {
          brandId: brand.id,
          workspaceId,
          deletedAt: null,
        },
        include: {
          contentAccounts: {
            include: {
              socialAccount: true,
            },
          },
          publications: {
            where: { deletedAt: null },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Fetch tags for all contents
      const contentIds = contents.map((c: any) => c.id);
      const tagsMap = await getTagsForContents(workspaceId, contentIds);

      // Calculate status based on publications for each content
      const contentsWithTagsAndStatus = contents.map((content: any) => {
        // Calculate status from publications
        let calculatedStatus = content.status;
        const hasPublishingPublications = content.publications?.some(
          (p: any) => p.status === PublicationStatus.PUBLISHING
        );
        
        if (content.publications && content.publications.length > 0) {
          const publications = content.publications;
          const successCount = publications.filter((p: any) => p.status === PublicationStatus.SUCCESS).length;
          const failedCount = publications.filter((p: any) => p.status === PublicationStatus.FAILED).length;
          const publishingCount = publications.filter((p: any) => p.status === PublicationStatus.PUBLISHING).length;
          const pendingCount = publications.filter(
            (p: any) =>
              p.status === PublicationStatus.PENDING ||
              p.status === PublicationStatus.QUEUED
          ).length;
          const skippedCount = publications.filter((p: any) => p.status === PublicationStatus.SKIPPED).length;

          const totalActive = publications.length - skippedCount;

          if (totalActive > 0) {
            // If any publication is currently publishing, show as PUBLISHING (even though it's not in ContentStatus enum)
            if (publishingCount > 0) {
              calculatedStatus = 'PUBLISHING' as any;
            } else if (successCount === totalActive) {
              calculatedStatus = ContentStatus.PUBLISHED;
            } else if (failedCount === totalActive) {
              calculatedStatus = ContentStatus.FAILED;
            } else if (successCount > 0 && (failedCount > 0 || pendingCount > 0)) {
              calculatedStatus = ContentStatus.PARTIALLY_PUBLISHED;
            } else if (pendingCount === totalActive) {
              calculatedStatus = content.scheduledAt ? ContentStatus.SCHEDULED : ContentStatus.DRAFT;
            }
          }
        }

        return {
          ...content,
          status: calculatedStatus, // Use calculated status (can be PUBLISHING)
          tags: (tagsMap.get(content.id) || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            color: t.color,
          })),
          // Include publication statuses for frontend to display
          publicationStatuses: content.publications?.map((p: any) => ({
            id: p.id,
            status: p.status,
            platform: p.platform,
          })) || [],
          // Remove full publications from response to reduce payload
          publications: undefined,
        };
      });

      // Clean up publications from response
      const contentsWithTags = contentsWithTagsAndStatus.map(({ publications, ...rest }) => rest);

      const response = {
        success: true as const,
        contents: contentsWithTags,
      };

      // Cache for 30 seconds (shorter TTL since status is dynamic)
      // Note: Cache will be invalidated on content create/update
      await setCache(cacheKey, response, 30);

      return reply.status(200).send(response);
    } catch (error: any) {
      request.log.error(error, 'Error listing contents');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CONTENT_LIST_ERROR',
          message: error.message || 'Failed to list contents',
        },
      });
    }
  });

  // GET /workspaces/:workspaceId/brands/:brandSlug/contents/:contentId - Get content
  app.get('/workspaces/:workspaceId/brands/:brandSlug/contents/:contentId', {
    preHandler: requireWorkspaceRoleFor('content:view'),
    schema: {
      tags: ['Content'],
      summary: 'Get content',
      description: 'Returns a single content with tags.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandSlug, contentId } = request.params as {
      workspaceId: string;
      brandSlug: string;
      contentId: string;
    };

    try {
      const brand = await prisma.brand.findFirst({
        where: {
          workspaceId,
          slug: brandSlug,
        },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      const content = await prisma.content.findFirst({
        where: {
          id: contentId,
          brandId: brand.id,
          workspaceId,
          deletedAt: null,
        },
        include: {
          contentAccounts: {
            include: {
              socialAccount: true,
            },
          },
          contentMedia: {
            include: {
              media: true,
            },
          },
        },
      });

      if (!content) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found',
          },
        });
      }

      // Fetch tags
      const tags = await getTagsForContent(workspaceId, content.id);

      // Generate media URLs
      const { getMediaVariantUrlAsync } = await import('../../core/storage/s3-url.js');
      const contentWithMediaUrls = {
        ...content,
        contentMedia: await Promise.all(
          (content.contentMedia || []).map(async (cm: any) => {
            const media = cm.media;
            if (!media) return cm;
            
            // Generate preview URL (use small variant if available, otherwise original)
            let previewUrl: string | null = null;
            if (media.variants && typeof media.variants === 'object') {
              previewUrl = await getMediaVariantUrlAsync(
                media.bucket,
                media.variants,
                'small',
                media.isPublic
              ) || await getMediaVariantUrlAsync(
                media.bucket,
                media.variants,
                'thumbnail',
                media.isPublic
              );
            }
            
            // Fallback to original if no variant available
            if (!previewUrl && media.isPublic) {
              const { getS3PublicUrl } = await import('../../core/storage/s3-url.js');
              previewUrl = getS3PublicUrl(media.bucket, media.baseKey);
            } else if (!previewUrl) {
              // For private media, generate presigned URL
              const { generatePresignedUrl } = await import('../../core/storage/s3-client.js');
              previewUrl = await generatePresignedUrl(media.bucket, media.baseKey, 3600);
            }
            
            return {
              ...cm,
              media: {
                ...media,
                previewUrl,
              },
            };
          })
        ),
        tags: tags.map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          color: t.color,
        })),
      };

      return reply.status(200).send({
        success: true,
        content: contentWithMediaUrls,
      });
    } catch (error: any) {
      request.log.error(error, 'Error getting content');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CONTENT_GET_ERROR',
          message: error.message || 'Failed to get content',
        },
      });
    }
  });

  // DELETE /workspaces/:workspaceId/brands/:brandSlug/contents/:contentId - Delete content
  app.delete('/workspaces/:workspaceId/brands/:brandSlug/contents/:contentId', {
    preHandler: requireWorkspaceRoleFor('content:delete'),
    schema: {
      tags: ['Content'],
      summary: 'Delete content',
      description: 'Soft deletes content and related publications. Hard deletes media files from S3.',
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          brandSlug: { type: 'string' },
          contentId: { type: 'string' },
        },
        required: ['workspaceId', 'brandSlug', 'contentId'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { workspaceId: string; brandSlug: string; contentId: string } }>, reply: FastifyReply) => {
    try {
      const { workspaceId, brandSlug, contentId } = request.params;
      
      // User is already authenticated by requireWorkspaceRoleFor preHandler
      // Extract user ID from auth context (userId is directly available in AuthContext)
      if (!request.auth || !request.auth.userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }
      const userId = request.auth.userId;

      // Get brand
      const brand = await prisma.brand.findFirst({
        where: {
          slug: brandSlug,
          workspaceId,
        },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      // Get content with relations
      const content = await prisma.content.findFirst({
        where: {
          id: contentId,
          brandId: brand.id,
          workspaceId,
          deletedAt: null,
        },
        include: {
          contentMedia: {
            include: {
              media: true,
            },
          },
          publications: {
            where: { deletedAt: null },
          },
        },
      });

      if (!content) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found',
          },
        });
      }

      logger.info(
        {
          contentId,
          workspaceId,
          brandId: brand.id,
          status: content.status,
          publicationCount: content.publications.length,
          mediaCount: content.contentMedia.length,
        },
        'Deleting content'
      );

      // Soft delete publications
      if (content.publications.length > 0) {
        await prisma.publication.updateMany({
          where: {
            contentId: content.id,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });

        logger.info(
          { contentId, publicationCount: content.publications.length },
          'Soft deleted publications'
        );
      }

      // Delete media files from S3 and database
      for (const contentMedia of content.contentMedia) {
        const media = contentMedia.media;
        if (media) {
          try {
            await deleteMedia({
              mediaId: media.id,
              workspaceId,
              userId,
            });
            logger.info({ contentId, mediaId: media.id }, 'Deleted media');
          } catch (mediaError: any) {
            logger.error(
              { contentId, mediaId: media.id, error: mediaError.message },
              'Failed to delete media, continuing'
            );
            // Continue with other media even if one fails
          }
        }
      }

      // Soft delete content
      await prisma.content.update({
        where: { id: content.id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Invalidate contents cache
      await deleteCachePattern(`contents:workspace:${workspaceId}:brand:${brandSlug}`);

      // Broadcast content deleted event
      broadcastPublicationEvent(
        workspaceId,
        {
          type: 'content.deleted',
          data: {
            id: content.id,
            brandId: brand.id,
          },
        },
        brand.id
      );

      logger.info({ contentId }, 'Content deleted successfully');

      return reply.status(200).send({
        success: true,
        message: 'Content deleted successfully',
      });
    } catch (error: any) {
      request.log.error(error, 'Error deleting content');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CONTENT_DELETE_ERROR',
          message: error.message || 'Failed to delete content',
        },
      });
    }
  });
}
