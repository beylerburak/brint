/**
 * Workspace Role Helpers
 * 
 * Simple role-based authorization using fixed WorkspaceRole enum.
 * OWNER always has full access to everything.
 */

import type { WorkspaceRole } from '@prisma/client';

/**
 * Role level mapping - higher number = more permissions
 */
export const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  EDITOR: 50,
  VIEWER: 20,
};

/**
 * Check if a user's role meets the minimum required role
 * 
 * @param current - User's current role
 * @param minimum - Minimum role required
 * @returns true if user has sufficient role level
 * 
 * @example
 * hasRoleAtLeast('ADMIN', 'EDITOR') // true
 * hasRoleAtLeast('VIEWER', 'EDITOR') // false
 * hasRoleAtLeast('OWNER', 'ADMIN') // true (OWNER always passes)
 */
export function hasRoleAtLeast(
  current: WorkspaceRole,
  minimum: WorkspaceRole
): boolean {
  return ROLE_LEVEL[current] >= ROLE_LEVEL[minimum];
}

/**
 * Check if user is workspace owner
 * 
 * @param role - User's workspace role
 * @returns true if role is OWNER
 */
export function isOwner(role: WorkspaceRole): boolean {
  return role === 'OWNER';
}

/**
 * Check if user can manage workspace (OWNER or ADMIN)
 * 
 * @param role - User's workspace role
 * @returns true if role is OWNER or ADMIN
 */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Check if user can edit content (OWNER, ADMIN, or EDITOR)
 * 
 * @param role - User's workspace role
 * @returns true if role is OWNER, ADMIN, or EDITOR
 */
export function canEditContent(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR';
}

/**
 * Get human-readable role name
 * 
 * @param role - Workspace role
 * @returns Human-readable role name
 */
export function getRoleName(role: WorkspaceRole): string {
  const names: Record<WorkspaceRole, string> = {
    OWNER: 'Owner',
    ADMIN: 'Administrator',
    EDITOR: 'Editor',
    VIEWER: 'Viewer',
  };
  return names[role];
}

/**
 * Get role description
 * 
 * @param role - Workspace role
 * @returns Role description
 */
export function getRoleDescription(role: WorkspaceRole): string {
  const descriptions: Record<WorkspaceRole, string> = {
    OWNER: 'Full access to workspace, can manage members and settings',
    ADMIN: 'Can manage workspace settings and content, but cannot remove owner',
    EDITOR: 'Can create and edit content, but cannot manage workspace settings',
    VIEWER: 'Can only view content and workspace information',
  };
  return descriptions[role];
}

