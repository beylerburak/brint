/**
 * Frontend Configuration
 * 
 * Client-side configuration values.
 * Imports shared config from @brint/shared-config for consistency.
 */

import {
  MAX_AVATAR_SIZE_MB,
  MAX_AVATAR_SIZE_BYTES,
} from '@brint/shared-config/upload';

export const APP_CONFIG = {
  media: {
    avatar: {
      maxSizeMB: MAX_AVATAR_SIZE_MB,
      maxSizeBytes: MAX_AVATAR_SIZE_BYTES,
      recommendedMinSize: 400, // 400x400px
    },
  },
} as const;
