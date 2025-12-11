// apps/api/src/modules/integration/google-drive/google-drive.client.ts
import axios from 'axios';
import { GOOGLE_DRIVE_CONFIG } from '../../../config/integration-config.js';

export interface GoogleDriveTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class GoogleDriveOAuthClient {
  getAuthUrl(state: string) {
    if (!GOOGLE_DRIVE_CONFIG.clientId) {
      throw new Error('GOOGLE_DRIVE_CLIENT_ID is not configured');
    }
    if (!GOOGLE_DRIVE_CONFIG.redirectUri) {
      throw new Error('GOOGLE_DRIVE_REDIRECT_URI is not configured');
    }

    const params = new URLSearchParams({
      client_id: GOOGLE_DRIVE_CONFIG.clientId,
      redirect_uri: GOOGLE_DRIVE_CONFIG.redirectUri,
      response_type: 'code',
      scope: GOOGLE_DRIVE_CONFIG.scope,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleDriveTokens> {
    const params = new URLSearchParams({
      code,
      client_id: GOOGLE_DRIVE_CONFIG.clientId,
      client_secret: GOOGLE_DRIVE_CONFIG.clientSecret,
      redirect_uri: GOOGLE_DRIVE_CONFIG.redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await axios.post('https://oauth2.googleapis.com/token', params);
    return res.data;
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleDriveTokens> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_DRIVE_CONFIG.clientId,
      client_secret: GOOGLE_DRIVE_CONFIG.clientSecret,
      grant_type: 'refresh_token',
    });

    const res = await axios.post('https://oauth2.googleapis.com/token', params);
    return res.data;
  }

  async listFiles(
    accessToken: string,
    options?: {
      includeSharedDrives?: boolean;
      query?: string;
      pageSize?: number;
      pageToken?: string;
      folderId?: string; // If provided, list files in this folder. If 'root', list root files. If undefined, list all files.
    }
  ) {
    try {
      // Build query string
      let q = "trashed=false"; // Only get non-trashed files
      
      // Folder navigation
      if (options?.folderId) {
        if (options.folderId === 'root') {
          q += " and 'root' in parents";
        } else {
          q += ` and '${options.folderId}' in parents`;
        }
      }
      
      // Search query (searches entire Drive, not just current folder)
      if (options?.query) {
        // Search by file name only - do NOT use fullText contains as it searches
        // inside file content and returns many irrelevant results
        // Exclude folders from search results - only return files
        const escapedQuery = options.query.replace(/'/g, "\\'").replace(/"/g, '\\"');
        q += ` and name contains '${escapedQuery}' and mimeType != 'application/vnd.google-apps.folder'`;
      } else {
        // When not searching, also exclude folders from recent files list
        // Only show actual files (images, videos, documents, etc.)
        q += " and mimeType != 'application/vnd.google-apps.folder'";
      }

      const params: Record<string, any> = {
        pageSize: options?.pageSize ?? 100, // Default 100, max 1000
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,thumbnailLink,webViewLink,size,shared,owners,parents)',
        q,
        // Order by modified time (most recent first) when no folder filter
        // Otherwise order by folder first, then name
        orderBy: options?.folderId ? 'folder,name' : 'modifiedTime desc',
      };

      // Include Shared Drives (Team Drives) if requested
      if (options?.includeSharedDrives === true) {
        params.supportsAllDrives = true;
        params.includeItemsFromAllDrives = true;
        if (!options?.folderId) {
          // Use corpora=allDrives when not in a specific folder (both for browsing and searching)
          // This ensures search results include files from shared drives
          params.corpora = 'allDrives'; // Include both My Drive and Shared Drives
        }
      } else if (options?.includeSharedDrives === false) {
        // My Drive only - explicitly exclude shared drives
        params.corpora = 'user'; // Only My Drive, no shared drives
      }

      // Pagination
      if (options?.pageToken) {
        params.pageToken = options.pageToken;
      }

      const res = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params,
      });

      return res.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        const errorCode = error.response.data?.error?.code || error.response.status;
        throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
      }
      throw error;
    }
  }

  async getFolderMetadata(accessToken: string, folderId: string) {
    try {
      const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: 'id,name,parents',
          supportsAllDrives: true,
        },
      });

      return res.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        const errorCode = error.response.data?.error?.code || error.response.status;
        throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
      }
      throw error;
    }
  }

  async listSharedDrives(accessToken: string) {
    try {
      const res = await axios.get('https://www.googleapis.com/drive/v3/drives', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          pageSize: 100,
          supportsAllDrives: true,
        },
      });

      return res.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        const errorCode = error.response.data?.error?.code || error.response.status;
        throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
      }
      throw error;
    }
  }

  async listFilesInSharedDrive(
    accessToken: string,
    driveId: string,
    options?: {
      query?: string;
      pageSize?: number;
      pageToken?: string;
      folderId?: string;
    }
  ) {
    try {
      let q = "trashed=false";
      
      // Search query - when searching, search entire shared drive (no folder restriction)
      if (options?.query) {
        // Search by file name only - do NOT use fullText contains as it searches
        // inside file content and returns many irrelevant results
        // Exclude folders from search results - only return files
        // Don't add parent folder restriction to search entire drive
        const escapedQuery = options.query.replace(/'/g, "\\'").replace(/"/g, '\\"');
        q += ` and name contains '${escapedQuery}' and mimeType != 'application/vnd.google-apps.folder'`;
      } else {
        // Folder navigation within shared drive (only when not searching)
        // When corpora='drive' and driveId are used together, 'root' in parents
        // refers to the root of the specified shared drive
        if (options?.folderId && options.folderId !== 'root') {
          // Specific folder within shared drive
          q += ` and '${options.folderId}' in parents`;
        } else {
          // Root of shared drive - use 'root' in parents
          // When combined with driveId and corpora='drive', this returns only files
          // from the root of the specified shared drive
          q += " and 'root' in parents";
        }
        // When not searching, also exclude folders from recent files list
        q += " and mimeType != 'application/vnd.google-apps.folder'";
      }

      const params: Record<string, any> = {
        pageSize: options?.pageSize ?? 100,
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,thumbnailLink,webViewLink,size,shared,owners,parents)',
        q,
        orderBy: 'folder,name',
        // Critical: driveId must be set to limit results to the specific shared drive
        // This parameter MUST be included to scope the query to the specific drive
        driveId: driveId,
        // corpora='drive' limits the search to the specified drive (not all drives)
        // This is REQUIRED for shared drive queries
        corpora: 'drive',
        // These flags are required for shared drive support
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      };
      
      // Debug: Log the exact parameters being sent to Google Drive API
      console.log('[GoogleDriveClient] API request params (sanitized):', {
        driveId,
        corpora: params.corpora,
        q: params.q,
        pageSize: params.pageSize,
        includeItemsFromAllDrives: params.includeItemsFromAllDrives,
        supportsAllDrives: params.supportsAllDrives,
      });

      if (options?.pageToken) {
        params.pageToken = options.pageToken;
      }

      console.log('[GoogleDriveClient] listFilesInSharedDrive request:', {
        driveId,
        folderId: options?.folderId,
        query: q,
        params: {
          ...params,
          // Don't log access token
          // accessToken: '***',
        },
      });

      const res = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params,
      });

      console.log('[GoogleDriveClient] listFilesInSharedDrive response:', {
        fileCount: res.data.files?.length || 0,
        hasNextPage: !!res.data.nextPageToken,
        firstFileNames: res.data.files?.slice(0, 5).map((f: any) => f.name) || [],
      });

      return res.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        const errorCode = error.response.data?.error?.code || error.response.status;
        throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
      }
      throw error;
    }
  }

  async getFileMetadata(accessToken: string, fileId: string) {
    try {
      const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: 'id,name,mimeType,size,thumbnailLink,webViewLink',
          supportsAllDrives: true,
        },
      });

      return res.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        const errorCode = error.response.data?.error?.code || error.response.status;
        throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
      }
      throw error;
    }
  }

  async downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
    try {
      const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          alt: 'media',
          supportsAllDrives: true,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(res.data);
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        const errorCode = error.response.data?.error?.code || error.response.status;
        throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
      }
      throw error;
    }
  }

  async downloadThumbnail(accessToken: string, fileId: string): Promise<Buffer> {
    try {
      // Use Google Drive API's thumbnail endpoint directly
      // This is more reliable than using thumbnailLink which may require additional authentication
      const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}/thumbnail`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          supportsAllDrives: true,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(res.data);
    } catch (error: any) {
      // If thumbnail endpoint fails, try to get thumbnail from thumbnailLink
      if (error.response?.status === 404 || error.response?.status === 403) {
        try {
          const metadata = await this.getFileMetadata(accessToken, fileId);
          
          if (!metadata.thumbnailLink) {
            throw new Error('Thumbnail not available for this file');
          }

          // Download thumbnail from thumbnailLink with access token
          const thumbnailUrl = new URL(metadata.thumbnailLink);
          thumbnailUrl.searchParams.set('access_token', accessToken);

          const res = await axios.get(thumbnailUrl.toString(), {
            responseType: 'arraybuffer',
          });

          return Buffer.from(res.data);
        } catch (fallbackError: any) {
          if (fallbackError.response) {
            const errorMessage = fallbackError.response.data?.error?.message || fallbackError.response.statusText;
            const errorCode = fallbackError.response.data?.error?.code || fallbackError.response.status;
            throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
          }
          throw fallbackError;
        }
      }
      
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        const errorCode = error.response.data?.error?.code || error.response.status;
        throw new Error(`Google Drive API error (${errorCode}): ${errorMessage}`);
      }
      throw error;
    }
  }
}
