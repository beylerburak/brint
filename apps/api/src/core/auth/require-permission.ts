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
    // Check if auth context exists
    if (!request.auth) {
      logger.warn(
        {
          permission,
          reason: 'missing-auth',
          method: request.method,
          url: request.url,
        },
        'Permission check failed: missing auth context'
      );

      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Check if userId exists
    if (!request.auth.userId) {
      logger.warn(
        {
          permission,
          reason: 'missing-auth',
          method: request.method,
          url: request.url,
          userId: request.auth.userId,
        },
        'Permission check failed: missing userId'
      );

      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Check if workspaceId exists
    if (!request.auth.workspaceId) {
      logger.warn(
        {
          permission,
          reason: 'missing-auth',
          method: request.method,
          url: request.url,
          userId: request.auth.userId,
          workspaceId: request.auth.workspaceId,
        },
        'Permission check failed: missing workspaceId'
      );

      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Check if user has the required permission
    const hasPermission = await permissionService.hasPermission({
      userId: request.auth.userId,
      workspaceId: request.auth.workspaceId,
      permission,
    });

    if (!hasPermission) {
      logger.warn(
        {
          permission,
          reason: 'missing-permission',
          userId: request.auth.userId,
          workspaceId: request.auth.workspaceId,
          method: request.method,
          url: request.url,
        },
        'Permission check failed: user does not have required permission'
      );

      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
    }

    // Permission check passed - continue to handler
    // (no return needed, void is fine)
  };
}

