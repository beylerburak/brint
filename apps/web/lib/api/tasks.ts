/**
 * Tasks API
 * 
 * Task management endpoints
 */

import { fetchApi, apiCache } from './http';

export const tasksApi = {
  /**
   * List tasks
   */
  async listTasks(params: {
    workspaceId: string;
    brandId?: string;
    projectId?: string;
    statusIds?: string[];
    assigneeUserId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: true;
    tasks: Array<{
      id: string;
      taskNumber: number;
      title: string;
      description: string | null;
      status: {
        id: string;
        label: string;
        color: string | null;
        group: 'TODO' | 'IN_PROGRESS' | 'DONE';
      };
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId: string | null;
      dueDate: string | null;
      assignedTo?: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null }>;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params.brandId) searchParams.append('brandId', params.brandId);
    if (params.projectId) searchParams.append('projectId', params.projectId);
    if (params.statusIds) params.statusIds.forEach(id => searchParams.append('statusIds[]', id));
    if (params.assigneeUserId) searchParams.append('assigneeUserId', params.assigneeUserId);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return fetchApi(`/tasks${query}`, {
      headers: {
        'X-Workspace-Id': params.workspaceId,
      },
    });
  },

  /**
   * Get task details (includes checklist, attachments, comments)
   */
  async getTask(
    workspaceId: string,
    taskId: string
  ): Promise<{
    success: true;
    task: {
      id: string;
      title: string;
      description: string | null;
      status: {
        id: string;
        label: string;
        color: string | null;
        group: 'TODO' | 'IN_PROGRESS' | 'DONE';
      };
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId: string | null;
      dueDate: string | null;
      assignedTo?: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null }>;
      checklistItems?: Array<{
        id: string;
        title: string;
        isCompleted: boolean;
        sortOrder: number;
      }>;
      attachments?: Array<{
        id: string;
        mediaId: string;
        title: string | null;
      }>;
      comments?: Array<{
        id: string;
        body: string;
        authorUserId: string;
        createdAt: string;
        author: {
          id: string;
          name: string | null;
          email: string;
          avatarUrl: string | null;
        };
      }>;
      createdAt: string;
      updatedAt: string;
    };
  }> {
    return fetchApi(`/tasks/${taskId}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Create a new task
   */
  async createTask(
    workspaceId: string,
    data: {
      title: string;
      description?: string;
      brandId?: string;
      projectId?: string;
      statusId?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId?: string;
      dueDate?: string;
    }
  ): Promise<{ success: true; task: any }> {
    return fetchApi('/tasks', {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a task
   */
  async updateTask(
    workspaceId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      statusId?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId?: string | null;
      dueDate?: string;
      checklistItems?: Array<{
        id?: string;
        title: string;
        isCompleted?: boolean;
        sortOrder?: number;
      }>;
      attachmentMediaIds?: string[];
    }
  ): Promise<{ success: true; task: any }> {
    return fetchApi(`/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a task
   */
  async deleteTask(
    workspaceId: string,
    taskId: string
  ): Promise<{ success: true; message: string }> {
    return fetchApi(`/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * List comments for a task
   */
  async listTaskComments(
    workspaceId: string,
    taskId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    success: true;
    comments: Array<{
      id: string;
      body: string;
      authorUserId: string;
      parentId: string | null;
      isEdited: boolean;
      createdAt: string;
      author: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
        avatarMediaId: string | null;
      };
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return fetchApi(`/tasks/${taskId}/comments${query}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Get activity logs for a task
   */
  async listTaskActivityLogs(
    workspaceId: string,
    taskId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    success: true;
    activities: Array<{
      id: string;
      eventKey: string;
      message: string | null;
      context: string | null;
      actorType: string;
      actorUserId: string | null;
      actorLabel: string | null;
      actor: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
        avatarMediaId: string | null;
      } | null;
      payload: any;
      severity: string;
      visibility: string;
      createdAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return fetchApi(`/tasks/${taskId}/activity${query}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Create a comment on a task
   */
  async createTaskComment(
    workspaceId: string,
    taskId: string,
    data: {
      body: string;
      parentId?: string;
    }
  ): Promise<{
    success: true;
    comment: {
      id: string;
      body: string;
      createdAt: string;
      author: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
        avatarMediaId: string | null;
      };
    };
  }> {
    return fetchApi(`/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * List task statuses (grouped)
   * Automatically cached to prevent duplicate requests
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async listTaskStatuses(
    workspaceId: string,
    brandId?: string,
    options?: { skipCache?: boolean }
  ): Promise<{
    success: true;
    statuses: {
      TODO: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
      IN_PROGRESS: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
      DONE: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
    };
  }> {
    const cacheKey = `task-statuses:${workspaceId}:${brandId || 'all'}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
    const cached = apiCache.get<{
      success: true;
      statuses: {
        TODO: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
        IN_PROGRESS: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
        DONE: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
      };
    }>(cacheKey);
    if (cached) {
      console.log(`[API Cache] Returning cached task statuses for workspace ${workspaceId}, brand ${brandId || 'all'}`);
      return cached;
    }

    // Check if there's already a pending request
    const pending = apiCache.getPendingRequest<{
      success: true;
      statuses: {
        TODO: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
        IN_PROGRESS: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
        DONE: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
      };
    }>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending task statuses request for workspace ${workspaceId}, brand ${brandId || 'all'}`);
      return pending;
    }

    // Make the request
    console.log(`[API Cache] Fetching fresh task statuses for workspace ${workspaceId}, brand ${brandId || 'all'}`);
    const searchParams = new URLSearchParams();
    if (brandId) searchParams.append('brandId', brandId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    const promise = fetchApi<{
      success: true;
      statuses: {
        TODO: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
        IN_PROGRESS: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
        DONE: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
      };
    }>(`/task-statuses${query}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
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
};
