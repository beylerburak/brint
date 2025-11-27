export const PERMISSIONS = {
  WORKSPACE_SETTINGS_VIEW: "workspace:settings.view",
  WORKSPACE_MEMBERS_MANAGE: "workspace:members.manage",
  STUDIO_BRAND_VIEW: "studio:brand.view",
  STUDIO_BRAND_CREATE: "studio:brand.create",
  STUDIO_CONTENT_CREATE: "studio:content.create",
  STUDIO_CONTENT_PUBLISH: "studio:content.publish",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

/**
 * Permission required to fetch subscription information
 * This endpoint requires workspace:settings.view permission
 */
export const SUBSCRIPTION_PERMISSION = PERMISSIONS.WORKSPACE_SETTINGS_VIEW;
