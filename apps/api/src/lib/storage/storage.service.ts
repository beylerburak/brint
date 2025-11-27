export type PresignedUploadRequest = {
  workspaceId: string;
  brandId?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type PresignedUploadResponse = {
  uploadUrl: string;
  method: 'PUT';
  objectKey: string;
  expiresInSeconds: number;
};

export interface StorageService {
  getPresignedUploadUrl(req: PresignedUploadRequest): Promise<PresignedUploadResponse>;
  getPresignedDownloadUrl(
    objectKey: string,
    opts?: { expiresInSeconds?: number }
  ): Promise<string>;
  getObjectBuffer(objectKey: string): Promise<{ buffer: Buffer; contentType?: string; contentLength?: number }>;
  putObject(objectKey: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}
