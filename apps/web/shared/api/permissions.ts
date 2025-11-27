import { httpClient } from "@/shared/http";
import type { PermissionKey } from "@/features/permissions/permission-keys";

export interface PermissionSnapshot {
  workspaceId: string;
  permissions: PermissionKey[];
}

export async function fetchPermissionsSnapshot(): Promise<PermissionSnapshot | null> {
  const response = await httpClient.get<{
    success: boolean;
    data: PermissionSnapshot;
  }>("/auth/permissions");

  if (!response.ok) {
    return null;
  }

  return response.data.data;
}
