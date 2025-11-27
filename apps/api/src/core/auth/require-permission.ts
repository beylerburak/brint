/**
 * requirePermission Middleware
 * 
 * Reusable permission guard for Fastify routes.
 * Checks if the authenticated user has the required permission in the current workspace.
 * 
 * Usage:
 * ```ts
 * app.get('/protected', {
 *   preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)],
 *   // ...
 * }, handler);
 * ```
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PermissionKey } from './permissions.registry.js';
import { permissionService } from './permission.service.js';
import { logger } from '../../lib/logger.js';
import { ForbiddenError, UnauthorizedError } from '../../lib/http-errors.js';

/**
 * Creates a permission guard middleware for Fastify routes
 * 
 * @param permission - The permission key required to access the route
 * @returns A Fastify preHandler function that checks the permission
 */
export function requirePermission(permission: PermissionKey) {
  return async function permissionGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const { userId, workspaceId } = request.auth ?? {};

    if (!userId || !workspaceId) {
      logger.warn(
        {
          permission,
          reason: 'missing-auth',
          method: request.method,
          url: request.url,
          userId,
          workspaceId,
        },
        'Permission check failed: missing auth context'
      );

      throw new UnauthorizedError('AUTH_REQUIRED');
    }

    // Check if user has the required permission
    const hasPermission = await permissionService.hasPermission({
      userId,
      workspaceId,
      permission,
    });

    if (!hasPermission) {
      logger.warn(
        {
          permission,
          reason: 'missing-permission',
          userId,
          workspaceId,
          method: request.method,
          url: request.url,
        },
        'Permission check failed: user does not have required permission'
      );

      throw new ForbiddenError('PERMISSION_DENIED', { permission });
    }

    // Permission check passed - continue to handler
    // (no return needed, void is fine)
  };
}
