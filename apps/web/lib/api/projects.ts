/**
 * Projects API
 * 
 * Project management endpoints
 */

import { fetchApi, apiCache } from './http';

export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type Project = {
  id: string;
  workspaceId: string;
  brandId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsListResponse = {
  success: true;
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const projectsApi = {
  /**
   * List projects in workspace
   * Automatically cached per workspace
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async listProjects(
    workspaceId: string,
    options?: {
      brandId?: string;
      status?: ProjectStatus;
      page?: number;
      limit?: number;
      skipCache?: boolean;
    }
  ): Promise<ProjectsListResponse> {
    const cacheKey = `projects:${workspaceId}:${options?.brandId || 'all'}:${options?.status || 'all'}:${options?.page || 1}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    const cached = apiCache.get<ProjectsListResponse>(cacheKey);
    if (cached) {
      console.log(`[API Cache] Returning cached projects for workspace ${workspaceId}`);
      return cached;
    }

    const pending = apiCache.getPendingRequest<ProjectsListResponse>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending projects request for workspace ${workspaceId}`);
      return pending;
    }

    console.log(`[API Cache] Fetching fresh projects for workspace ${workspaceId}`);
    const params = new URLSearchParams();
    if (options?.brandId) params.append('brandId', options.brandId);
    if (options?.status) params.append('status', options.status);
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';

    const promise = fetchApi<ProjectsListResponse>(`/projects${query}`, {
      headers: { 'X-Workspace-Id': workspaceId },
    });
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
   * Get project by ID
   */
  async getProject(workspaceId: string, projectId: string): Promise<{ success: true; project: Project }> {
    return fetchApi(`/projects/${projectId}`, {
      headers: { 'X-Workspace-Id': workspaceId },
    });
  },

  /**
   * Create a new project
   */
  async createProject(
    workspaceId: string,
    data: {
      name: string
      description?: string
      brandId?: string | null
      status?: ProjectStatus
      startDate?: string
      endDate?: string
    }
  ): Promise<{ success: true; project: Project }> {
    // Clear cache before creating
    this.clearProjectsCache(workspaceId)

    const response = await fetchApi<{ success: true; project: Project }>(`/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-Id": workspaceId,
      },
      body: JSON.stringify(data),
    })

    // Clear cache after successful creation
    this.clearProjectsCache(workspaceId)

    return response
  },

  /**
   * Clear projects cache for a workspace
   */
  clearProjectsCache(workspaceId: string): void {
    // Note: We can't use wildcards with apiCache.clear
    // In practice, cache will expire naturally or can be cleared by workspaceId pattern
    // For now, we'll clear common cache patterns
    apiCache.clear(`projects:${workspaceId}:all:all:1`);
  },
};

