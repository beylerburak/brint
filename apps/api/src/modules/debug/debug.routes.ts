import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../core/auth/permissions.registry.js';
import { requirePermission } from '../../core/auth/require-permission.js';

/**
 * Registers debug routes for development and testing
 * - GET /debug/auth - Returns current auth context
 * - GET /debug/protected - Protected endpoint (requires workspace:settings.manage)
 */
export async function registerDebugRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/debug/auth',
    {
      schema: {
        tags: ['Debug'],
        summary: 'Returns current auth context (for debugging)',
        description:
          'Returns the auth context attached to the current request. ' +
          'Requires Authorization: Bearer <token> header and optionally X-Workspace-Id and X-Brand-Id headers.',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              auth: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      workspaceId: { type: ['string', 'null'] },
                      brandId: { type: ['string', 'null'] },
                      tokenType: { type: 'string' },
                      tokenPayload: {
                        type: 'object',
                        properties: {
                          sub: { type: 'string' },
                          wid: { type: ['string', 'null'] },
                          bid: { type: ['string', 'null'] },
                          type: { type: 'string' },
                          iat: { type: ['number', 'null'] },
                          exp: { type: ['number', 'null'] },
                        },
                      },
                    },
                    required: ['userId', 'tokenType', 'tokenPayload'],
                  },
                ],
              },
            },
            required: ['success', 'auth'],
          },
        },
      },
    },
    async (request, reply) => {
      return reply.status(200).send({
        success: true,
        auth: request.auth ?? null,
      });
    }
  );

  app.get(
    '/debug/protected',
    {
      preHandler: [
        requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_MANAGE),
      ],
      schema: {
        tags: ['Debug'],
        summary: 'Protected debug endpoint (requires workspace:settings.manage)',
        description:
          'Protected endpoint that requires workspace:settings.manage permission. ' +
          'Requires Authorization: Bearer <token> header and X-Workspace-Id header.',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              auth: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      workspaceId: { type: ['string', 'null'] },
                      brandId: { type: ['string', 'null'] },
                    },
                  },
                ],
              },
            },
            required: ['success', 'message', 'auth'],
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
      return reply.status(200).send({
        success: true,
        message: 'You have workspace:settings.manage',
        auth: request.auth
          ? {
              userId: request.auth.userId,
              workspaceId: request.auth.workspaceId ?? null,
              brandId: request.auth.brandId ?? null,
            }
          : null,
      });
    }
  );

  // Test endpoint for Sentry
  app.get(
    '/debug/sentry-test',
    {
      schema: {
        tags: ['Debug'],
        summary: 'Test Sentry error reporting',
        description: 'Throws a test error to verify Sentry integration',
        response: {
          500: {
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
    },
    async (request, reply) => {
      // Throw a test error to verify Sentry integration
      throw new Error('Sentry test error - this should appear in Sentry dashboard');
    }
  );
}

