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
  listBrands,
  isBrandSlugAvailable,
} from './brand.service.js';
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

    try {
      const brand = await createBrand(workspaceId, request.body as any);

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
      description: 'Get detailed information about a specific brand. Requires VIEWER role.',
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
        mediaCount: brand._count.media,
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
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

    try {
      const brand = await updateBrand(brandId, workspaceId, request.body as any);

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

    try {
      await deleteBrand(brandId, workspaceId);

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
}

