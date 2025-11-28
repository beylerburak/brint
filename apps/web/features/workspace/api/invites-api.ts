import { httpClient } from "@/shared/http";

export interface CreateWorkspaceInviteRequest {
  email: string;
  expiresAt?: string | null;
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  workspaceId: string;
  token: string;
  status: string;
  expiresAt: string;
  invitedBy: string;
  invitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInviteResponse {
  success: boolean;
  data: WorkspaceInvite;
}

export interface GetWorkspaceInvitesResponse {
  success: boolean;
  data: WorkspaceInvite[];
}

/**
 * Get workspace invites list
 */
export async function getWorkspaceInvites(
  workspaceId: string
): Promise<WorkspaceInvite[]> {
  const response = await httpClient.get<GetWorkspaceInvitesResponse>(
    `/workspaces/${workspaceId}/invites`
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to get workspace invites");
  }

  return response.data.data;
}

/**
 * Create a workspace invite
 */
export async function createWorkspaceInvite(
  workspaceId: string,
  payload: CreateWorkspaceInviteRequest
): Promise<WorkspaceInvite> {
  const response = await httpClient.post<CreateWorkspaceInviteResponse>(
    `/workspaces/${workspaceId}/invites`,
    payload
  );

  if (!response.ok) {
    const errorMessage = 
      (response.details as any)?.error?.message || 
      response.message || 
      "Failed to create workspace invite";
    throw new Error(errorMessage);
  }

  // Check if response has the expected structure
  if (!response.data) {
    throw new Error("Invalid response from server: missing data");
  }

  // Backend returns { success: true, data: WorkspaceInvite }
  if (!response.data.data) {
    throw new Error("Invalid response from server: missing invite data");
  }

  return response.data.data;
}

export interface GetInviteDetailsResponse {
  success: boolean;
  data: {
    id: string;
    email: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    invitedBy: string | null;
    invitedByName: string | null;
    status: string;
    expiresAt: string;
  };
}

/**
 * Get invite details by token (public endpoint)
 */
export async function getInviteDetails(token: string): Promise<GetInviteDetailsResponse["data"]> {
  const response = await httpClient.get<GetInviteDetailsResponse>(
<<<<<<< HEAD
    `/public/invites/${token}`,
=======
    `/workspace-invites/${token}`,
>>>>>>> origin/saj
    {
      skipAuth: true, // Public endpoint, no auth required
    }
  );

  if (!response.ok) {
    const errorMessage = 
      (response.details as any)?.error?.message || 
      response.message || 
      "Failed to get invite details";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

export interface LoginWithInviteTokenResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name: string | null;
    };
    accessToken: string;
  };
}

/**
 * Login with invite token (public endpoint)
 */
export async function loginWithInviteToken(token: string): Promise<LoginWithInviteTokenResponse["data"]> {
  const response = await httpClient.post<LoginWithInviteTokenResponse>(
<<<<<<< HEAD
    `/public/invites/${token}/login`,
=======
    `/workspace-invites/${token}/login`,
>>>>>>> origin/saj
    undefined,
    {
      skipAuth: true, // Public endpoint, no auth required
      credentials: "include", // Include cookies for refresh token
    }
  );

  if (!response.ok) {
    const errorMessage = 
      (response.details as any)?.error?.message || 
      response.message || 
      "Failed to login with invite token";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

export interface CancelWorkspaceInviteResponse {
  success: boolean;
  data: {
    id: string;
    status: string;
  };
}

/**
 * Cancel a workspace invite (sets status to EXPIRED)
 */
export async function cancelWorkspaceInvite(
  workspaceId: string,
  inviteId: string
): Promise<void> {
  const response = await httpClient.delete<CancelWorkspaceInviteResponse>(
    `/workspaces/${workspaceId}/invites/${inviteId}`
  );

  if (!response.ok) {
    const errorMessage = 
      (response.details as any)?.error?.message || 
      response.message || 
      "Failed to cancel workspace invite";
    throw new Error(errorMessage);
  }
}

