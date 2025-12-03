/**
 * Permission Registry
 * 
 * Central registry for all permission keys used in the application.
 * This ensures type-safe usage and prevents magic strings throughout the codebase.
 * 
 * Permission keys follow the pattern: `<scope>:<resource>.<action>`
 * - workspace:settings.manage
 * - workspace:members.manage
 * - studio:brand.view
 * - studio:brand.create
 * - studio:content.create
 * - studio:content.publish
 */

export const PERMISSIONS = {
  // Workspace permissions
  WORKSPACE_SETTINGS_MANAGE: 'workspace:settings.manage',
  WORKSPACE_MEMBERS_MANAGE: 'workspace:members.manage',

  // Studio - Brand permissions
  STUDIO_BRAND_VIEW: 'studio:brand.view',
  STUDIO_BRAND_CREATE: 'studio:brand.create',
  STUDIO_BRAND_UPDATE: 'studio:brand.update',
  STUDIO_BRAND_DELETE: 'studio:brand.delete',
  STUDIO_BRAND_MANAGE: 'studio:brand.manage',
  STUDIO_BRAND_MANAGE_SOCIAL_ACCOUNTS: 'studio:brand.manage_social_accounts',
  STUDIO_BRAND_MANAGE_PUBLISHING_DEFAULTS: 'studio:brand.manage_publishing_defaults',

  // Studio - Content permissions
  STUDIO_CONTENT_VIEW: 'studio:content.view',
  STUDIO_CONTENT_CREATE: 'studio:content.create',
  STUDIO_CONTENT_UPDATE: 'studio:content.update',
  STUDIO_CONTENT_DELETE: 'studio:content.delete',
  STUDIO_CONTENT_PUBLISH: 'studio:content.publish',
  STUDIO_CONTENT_MANAGE_PUBLICATIONS: 'studio:content.manage_publications',

  // Studio - Social Account permissions
  STUDIO_SOCIAL_ACCOUNT_VIEW: 'studio:social_account.view',
  STUDIO_SOCIAL_ACCOUNT_CONNECT: 'studio:social_account.connect',
  STUDIO_SOCIAL_ACCOUNT_DISCONNECT: 'studio:social_account.disconnect',
  STUDIO_SOCIAL_ACCOUNT_DELETE: 'studio:social_account.delete',

  // Studio - Task permissions
  STUDIO_TASK_VIEW: 'studio:task.view',
  STUDIO_TASK_CREATE: 'studio:task.create',
  STUDIO_TASK_UPDATE: 'studio:task.update',
  STUDIO_TASK_DELETE: 'studio:task.delete',
  STUDIO_TASK_MANAGE_CATEGORIES: 'studio:task.manage_categories',
  STUDIO_TASK_MANAGE_STATUSES: 'studio:task.manage_statuses',
} as const;

/**
 * Role-Permission Matrix
 * 
 * Defines which roles have which permissions by default.
 * This is used for seeding and documentation.
 * 
 * Legend:
 * - OWNER: Full access to everything
 * - ADMIN: Full access to everything (same as Owner)
 * - EDITOR: Can view/create/update brands, full content access, no brand delete
 * - VIEWER: Read-only access to brands and content
 */
