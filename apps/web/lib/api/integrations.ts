/**
 * Integrations API
 * 
 * Third-party integration endpoints (Google Drive, etc.)
 */

import { fetchApi, getApiBaseUrl } from './http';

export const integrationsApi = {
  /**
   * List workspace integrations
   */
  async listIntegrations(workspaceId: string): Promise<{
    success: true;
    integrations: Array<{
      id: string;
      workspaceId: string;
      integrationType: string;
      status: string;
      statusMessage?: string | null;
      lastSyncedAt?: Date | null;
      connectedByUserId?: string | null;
      hasAuth: boolean;
      config: any;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    return fetchApi(`/integrations`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Get Google Drive auth URL
   */
  async getGoogleDriveAuthUrl(workspaceId: string): Promise<{
    success: true;
    url: string;
  }> {
    return fetchApi(`/integrations/google-drive/auth-url`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Disconnect Google Drive
   */
  async disconnectGoogleDrive(workspaceId: string): Promise<{
    success: true;
  }> {
    return fetchApi(`/integrations/google-drive/disconnect`, {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Get Google Drive status
   */
  async getGoogleDriveStatus(workspaceId: string): Promise<{
    success: true;
    status: {
      connected: boolean;
      status: string;
      statusMessage?: string | null;
      lastSyncedAt?: Date | null;
    };
  }> {
    return fetchApi(`/integrations/google-drive/status`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * List Google Drive shared drives
   */
  async listGoogleDriveSharedDrives(workspaceId: string): Promise<{
    success: true;
    drives: Array<{
      id: string;
      name: string;
    }>;
  }> {
    return fetchApi(`/integrations/google-drive/shared-drives`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * List Google Drive files
   */
  async listGoogleDriveFiles(
    workspaceId: string,
    params?: { query?: string; pageSize?: number; pageToken?: string; folderId?: string; driveId?: string }
  ): Promise<{
    success: true;
    files: Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime: string;
      thumbnailLink?: string;
      size?: string;
      parents?: string[];
    }>;
    nextPageToken?: string;
  }> {
    return fetchApi(`/integrations/google-drive/files`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      params,
    });
  },

  /**
   * Get Google Drive file thumbnail URL
   */
  getGoogleDriveThumbnailUrl(workspaceId: string, fileId: string): string {
    return `${getApiBaseUrl()}/integrations/google-drive/thumbnail/${fileId}`;
  },

  /**
   * Import Google Drive file to Media
   */
  async importGoogleDriveFile(workspaceId: string, fileId: string): Promise<{
    success: true;
    media: {
      id: string;
      previewUrl: string;
      mimeType: string;
      kind: string;
    };
  }> {
    return fetchApi(`/integrations/google-drive/import`, {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      body: JSON.stringify({ fileId }),
    });
  },
};
