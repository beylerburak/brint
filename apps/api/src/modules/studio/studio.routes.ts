import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../core/auth/permissions.registry.js';
import { requirePermission } from '../../core/auth/require-permission.js';
import { brandStudioService } from '../brand/brand-studio.service.js';

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
}

