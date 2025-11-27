import type { FastifyReply, FastifyRequest } from 'fastify';
import { assertWithinLimit, LimitExceededError, UnsupportedLimitError, type CheckLimitInput } from './limit-service.js';
import { BrandNotFoundError } from './usage.service.js';
import type { LimitKey } from './limit-keys.js';
import type { SubscriptionPlan } from './plans.js';

export interface LimitContextResolverInput extends Partial<CheckLimitInput> {
  planOverride?: SubscriptionPlan;
}

export type LimitContextResolver = (req: FastifyRequest) => Promise<LimitContextResolverInput> | LimitContextResolverInput;

/**
 * Fastify preHandler factory to enforce subscription limits on write endpoints.
 *
 * Usage:
 * app.post('/brands', {
 *   preHandler: [
 *     createLimitGuard('brand.maxCount', async (req) => ({
 *       workspaceId: req.auth?.workspaceId,
 *       userId: req.auth?.userId,
 *     }))
 *   ]
 * }, handler)
 */
export function createLimitGuard(limitKey: LimitKey, resolveContext: LimitContextResolver) {
  return async function limitGuard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const ctx = await resolveContext(request);
      await assertWithinLimit({
        limitKey,
        workspaceId: ctx.workspaceId ?? request.auth?.workspaceId,
        brandId: ctx.brandId ?? request.auth?.brandId,
        userId: ctx.userId ?? request.auth?.userId,
        amount: ctx.amount,
        current: ctx.current,
        planOverride: ctx.planOverride,
      });
    } catch (error: unknown) {
      if (error instanceof LimitExceededError) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: 'Subscription limit reached for this action',
            details: error.decision,
          },
        });
      }

      if (error instanceof UnsupportedLimitError) {
        return reply.status(501).send({
          success: false,
          error: {
            code: 'LIMIT_NOT_IMPLEMENTED',
            message: error.message,
          },
        });
      }

      if (error instanceof BrandNotFoundError) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: error.message,
          },
        });
      }

      // Unknown/unhandled errors bubble up to the global error handler
      throw error;
    }
  };
}
