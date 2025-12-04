/**
 * S3 Storage Client
 * 
 * Handles file uploads to AWS S3 for media storage.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'stream';

let s3Client: S3Client | null = null;

/**
 * Get environment variables (lazy loaded after dotenv)
 */
function getEnv() {
  return {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.S3_MEDIA_BUCKET || 'brint-media-dev',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  };
}

/**
 * Get or create S3 client instance
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    const env = getEnv();
    
    const config: any = {
      region: env.region,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    };

    // For MinIO/LocalStack
    if (env.endpoint) {
      config.endpoint = env.endpoint;
      config.forcePathStyle = env.forcePathStyle;
    }

    s3Client = new S3Client(config);
  }
  return s3Client;
}

export type UploadToS3Params = {
  bucket?: string;
  key: string;
  body: Buffer | Uint8Array | Blob | string | Readable;
  contentType?: string;
  metadata?: Record<string, string>;
};

/**
 * Upload a file to S3
 */
export async function uploadToS3(params: UploadToS3Params): Promise<{ key: string; bucket: string }> {
  const client = getS3Client();
  const env = getEnv();
  const bucket = params.bucket ?? env.bucket;

  // For large files or streams, use Upload from @aws-sdk/lib-storage
  if (params.body instanceof Buffer && params.body.length > 5 * 1024 * 1024) {
    // Use multipart upload for files > 5MB
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        Metadata: params.metadata,
      },
    });

    await upload.done();
  } else {
    // Use simple PutObject for smaller files
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
    });

    await client.send(command);
  }

  return {
    key: params.key,
    bucket,
  };
}

/**
 * Generate S3 key for media object
 * 
 * Pattern: media/{workspaceId}/{mediaId}/{variantName}.{extension}
 * 
 * @example
 * getMediaObjectKey('ws123', 'med456', 'original', 'jpg')
 * // Returns: 'media/ws123/med456/original.jpg'
 */
export function getMediaObjectKey(
  workspaceId: string,
  mediaId: string,
  variantName: string,
  extension: string
): string {
  return `media/${workspaceId}/${mediaId}/${variantName}.${extension}`;
}

/**
 * Get the base path for all variants of a media item
 * 
 * @example
 * getMediaBasePath('ws123', 'med456')
 * // Returns: 'media/ws123/med456'
 */
export function getMediaBasePath(workspaceId: string, mediaId: string): string {
  return `media/${workspaceId}/${mediaId}`;
}

export function getMediaBucketName() {
  return getEnv().bucket;
}

export function getAwsRegionName() {
  return getEnv().region;
}

import { APP_CONFIG } from '../../config/app-config.js';

/**
 * Generate presigned URL for private S3 object
 * 
 * @param bucket S3 bucket name
 * @param key S3 object key
 * @param expiresIn Expiration time in seconds (default: from config)
 */
export async function generatePresignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = APP_CONFIG.media.s3.presignedUrlExpirySeconds
): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete a single object from S3
 */
export async function deleteFromS3(bucket: string, key: string): Promise<void> {
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Delete multiple objects from S3
 */
export async function deleteMultipleFromS3(bucket: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const client = getS3Client();
  const command = new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
      Quiet: true,
    },
  });

  await client.send(command);
}

// Legacy exports (lazy)
export const MEDIA_BUCKET_NAME = getEnv().bucket;
export const AWS_REGION_NAME = getEnv().region;

