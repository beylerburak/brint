/**
 * Workspaces API
 * 
 * Workspace management endpoints
 */

import { fetchApi, apiCache } from './http';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
export type WorkspacePlan = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY';

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null; // Deprecated: use avatarUrls instead
  avatarUrls: {
    thumbnail: string | null;
    small: string | null;
    medium: string | null;
    large: string | null;
  } | null;
  timezone: string;
  locale: string;
  baseCurrency: string;
  plan: WorkspacePlan;
  role: WorkspaceRole;
};

export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  avatarMediaId: string | null;
  avatarUrl: string | null; // Deprecated: use avatarUrls instead
  avatarUrls: {
    thumbnail: string | null;
    small: string | null;
    medium: string | null;
    large: string | null;
  } | null;
  timezone: string;
  locale: string;
  baseCurrency: string;
  plan: WorkspacePlan;
  settings: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  userRole: WorkspaceRole;
};

export type WorkspaceDetailsResponse = {
  success: true;
  workspace: WorkspaceDetails;
};

export const workspacesApi = {
  /**
   * Get workspace details
   * Automatically cached to prevent duplicate requests
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async getWorkspace(
    workspaceId: string,
    options?: { skipCache?: boolean }
  ): Promise<WorkspaceDetailsResponse> {
    const cacheKey = `workspace:${workspaceId}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
    const cached = apiCache.get<WorkspaceDetailsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if there's already a pending request
    const pending = apiCache.getPendingRequest<WorkspaceDetailsResponse>(cacheKey);
    if (pending) {
      return pending;
    }

    // Make the request
    const promise = fetchApi<WorkspaceDetailsResponse>(`/workspaces/${workspaceId}`);
    apiCache.setPendingRequest(cacheKey, promise);

    try {
      const response = await promise;
      apiCache.set(cacheKey, response);
      return response;
    } catch (error) {
      apiCache.clear(cacheKey);
      throw error;
    }
  },

  /**
   * List all user workspaces
   */
  async listWorkspaces(): Promise<{ success: true; workspaces: WorkspaceSummary[] }> {
    return fetchApi('/workspaces');
  },

  /**
   * List workspace members
   * Automatically cached to prevent duplicate requests
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async listWorkspaceMembers(
    workspaceId: string,
    options?: { skipCache?: boolean }
  ): Promise<{
    success: true;
    members: Array<{
      id: string;
      name: string | null;
      email: string;
      avatarMediaId: string | null;
      avatarUrl: string | null;
      role: string;
    }>;
  }> {
    const cacheKey = `workspace-members:${workspaceId}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
    const cached = apiCache.get<{
      success: true;
      members: Array<{
        id: string;
        name: string | null;
        email: string;
        avatarMediaId: string | null;
        avatarUrl: string | null;
        role: string;
      }>;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if there's already a pending request
    const pending = apiCache.getPendingRequest<{
      success: true;
      members: Array<{
        id: string;
        name: string | null;
        email: string;
        avatarMediaId: string | null;
        avatarUrl: string | null;
        role: string;
      }>;
    }>(cacheKey);
    if (pending) {
      return pending;
    }

    // Make the request
    const promise = fetchApi<{
      success: true;
      members: Array<{
        id: string;
        name: string | null;
        email: string;
        avatarMediaId: string | null;
        avatarUrl: string | null;
        role: string;
      }>;
    }>(`/workspaces/${workspaceId}/members`);
    apiCache.setPendingRequest(cacheKey, promise);

    try {
      const response = await promise;
      apiCache.set(cacheKey, response);
      return response;
    } catch (error) {
      apiCache.clear(cacheKey);
      throw error;
    }
  },

  /**
   * Update workspace member role
   */
  async updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
  ): Promise<{
    success: true;
    member: {
      id: string;
      name: string | null;
      email: string;
      role: string;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  /**
   * Remove member from workspace
   */
  async removeWorkspaceMember(
    workspaceId: string,
    userId: string
  ): Promise<{
    success: true;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Invite a user to workspace by email
   */
  async inviteWorkspaceMember(
    workspaceId: string,
    email: string,
    role: 'ADMIN' | 'EDITOR' | 'VIEWER' = 'VIEWER'
  ): Promise<{
    success: true;
    member: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
      role: string;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  /**
   * Check if a workspace slug is available
   */
  async checkSlugAvailable(
    slug: string,
    excludeWorkspaceId?: string
  ): Promise<{
    success: true;
    available: boolean;
    slug: string;
  }> {
    const params = excludeWorkspaceId ? { excludeWorkspaceId } : {};
    return fetchApi(`/workspaces/slug/${encodeURIComponent(slug)}/available`, {
      params,
    });
  },

  /**
   * Update workspace settings
   */
  async updateWorkspace(
    workspaceId: string,
    data: {
      name?: string;
      slug?: string;
      timezone?: string;
      locale?: string;
      baseCurrency?: string;
      avatarMediaId?: string | null;
    }
  ): Promise<{
    success: true;
    workspace: {
      id: string;
      name: string;
      slug: string;
      avatarMediaId: string | null;
      avatarUrl: string | null;
      avatarUrls: {
        thumbnail: string | null;
        small: string | null;
        medium: string | null;
        large: string | null;
      } | null;
      timezone: string;
      locale: string;
      baseCurrency: string;
      updatedAt: string;
    };
  }> {
    // Clear workspace cache after update
    const cacheKey = `workspace:${workspaceId}`;
    apiCache.clear(cacheKey);
    
    return fetchApi(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
