/**
 * Tags API
 * 
 * Tag search and management endpoints
 */

import { fetchApi } from './http';

export const tagsApi = {
  /**
   * Search tags for autocomplete
   */
  async searchTags(
    workspaceId: string,
    options?: {
      query?: string;
      limit?: number;
    }
  ): Promise<{
    success: true;
    items: Array<{
      id: string;
      name: string;
      slug: string;
      color: string | null;
    }>;
  }> {
    const params = new URLSearchParams();
    if (options?.query) params.append('query', options.query);
    if (options?.limit) params.append('limit', options.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return fetchApi(`/workspaces/${workspaceId}/tags/search${query}`);
  },
};
