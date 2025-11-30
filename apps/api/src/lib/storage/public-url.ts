/**
 * Public URL Builder
 * 
 * Utilities for building public CDN URLs for media files.
 */

import { storageConfig } from '../../config/index.js';

/**
 * Build a public CDN URL for a media object
 * 
 * This only works for media with isPublic: true
 * For private media, use presigned URLs instead.
 * 
 * @param objectKey - The S3 object key
 * @returns Public CDN URL or null if CDN is not configured
 */
export function buildPublicUrl(objectKey: string): string | null {
  const cdnBaseUrl = storageConfig.cdnBaseUrl;
  
  if (!cdnBaseUrl) {
    return null;
  }

  // Ensure no double slashes
  const baseUrl = cdnBaseUrl.endsWith('/') ? cdnBaseUrl.slice(0, -1) : cdnBaseUrl;
  const key = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey;

  return `${baseUrl}/${key}`;
}

/**
 * Build a public URL for a specific variant
 * 
 * @param variants - The variants object from media record
 * @param variantName - The variant name (e.g., 'thumbnail', 'sm', 'md', 'lg')
 * @returns Public CDN URL for the variant or null
 */
export function buildPublicVariantUrl(
  variants: Record<string, { key: string }> | null | undefined,
  variantName: string
): string | null {
  if (!variants || !variants[variantName]?.key) {
    return null;
  }

  return buildPublicUrl(variants[variantName].key);
}

