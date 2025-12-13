/**
 * Media API
 * 
 * Media upload and management endpoints
 */

import { fetchApi, ApiError, getApiBaseUrl } from './http';

export const mediaApi = {
  /**
   * Upload media file
   */
  async uploadMedia(
    workspaceId: string,
    file: File
  ): Promise<{
    success: true;
    media: {
      id: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      baseKey: string;
      bucket: string;
      variants?: Record<string, string>;
      createdAt: string;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${getApiBaseUrl()}/workspaces/${workspaceId}/media`, {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        data.error?.message || 'Failed to upload media',
        response.status,
        data.error?.code
      );
    }

    return response.json();
  },

  /**
   * Get media URL (for downloading/viewing)
   */
  getMediaUrl(workspaceId: string, mediaId: string, variant?: string): string {
    const variantParam = variant ? `?variant=${variant}` : '';
    return `${getApiBaseUrl()}/workspaces/${workspaceId}/media/${mediaId}/download${variantParam}`;
  },

  /**
   * Get media details by mediaId
   */
  async getMedia(
    workspaceId: string,
    mediaId: string
  ): Promise<{
    success: true;
    media: {
      id: string;
      originalFilename: string;
      extension: string;
      sizeBytes: number;
      mimeType: string;
      [key: string]: any;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/media/${mediaId}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Delete media file (from S3 and database)
   */
  async deleteMedia(
    workspaceId: string,
    mediaId: string
  ): Promise<{
    success: true;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/media/${mediaId}`, {
      method: 'DELETE',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },
};
