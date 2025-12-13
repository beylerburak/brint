/**
 * Content API
 * 
 * Content and publishing endpoints
 */

import { fetchApi, apiCache } from './http';

export const contentApi = {
  /**
   * Create content
   */
  async createContent(
    workspaceId: string,
    brandSlug: string,
    data: {
      formFactor: 'FEED_POST' | 'STORY' | 'VERTICAL_VIDEO' | 'BLOG_ARTICLE' | 'LONG_VIDEO';
      title?: string | null;
      baseCaption?: string | null;
      platformCaptions?: Record<string, string> | null;
      accountIds: string[];
      scheduledAt?: string | null;
      status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PARTIALLY_PUBLISHED' | 'FAILED' | 'ARCHIVED';
      tags?: string[];
      mediaIds?: string[];
      mediaLookupId?: string | null;
      useMediaLookupOnPublish?: boolean;
    }
  ): Promise<{
    success: true;
    content: any;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandSlug}/contents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update content
   */
  async updateContent(
    workspaceId: string,
    brandSlug: string,
    contentId: string,
    data: {
      formFactor?: 'FEED_POST' | 'STORY' | 'VERTICAL_VIDEO' | 'BLOG_ARTICLE' | 'LONG_VIDEO';
      title?: string | null;
      baseCaption?: string | null;
      platformCaptions?: Record<string, string> | null;
      accountIds?: string[];
      scheduledAt?: string | null;
      status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PARTIALLY_PUBLISHED' | 'FAILED' | 'ARCHIVED';
      tags?: string[];
      mediaIds?: string[];
      useMediaLookupOnPublish?: boolean;
    }
  ): Promise<{
    success: true;
    content: any;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandSlug}/contents/${contentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get content
   */
  async getContent(
    workspaceId: string,
    brandSlug: string,
    contentId: string
  ): Promise<{
    success: true;
    content: any;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandSlug}/contents/${contentId}`);
  },

  /**
   * List contents
   * Automatically cached to prevent duplicate requests
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async listContents(
    workspaceId: string,
    brandSlug: string,
    options?: { skipCache?: boolean }
  ): Promise<{
    success: true;
    contents: any[];
  }> {
    const cacheKey = `contents:${workspaceId}:${brandSlug}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
    const cached = apiCache.get<{
      success: true;
      contents: any[];
    }>(cacheKey);
    if (cached) {
      console.log(`[API Cache] Returning cached contents for workspace ${workspaceId}, brand ${brandSlug}`);
      return cached;
    }

    // Check if there's already a pending request
    const pending = apiCache.getPendingRequest<{
      success: true;
      contents: any[];
    }>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending contents request for workspace ${workspaceId}, brand ${brandSlug}`);
      return pending;
    }

    // Make the request
    console.log(`[API Cache] Fetching fresh contents for workspace ${workspaceId}, brand ${brandSlug}`);
    const promise = fetchApi<{
      success: true;
      contents: any[];
    }>(`/workspaces/${workspaceId}/brands/${brandSlug}/contents`);
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
   * Delete content
   */
  async deleteContent(
    workspaceId: string,
    brandSlug: string,
    contentId: string
  ): Promise<{
    success: true;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandSlug}/contents/${contentId}`, {
      method: 'DELETE',
    });
  },
};
