// apps/api/src/modules/integration/google-drive/google-drive.service.ts

import { IntegrationRepository } from '../integration.repository.js';
import { IntegrationType, IntegrationStatus } from '@prisma/client';
import { GoogleDriveOAuthClient } from './google-drive.client.js';
import { GOOGLE_DRIVE_CONFIG } from '../../../config/integration-config.js';

interface WorkspaceContext {
  workspaceId: string;
  userId: string;
}

export class GoogleDriveIntegrationService {
  private readonly repo = new IntegrationRepository();
  private readonly oauth = new GoogleDriveOAuthClient();

  getAuthUrl(ctx: WorkspaceContext) {
    const statePayload = JSON.stringify({
      workspaceId: ctx.workspaceId,
    });
    const state = Buffer.from(statePayload).toString('base64url');

    const url = this.oauth.getAuthUrl(state);
    return url;
  }

  async handleOAuthCallback(params: {
    code: string;
    state: string;
    userId: string;
  }) {
    const decoded = JSON.parse(Buffer.from(params.state, 'base64url').toString('utf8')) as {
      workspaceId: string;
    };

    const { workspaceId } = decoded;
    const tokens = await this.oauth.exchangeCodeForTokens(params.code);

    const now = new Date();
    const expiryDate =
      tokens.expires_in != null
        ? new Date(now.getTime() + tokens.expires_in * 1000)
        : null;

    const auth = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: expiryDate?.toISOString() ?? null,
      scope: tokens.scope ?? GOOGLE_DRIVE_CONFIG.scope,
      tokenType: tokens.token_type ?? 'Bearer',
    };

    const record = await this.repo.upsertWorkspaceIntegration({
      workspaceId,
      integrationType: IntegrationType.GOOGLE_DRIVE,
      status: IntegrationStatus.ACTIVE,
      statusMessage: null,
      auth,
      connectedByUserId: params.userId,
      lastSyncedAt: null,
    });

