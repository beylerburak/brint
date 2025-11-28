import { httpClient } from "@/shared/http";
import { apiCache } from "@/shared/api/cache";

export interface MediaConfig {
  version: string;
  presign: {
    uploadExpireSeconds: number;
    downloadExpireSeconds: number;
  };
  cdnBaseUrl: string | null;
  allowedAssetTypes: string[];
  assets: {
    avatar?: {
      limits: {
        maxFileSizeBytes: number;
        allowedExtensions: string[];
        allowedMimeTypes: string[];
      };
      variants?: Record<string, unknown>;
    };
    "content-image"?: {
      limits: {
        maxFileSizeBytes: number;
        allowedExtensions: string[];
        allowedMimeTypes: string[];
      };
      variants?: Record<string, unknown>;
    };
    "content-video"?: {
      limits: {
        maxFileSizeBytes: number;
        allowedExtensions: string[];
        allowedMimeTypes: string[];
      };
      variants?: Record<string, unknown>;
    };
  };
}

export interface GetMediaConfigResponse {
  success: boolean;
  data: MediaConfig;
}

/**
 * Get media configuration (limits, variants, presign durations)
 * Uses global cache with version-based invalidation
 */
export async function getMediaConfig(): Promise<MediaConfig> {
  return apiCache.getOrFetch(
    "media:config",
    async () => {
      const response = await httpClient.get<GetMediaConfigResponse>(
        "/media/config",
        { skipAuth: true }
      );

      if (!response.ok) {
        throw new Error(response.message || "Failed to get media config");
      }

      const config = response.data.data;
      
      // Store version for invalidation check
      const cachedVersion = localStorage.getItem("media:config:version");
      if (cachedVersion && cachedVersion !== config.version) {
        // Version changed, invalidate cache
        apiCache.invalidate("media:config");
      }
      localStorage.setItem("media:config:version", config.version);

      return config;
    },
    300000 // 5 minutes cache (config rarely changes)
  );
}

export interface PresignUploadRequest {
  workspaceId: string;
  brandId?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  assetType?: "avatar" | "content-image" | "content-video";
}

export interface PresignUploadResponse {
  uploadUrl: string;
  method: "PUT";
  objectKey: string;
  expiresInSeconds: number;
}

export async function presignUpload(
  payload: PresignUploadRequest
): Promise<PresignUploadResponse> {
  const response = await httpClient.post<{ success: boolean; data: PresignUploadResponse }>(
    "/media/presign-upload",
    payload
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to presign upload");
  }

  return response.data.data;
}

export interface FinalizeUploadResponse {
  media: {
    id: string;
    objectKey: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    isPublic: boolean;
    variants: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  variants: Record<string, unknown>;
}

export async function finalizeUpload(payload: {
  objectKey: string;
  workspaceId: string;
  brandId?: string;
  originalName: string;
  contentType?: string;
  assetType?: "avatar" | "content-image" | "content-video";
}): Promise<FinalizeUploadResponse> {
  const response = await httpClient.post<{ success: boolean; data: FinalizeUploadResponse }>(
    "/media/finalize",
    payload
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to finalize upload");
  }

  return response.data.data;
}
