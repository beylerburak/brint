/**
 * Workspace Context Helper
 * 
 * Utility to extract workspace ID from request
 */

import type { FastifyRequest } from 'fastify';

/**
 * Extract workspace ID from request
 * 
 * Checks (in order):
 * 1. Path param :workspaceId
 * 2. Header x-workspace-id
 * 
 * @throws Error if workspace ID not found
 */
export function getWorkspaceIdFromRequest(req: FastifyRequest): string {
  // Check path params first
  const params = req.params as Record<string, string>;
  if (params?.workspaceId) {
    return params.workspaceId;
  }

  // Check headers
  const headerValue = req.headers['x-workspace-id'];
  if (headerValue && typeof headerValue === 'string') {
    return headerValue;
  }

  throw new Error('Workspace ID not found in request');
}