    return record;
  }

  async disconnect(ctx: WorkspaceContext) {
    return this.repo.deleteWorkspaceIntegration(ctx.workspaceId, IntegrationType.GOOGLE_DRIVE);
  }

  async getStatus(ctx: WorkspaceContext) {
    const integ = await this.repo.findByWorkspaceAndType(ctx.workspaceId, IntegrationType.GOOGLE_DRIVE);
    if (!integ) {
      return {
        connected: false,
        status: IntegrationStatus.DISCONNECTED,
      };
    }

    return {
      connected: integ.status === IntegrationStatus.ACTIVE,
      status: integ.status,
      statusMessage: integ.statusMessage ?? null,
      lastSyncedAt: integ.lastSyncedAt ?? null,
    };
  }

  async listSharedDrives(ctx: WorkspaceContext) {
    const integ = await this.repo.findByWorkspaceAndType(ctx.workspaceId, IntegrationType.GOOGLE_DRIVE);
    if (!integ || !integ.auth) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED');
    }

    const auth = integ.auth as any;
    let { accessToken, refreshToken, expiryDate } = auth;

    // Token refresh logic - check if token is expired or about to expire
    const shouldRefresh = !expiryDate || new Date(expiryDate).getTime() < Date.now() - 60_000;
    
    if (shouldRefresh) {
      if (!refreshToken) {
        await this.repo.updateStatus({
          workspaceId: ctx.workspaceId,
          integrationType: IntegrationType.GOOGLE_DRIVE,
          status: IntegrationStatus.ERROR,
          statusMessage: 'Missing refresh token',
        });
        throw new Error('GOOGLE_DRIVE_REFRESH_FAILED');
      }

      const tokens = await this.oauth.refreshAccessToken(refreshToken);
      const now = new Date();
      const newExpiry =
        tokens.expires_in != null
          ? new Date(now.getTime() + tokens.expires_in * 1000)
          : null;

      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token ?? refreshToken;

      const newAuth = {
        ...auth,
        accessToken,
        refreshToken,
        expiryDate: newExpiry?.toISOString() ?? null,
        tokenType: tokens.token_type ?? auth.tokenType ?? 'Bearer',
        scope: tokens.scope ?? auth.scope,
      };

      await this.repo.upsertWorkspaceIntegration({
        workspaceId: ctx.workspaceId,
        integrationType: IntegrationType.GOOGLE_DRIVE,
        auth: newAuth,
        status: IntegrationStatus.ACTIVE,
        statusMessage: null,
      });
    }

    // Try to list shared drives, if 401 error occurs, try refreshing token once more
    try {
      const drives = await this.oauth.listSharedDrives(accessToken);
      return drives;
    } catch (error: any) {
      // If we get 401 and haven't refreshed yet, try refreshing and retry
      if (error.message?.includes('401') && !shouldRefresh && refreshToken) {
        const tokens = await this.oauth.refreshAccessToken(refreshToken);
        const now = new Date();
        const newExpiry =
          tokens.expires_in != null
            ? new Date(now.getTime() + tokens.expires_in * 1000)
            : null;

        const newAccessToken = tokens.access_token;
        const newRefreshToken = tokens.refresh_token ?? refreshToken;

        const newAuth = {
          ...auth,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiryDate: newExpiry?.toISOString() ?? null,
          tokenType: tokens.token_type ?? auth.tokenType ?? 'Bearer',
          scope: tokens.scope ?? auth.scope,
        };

        await this.repo.upsertWorkspaceIntegration({
          workspaceId: ctx.workspaceId,
          integrationType: IntegrationType.GOOGLE_DRIVE,
          auth: newAuth,
          status: IntegrationStatus.ACTIVE,
          statusMessage: null,
        });

        // Retry with new token
        const drives = await this.oauth.listSharedDrives(newAccessToken);
        return drives;
      }
      throw error;
    }
  }

  async listFiles(
    ctx: WorkspaceContext,
    options?: { query?: string; pageSize?: number; pageToken?: string; folderId?: string; driveId?: string }
  ) {
    const integ = await this.repo.findByWorkspaceAndType(ctx.workspaceId, IntegrationType.GOOGLE_DRIVE);
    if (!integ || !integ.auth) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED');
    }

    const auth = integ.auth as any;
    let { accessToken, refreshToken, expiryDate } = auth;

    // Token refresh logic - check if token is expired or about to expire
    const shouldRefresh = !expiryDate || new Date(expiryDate).getTime() < Date.now() - 60_000;
    
    if (shouldRefresh) {
      if (!refreshToken) {
        await this.repo.updateStatus({
          workspaceId: ctx.workspaceId,
          integrationType: IntegrationType.GOOGLE_DRIVE,
          status: IntegrationStatus.ERROR,
          statusMessage: 'Missing refresh token',
        });
        throw new Error('GOOGLE_DRIVE_REFRESH_FAILED');
      }

      const tokens = await this.oauth.refreshAccessToken(refreshToken);
      const now = new Date();
      const newExpiry =
        tokens.expires_in != null
          ? new Date(now.getTime() + tokens.expires_in * 1000)
          : null;

      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token ?? refreshToken;

      const newAuth = {
        ...auth,
        accessToken,
        refreshToken,
        expiryDate: newExpiry?.toISOString() ?? null,
        tokenType: tokens.token_type ?? auth.tokenType ?? 'Bearer',
        scope: tokens.scope ?? auth.scope,
      };

      await this.repo.upsertWorkspaceIntegration({
        workspaceId: ctx.workspaceId,
        integrationType: IntegrationType.GOOGLE_DRIVE,
        auth: newAuth,
        status: IntegrationStatus.ACTIVE,
        statusMessage: null,
      });
    }

    // Helper function to refresh token and retry on 401
    const executeWithRetry = async (fn: (token: string) => Promise<any>) => {
      try {
        return await fn(accessToken);
      } catch (error: any) {
        // If we get 401 and haven't refreshed yet, try refreshing and retry
        if (error.message?.includes('401') && !shouldRefresh && refreshToken) {
          const tokens = await this.oauth.refreshAccessToken(refreshToken);
          const now = new Date();
          const newExpiry =
            tokens.expires_in != null
              ? new Date(now.getTime() + tokens.expires_in * 1000)
              : null;

          const newAccessToken = tokens.access_token;
          const newRefreshToken = tokens.refresh_token ?? refreshToken;

          const newAuth = {
            ...auth,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiryDate: newExpiry?.toISOString() ?? null,
            tokenType: tokens.token_type ?? auth.tokenType ?? 'Bearer',
            scope: tokens.scope ?? auth.scope,
          };

          await this.repo.upsertWorkspaceIntegration({
            workspaceId: ctx.workspaceId,
            integrationType: IntegrationType.GOOGLE_DRIVE,
            auth: newAuth,
            status: IntegrationStatus.ACTIVE,
            statusMessage: null,
          });

          // Retry with new token
          return await fn(newAccessToken);
        }
        throw error;
      }
    };

    // If driveId is provided, list files in that shared drive
    if (options?.driveId) {
      console.log('[GoogleDriveService] Listing files in shared drive:', {
        driveId: options.driveId,
        folderId: options?.folderId,
        query: options?.query,
        pageSize: options?.pageSize,
        pageToken: options?.pageToken,
      });
      const files = await executeWithRetry((token) =>
        this.oauth.listFilesInSharedDrive(token, options.driveId!, {
          query: options?.query,
          pageSize: options?.pageSize,
          pageToken: options?.pageToken,
          folderId: options?.folderId,
        })
      );
      console.log('[GoogleDriveService] Shared drive files result:', {
        fileCount: files.files?.length || 0,
        firstFileNames: files.files?.slice(0, 5).map((f: any) => f.name) || [],
      });
      await this.repo.upsertWorkspaceIntegration({
        workspaceId: ctx.workspaceId,
        integrationType: IntegrationType.GOOGLE_DRIVE,
        lastSyncedAt: new Date(),
      });
      return files;
    }

    // Otherwise, list files (My Drive + Shared Drives if no folderId specified)
    // If folderId is specified, only search in that folder
    // If no folderId and no query, show recently modified files from all drives
    const files = await executeWithRetry((token) =>
      this.oauth.listFiles(token, {
        includeSharedDrives: !options?.folderId, // Include shared drives when not in a specific folder
        query: options?.query,
        pageSize: options?.pageSize,
        pageToken: options?.pageToken,
        folderId: options?.folderId,
      })
    );
    await this.repo.upsertWorkspaceIntegration({
      workspaceId: ctx.workspaceId,
      integrationType: IntegrationType.GOOGLE_DRIVE,
      lastSyncedAt: new Date(),
    });

    return files;
  }

  async importFile(ctx: WorkspaceContext, fileId: string) {
    const integ = await this.repo.findByWorkspaceAndType(ctx.workspaceId, IntegrationType.GOOGLE_DRIVE);
    if (!integ || !integ.auth) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED');
    }

    const auth = integ.auth as any;
    let { accessToken, refreshToken, expiryDate } = auth;

    // token expired ise refresh et
    if (expiryDate && new Date(expiryDate).getTime() < Date.now() - 60_000) {
      if (!refreshToken) {
        await this.repo.updateStatus({
          workspaceId: ctx.workspaceId,
          integrationType: IntegrationType.GOOGLE_DRIVE,
          status: IntegrationStatus.ERROR,
          statusMessage: 'Missing refresh token',
        });
        throw new Error('GOOGLE_DRIVE_REFRESH_FAILED');
      }

      const tokens = await this.oauth.refreshAccessToken(refreshToken);
      const now = new Date();
      const newExpiry =
        tokens.expires_in != null
          ? new Date(now.getTime() + tokens.expires_in * 1000)
          : null;

      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token ?? refreshToken;

      const newAuth = {
        ...auth,
        accessToken,
        refreshToken,
        expiryDate: newExpiry?.toISOString() ?? null,
        tokenType: tokens.token_type ?? auth.tokenType ?? 'Bearer',
        scope: tokens.scope ?? auth.scope,
      };

      await this.repo.upsertWorkspaceIntegration({
        workspaceId: ctx.workspaceId,
        integrationType: IntegrationType.GOOGLE_DRIVE,
        auth: newAuth,
        status: IntegrationStatus.ACTIVE,
        statusMessage: null,
      });
    }

    // Get file metadata
    const metadata = await this.oauth.getFileMetadata(accessToken, fileId);
    
    // Download file
    const fileBuffer = await this.oauth.downloadFile(accessToken, fileId);

    // Import to media system
    const { uploadMedia } = await import('../../media/media-upload.service.js');
    const result = await uploadMedia({
      workspaceId: ctx.workspaceId,
      brandId: null, // Can be set later if needed
      ownerUserId: ctx.userId,
      file: {
        buffer: fileBuffer,
        originalname: metadata.name || `drive-file-${fileId}`,
        mimetype: metadata.mimeType || 'application/octet-stream',
        size: parseInt(metadata.size || '0', 10) || fileBuffer.length,
      },
      metadata: {
        title: metadata.name || null,
        description: `Imported from Google Drive (${fileId})`,
        isPublic: false,
      },
    });

    // Get preview URL - always use S3 URL since file is already uploaded to S3
    // Don't use Google Drive thumbnail link as it requires authentication
    const { getPublishableUrlForMedia } = await import('../../../core/media/media-url.helper.js');
    const { prisma } = await import('../../../lib/prisma.js');
    const media = await prisma.media.findUnique({
      where: { id: result.id },
    });

    let previewUrl = '';
    if (media) {
      // Always use S3 presigned URL - file is already uploaded to S3
      previewUrl = await getPublishableUrlForMedia(media, { expiresInSeconds: 3600 });
    } else {
      // Fallback: construct a basic URL (shouldn't happen, but safety check)
      previewUrl = '';
    }

    return {
      id: result.id,
      previewUrl,
      mimeType: result.mimeType,
      kind: result.kind,
    };
  }

  async getThumbnail(ctx: WorkspaceContext, fileId: string) {
    const integ = await this.repo.findByWorkspaceAndType(ctx.workspaceId, IntegrationType.GOOGLE_DRIVE);
    if (!integ || !integ.auth) {
      throw new Error('GOOGLE_DRIVE_NOT_CONNECTED');
    }

    const auth = integ.auth as any;
    let { accessToken, refreshToken, expiryDate } = auth;

    // Token refresh logic
    const shouldRefresh = !expiryDate || new Date(expiryDate).getTime() < Date.now() - 60_000;
    
    if (shouldRefresh) {
      if (!refreshToken) {
        throw new Error('GOOGLE_DRIVE_REFRESH_FAILED');
      }

      const tokens = await this.oauth.refreshAccessToken(refreshToken);
      const now = new Date();
      const newExpiry =
        tokens.expires_in != null
          ? new Date(now.getTime() + tokens.expires_in * 1000)
          : null;

      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token ?? refreshToken;

      const newAuth = {
        ...auth,
        accessToken,
        refreshToken,
        expiryDate: newExpiry?.toISOString() ?? null,
        tokenType: tokens.token_type ?? auth.tokenType ?? 'Bearer',
        scope: tokens.scope ?? auth.scope,
      };

      await this.repo.upsertWorkspaceIntegration({
        workspaceId: ctx.workspaceId,
        integrationType: IntegrationType.GOOGLE_DRIVE,
        auth: newAuth,
        status: IntegrationStatus.ACTIVE,
        statusMessage: null,
      });
    }

    // Get file metadata to get thumbnail link
    const metadata = await this.oauth.getFileMetadata(accessToken, fileId);
    
    if (!metadata.thumbnailLink) {
      throw new Error('THUMBNAIL_NOT_AVAILABLE');
    }

    // Download thumbnail with access token
    const thumbnailBuffer = await this.oauth.downloadThumbnail(accessToken, fileId);
    
    return {
      buffer: thumbnailBuffer,
      contentType: 'image/jpeg', // Google Drive thumbnails are typically JPEG
    };
  }
}
