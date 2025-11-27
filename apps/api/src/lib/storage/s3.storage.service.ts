import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storageConfig } from '../../config/index.js';
import { buildMediaObjectKey } from './key-builder.js';
import type { PresignedUploadRequest, PresignedUploadResponse, StorageService } from './storage.service.js';
import { logger } from '../logger.js';

export class S3StorageService implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = storageConfig.bucket;
    this.client = new S3Client({
      region: storageConfig.region,
    });
  }

  private validateUploadRequest(req: PresignedUploadRequest) {
    if (req.sizeBytes > storageConfig.limits.maxFileSizeBytes) {
      throw new Error('FILE_TOO_LARGE');
    }
    const ext = (req.fileName.split('.').pop() || '').toLowerCase();
    if (!storageConfig.limits.allowedExtensions.includes(ext)) {
      throw new Error('FILE_EXTENSION_NOT_ALLOWED');
    }
    if (!storageConfig.limits.allowedMimeTypes.includes(req.contentType)) {
      throw new Error('MIME_TYPE_NOT_ALLOWED');
    }
  }

  async getPresignedUploadUrl(req: PresignedUploadRequest): Promise<PresignedUploadResponse> {
    this.validateUploadRequest(req);

    const fileId = randomUUID();
    const objectKey = buildMediaObjectKey({
      workspaceId: req.workspaceId,
      brandId: req.brandId,
      fileId,
      originalFileName: req.fileName,
    });

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: req.contentType,
      ContentLength: req.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: storageConfig.presign.uploadExpireSeconds,
    });

    return {
      uploadUrl,
      method: 'PUT',
      objectKey,
      expiresInSeconds: storageConfig.presign.uploadExpireSeconds,
    };
  }

  async getPresignedDownloadUrl(
    objectKey: string,
    opts?: { expiresInSeconds?: number }
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    const expiresIn = opts?.expiresInSeconds ?? storageConfig.presign.downloadExpireSeconds;
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        })
      );
    } catch (error) {
      logger.error({ error, objectKey }, 'Failed to delete object from S3');
      throw error;
    }
  }

  async getObjectBuffer(objectKey: string): Promise<{ buffer: Buffer; contentType?: string; contentLength?: number }> {
    let response;
    try {
      response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        })
      );
    } catch (error: any) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404 || error?.name === 'NoSuchKey') {
        const err = new Error('OBJECT_NOT_FOUND');
        (err as any).cause = error;
        throw err;
      }
      logger.error({ error, objectKey }, 'Failed to get object from S3');
      throw error;
    }

    if (!response.Body) {
      throw new Error('OBJECT_STREAM_EMPTY');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: response.ContentType,
      contentLength: response.ContentLength ?? undefined,
    };
  }

  async putObject(objectKey: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    });
    await this.client.send(command);
  }
}
