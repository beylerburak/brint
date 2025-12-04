/**
 * Frontend Configuration
 * 
 * Client-side configuration values.
 * Should match backend config where applicable.
 */

export const APP_CONFIG = {
  media: {
    avatar: {
      maxSizeMB: 3,
      maxSizeBytes: 3 * 1024 * 1024,
      recommendedMinSize: 400, // 400x400px
    },
  },
} as const;

