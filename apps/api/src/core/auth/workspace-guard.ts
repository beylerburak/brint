/**
 * Workspace Role-Based Guard
 * 
 * Simple guard pattern for workspace-scoped endpoints.
 * OWNER always bypasses all checks.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WorkspaceRole } from '@prisma/client';
import type { WorkspaceClaim } from './token.service.js';
import { hasRoleAtLeast } from './workspace-role.js';
import { getWorkspaceIdFromRequest } from './workspace-context.js';

/**
 * Endpoint action -> minimum role mapping
 * 
 * Add new actions here as you create new endpoints.
 * OWNER always passes regardless of this config.
 */
export const ENDPOINT_MIN_ROLE = {
  // Workspace management
  'workspace:view': 'VIEWER',
  'workspace:update': 'ADMIN',
  'workspace:delete': 'OWNER',
  'workspace:members:list': 'ADMIN',
  'workspace:members:add': 'ADMIN',
  'workspace:members:remove': 'OWNER',
  'workspace:members:update-role': 'OWNER',

  // Content management
  'content:list': 'VIEWER',
  'content:view': 'VIEWER',
  'content:create': 'EDITOR',
  'content:update': 'EDITOR',
  'content:delete': 'ADMIN',
  'content:publish': 'EDITOR',

  // Media management
  'media:list': 'VIEWER',
  'media:view': 'VIEWER',
  'media:upload': 'EDITOR',
  'media:delete': 'ADMIN',

  // Brand management
  'brand:list': 'VIEWER',
  'brand:view': 'VIEWER',
  'brand:create': 'ADMIN',
  'brand:update': 'ADMIN',
  'brand:delete': 'OWNER',

  // Task management
  'task:list': 'VIEWER',
  'task:view': 'VIEWER',
  'task:create': 'EDITOR',
  'task:update': 'EDITOR',
  'task:delete': 'ADMIN',

  // Comment management
  'comment:list': 'VIEWER',
  'comment:create': 'VIEWER', // Any workspace member can comment
  'comment:update': 'VIEWER', // Owner check in service layer
  'comment:delete': 'VIEWER', // Owner check in service layer

  // Social Account management
  'social-account:list': 'VIEWER',
  'social-account:view': 'VIEWER',
  'social-account:create': 'ADMIN',
  'social-account:update': 'ADMIN',
  'social-account:delete': 'OWNER',
} as const;

export type EndpointAction = keyof typeof ENDPOINT_MIN_ROLE;

/**
 * Auth user type from JWT payload
 */
type AuthUser = {
  sub: string;
  email: string;
  workspaces: WorkspaceClaim[];
};

/**
 * Require workspace role for an endpoint
 * 
 * Usage:
 * ```ts
 * app.get('/workspaces/:workspaceId/brands',
 *   { preHandler: requireWorkspaceRoleFor('brand:list') },
 *   handler
 * );
 * ```
 */
export function requireWorkspaceRoleFor(action: EndpointAction) {
  const minRole = ENDPOINT_MIN_ROLE[action] as WorkspaceRole;

  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!req.auth || !req.auth.tokenPayload) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const user = req.auth.tokenPayload as AuthUser;

    // Extract workspace ID from request
    let workspaceId: string;
    try {
      workspaceId = getWorkspaceIdFromRequest(req);
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Workspace ID required',
        },
      });
    }

    // Find user's role in this workspace
    const workspaceClaim = user.workspaces.find((w) => w.id === workspaceId);

    if (!workspaceClaim) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not a member of this workspace',
        },
      });
    }

    // OWNER bypasses all role checks
    if (workspaceClaim.role === 'OWNER') {
      return; // proceed to handler
    }

    // Check if role meets minimum requirement
    if (!hasRoleAtLeast(workspaceClaim.role, minRole)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `This action requires ${minRole} role or higher`,
        },
      });
    }

    // Role check passed
    return; // proceed to handler
  };
}

