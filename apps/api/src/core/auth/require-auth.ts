import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../lib/http-errors.js';

/**
 * Simple auth guard for routes that only need a logged-in user.
 * Use in preHandler: [requireAuth()]
 */
export function requireAuth() {
  return async function requireAuthGuard(request: FastifyRequest, _reply: FastifyReply) {
    if (!request.auth?.userId) {
      throw new UnauthorizedError('UNAUTHORIZED', undefined, 'Authentication required');
    }
  };
}
