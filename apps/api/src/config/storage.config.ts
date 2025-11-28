import { env } from './env.js';
import type { AssetType } from '../lib/storage/storage.types.js';

const MB = (val: number) => val * 1024 * 1024;

const parseList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const imageVariants = {
  thumbnail: { width: env.STORAGE_VARIANT_THUMB_WIDTH, height: env.STORAGE_VARIANT_THUMB_HEIGHT, quality: env.STORAGE_VARIANT_THUMB_QUALITY },
  sm: { width: env.STORAGE_VARIANT_SM_WIDTH, quality: env.STORAGE_VARIANT_SM_QUALITY },
  md: { width: env.STORAGE_VARIANT_MD_WIDTH, quality: env.STORAGE_VARIANT_MD_QUALITY },
  lg: { width: env.STORAGE_VARIANT_LG_WIDTH, quality: env.STORAGE_VARIANT_LG_QUALITY },
};

export const storageConfig = {
  region: env.AWS_REGION,
  bucket: env.S3_MEDIA_BUCKET,
  cdnBaseUrl: env.S3_PUBLIC_CDN_URL ?? null,
  presign: {
    uploadExpireSeconds: env.STORAGE_UPLOAD_EXPIRE_SECONDS,
    downloadExpireSeconds: env.STORAGE_DOWNLOAD_EXPIRE_SECONDS,
  },
  assets: {
    avatar: {
      limits: {
        maxFileSizeBytes: MB(env.STORAGE_AVATAR_MAX_MB),
        allowedExtensions: parseList(env.STORAGE_AVATAR_EXTENSIONS, ['jpg', 'jpeg', 'png', 'webp']),
        allowedMimeTypes: parseList(env.STORAGE_AVATAR_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp']),
      },
      variants: imageVariants,
    },
    'content-image': {
      limits: {
        maxFileSizeBytes: MB(env.STORAGE_CONTENT_IMAGE_MAX_MB),
        allowedExtensions: parseList(env.STORAGE_CONTENT_IMAGE_EXTENSIONS, ['jpg', 'jpeg', 'png', 'webp']),
        allowedMimeTypes: parseList(env.STORAGE_CONTENT_IMAGE_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp']),
      },
      variants: imageVariants,
    },
    'content-video': {
      limits: {
        maxFileSizeBytes: MB(env.STORAGE_CONTENT_VIDEO_MAX_MB),
        allowedExtensions: parseList(env.STORAGE_CONTENT_VIDEO_EXTENSIONS, ['mp4', 'mov']),
        allowedMimeTypes: parseList(env.STORAGE_CONTENT_VIDEO_MIME_TYPES, ['video/mp4', 'video/quicktime']),
      },
      variants: {},
    },
  } satisfies Record<AssetType, any>,
} as const;
