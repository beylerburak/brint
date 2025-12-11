/**
 * Platform Rules & Caption Limits
 * 
 * Single source of truth for platform-specific rules and caption character limits.
 * Used by both frontend validation and backend processing.
 */

export type ContentFormFactor =
  | "FEED_POST"
  | "STORY"
  | "VERTICAL_VIDEO"
  | "BLOG_ARTICLE"
  | "LONG_VIDEO";

export type SocialPlatform =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TIKTOK"
  | "LINKEDIN"
  | "X"
  | "YOUTUBE"
  | "WHATSAPP"
  | "PINTEREST";

export interface CaptionLimits {
  DEFAULT: number;
  FEED_POST?: number;
  STORY?: number;
  VERTICAL_VIDEO?: number;
  BLOG_ARTICLE?: number;
  LONG_VIDEO?: number;
}

export interface PlatformRule {
  captionLimits: CaptionLimits;
  /** Whether media is required for this platform/form factor */
  requiresMedia?: {
    FEED_POST?: boolean;
    STORY?: boolean;
    VERTICAL_VIDEO?: boolean;
    BLOG_ARTICLE?: boolean;
    LONG_VIDEO?: boolean;
  };
}

export const PLATFORM_RULES: Record<SocialPlatform, PlatformRule> = {
  INSTAGRAM: {
    captionLimits: {
      DEFAULT: 2200,
      FEED_POST: 2200,
      STORY: 2200,
      VERTICAL_VIDEO: 2200,
    },
    requiresMedia: {
      FEED_POST: true, // Instagram requires media for feed posts
      STORY: true, // Stories require media
      VERTICAL_VIDEO: true, // Reels require video
    },
  },
  FACEBOOK: {
    captionLimits: {
      DEFAULT: 63206,
      FEED_POST: 63206,
    },
    requiresMedia: {
      FEED_POST: false, // Facebook allows text-only posts
      STORY: true, // Stories require media
      VERTICAL_VIDEO: true, // Reels require video
    },
  },
  TIKTOK: {
    captionLimits: {
      DEFAULT: 2200,
      VERTICAL_VIDEO: 2200,
    },
    requiresMedia: {
      FEED_POST: true, // TikTok requires media for feed posts
      STORY: true, // Stories require media
      VERTICAL_VIDEO: true, // Videos require media
    },
  },
  LINKEDIN: {
    captionLimits: {
      DEFAULT: 3000,
      FEED_POST: 3000,
    },
    requiresMedia: {
      FEED_POST: false, // LinkedIn allows text-only posts
      STORY: true, // Stories require media
    },
  },
  X: {
    captionLimits: {
      DEFAULT: 280,
      FEED_POST: 280,
    },
    requiresMedia: {
      FEED_POST: false, // X allows text-only posts
      STORY: true, // Stories require media
    },
  },
  YOUTUBE: {
    captionLimits: {
      DEFAULT: 5000, // TODO: net limit geldiğinde güncelle
      LONG_VIDEO: 5000,
    },
    requiresMedia: {
      LONG_VIDEO: true, // YouTube videos require media
      STORY: true, // Stories require media (if supported)
    },
  },
  WHATSAPP: {
    captionLimits: {
      DEFAULT: 1024, // şimdilik konservatif
    },
    requiresMedia: {
      FEED_POST: false, // WhatsApp allows text-only messages
      STORY: true, // Stories require media
    },
  },
  PINTEREST: {
    captionLimits: {
      DEFAULT: 500, // şimdilik konservatif
    },
    requiresMedia: {
      FEED_POST: true, // Pinterest requires media for pins
      STORY: true, // Stories require media
    },
  },
};

/**
 * Get caption limit for a specific platform and form factor
 *
 * @param platform - Social platform
 * @param formFactor - Content form factor
 * @returns Character limit for captions
 */
export function getCaptionLimitFor(
  platform: SocialPlatform,
  formFactor: ContentFormFactor
): number {
  const rules = PLATFORM_RULES[platform];
  if (!rules || !rules.captionLimits) {
    return Infinity;
  }

  const limits = rules.captionLimits;

  switch (formFactor) {
    case "FEED_POST":
      return limits.FEED_POST ?? limits.DEFAULT;
    case "STORY":
      return limits.STORY ?? limits.DEFAULT;
    case "VERTICAL_VIDEO":
      return limits.VERTICAL_VIDEO ?? limits.DEFAULT;
    case "BLOG_ARTICLE":
      return limits.BLOG_ARTICLE ?? limits.DEFAULT;
    case "LONG_VIDEO":
      return limits.LONG_VIDEO ?? limits.DEFAULT;
    default:
      return limits.DEFAULT;
  }
}

/**
 * Check if media is required for a specific platform and form factor
 *
 * @param platform - Social platform
 * @param formFactor - Content form factor
 * @returns true if media is required, false otherwise
 */
export function requiresMedia(
  platform: SocialPlatform,
  formFactor: ContentFormFactor
): boolean {
  const rules = PLATFORM_RULES[platform];
  if (!rules || !rules.requiresMedia) {
    // Default: media not required (most platforms allow text-only posts)
    return false;
  }

  const requires = rules.requiresMedia;

  switch (formFactor) {
    case "FEED_POST":
      return requires.FEED_POST ?? false;
    case "STORY":
      return requires.STORY ?? false;
    case "VERTICAL_VIDEO":
      return requires.VERTICAL_VIDEO ?? false;
    case "BLOG_ARTICLE":
      return requires.BLOG_ARTICLE ?? false;
    case "LONG_VIDEO":
      return requires.LONG_VIDEO ?? false;
    default:
      return false;
  }
}

/**
 * Instagram Video Polling Rules
 *
 * Dynamic polling configuration for Instagram video container status checks.
 * Polling intervals and max wait times are calculated based on video duration/size.
 */
export interface InstagramVideoPollingRules {
  /** Maximum total wait time (ms) */
  maxWaitMs: number;
  /** Minimum poll interval (ms) */
  minIntervalMs: number;
  /** Maximum poll interval (ms) */
  maxIntervalMs: number;
  /** Base wait time for videos shorter than 1 minute (ms) */
  shortVideoBaseWaitMs: number;
}

export const INSTAGRAM_VIDEO_POLLING_RULES: InstagramVideoPollingRules = {
  maxWaitMs: 5 * 60 * 1000,      // 5 minutes total
  minIntervalMs: 3_000,          // 3 seconds
  maxIntervalMs: 30_000,         // 30 seconds
  shortVideoBaseWaitMs: 60_000,  // 1 minute
};