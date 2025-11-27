import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '../../core/auth/permissions.registry.js';
import { requirePermission } from '../../core/auth/require-permission.js';
import { brandStudioService } from '../brand/brand-studio.service.js';
import { prisma } from '../../lib/prisma.js';
import { createLimitGuard } from '../../core/subscription/limit-checker.js';
import { brandRepository } from '../brand/brand.repository.js';
import { permissionService } from '../../core/auth/permission.service.js';
import { ForbiddenError, UnauthorizedError } from '../../lib/http-errors.js';

/**
 * Registers studio routes
 * - GET /studio/brands - Returns accessible brands for the authenticated user in the workspace
 */
export async function registerStudioRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/brands',
    {
      preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)],
      schema: {
        tags: ['Studio'],
        summary: 'Get accessible brands for the current workspace',
        description:
          'Returns brands that the authenticated user can access in the current workspace. ' +
          'Requires Authorization: Bearer <token> header and X-Workspace-Id header. ' +
          'Requires studio:brand.view permission.',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  workspaceId: { type: 'string' },
                  hasBrandViewPermission: { type: 'boolean' },
                  effectivePermissions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  brands: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        workspaceId: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        description: { type: ['string', 'null'] },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                      required: [
                        'id',
                        'workspaceId',
                        'name',
                        'slug',
                        'isActive',
                        'createdAt',
                        'updatedAt',
                      ],
                    },
                  },
                },
                required: [
                  'userId',
                  'workspaceId',
                  'hasBrandViewPermission',
                  'effectivePermissions',
                  'brands',
                ],
              },
            },
            required: ['success', 'data'],
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['code', 'message'],
              },
            },
            required: ['success', 'error'],
          },
          403: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['code', 'message'],
              },
            },
            required: ['success', 'error'],
          },
        },
      },
    },
    async (request, reply) => {
      // Auth context is guaranteed by requirePermission middleware
      if (!request.auth || !request.auth.userId || !request.auth.workspaceId) {
        // This should never happen due to requirePermission, but adding guard for safety
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const { userId, workspaceId } = request.auth;

      // Get accessible brands using brand studio service
      const result = await brandStudioService.getAccessibleBrands({
        userId,
        workspaceId,
      });

      // Convert brands to JSON format
      const brandsJson = result.brands.map((brand) => brand.toJSON());

      return reply.status(200).send({
        success: true,
        data: {
          userId: result.userId,
          workspaceId: result.workspaceId,
          hasBrandViewPermission: result.hasBrandViewPermission,
          effectivePermissions: result.effectivePermissions,
          brands: brandsJson,
        },
      });
    }
  );

  // POST /studio/brands - create brand with subscription limit guard
  app.post(
    '/brands',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_BRAND_CREATE),
        createLimitGuard('brand.maxCount', (req) => ({
          workspaceId: req.auth?.workspaceId,
          userId: req.auth?.userId,
        })),
      ],
      schema: {
        tags: ['Studio'],
        summary: 'Create brand in current workspace',
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.auth?.workspaceId || !request.auth.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Workspace context is required' },
        });
      }

      try {
        const brand = await brandRepository.createBrand({
          workspaceId: request.auth.workspaceId,
          name: (request.body as any).name,
          slug: (request.body as any).slug,
          description: (request.body as any).description ?? null,
          createdBy: request.auth.userId,
        });

        return reply.status(201).send({ success: true, data: brand.toJSON() });
      } catch (error: any) {
        if (error instanceof Error && error.message.includes('already exists')) {
          return reply.status(409).send({
            success: false,
            error: { code: 'BRAND_SLUG_EXISTS', message: error.message },
          });
        }
        throw error;
      }
    }
  );

  // POST /studio/brands/:brandId/social-accounts - link social account with limit guard
  app.post(
    '/brands/:brandId/social-accounts',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_BRAND_CREATE),
        createLimitGuard('brand.socialAccount.maxCount', (req) => ({
          brandId: (req.params as any).brandId,
          workspaceId: req.auth?.workspaceId,
        })),
      ],
      schema: {
        tags: ['Studio'],
        summary: 'Add social account to brand',
        params: {
          type: 'object',
          properties: { brandId: { type: 'string' } },
          required: ['brandId'],
        },
        body: {
          type: 'object',
          required: ['provider', 'externalId', 'handle'],
          properties: {
            provider: { type: 'string' },
            externalId: { type: 'string' },
            handle: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      const body = request.body as any;

      if (!request.auth?.workspaceId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Workspace context is required' },
        });
      }

      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, workspaceId: true },
      });

      if (!brand || brand.workspaceId !== request.auth.workspaceId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'BRAND_NOT_FOUND', message: 'Brand not found in workspace' },
        });
      }

      try {
        const socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: brand.workspaceId,
            brandId: brand.id,
            provider: body.provider,
            externalId: body.externalId,
            handle: body.handle,
            displayName: body.displayName ?? null,
          },
        });

        return reply.status(201).send({ success: true, data: socialAccount });
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: { code: 'SOCIAL_ACCOUNT_EXISTS', message: 'Social account already linked for this brand' },
          });
        }
        throw error;
      }
    }
  );

  // POST /studio/brands/:brandId/contents - create brand content with monthly limit guard
  app.post(
    '/brands/:brandId/contents',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_CONTENT_CREATE),
        async (req) => {
          const status = (req.body as any)?.status;
          if (status === 'published') {
            const { userId, workspaceId } = req.auth ?? {};
            if (!userId || !workspaceId) {
              throw new UnauthorizedError('AUTH_REQUIRED');
            }
            const canPublish = await permissionService.hasPermission({
              userId,
              workspaceId,
              permission: PERMISSIONS.STUDIO_CONTENT_PUBLISH,
            });
            if (!canPublish) {
              throw new ForbiddenError('PERMISSION_DENIED', {
                permission: PERMISSIONS.STUDIO_CONTENT_PUBLISH,
              });
            }
          }
        },
        createLimitGuard('brand.content.maxCountPerMonth', (req) => ({
          brandId: (req.params as any).brandId,
          workspaceId: req.auth?.workspaceId,
        })),
      ],
      schema: {
        tags: ['Studio'],
        summary: 'Create content for a brand (counts toward monthly limit)',
        params: {
          type: 'object',
          properties: { brandId: { type: 'string' } },
          required: ['brandId'],
        },
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published'] },
            scheduledAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      const body = request.body as any;

      if (!request.auth?.workspaceId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Workspace context is required' },
        });
      }

      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, workspaceId: true },
      });

      if (!brand || brand.workspaceId !== request.auth.workspaceId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'BRAND_NOT_FOUND', message: 'Brand not found in workspace' },
        });
      }

      const now = new Date();
      const content = await prisma.brandContent.create({
        data: {
          workspaceId: brand.workspaceId,
          brandId: brand.id,
          title: body.title,
          body: body.body ?? null,
          status: body.status ?? 'draft',
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          publishedAt: body.status === 'published' ? now : null,
        },
      });

      return reply.status(201).send({ success: true, data: content });
    }
  );
}
