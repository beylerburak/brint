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
} from './brand.service.js';
import {
  BrandProfileDataSchema,
  type BrandProfileData,
} from './domain/brand-profile.schema.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';
import { prisma } from '../../lib/prisma.js';

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

    return reply.status(200).send({
      success: true,
      brands: brandsWithUrls,
      total: brandsWithUrls.length,
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
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
        // Contact channels
        contactChannels: brand.contactChannels.map((ch) => ({
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
              optimizationScoreUpdatedAt: brand.profile.optimizationScoreUpdatedAt?.toISOString() ?? null,
              aiSummaryShort: brand.profile.aiSummaryShort,
              aiSummaryDetailed: brand.profile.aiSummaryDetailed,
              data: profileData,
              lastEditedAt: brand.profile.lastEditedAt.toISOString(),
              lastAiRefreshAt: brand.profile.lastAiRefreshAt?.toISOString() ?? null,
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
}

