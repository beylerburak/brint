/**
 * S3 URL Generator
 * 
 * Generates URLs for S3 objects (public or presigned based on isPublic flag)
 */

import { generatePresignedUrl } from './s3-client.js';

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://s3.amazonaws.com';
const MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET || 'brint-media-dev';

/**
 * Get public URL for S3 object (for public media only)
 * 
 * For MinIO: http://localhost:9000/bucket/key
 * For S3: https://bucket.s3.region.amazonaws.com/key
 */
export function getS3PublicUrl(bucket: string, key: string): string {
  if (S3_ENDPOINT && (S3_ENDPOINT.includes('localhost') || S3_ENDPOINT.includes('127.0.0.1'))) {
    // MinIO/LocalStack: http://localhost:9000/bucket/key
    return `${S3_ENDPOINT}/${bucket}/${key}`;
  } else {
    // AWS S3: https://bucket.s3.region.amazonaws.com/key
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}

/**
 * Get variant URL from media object (async for presigned URLs)
 */
export async function getMediaVariantUrlAsync(
  bucket: string,
  variants: any,
  variantName: 'thumbnail' | 'small' | 'medium' | 'large' | 'original',
  isPublic: boolean = false
): Promise<string | null> {
  if (!variants || typeof variants !== 'object') return null;
  
  const variant = variants[variantName];
  if (!variant?.key) return null;
  
  if (isPublic) {
    // Public media: use direct S3 URL
    return getS3PublicUrl(bucket, variant.key);
  } else {
    // Private media: generate presigned URL (1 hour expiry)
    return await generatePresignedUrl(bucket, variant.key, 3600);
  }
}

/**
 * Legacy sync function (deprecated, use getMediaVariantUrlAsync)
 */
export function getMediaVariantUrl(
  bucket: string,
  variants: any,
  variantName: 'thumbnail' | 'small' | 'medium' | 'large' | 'original'
): string | null {
  if (!variants || typeof variants !== 'object') return null;
  
  const variant = variants[variantName];
  if (!variant?.key) return null;
  
  return getS3PublicUrl(bucket, variant.key);
}

