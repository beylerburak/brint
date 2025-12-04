/**
 * Global Application Configuration
 * 
 * Centralized config for app-wide constants and defaults.
 * Avoids hard-coded values scattered across the codebase.
 */

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

const MAX_FILE_SIZE_MB = 200;
const MAX_AVATAR_SIZE_MB = 3;

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

  plans: {
    FREE: {
      maxBrands: 1,
      maxStorageGB: 1,
      maxTeamMembers: 2,
    },
    STARTER: {
      maxBrands: 5,
      maxStorageGB: 10,
      maxTeamMembers: 5,
    },
    PRO: {
      maxBrands: 20,
      maxStorageGB: 100,
      maxTeamMembers: 20,
    },
    AGENCY: {
      maxBrands: -1, // unlimited
      maxStorageGB: 500,
      maxTeamMembers: 50,
    },
  },

  media: {
    upload: {
      maxFileSizeMB: MAX_FILE_SIZE_MB,
      maxFileSizeBytes: MAX_FILE_SIZE_MB * 1024 * 1024,
      maxAvatarSizeMB: MAX_AVATAR_SIZE_MB,
      maxAvatarSizeBytes: MAX_AVATAR_SIZE_MB * 1024 * 1024,
      allowedImageTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ],
      allowedVideoTypes: [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
      ],
      allowedDocumentTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
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