import { httpClient } from "@/shared/http";

export interface WorkspaceRolePermission {
  key: string;
  description: string | null;
}

export interface WorkspaceRole {
  id: string;
  workspaceId: string | null;
  key: string;
  name: string;
  description: string | null;
  builtIn: boolean;
  order: number;
  permissions: WorkspaceRolePermission[];
}

export interface GetWorkspaceRolesResponse {
  success: boolean;
  data: WorkspaceRole[];
}

/**
 * Get workspace roles list
 */
export async function getWorkspaceRoles(
  workspaceId: string
): Promise<WorkspaceRole[]> {
  const response = await httpClient.get<GetWorkspaceRolesResponse>(
    `/workspaces/${workspaceId}/roles`
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to get workspace roles");
  }

  return response.data.data;
}

