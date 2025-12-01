/**
 * Shared Media Utilities for Publication Providers
 * 
 * Common utilities for handling media across different social platforms.
 * Provides media URL resolution with CDN and S3 presigned URL fallback.
 */

import { prisma } from "../../../lib/prisma.js";
import { buildPublicUrl } from "../../../lib/storage/public-url.js";
import { S3StorageService } from "../../../lib/storage/s3.storage.service.js";
import { logger } from "../../../lib/logger.js";

const s3Storage = new S3StorageService();

/**
 * Get public URL for a media item
 * Falls back to presigned S3 URL if CDN is not configured
 * 
 * @param mediaId - The media ID to get URL for
 * @returns Public URL or null if media not found
 */
export async function getMediaPublicUrl(mediaId: string): Promise<string | null> {
    const media = await prisma.media.findUnique({
        where: { id: mediaId },
        select: { objectKey: true, variants: true },
    });

    if (!media) return null;

    // Try CDN URL first
    const publicUrl = buildPublicUrl(media.objectKey);
    if (publicUrl) return publicUrl;

    // Fall back to presigned S3 URL (valid for 1 hour)
    try {
        const presignedUrl = await s3Storage.getPresignedDownloadUrl(media.objectKey, {
            expiresInSeconds: 3600, // 1 hour
        });
        logger.info({ mediaId }, "Using presigned S3 URL for media");
        return presignedUrl;
    } catch (err) {
        logger.warn({ mediaId, err }, "Failed to generate presigned URL for media");
        return null;
    }
}
