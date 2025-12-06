/**
 * Global Application Configuration
 * 
 * Centralized config for app-wide constants and defaults.
 * Avoids hard-coded values scattered across the codebase.
 * 
 * Common constants are imported from @brint/shared-config for consistency
 * between frontend and backend.
 */

import {
  MAX_FILE_SIZE_MB as SHARED_MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES as SHARED_MAX_FILE_SIZE_BYTES,
  MAX_AVATAR_SIZE_MB as SHARED_MAX_AVATAR_SIZE_MB,
  MAX_AVATAR_SIZE_BYTES as SHARED_MAX_AVATAR_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES as SHARED_ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES as SHARED_ALLOWED_VIDEO_TYPES,
  ALLOWED_DOCUMENT_TYPES as SHARED_ALLOWED_DOCUMENT_TYPES,
} from '@brint/shared-config/upload';

import { PLAN_LIMITS as SHARED_PLAN_LIMITS } from '@brint/shared-config/plans';

export type AppConfig = {
  appName: string;
  companyName: string;
  supportEmail: string;

  defaults: {
    timezone: string;
    locale: string;
    baseCurrency: string;
    plan: "FREE" | "STARTER" | "PRO" | "AGENCY";
  };

  currencies: {
    supported: string[]; // ISO 4217 currency codes
  };

  plans: {
    FREE: {
      maxBrands: number;
      maxStorageGB: number;
      maxTeamMembers: number;
    };
    STARTER: {
      maxBrands: number;
      maxStorageGB: number;
      maxTeamMembers: number;
    };
    PRO: {
      maxBrands: number;
      maxStorageGB: number;
      maxTeamMembers: number;
    };
    AGENCY: {
      maxBrands: number;
      maxStorageGB: number;
      maxTeamMembers: number;
    };
  };

  media: {
    upload: {
      maxFileSizeMB: number;
      maxFileSizeBytes: number;
      maxAvatarSizeMB: number; // Separate limit for avatars
      maxAvatarSizeBytes: number;
      allowedImageTypes: string[];
      allowedVideoTypes: string[];
      allowedDocumentTypes: string[];
    };
    variants: {
      image: {
        thumbnail: { width: number; height: number; fit: 'cover' | 'inside' };
        small: { width: number; height: number; fit: 'cover' | 'inside' };
        medium: { width: number; height: number; fit: 'cover' | 'inside' };
        large: { width: number; height: number; fit: 'cover' | 'inside' };
      };
      quality: {
        webp: number; // 0-100
        jpeg: number; // 0-100
      };
    };
    s3: {
      presignedUrlExpirySeconds: number;
    };
  };
};

export const APP_CONFIG: AppConfig = {
  appName: process.env.APP_NAME ?? "Brigmo",
  companyName: process.env.COMPANY_NAME ?? "Beyler Interactive",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@example.com",

  defaults: {
    timezone: "Europe/Istanbul",
    locale: "tr-TR",
    baseCurrency: "TRY",
    plan: "FREE",
  },

  currencies: {
    supported: ["TRY", "USD", "EUR"],
  },

  plans: SHARED_PLAN_LIMITS,

  media: {
    upload: {
      maxFileSizeMB: SHARED_MAX_FILE_SIZE_MB,
      maxFileSizeBytes: SHARED_MAX_FILE_SIZE_BYTES,
      maxAvatarSizeMB: SHARED_MAX_AVATAR_SIZE_MB,
      maxAvatarSizeBytes: SHARED_MAX_AVATAR_SIZE_BYTES,
      allowedImageTypes: [...SHARED_ALLOWED_IMAGE_TYPES],
      allowedVideoTypes: [...SHARED_ALLOWED_VIDEO_TYPES],
      allowedDocumentTypes: [...SHARED_ALLOWED_DOCUMENT_TYPES],
    },
    variants: {
      image: {
        thumbnail: { width: 150, height: 150, fit: 'cover' },
        small: { width: 400, height: 400, fit: 'inside' },
        medium: { width: 800, height: 800, fit: 'inside' },
        large: { width: 1600, height: 1600, fit: 'inside' },
      },
      quality: {
        webp: 85,
        jpeg: 95,
      },
    },
    s3: {
      presignedUrlExpirySeconds: 3600, // 1 hour
    },
  },
};