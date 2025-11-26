/**
 * Brand Studio Service
 * 
 * Domain service for determining which brands are accessible to a user in a workspace
 * based on their effective permissions.
 */

import type { PermissionKey } from '../../core/auth/permissions.registry.js';
import { PERMISSIONS } from '../../core/auth/permissions.registry.js';
import { permissionService } from '../../core/auth/permission.service.js';
import { brandRepository } from './brand.repository.js';
import type { BrandEntity } from './brand.entity.js';

export interface BrandStudioContext {
  userId: string;
  workspaceId: string;
}

export interface BrandStudioAccessResult {
  userId: string;
  workspaceId: string;
  hasBrandViewPermission: boolean;
  effectivePermissions: PermissionKey[];
  brands: BrandEntity[];
}

/**
 * Gets accessible brands for a user in a workspace
 * 
 * Logic:
 * 1. Get effective permissions for user + workspace
 * 2. Check if user has STUDIO_BRAND_VIEW permission
 * 3. If yes, fetch and return active brands for the workspace
 * 4. If no, return empty brands array
 */
async function getAccessibleBrands(
  input: BrandStudioContext
): Promise<BrandStudioAccessResult> {
  const { userId, workspaceId } = input;

  // 1. Get effective permissions
  const effectivePermissionsResult =
    await permissionService.getEffectivePermissionsForUserWorkspace({
      userId,
      workspaceId,
    });

  const effectivePermissions = effectivePermissionsResult.permissions;

  // 2. Check if user has STUDIO_BRAND_VIEW permission
  const hasBrandViewPermission = effectivePermissions.includes(
    PERMISSIONS.STUDIO_BRAND_VIEW
  );

  // 3. If no permission, return empty brands
  if (!hasBrandViewPermission) {
    return {
      userId,
      workspaceId,
      hasBrandViewPermission: false,
      effectivePermissions,
      brands: [],
    };
  }

  // 4. If yes, fetch active brands for the workspace
  const brands = await brandRepository.listByWorkspace(workspaceId);

  return {
    userId,
    workspaceId,
    hasBrandViewPermission: true,
    effectivePermissions,
    brands,
  };
}

export const brandStudioService = {
  getAccessibleBrands,
};

