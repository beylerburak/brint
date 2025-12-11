/**
 * Media URL Helper
 *
 * Generates publishable URLs for media objects that can be accessed by external platforms.
 * For private S3 objects, generates presigned GET URLs. For public objects, uses direct URLs.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Media } from "@prisma/client";
import { getS3Client } from "../storage/s3-client.js";
import { getS3PublicUrl } from "../storage/s3-url.js";

let s3Client: S3Client | null = null;

/**
 * Get or create S3 client for presigned URL generation
 */
function getS3ClientForUrls(): S3Client {
  if (!s3Client) {
    s3Client = getS3Client();
  }
  return s3Client;
}

/**
 * Generate a publishable URL for media that can be accessed by external platforms
 *
 * This function handles both public and private media:
 * - Public media: Returns direct S3 URL
 * - Private media: Returns presigned GET URL with configurable expiration
 *
 * @param media - Media object from database
 * @param options - Configuration options
 * @returns Promise<string> - URL that can be used by external platforms
 */
export async function getPublishableUrlForMedia(
  media: Media,
  options?: {
    variantKey?: string;
    expiresInSeconds?: number;
  }
): Promise<string> {
  const expiresIn = options?.expiresInSeconds ?? 60 * 10; // 10 minutes default
  const keyToUse = options?.variantKey ?? media.baseKey;

  // TODO: Future enhancement - check for CDN/public URL support
  // if (media.isPublic && hasCdnUrl) {
  //   return getCdnUrl(media.bucket, keyToUse);
  // }

  if (media.isPublic) {
    // Public media: use direct S3 URL
    return getS3PublicUrl(media.bucket, keyToUse);
  } else {
    // Private media: generate presigned GET URL
    const client = getS3ClientForUrls();
    const command = new GetObjectCommand({
      Bucket: media.bucket,
      Key: keyToUse,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  }
}