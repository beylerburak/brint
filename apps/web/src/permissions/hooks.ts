"use client";

import { usePermissionContext } from "./permission-context";
import type { Permission } from "./permission-context";

/**
 * Returns the permission context (permissions array and setter)
 */
export function usePermissions() {
  return usePermissionContext();
}

/**
 * Checks if the user has a specific permission
 * @param permission The permission to check
 * @returns true if the user has the permission, false otherwise
 */
export function useHasPermission(permission: Permission): boolean {
  const { permissions } = usePermissionContext();
  return permissions.includes(permission);
}

/**
 * Checks if the user has any of the provided permissions (OR logic)
 * @param permissionList Array of permissions to check
 * @returns true if the user has at least one of the permissions, false otherwise
 */
export function useAnyPermission(permissionList: Permission[]): boolean {
  const { permissions } = usePermissionContext();
  return permissions.some((p) => permissionList.includes(p));
}

