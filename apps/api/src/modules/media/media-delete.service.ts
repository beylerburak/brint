/**
 * Media Delete Service
 * 
 * Handles media deletion from database and S3.
 */

import { prisma } from '../../lib/prisma.js';
import { deleteMultipleFromS3 } from '../../core/storage/s3-client.js';
import { logger } from '../../lib/logger.js';

export type DeleteMediaInput = {
  mediaId: string;
  workspaceId: string;
  userId: string;
};

/**
 * Delete media and all its variants from S3 and database
 */
export async function deleteMedia(input: DeleteMediaInput): Promise<void> {
  logger.info(
    {
      mediaId: input.mediaId,
      workspaceId: input.workspaceId,
      userId: input.userId,
    },
    'Starting media deletion'
  );

  // Fetch media record
  const media = await prisma.media.findFirst({
    where: {
      id: input.mediaId,
      workspaceId: input.workspaceId,
    },
  });

  if (!media) {
    throw new Error('Media not found');
  }

  // Collect all S3 keys to delete
  const keysToDelete: string[] = [media.baseKey]; // Original file

  // Add all variant keys
  if (media.variants && typeof media.variants === 'object') {
    const variants = media.variants as Record<string, any>;
    for (const variant of Object.values(variants)) {
      if (variant?.key) {
        keysToDelete.push(variant.key);
      }
    }
  }

  logger.info(
    {
      mediaId: input.mediaId,
      fileCount: keysToDelete.length,
      keys: keysToDelete,
    },
    'Deleting files from S3'
  );

  // Delete from S3
  try {
    await deleteMultipleFromS3(media.bucket, keysToDelete);
    logger.info({ mediaId: input.mediaId }, 'Files deleted from S3');
  } catch (error) {
    logger.error({ error, mediaId: input.mediaId }, 'Failed to delete from S3');
    // Continue with database deletion even if S3 fails
  }

  // Delete from database
  await prisma.media.delete({
    where: { id: input.mediaId },
  });

  logger.info({ mediaId: input.mediaId }, 'Media deleted from database');
}

