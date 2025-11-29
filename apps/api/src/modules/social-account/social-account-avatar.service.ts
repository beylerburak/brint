/**
 * Social Account Avatar Service
 * 
 * Downloads and saves social account profile pictures as media.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { S3StorageService } from '../../lib/storage/s3.storage.service.js';
import { buildMediaObjectKey } from '../../lib/storage/key-builder.js';
import { generateImageVariants } from '../media/lib/image-optimizer.js';
import { storageConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

const storage = new S3StorageService();

export interface SaveAvatarFromUrlInput {
  imageUrl: string;
  workspaceId: string;
  brandId?: string;
  socialAccountId: string;
  platform: string;
  accountName: string;
}

/**
 * Download an image from URL and save it as media
 * Returns the created media ID
 */
export async function saveAvatarFromUrl(
  input: SaveAvatarFromUrlInput
): Promise<string | null> {
  const { imageUrl, workspaceId, brandId, socialAccountId, platform, accountName } = input;

  if (!imageUrl) {
    logger.debug({ socialAccountId }, 'No avatar URL provided, skipping avatar save');
    return null;
  }

  try {
    // 1. Download the image
    logger.debug({ imageUrl, socialAccountId }, 'Downloading social account avatar');
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrintBot/1.0)',
      },
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, imageUrl, socialAccountId },
        'Failed to download social account avatar'
      );
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2. Generate object key
    const fileId = randomUUID();
    const extension = getExtensionFromContentType(contentType);
    const fileName = `${platform.toLowerCase()}-avatar-${sanitizeFileName(accountName)}.${extension}`;
    
    const objectKey = buildMediaObjectKey({
      workspaceId,
      brandId,
      fileId,
      originalFileName: fileName,
    });

    // 3. Upload original to S3
    await storage.putObject(objectKey, buffer, contentType);

    // 4. Generate and upload variants
    const { variants, files } = await generateImageVariants({
      buffer,
      contentType,
      baseKey: objectKey,
      variantsConfig: storageConfig.assets.avatar.variants,
    });

    await Promise.all(
      files.map((file) => storage.putObject(file.key, file.buffer, file.contentType))
    );

    // 5. Create media record
    const media = await prisma.media.create({
      data: {
        workspaceId,
        brandId: brandId || null,
        objectKey,
        originalName: fileName,
        contentType,
        sizeBytes: buffer.byteLength,
        variants: variants as Prisma.InputJsonValue,
      },
    });

    // 6. Update social account with avatar
    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: { avatarMediaId: media.id },
    });

    logger.info(
      { mediaId: media.id, socialAccountId, platform },
      'Social account avatar saved successfully'
    );

    return media.id;
  } catch (error) {
    logger.error(
      { error, imageUrl, socialAccountId },
      'Failed to save social account avatar'
    );
    return null;
  }
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[contentType] || 'jpg';
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

