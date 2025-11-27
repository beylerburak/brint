import { env } from './env.js';

export const storageConfig = {
  region: env.AWS_REGION,
  bucket: env.S3_MEDIA_BUCKET,
  cdnBaseUrl: env.S3_PUBLIC_CDN_URL ?? null,
  presign: {
    uploadExpireSeconds: 60,
    downloadExpireSeconds: 120,
  },
  limits: {
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
  },
  variants: {
    thumbnail: { width: 240, height: 240, quality: 70 },
    sm: { width: 480, quality: 75 },
    md: { width: 960, quality: 80 },
    lg: { width: 1600, quality: 80 },
  },
} as const;
