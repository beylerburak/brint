import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PERMISSIONS } from '../../core/auth/permissions.registry.js';
import { requirePermission } from '../../core/auth/require-permission.js';
import { brandStudioService } from '../brand/brand-studio.service.js';
import { prisma } from '../../lib/prisma.js';
import { createLimitGuard } from '../../core/subscription/limit-checker.js';
import { brandRepository } from '../brand/brand.repository.js';
import { permissionService } from '../../core/auth/permission.service.js';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../lib/http-errors.js';

type CreateBrandBody = {
  name: string;
  slug: string;
  description?: string | null;
};

type WorkspaceParams = {
  workspaceId: string;
};

type BrandParams = {
  brandId: string;
};

type CreateSocialAccountBody = {
  provider: string;
  externalId: string;
  handle: string;
  displayName?: string | null;
};

type CreateContentBody = {
  title: string;
  body?: string | null;
  status?: 'draft' | 'published';
  scheduledAt?: string;
};

const CreateBrandSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).nullable().optional(),
});

const CreateSocialAccountSchema = z.object({
  provider: z.string().trim().min(2).max(50),
  externalId: z.string().trim().min(2).max(255),
  handle: z.string().trim().min(1).max(255),
  displayName: z.string().trim().max(255).nullable().optional(),
});

