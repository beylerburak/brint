import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PERMISSIONS } from '../../core/auth/permissions.registry.js';
import { requirePermission } from '../../core/auth/require-permission.js';
import { checkLimit, UnsupportedLimitError } from '../../core/subscription/limit-service.js';
import { isLimitKey, LIMIT_KEY_REGISTRY, type LimitKey } from '../../core/subscription/limit-keys.js';

interface UsageQuery {
  limitKey?: string;
  brandId?: string;
}

interface UsageParams {
  workspaceId: string;
}

export async function registerUsageRoutes(app: FastifyInstance) {
  app.get(
    '/workspaces/:workspaceId/usage',
    {
      preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)],
      schema: {
        tags: ['Workspaces'],
        summary: 'Get usage for a subscription limit key',
        querystring: {
          type: 'object',
          properties: {
            limitKey: { type: 'string' },
            brandId: { type: 'string' },
          },
          required: ['limitKey'],
        },
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
          },
          required: ['workspaceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  limitKey: { type: 'string' },
                  plan: { type: 'string' },
                  current: { type: 'number' },
                  limit: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                  remaining: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                  isUnlimited: { type: 'boolean' },
                },
                required: ['limitKey', 'plan', 'current', 'limit', 'remaining', 'isUnlimited'],
              },
            },
            required: ['success', 'data'],
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: UsageQuery; Params: UsageParams }>,
      reply: FastifyReply
    ) => {
      const { limitKey: limitKeyRaw, brandId } = request.query;
      const { workspaceId } = request.params;

      if (!limitKeyRaw || !isLimitKey(limitKeyRaw)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_LIMIT_KEY',
            message: 'limitKey is required and must be a known limit',
          },
        });
      }

      const limitKey = limitKeyRaw as LimitKey;
      const definition = LIMIT_KEY_REGISTRY[limitKey];

      if (definition.scope === 'brand' && !brandId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BRAND_ID_REQUIRED',
            message: `brandId is required for ${limitKey}`,
          },
        });
      }

      if (request.auth?.workspaceId && request.auth.workspaceId !== workspaceId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'WORKSPACE_MISMATCH',
            message: 'Workspace in header does not match requested workspace',
          },
        });
      }

      try {
        const decision = await checkLimit({
          limitKey,
          workspaceId,
          brandId,
          userId: request.auth?.userId,
          amount: 0, // we only want current usage, not a projection
        });

        return reply.send({
          success: true,
          data: {
            limitKey,
            plan: decision.plan,
            current: decision.current,
            limit: decision.isUnlimited ? null : decision.limit,
            remaining: decision.isUnlimited ? null : decision.remaining,
            isUnlimited: decision.isUnlimited,
          },
        });
      } catch (error: unknown) {
        if (error instanceof UnsupportedLimitError) {
          return reply.status(501).send({
            success: false,
            error: {
              code: 'LIMIT_NOT_IMPLEMENTED',
              message: error.message,
            },
          });
        }

        throw error;
      }
    }
  );
}
