/**
 * Content Routes
 * 
 * Handles content creation, update, and retrieval endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { upsertTagsForWorkspace, setTagsForContent, getTagsForContent, getTagsForContents } from '../tag/tag.service.js';
import { TagEntityType } from '@prisma/client';

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
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

      // Create content
      const content = await prisma.content.create({
        data: {
          brandId: brand.id,
          workspaceId,
          formFactor: body.formFactor as any,
          title: body.title || null,
          baseCaption: body.baseCaption || null,
          platformCaptions: body.platformCaptions || null,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          status: (body.status as any) || 'DRAFT',
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

      // Handle tags
      if (body.tags !== undefined) {
        const tagEntities = await upsertTagsForWorkspace(workspaceId, body.tags);
        await setTagsForContent(workspaceId, content.id, tagEntities);
      }

      // Fetch tags for response
      const tags = await getTagsForContent(workspaceId, content.id);

      return reply.status(200).send({
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
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Fetch tags for all contents
      const contentIds = contents.map((c: any) => c.id);
      const tagsMap = await getTagsForContents(workspaceId, contentIds);

      const contentsWithTags = contents.map((content: any) => ({
        ...content,
        tags: (tagsMap.get(content.id) || []).map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          color: t.color,
        })),
      }));

      return reply.status(200).send({
        success: true,
        contents: contentsWithTags,
      });
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
}
