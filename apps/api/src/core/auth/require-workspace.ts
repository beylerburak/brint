import type { FastifyReply, FastifyRequest } from 'fastify';
import { BadRequestError, ForbiddenError } from '../../lib/http-errors.js';

/**
 * Ensures the request has X-Workspace-Id (via auth context) and matches the :workspaceId param.
 * Use only on routes that have `workspaceId` in params.
 */
export function requireWorkspaceMatch() {
  return async function workspaceMatchGuard(request: FastifyRequest, _reply: FastifyReply) {
    const params = request.params as Record<string, unknown> | undefined;
    const paramWorkspaceId = params?.workspaceId as string | undefined;
    const headerWorkspaceId = request.auth?.workspaceId;

    if (!headerWorkspaceId) {
      throw new BadRequestError('WORKSPACE_ID_REQUIRED', 'X-Workspace-Id header is required');
    }

    if (!paramWorkspaceId) {
      throw new BadRequestError('WORKSPACE_ID_PARAM_REQUIRED', 'workspaceId param is required');
    }

    if (headerWorkspaceId !== paramWorkspaceId) {
      throw new ForbiddenError('WORKSPACE_MISMATCH', { headerWorkspaceId, paramWorkspaceId });
    }
  };
}
