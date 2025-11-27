import { httpClient } from "@/shared/http";

export interface PresignUploadRequest {
  workspaceId: string;
  brandId?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
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
