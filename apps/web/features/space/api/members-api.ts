import { httpClient } from "@/shared/http";
import { getWorkspaceId } from "@/shared/http/workspace-header";

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
}

export interface GetWorkspaceMembersResponse {
  success: boolean;
  data: WorkspaceMember[];
}

/**
 * Get workspace members list
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMember[]> {
  // Ensure we use UUID from workspace header getter, not slug
  const resolvedWorkspaceId = getWorkspaceId() || workspaceId;
  
  const response = await httpClient.get<GetWorkspaceMembersResponse>(
    `/workspaces/${resolvedWorkspaceId}/members`
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to get workspace members");
  }

  return response.data.data;
}

export interface UpdateWorkspaceMemberRequest {
  role?: "OWNER" | "ADMIN" | "MEMBER";
  status?: string;
}

export interface UpdateWorkspaceMemberResponse {
  success: boolean;
  data: WorkspaceMember;
}

/**
 * Update workspace member role/status
 */
export async function updateWorkspaceMember(
  workspaceId: string,
  userId: string,
  payload: UpdateWorkspaceMemberRequest
): Promise<WorkspaceMember> {
  // Ensure we use UUID from workspace header getter, not slug
  const resolvedWorkspaceId = getWorkspaceId() || workspaceId;
  
  const response = await httpClient.patch<UpdateWorkspaceMemberResponse>(
    `/workspaces/${resolvedWorkspaceId}/members/${userId}`,
    payload
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to update workspace member");
  }

  return response.data.data;
}