export const ROLE_PERMISSION_MATRIX = {
  OWNER: [
    // Workspace
    PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
    PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
    // Brand - all
    PERMISSIONS.STUDIO_BRAND_VIEW,
    PERMISSIONS.STUDIO_BRAND_CREATE,
    PERMISSIONS.STUDIO_BRAND_UPDATE,
    PERMISSIONS.STUDIO_BRAND_DELETE,
    PERMISSIONS.STUDIO_BRAND_MANAGE,
    PERMISSIONS.STUDIO_BRAND_MANAGE_SOCIAL_ACCOUNTS,
    PERMISSIONS.STUDIO_BRAND_MANAGE_PUBLISHING_DEFAULTS,
    // Content - all
    PERMISSIONS.STUDIO_CONTENT_VIEW,
    PERMISSIONS.STUDIO_CONTENT_CREATE,
    PERMISSIONS.STUDIO_CONTENT_UPDATE,
    PERMISSIONS.STUDIO_CONTENT_DELETE,
    PERMISSIONS.STUDIO_CONTENT_PUBLISH,
    PERMISSIONS.STUDIO_CONTENT_MANAGE_PUBLICATIONS,
    // Social Account - all
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_CONNECT,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DISCONNECT,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DELETE,
    // Task - all
    PERMISSIONS.STUDIO_TASK_VIEW,
    PERMISSIONS.STUDIO_TASK_CREATE,
    PERMISSIONS.STUDIO_TASK_UPDATE,
    PERMISSIONS.STUDIO_TASK_DELETE,
    PERMISSIONS.STUDIO_TASK_MANAGE_CATEGORIES,
    PERMISSIONS.STUDIO_TASK_MANAGE_STATUSES,
  ],
  ADMIN: [
    // Workspace
    PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
    PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
    // Brand - all
    PERMISSIONS.STUDIO_BRAND_VIEW,
    PERMISSIONS.STUDIO_BRAND_CREATE,
    PERMISSIONS.STUDIO_BRAND_UPDATE,
    PERMISSIONS.STUDIO_BRAND_DELETE,
    PERMISSIONS.STUDIO_BRAND_MANAGE,
    PERMISSIONS.STUDIO_BRAND_MANAGE_SOCIAL_ACCOUNTS,
    PERMISSIONS.STUDIO_BRAND_MANAGE_PUBLISHING_DEFAULTS,
    // Content - all
    PERMISSIONS.STUDIO_CONTENT_VIEW,
    PERMISSIONS.STUDIO_CONTENT_CREATE,
    PERMISSIONS.STUDIO_CONTENT_UPDATE,
    PERMISSIONS.STUDIO_CONTENT_DELETE,
    PERMISSIONS.STUDIO_CONTENT_PUBLISH,
    PERMISSIONS.STUDIO_CONTENT_MANAGE_PUBLICATIONS,
    // Social Account - all
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_CONNECT,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DISCONNECT,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DELETE,
    // Task - all
    PERMISSIONS.STUDIO_TASK_VIEW,
    PERMISSIONS.STUDIO_TASK_CREATE,
    PERMISSIONS.STUDIO_TASK_UPDATE,
    PERMISSIONS.STUDIO_TASK_DELETE,
    PERMISSIONS.STUDIO_TASK_MANAGE_CATEGORIES,
    PERMISSIONS.STUDIO_TASK_MANAGE_STATUSES,
  ],
  EDITOR: [
    // Brand - view/create/update + manage, no delete
    PERMISSIONS.STUDIO_BRAND_VIEW,
    PERMISSIONS.STUDIO_BRAND_CREATE,
    PERMISSIONS.STUDIO_BRAND_UPDATE,
    PERMISSIONS.STUDIO_BRAND_MANAGE,
    PERMISSIONS.STUDIO_BRAND_MANAGE_SOCIAL_ACCOUNTS,
    PERMISSIONS.STUDIO_BRAND_MANAGE_PUBLISHING_DEFAULTS,
    // Content - all
    PERMISSIONS.STUDIO_CONTENT_VIEW,
    PERMISSIONS.STUDIO_CONTENT_CREATE,
    PERMISSIONS.STUDIO_CONTENT_UPDATE,
    PERMISSIONS.STUDIO_CONTENT_DELETE,
    PERMISSIONS.STUDIO_CONTENT_PUBLISH,
    PERMISSIONS.STUDIO_CONTENT_MANAGE_PUBLICATIONS,
    // Social Account - view, connect, disconnect (no delete)
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_CONNECT,
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DISCONNECT,
    // Task - view, create, update (no delete, no manage)
    PERMISSIONS.STUDIO_TASK_VIEW,
    PERMISSIONS.STUDIO_TASK_CREATE,
    PERMISSIONS.STUDIO_TASK_UPDATE,
  ],
  VIEWER: [
    // Brand - view only
    PERMISSIONS.STUDIO_BRAND_VIEW,
    // Content - view only
    PERMISSIONS.STUDIO_CONTENT_VIEW,
    // Social Account - view only
    PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW,
    // Task - view only
    PERMISSIONS.STUDIO_TASK_VIEW,
  ],
} as const;

/**
 * Union type of all permission keys.
 * Use this for type-safe permission checks throughout the application.
 * 
 * @example
 * function requirePermission(key: PermissionKey) {
 *   // key is guaranteed to be a valid permission string
 * }
 */
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Type guard to check if a string is a valid permission key.
 * 
 * @param value - String to check
 * @returns true if value is a valid PermissionKey
 */
export function isPermissionKey(value: string): value is PermissionKey {
  return Object.values(PERMISSIONS).includes(value as PermissionKey);
}

/**
 * Get all permission keys as an array.
 * Useful for iteration, validation, or seeding.
 */
export function getAllPermissionKeys(): PermissionKey[] {
  return Object.values(PERMISSIONS);
}

/**
 * Get all permission keys as an array (alias for getAllPermissionKeys).
 * Useful for frontend compatibility.
 */
export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

/**
 * Permission required to fetch subscription information
 * This endpoint requires workspace:settings.manage permission
 */
export const SUBSCRIPTION_PERMISSION = PERMISSIONS.WORKSPACE_SETTINGS_MANAGE;

