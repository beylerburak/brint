/**
 * Permission Registry
 * 
 * Central registry for all permission keys used in the application.
 * This ensures type-safe usage and prevents magic strings throughout the codebase.
 * 
 * Permission keys follow the pattern: `<scope>:<resource>.<action>`
 * - workspace:settings.view
 * - workspace:members.manage
 * - studio:brand.view
 * - studio:brand.create
 * - studio:content.create
 * - studio:content.publish
 */

export const PERMISSIONS = {
  // Workspace permissions
  WORKSPACE_SETTINGS_VIEW: 'workspace:settings.view',
  WORKSPACE_MEMBERS_MANAGE: 'workspace:members.manage',

  // Studio permissions
  STUDIO_BRAND_VIEW: 'studio:brand.view',
  STUDIO_BRAND_CREATE: 'studio:brand.create',
  STUDIO_CONTENT_CREATE: 'studio:content.create',
  STUDIO_CONTENT_PUBLISH: 'studio:content.publish',
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

