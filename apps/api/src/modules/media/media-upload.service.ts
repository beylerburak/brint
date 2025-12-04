/**
 * Media Upload Service
 * 
 * Handles file uploads and media record creation.
 */

import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { uploadToS3, getMediaObjectKey, getMediaBucketName } from '../../core/storage/s3-client.js';
import { enqueueVariantGeneration } from '../../core/queue/media-queue.js';
import { logger } from '../../lib/logger.js';
import type { MediaKind } from '@prisma/client';

export type UploadMediaInput = {
  workspaceId: string;
  brandId?: string | null;
  ownerUserId: string;
  
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  
  metadata?: {
    title?: string;
    alt?: string;
    description?: string;
    isPublic?: boolean;
  };
};

export type UploadMediaResult = {
  id: string;
  kind: MediaKind;
  status: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  baseKey: string;
  bucket: string;
};

/**
 * Determine media kind from MIME type
 */
function getMediaKindFromMimeType(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  
  if (mimeType.includes('pdf') || 
      mimeType.includes('document') || 
      mimeType.includes('msword') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation')) {
    return 'DOCUMENT';
  }
  
  if (mimeType.includes('font') || 
      mimeType.endsWith('woff') || 
      mimeType.endsWith('woff2') ||
      mimeType.endsWith('ttf') ||
      mimeType.endsWith('otf')) {
    return 'FONT';
  }
  
  if (mimeType.includes('zip') || 
      mimeType.includes('rar') ||
      mimeType.includes('7z') ||
      mimeType.includes('compressed')) {
    return 'ARCHIVE';
  }
  
  return 'OTHER';
}

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
}

/**
 * Upload media file to S3 and create database record
 */
export async function uploadMedia(input: UploadMediaInput): Promise<UploadMediaResult> {
  const mediaId = randomUUID();
  const extension = getExtension(input.file.originalname);
  const kind = getMediaKindFromMimeType(input.file.mimetype);
  
  // Generate S3 key
  const baseKey = getMediaObjectKey(input.workspaceId, mediaId, 'original', extension);
  
  logger.info(
    {
      mediaId,
      workspaceId: input.workspaceId,
      filename: input.file.originalname,
      size: input.file.size,
      kind,
    },
    'Starting media upload'
  );

  // Upload to S3
  await uploadToS3({
    key: baseKey,
    body: input.file.buffer,
    contentType: input.file.mimetype,
    metadata: {
      workspaceId: input.workspaceId,
      mediaId,
      originalFilename: input.file.originalname,
    },
  });

  logger.info({ mediaId, baseKey }, 'File uploaded to S3');

  // Create database record
  const mediaBucket = getMediaBucketName();
  const media = await prisma.media.create({
    data: {
      id: mediaId,
      workspaceId: input.workspaceId,
      brandId: input.brandId || null,
      ownerUserId: input.ownerUserId,
      kind,
      status: 'PENDING',
      originalFilename: input.file.originalname,
      extension,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      storageProvider: 'S3',
      bucket: mediaBucket,
      baseKey,
      title: input.metadata?.title || null,
      alt: input.metadata?.alt || null,
      description: input.metadata?.description || null,
      isPublic: input.metadata?.isPublic ?? false,
    },
  });

  logger.info({ mediaId }, 'Media record created in database');

  // Enqueue variant generation for IMAGE and VIDEO
  if (kind === 'IMAGE' || kind === 'VIDEO') {
    await enqueueVariantGeneration({
      mediaId: media.id,
      workspaceId: media.workspaceId,
      kind,
      originalKey: baseKey,
      bucket: mediaBucket,
    });
  } else {
    // For other types, mark as READY immediately
    await prisma.media.update({
      where: { id: mediaId },
      data: { status: 'READY' },
    });
  }

  return {
    id: media.id,
    kind: media.kind,
    status: media.status,
    originalFilename: media.originalFilename,
    sizeBytes: media.sizeBytes,
    mimeType: media.mimeType,
    baseKey: media.baseKey,
    bucket: media.bucket,
  };
}