const CreateContentSchema = z.object({
  title: z.string().trim().min(1).max(500),
  body: z.string().trim().nullable().optional(),
  status: z.enum(['draft', 'published']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

/**
 * Registers studio routes
 * - GET /studio/brands - Returns accessible brands for the authenticated user in the workspace
 */
export async function registerStudioRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/studio/brands',
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
        throw new UnauthorizedError('UNAUTHORIZED');
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

  app.get(
    '/workspaces/:workspaceId/studio/brands',
    {
      preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)],
      schema: {
        tags: ['Studio'],
        summary: 'Get accessible brands for the current workspace (path-scoped)',
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string' } },
          required: ['workspaceId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: WorkspaceParams }>, reply) => {
      if (!request.auth?.workspaceId) {
        throw new UnauthorizedError('UNAUTHORIZED');
      }

      if (request.auth.workspaceId !== request.params.workspaceId) {
        throw new ForbiddenError('WORKSPACE_MISMATCH', { headerWorkspaceId: request.auth.workspaceId, paramWorkspaceId: request.params.workspaceId });
      }

      const { userId, workspaceId } = request.auth;
      const result = await brandStudioService.getAccessibleBrands({
        userId,
        workspaceId,
      });
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
    '/studio/brands',
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
    async (request: FastifyRequest<{ Body: CreateBrandBody }>, reply: FastifyReply) => {
      if (!request.auth?.workspaceId || !request.auth.userId) {
        throw new UnauthorizedError('UNAUTHORIZED', undefined, 'Workspace context is required');
      }

      const parsed = CreateBrandSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('INVALID_BODY', 'Invalid brand payload', parsed.error.flatten());
      }

      try {
        const brand = await brandRepository.createBrand({
          workspaceId: request.auth.workspaceId,
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description ?? null,
          createdBy: request.auth.userId,
        });

        return reply.status(201).send({ success: true, data: brand.toJSON() });
      } catch (error: any) {
        if (error instanceof Error && error.message.includes('already exists')) {
          throw new ConflictError('BRAND_SLUG_EXISTS', error.message);
        }
        throw error;
      }
    }
  );

  app.post(
    '/workspaces/:workspaceId/studio/brands',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_BRAND_CREATE),
        createLimitGuard('brand.maxCount', (req: FastifyRequest<{ Params: WorkspaceParams }>) => ({
          workspaceId: req.params.workspaceId,
          userId: req.auth?.userId,
        })),
      ],
      schema: {
        tags: ['Studio'],
        summary: 'Create brand in workspace (path-scoped)',
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string' } },
          required: ['workspaceId'],
        },
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
    async (request: FastifyRequest<{ Params: WorkspaceParams; Body: CreateBrandBody }>, reply: FastifyReply) => {
      if (!request.auth?.workspaceId || !request.auth.userId) {
        throw new UnauthorizedError('UNAUTHORIZED', undefined, 'Workspace context is required');
      }

      if (request.auth.workspaceId !== request.params.workspaceId) {
        throw new ForbiddenError('WORKSPACE_MISMATCH', { headerWorkspaceId: request.auth.workspaceId, paramWorkspaceId: request.params.workspaceId });
      }

      const parsed = CreateBrandSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('INVALID_BODY', 'Invalid brand payload', parsed.error.flatten());
      }

      try {
        const brand = await brandRepository.createBrand({
          workspaceId: request.params.workspaceId,
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description ?? null,
          createdBy: request.auth.userId,
        });

        return reply.status(201).send({ success: true, data: brand.toJSON() });
      } catch (error: any) {
        if (error instanceof Error && error.message.includes('already exists')) {
          throw new ConflictError('BRAND_SLUG_EXISTS', error.message);
        }
        throw error;
      }
    }
  );

  // POST /studio/brands/:brandId/social-accounts - link social account with limit guard
  app.post(
    '/studio/brands/:brandId/social-accounts',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_BRAND_CREATE),
        createLimitGuard('brand.socialAccount.maxCount', (req: FastifyRequest<{ Params: BrandParams }>) => ({
          brandId: req.params.brandId,
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
    async (
      request: FastifyRequest<{ Params: BrandParams; Body: CreateSocialAccountBody }>,
      reply: FastifyReply
    ) => {
      const { brandId } = request.params;
      const parsed = CreateSocialAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('INVALID_BODY', 'Invalid social account payload', parsed.error.flatten());
      }
      const body = parsed.data;

      if (!request.auth?.workspaceId) {
        throw new UnauthorizedError('UNAUTHORIZED', undefined, 'Workspace context is required');
      }

      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, workspaceId: true },
      });

      if (!brand || brand.workspaceId !== request.auth.workspaceId) {
        throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found in workspace');
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
          throw new ConflictError('SOCIAL_ACCOUNT_EXISTS', 'Social account already linked for this brand');
        }
        throw error;
      }
    }
  );

  app.post(
    '/workspaces/:workspaceId/studio/brands/:brandId/social-accounts',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_BRAND_CREATE),
        createLimitGuard('brand.socialAccount.maxCount', (req: FastifyRequest<{ Params: WorkspaceParams & BrandParams }>) => ({
          brandId: req.params.brandId,
          workspaceId: req.params.workspaceId,
        })),
      ],
      schema: {
        tags: ['Studio'],
        summary: 'Add social account to brand (path-scoped)',
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string' }, brandId: { type: 'string' } },
          required: ['workspaceId', 'brandId'],
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
    async (request: FastifyRequest<{ Params: WorkspaceParams & BrandParams; Body: CreateSocialAccountBody }>, reply: FastifyReply) => {
      if (!request.auth?.workspaceId) {
        throw new UnauthorizedError('UNAUTHORIZED', undefined, 'Workspace context is required');
      }

      if (request.auth.workspaceId !== request.params.workspaceId) {
        throw new ForbiddenError('WORKSPACE_MISMATCH', { headerWorkspaceId: request.auth.workspaceId, paramWorkspaceId: request.params.workspaceId });
      }

      const parsed = CreateSocialAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('INVALID_BODY', 'Invalid social account payload', parsed.error.flatten());
      }
      const body = parsed.data;
      const brand = await prisma.brand.findUnique({
        where: { id: request.params.brandId },
        select: { id: true, workspaceId: true },
      });

      if (!brand || brand.workspaceId !== request.params.workspaceId) {
        throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found in workspace');
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
          throw new ConflictError('SOCIAL_ACCOUNT_EXISTS', 'Social account already linked for this brand');
        }
        throw error;
      }
    }
  );

  // POST /studio/brands/:brandId/contents - create brand content with monthly limit guard
  app.post(
    '/studio/brands/:brandId/contents',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_CONTENT_CREATE),
        async (req: FastifyRequest<{ Body: CreateContentBody }>, reply: FastifyReply) => {
          const parsed = CreateContentSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('INVALID_BODY', 'Invalid content payload', parsed.error.flatten());
          }
          req.body = parsed.data;
        },
        async (req: FastifyRequest<{ Body: CreateContentBody }>) => {
          const status = req.body?.status;
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
        createLimitGuard('brand.content.maxCountPerMonth', (req: FastifyRequest<{ Params: BrandParams }>) => ({
          brandId: req.params.brandId,
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
    async (
      request: FastifyRequest<{ Params: BrandParams; Body: CreateContentBody }>,
      reply: FastifyReply
    ) => {
      const { brandId } = request.params;
      const parsed = CreateContentSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('INVALID_BODY', 'Invalid content payload', parsed.error.flatten());
      }
      const body = parsed.data;

      if (!request.auth?.workspaceId) {
        throw new UnauthorizedError('UNAUTHORIZED', undefined, 'Workspace context is required');
      }

      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, workspaceId: true },
      });

      if (!brand || brand.workspaceId !== request.auth.workspaceId) {
        throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found in workspace');
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

  app.post(
    '/workspaces/:workspaceId/studio/brands/:brandId/contents',
    {
      preHandler: [
        requirePermission(PERMISSIONS.STUDIO_CONTENT_CREATE),
        async (req: FastifyRequest<{ Params: WorkspaceParams & BrandParams; Body: CreateContentBody }>, reply: FastifyReply) => {
          const parsed = CreateContentSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('INVALID_BODY', 'Invalid content payload', parsed.error.flatten());
          }
          req.body = parsed.data;
        },
        async (req: FastifyRequest<{ Params: WorkspaceParams & BrandParams; Body: CreateContentBody }>) => {
          const status = req.body?.status;
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
        createLimitGuard('brand.content.maxCountPerMonth', (req: FastifyRequest<{ Params: WorkspaceParams & BrandParams }>) => ({
          brandId: req.params.brandId,
          workspaceId: req.params.workspaceId,
        })),
      ],
      schema: {
        tags: ['Studio'],
        summary: 'Create content for a brand (path-scoped)',
        params: {
          type: 'object',
          properties: { workspaceId: { type: 'string' }, brandId: { type: 'string' } },
          required: ['workspaceId', 'brandId'],
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
    async (request: FastifyRequest<{ Params: WorkspaceParams & BrandParams; Body: CreateContentBody }>, reply: FastifyReply) => {
      if (!request.auth?.workspaceId) {
        throw new UnauthorizedError('UNAUTHORIZED', undefined, 'Workspace context is required');
      }

      if (request.auth.workspaceId !== request.params.workspaceId) {
        throw new ForbiddenError('WORKSPACE_MISMATCH', { headerWorkspaceId: request.auth.workspaceId, paramWorkspaceId: request.params.workspaceId });
      }

      const parsed = CreateContentSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new BadRequestError('INVALID_BODY', 'Invalid content payload', parsed.error.flatten());
      }
      const body = parsed.data;

      const brand = await prisma.brand.findUnique({
        where: { id: request.params.brandId },
        select: { id: true, workspaceId: true },
      });

      if (!brand || brand.workspaceId !== request.params.workspaceId) {
        throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found in workspace');
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
