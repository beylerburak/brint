"use client";

import { usePermissionContext } from "../context/permission-context";
import { useWorkspace } from "@/features/space/context/workspace-context";
import type { PermissionKey } from "../permission-keys";

/**
 * Returns the permission context (permissions array and setter)
 */
export function usePermissions() {
  return usePermissionContext();
}

/**
 * Checks if the user has a specific permission
 * Uses only backend permission snapshot - no owner bypass
 * @param permission The permission to check
 * @returns true if the user has the permission, false otherwise
 */
export function useHasPermission(permission: PermissionKey): boolean {
  const { permissions } = usePermissionContext();
  return permissions.includes(permission);
}

/**
 * Checks if the user has any of the provided permissions (OR logic)
 * Uses only backend permission snapshot - no owner bypass
 * @param permissionList Array of permissions to check
 * @returns true if the user has at least one of the permissions, false otherwise
 */
export function useAnyPermission(permissionList: PermissionKey[]): boolean {
  const { permissions } = usePermissionContext();
  return permissions.some((p) => permissionList.includes(p));
}

/**
 * Checks if the user is owner of the current workspace
 * @returns true if the user is owner, false otherwise
 */
export function useIsOwner(): boolean {
  const { isOwner } = useWorkspace();
  return isOwner;
}

/**
 * Hook for page-level permission checking
 * Returns permissions state and owner status
 * Use this at the top of page components to ensure permissions are loaded
 * 
 * Note: isOwner is only for UI labels (e.g., showing "Owner" badge).
 * Permission checks should use permissions array only (backend snapshot).
 * 
 * @example
 * ```tsx
 * export function MyPage() {
 *   const { permissions, isOwner, loading } = usePagePermissions();
 *   
 *   if (loading) {
 *     return <div>Loading...</div>;
 *   }
 *   
 *   // Backend snapshot'a göre - owner bypass yok
 *   const canCreate = permissions.includes("studio:brand.create");
 *   
 *   return (
 *     <div>
 *       {canCreate && <Button>Create</Button>}
 *       {isOwner && <Badge>Owner</Badge>}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePagePermissions() {
  const { permissions, loading } = usePermissionContext();
  const { isOwner } = useWorkspace();
  
  return {
    permissions,
    isOwner,
    loading,
  };
}
