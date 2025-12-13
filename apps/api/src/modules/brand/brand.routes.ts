/**
 * Brand Routes
 * 
 * Handles brand CRUD operations.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createBrand,
  updateBrand,
  deleteBrand,
  getBrandById,
  getBrandBySlug,
  listBrands,
  isBrandSlugAvailable,
  updateBrandProfile,
  getBrandProfile,
  listBrandContactChannels,
  createBrandContactChannel,
  updateBrandContactChannel,
  deleteBrandContactChannel,
  reorderBrandContactChannels,
  calculateAndGetBrandOptimizationScore,
  updateBrandOptimizationScore,
} from './brand.service.js';
import {
  BrandProfileDataSchema,
  type BrandProfileData,
} from './domain/brand-profile.schema.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';
import { prisma } from '../../lib/prisma.js';
import { getCache, setCache, deleteCachePattern } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import { CacheKeys } from '../../core/cache/cache.service.js';

export async function registerBrandRoutes(app: FastifyInstance): Promise<void> {
  // POST /workspaces/:workspaceId/brands - Create brand
  app.post('/workspaces/:workspaceId/brands', {
    preHandler: requireWorkspaceRoleFor('brand:create'),
    schema: {
      tags: ['Brand'],
      summary: 'Create brand',
      description: 'Create a new brand in the workspace. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = request.auth?.userId;

    try {
      const brand = await createBrand(workspaceId, request.body as any, userId);

      // Invalidate brands cache for this workspace
      await deleteCachePattern(`brands:workspace:${workspaceId}:*`);

      return reply.status(201).send({
        success: true,
        brand: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description,
          industry: brand.industry,
          country: brand.country,
          city: brand.city,
          primaryLocale: brand.primaryLocale,
          timezone: brand.timezone,
          status: brand.status,
          logoMediaId: brand.logoMediaId,
          createdAt: brand.createdAt.toISOString(),
          updatedAt: brand.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'SLUG_TAKEN') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'SLUG_TAKEN',
              message: 'This slug is already taken',
            },
          });
        }
        if (error.message === 'BRAND_LIMIT_REACHED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'BRAND_LIMIT_REACHED',
              message: 'Brand limit reached for your current plan',
            },
          });
        }
        if (error.message === 'WORKSPACE_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'WORKSPACE_NOT_FOUND',
              message: 'Workspace not found',
            },
          });
        }
      }

      request.log.error({ error, workspaceId }, 'Brand creation failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create brand',
        },
      });
    }
  });

  // GET /workspaces/:workspaceId/brands - List brands
  app.get('/workspaces/:workspaceId/brands', {
    preHandler: requireWorkspaceRoleFor('brand:list'),
    schema: {
      tags: ['Brand'],
      summary: 'List brands',
      description: 'List all brands in the workspace. Requires VIEWER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { status, limit, offset } = request.query as {
      status?: 'ACTIVE' | 'ARCHIVED';
      limit?: string;
      offset?: string;
    };

    // Build cache key - only cache if no pagination (limit/offset)
    // Paginated requests should not be cached as they are less common
    const shouldCache = !limit && !offset;
    const cacheKey = shouldCache 
      ? CacheKeys.brandsList(workspaceId, status)
      : `brands:workspace:${workspaceId}:status:${status || 'all'}:limit:${limit || 'all'}:offset:${offset || '0'}`;

    // Try to get from cache first (only for non-paginated requests)
    if (shouldCache) {
      const cached = await getCache<{ success: true; brands: any[]; total: number }>(cacheKey);
      if (cached) {
        logger.debug({ workspaceId, status }, 'Brands list loaded from Redis cache');
        return reply.status(200).send(cached);
      }
    }

    const brands = await prisma.brand.findMany({
      where: {
        workspaceId,
        ...(status ? { status } : {}),
      },
      include: {
        _count: {
          select: {
            media: true,
          },
        },
        logoMedia: {
          select: {
            id: true,
            baseKey: true,
            bucket: true,
            variants: true,
            isPublic: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit ? parseInt(limit) : undefined,
      skip: offset ? parseInt(offset) : undefined,
    });

    // Generate presigned URLs for logos
    const brandsWithUrls = await Promise.all(
      brands.map(async (brand) => {
        let logoUrl: string | null = null;

        if (brand.logoMedia) {
          logoUrl = await getMediaVariantUrlAsync(
            brand.logoMedia.bucket,
            brand.logoMedia.variants,
            'small',
            brand.logoMedia.isPublic
          );
        }

        return {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description,
          industry: brand.industry,
          country: brand.country,
          city: brand.city,
          primaryLocale: brand.primaryLocale,
          timezone: brand.timezone,
          status: brand.status,
          logoMediaId: brand.logoMediaId,
          logoUrl,
          mediaCount: brand._count.media,
          createdAt: brand.createdAt.toISOString(),
          updatedAt: brand.updatedAt.toISOString(),
        };
      })
    );

    const response = {
      success: true as const,
      brands: brandsWithUrls,
      total: brandsWithUrls.length,
    };

    // Cache for 5 minutes (180 seconds) - only cache non-paginated requests
    // Presigned URLs are typically valid for a few minutes, so we cache for a reasonable duration
    if (shouldCache) {
      await setCache(cacheKey, response, 300);
      logger.debug({ workspaceId, status }, 'Brands list cached in Redis for 5 minutes');
    }

    return reply.status(200).send(response);
  });

  // GET /workspaces/:workspaceId/brands/slug/:slug - Get brand by slug
  app.get('/workspaces/:workspaceId/brands/slug/:slug', {
    preHandler: requireWorkspaceRoleFor('brand:view'),
    schema: {
      tags: ['Brand'],
      summary: 'Get brand by slug',
      description: 'Get detailed information about a specific brand by its slug. Requires VIEWER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, slug } = request.params as { workspaceId: string; slug: string };

    const brand = await getBrandBySlug(slug, workspaceId);

    if (!brand) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'BRAND_NOT_FOUND',
          message: 'Brand not found',
        },
      });
    }

    // Parse profile data safely
    let profileData: BrandProfileData | null = null;
    if (brand.profile?.data) {
      try {
        profileData = BrandProfileDataSchema.parse(brand.profile.data);
      } catch (e) {
        request.log.warn({ brandId: brand.id, error: e }, 'Failed to parse brand profile data');
      }
    }

    // Generate logo URL if logo exists
    let logoUrl: string | null = null;
    if (brand.logoMedia) {
      logoUrl = await getMediaVariantUrlAsync(
        brand.logoMedia.bucket,
        brand.logoMedia.variants,
        'medium',
        brand.logoMedia.isPublic
      );
    }

    // Helper to safely convert to ISO string
    const toISOString = (value: Date | string | null | undefined): string | null => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      }
      return null;
    };

    return reply.status(200).send({
      success: true,
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        industry: brand.industry,
        country: brand.country,
        city: brand.city,
        primaryLocale: brand.primaryLocale,
        timezone: brand.timezone,
        status: brand.status,
        logoMediaId: brand.logoMediaId,
        logoUrl,
        mediaCount: brand._count.media,
        createdAt: toISOString(brand.createdAt) || new Date().toISOString(),
        updatedAt: toISOString(brand.updatedAt) || new Date().toISOString(),
        // Contact channels
        contactChannels: brand.contactChannels.map((ch: any) => ({
          id: ch.id,
          type: ch.type,
          label: ch.label,
          value: ch.value,
          isPrimary: ch.isPrimary,
          order: ch.order,
          metaJson: ch.metaJson,
        })),
        // Profile
        profile: brand.profile
          ? {
            id: brand.profile.id,
            version: brand.profile.version,
            optimizationScore: brand.profile.optimizationScore,
            optimizationScoreUpdatedAt: toISOString(brand.profile.optimizationScoreUpdatedAt),
            aiSummaryShort: brand.profile.aiSummaryShort,
            aiSummaryDetailed: brand.profile.aiSummaryDetailed,
            data: profileData,
            lastEditedAt: toISOString(brand.profile.lastEditedAt) || new Date().toISOString(),
            lastAiRefreshAt: toISOString(brand.profile.lastAiRefreshAt),
          }
          : null,
      },
    });
  });

  // GET /workspaces/:workspaceId/brands/:brandId - Get brand details
  app.get('/workspaces/:workspaceId/brands/:brandId', {
    preHandler: requireWorkspaceRoleFor('brand:view'),
    schema: {
      tags: ['Brand'],
      summary: 'Get brand details',
      description: 'Get detailed information about a specific brand including profile and contact channels. Requires VIEWER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };

    const brand = await getBrandById(brandId, workspaceId);

    if (!brand) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'BRAND_NOT_FOUND',
          message: 'Brand not found',
        },
      });
    }

    // Parse profile data safely
    let profileData: BrandProfileData | null = null;
    if (brand.profile?.data) {
      try {
        profileData = BrandProfileDataSchema.parse(brand.profile.data);
      } catch (e) {
        // Log error but don't fail - return null
        request.log.warn({ brandId, error: e }, 'Failed to parse brand profile data');
      }
    }

    // Generate logo URL if logo exists
    let logoUrl: string | null = null;
    if (brand.logoMedia) {
      logoUrl = await getMediaVariantUrlAsync(
        brand.logoMedia.bucket,
        brand.logoMedia.variants,
        'medium',
        brand.logoMedia.isPublic
      );
    }

    // Helper to safely convert to ISO string (handles both Date objects and strings from cache)
    const toISOString = (value: Date | string | null | undefined): string | null => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      }
      return null;
    };

    return reply.status(200).send({
      success: true,
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        industry: brand.industry,
        country: brand.country,
        city: brand.city,
        primaryLocale: brand.primaryLocale,
        timezone: brand.timezone,
        status: brand.status,
        logoMediaId: brand.logoMediaId,
        logoUrl,
        mediaCount: brand._count.media,
        createdAt: toISOString(brand.createdAt) || new Date().toISOString(),
        updatedAt: toISOString(brand.updatedAt) || new Date().toISOString(),
        // Contact channels
        contactChannels: brand.contactChannels.map((ch: any) => ({
          id: ch.id,
          type: ch.type,
          label: ch.label,
          value: ch.value,
          isPrimary: ch.isPrimary,
          order: ch.order,
          metaJson: ch.metaJson,
        })),
        // Profile
        profile: brand.profile
          ? {
            id: brand.profile.id,
            version: brand.profile.version,
            optimizationScore: brand.profile.optimizationScore,
            optimizationScoreUpdatedAt: toISOString(brand.profile.optimizationScoreUpdatedAt),
            aiSummaryShort: brand.profile.aiSummaryShort,
            aiSummaryDetailed: brand.profile.aiSummaryDetailed,
            data: profileData,
            lastEditedAt: toISOString(brand.profile.lastEditedAt) || new Date().toISOString(),
            lastAiRefreshAt: toISOString(brand.profile.lastAiRefreshAt),
          }
          : null,
      },
    });
  });

  // PATCH /workspaces/:workspaceId/brands/:brandId - Update brand
  app.patch('/workspaces/:workspaceId/brands/:brandId', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Brand'],
      summary: 'Update brand',
      description: 'Update brand information. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };
    const userId = request.auth?.userId;

    try {
      const brand = await updateBrand(brandId, workspaceId, request.body as any, userId);

      // Invalidate brands cache for this workspace
      await deleteCachePattern(`brands:workspace:${workspaceId}:*`);

      return reply.status(200).send({
        success: true,
        brand: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description,
          industry: brand.industry,
          country: brand.country,
          city: brand.city,
          primaryLocale: brand.primaryLocale,
          timezone: brand.timezone,
          status: brand.status,
          logoMediaId: brand.logoMediaId,
          updatedAt: brand.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'SLUG_TAKEN') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'SLUG_TAKEN',
              message: 'This slug is already taken',
            },
          });
        }
      }

      request.log.error({ error, workspaceId, brandId }, 'Brand update failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update brand',
        },
      });
    }
  });

  // DELETE /workspaces/:workspaceId/brands/:brandId - Delete brand
  app.delete('/workspaces/:workspaceId/brands/:brandId', {
    preHandler: requireWorkspaceRoleFor('brand:delete'),
    schema: {
      tags: ['Brand'],
      summary: 'Delete brand',
      description: 'Delete a brand and all associated data. Requires OWNER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };
    const userId = request.auth?.userId;

    try {
      await deleteBrand(brandId, workspaceId, userId);

      // Invalidate brands cache for this workspace
      await deleteCachePattern(`brands:workspace:${workspaceId}:*`);

      return reply.status(200).send({
        success: true,
        message: 'Brand deleted successfully',
      });
    } catch (error) {
      request.log.error({ error, workspaceId, brandId }, 'Brand deletion failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete brand',
        },
      });
    }
  });

  // GET /brands/slug/:slug/available - Check slug availability
  app.get('/brands/slug/:slug/available', {
    schema: {
      tags: ['Brand'],
      summary: 'Check brand slug availability',
      description: 'Check if a brand slug is available (globally unique)',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const { excludeBrandId } = request.query as { excludeBrandId?: string };

    const available = await isBrandSlugAvailable(slug, excludeBrandId);

    return reply.status(200).send({
      success: true,
      available,
      slug,
    });
  });

  // ============================================================================
  // Brand Profile Routes
  // ============================================================================

  // PUT /workspaces/:workspaceId/brands/:brandId/profile - Update brand profile
  app.put('/workspaces/:workspaceId/brands/:brandId/profile', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Brand Profile'],
      summary: 'Update brand profile',
      description: 'Update or create the brand profile data. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };
    const userId = request.auth?.userId;
    const body = request.body as { profileData: unknown; optimizationScore?: number | null };

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
        },
      });
    }

    try {
      const profile = await updateBrandProfile({
        brandId,
        workspaceId,
        profileData: body.profileData,
        optimizationScore: body.optimizationScore,
        editorUserId: userId,
      });

      // Parse profile data for response
      let profileData: BrandProfileData | null = null;
      if (profile.data) {
        try {
          profileData = BrandProfileDataSchema.parse(profile.data);
        } catch (e) {
          request.log.warn({ brandId, error: e }, 'Failed to parse brand profile data');
        }
      }

      return reply.status(200).send({
        success: true,
        profile: {
          id: profile.id,
          version: profile.version,
          optimizationScore: profile.optimizationScore,
          optimizationScoreUpdatedAt: profile.optimizationScoreUpdatedAt?.toISOString() ?? null,
          aiSummaryShort: profile.aiSummaryShort,
          aiSummaryDetailed: profile.aiSummaryDetailed,
          data: profileData,
          lastEditedAt: profile.lastEditedAt.toISOString(),
          lastAiRefreshAt: profile.lastAiRefreshAt?.toISOString() ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile data format',
            details: error,
          },
        });
      }

      request.log.error({ error, workspaceId, brandId }, 'Brand profile update failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update brand profile',
        },
      });
    }
  });

  // ============================================================================
  // Brand Contact Channel Routes
  // ============================================================================

  // GET /workspaces/:workspaceId/brands/:brandId/contacts - List contact channels
  app.get('/workspaces/:workspaceId/brands/:brandId/contacts', {
    preHandler: requireWorkspaceRoleFor('brand:view'),
    schema: {
      tags: ['Brand Contacts'],
      summary: 'List brand contact channels',
      description: 'Get all contact channels for a brand. Requires VIEWER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = request.params as { brandId: string };

    const channels = await listBrandContactChannels(brandId);

    return reply.status(200).send({
      success: true,
      contactChannels: channels.map((ch) => ({
        id: ch.id,
        type: ch.type,
        label: ch.label,
        value: ch.value,
        isPrimary: ch.isPrimary,
        order: ch.order,
        metaJson: ch.metaJson,
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
      })),
    });
  });

  // POST /workspaces/:workspaceId/brands/:brandId/contacts - Create contact channel
  app.post('/workspaces/:workspaceId/brands/:brandId/contacts', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Brand Contacts'],
      summary: 'Create contact channel',
      description: 'Add a new contact channel to the brand. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };
    const userId = request.auth?.userId;

    try {
      const channel = await createBrandContactChannel(brandId, workspaceId, request.body as any, userId);

      return reply.status(201).send({
        success: true,
        contactChannel: {
          id: channel.id,
          type: channel.type,
          label: channel.label,
          value: channel.value,
          isPrimary: channel.isPrimary,
          order: channel.order,
          metaJson: channel.metaJson,
          createdAt: channel.createdAt.toISOString(),
          updatedAt: channel.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid contact channel data',
            details: error,
          },
        });
      }

      request.log.error({ error, workspaceId, brandId }, 'Contact channel creation failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create contact channel',
        },
      });
    }
  });

  // PATCH /workspaces/:workspaceId/brands/:brandId/contacts/:channelId - Update contact channel
  app.patch('/workspaces/:workspaceId/brands/:brandId/contacts/:channelId', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Brand Contacts'],
      summary: 'Update contact channel',
      description: 'Update an existing contact channel. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId, channelId } = request.params as {
      workspaceId: string;
      brandId: string;
      channelId: string;
    };
    const userId = request.auth?.userId;

    try {
      const channel = await updateBrandContactChannel(channelId, brandId, workspaceId, request.body as any, userId);

      return reply.status(200).send({
        success: true,
        contactChannel: {
          id: channel.id,
          type: channel.type,
          label: channel.label,
          value: channel.value,
          isPrimary: channel.isPrimary,
          order: channel.order,
          metaJson: channel.metaJson,
          createdAt: channel.createdAt.toISOString(),
          updatedAt: channel.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'CONTACT_CHANNEL_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'CONTACT_CHANNEL_NOT_FOUND',
              message: 'Contact channel not found',
            },
          });
        }
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid contact channel data',
              details: error,
            },
          });
        }
      }

      request.log.error({ error, workspaceId, brandId, channelId }, 'Contact channel update failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update contact channel',
        },
      });
    }
  });

  // DELETE /workspaces/:workspaceId/brands/:brandId/contacts/:channelId - Delete contact channel
  app.delete('/workspaces/:workspaceId/brands/:brandId/contacts/:channelId', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Brand Contacts'],
      summary: 'Delete contact channel',
      description: 'Remove a contact channel from the brand. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId, channelId } = request.params as {
      workspaceId: string;
      brandId: string;
      channelId: string;
    };
    const userId = request.auth?.userId;

    try {
      await deleteBrandContactChannel(channelId, brandId, workspaceId, userId);

      return reply.status(200).send({
        success: true,
        message: 'Contact channel deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'CONTACT_CHANNEL_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'CONTACT_CHANNEL_NOT_FOUND',
            message: 'Contact channel not found',
          },
        });
      }

      request.log.error({ error, workspaceId, brandId, channelId }, 'Contact channel deletion failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete contact channel',
        },
      });
    }
  });

  // PUT /workspaces/:workspaceId/brands/:brandId/contacts/reorder - Reorder contact channels
  app.put('/workspaces/:workspaceId/brands/:brandId/contacts/reorder', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Brand Contacts'],
      summary: 'Reorder contact channels',
      description: 'Bulk update the order of contact channels. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = request.params as { brandId: string };
    const body = request.body as { orders: { id: string; order: number }[] };

    try {
      await reorderBrandContactChannels(brandId, body.orders);

      return reply.status(200).send({
        success: true,
        message: 'Contact channels reordered successfully',
      });
    } catch (error) {
      request.log.error({ error, brandId }, 'Contact channel reordering failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'REORDER_FAILED',
          message: 'Failed to reorder contact channels',
        },
      });
    }
  });

  // ============================================================================
  // Brand Optimization Score Routes
  // ============================================================================

  // GET /workspaces/:workspaceId/brands/:brandId/optimization-score - Calculate optimization score
  app.get('/workspaces/:workspaceId/brands/:brandId/optimization-score', {
    preHandler: requireWorkspaceRoleFor('brand:view'),
    schema: {
      tags: ['Brand Optimization'],
      summary: 'Calculate brand optimization score',
      description: 'Calculate and return the brand optimization score without saving it. Shows detailed breakdown and improvement suggestions. Requires VIEWER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };

    try {
      const result = await calculateAndGetBrandOptimizationScore(brandId, workspaceId);

      return reply.status(200).send({
        success: true,
        optimizationScore: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'BRAND_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      request.log.error({ error, workspaceId, brandId }, 'Optimization score calculation failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CALCULATION_FAILED',
          message: 'Failed to calculate optimization score',
        },
      });
    }
  });

  // POST /workspaces/:workspaceId/brands/:brandId/optimization-score/refresh - Calculate and save optimization score
  app.post('/workspaces/:workspaceId/brands/:brandId/optimization-score/refresh', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Brand Optimization'],
      summary: 'Refresh brand optimization score',
      description: 'Calculate and save the brand optimization score to the profile. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };
    const userId = request.auth?.userId;

    try {
      const result = await updateBrandOptimizationScore(brandId, workspaceId, userId);

      return reply.status(200).send({
        success: true,
        message: 'Optimization score refreshed successfully',
        optimizationScore: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'BRAND_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      request.log.error({ error, workspaceId, brandId }, 'Optimization score refresh failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Failed to refresh optimization score',
        },
      });
    }
  });
}

