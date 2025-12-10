/**
 * Platform Rules Configuration
 * 
 * Shared platform capabilities and rules used by both frontend and backend
 * for content validation and compatibility checking.
 * 
 * This ensures that:
 * - Frontend prevents invalid content combinations before submission
 * - Backend validates content before publishing
 * - Both use the same source of truth
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
  DEFAULT: number; // platformun genel hard limit'i
  FEED_POST?: number;
  STORY?: number;
  VERTICAL_VIDEO?: number;
  LONG_VIDEO?: number;
  // gerektiğinde BLOG_ARTICLE vs. ekleyebiliriz
}

export interface PlatformRule {
  // Form factor support
  supports: {
    FEED_POST: boolean;
    STORY: boolean;
    VERTICAL_VIDEO: boolean;
    BLOG_ARTICLE: boolean;
    LONG_VIDEO: boolean;
  };

  // Media constraints
  media: {
    maxMediaCount: number; // Maximum number of media items (0 = not supported)
    allowMultipleMedia: boolean; // Can have multiple media (carousel/multi-asset)
    allowVideo: boolean; // Supports video content
    allowPhoto: boolean; // Supports photo/image content
    allowMixedPhotoVideo: boolean; // Can mix photos and videos in same content
  };

  // Caption character limits
  captionLimits: CaptionLimits;

  // Vertical video specific rules
  verticalVideo?: {
    requiresVerticalAspect?: boolean; // Must be vertical (9:16) aspect ratio
    canSelectCoverFrame?: boolean; // Can select cover frame from video
    canUploadCustomCover?: boolean; // Can upload custom cover image
    minDurationSec?: number; // Minimum duration in seconds
    maxDurationSec?: number; // Maximum duration in seconds
  };

  // Story specific rules
  story?: {
    maxDurationSec?: number; // Maximum duration for story videos
    supportsPhoto?: boolean; // Can use photos in stories
    supportsVideo?: boolean; // Can use videos in stories
  };

  // Feed post specific rules
  feedPost?: {
    maxCaptionLength?: number; // Maximum caption length in characters
    supportsCarousel?: boolean; // Supports carousel/multi-image posts
    maxCarouselItems?: number; // Maximum items in carousel
  };

  // Long video specific rules (YouTube, etc.)
  longVideo?: {
    minDurationSec?: number;
    maxDurationSec?: number;
    requiresTitle?: boolean;
    requiresDescription?: boolean;
    canCustomThumbnail?: boolean;
  };
}

export const PLATFORM_RULES: Record<SocialPlatform, PlatformRule> = {
  INSTAGRAM: {
    supports: {
      FEED_POST: true,
      STORY: true,
      VERTICAL_VIDEO: true, // Reels
      BLOG_ARTICLE: false,
      LONG_VIDEO: false,
    },
    media: {
      maxMediaCount: 10,
      allowMultipleMedia: true, // Carousel posts
      allowVideo: true,
      allowPhoto: true,
      allowMixedPhotoVideo: false, // Instagram doesn't allow mixing
    },
    captionLimits: {
      DEFAULT: 2200,
      FEED_POST: 2200,
      STORY: 2200,
      VERTICAL_VIDEO: 2200,
    },
    verticalVideo: {
      requiresVerticalAspect: true, // Reels must be vertical
      canSelectCoverFrame: true,
      canUploadCustomCover: true,
      minDurationSec: 0.5,
      maxDurationSec: 90,
    },
    story: {
      maxDurationSec: 15,
      supportsPhoto: true,
      supportsVideo: true,
    },
    feedPost: {
      maxCaptionLength: 2200,
      supportsCarousel: true,
      maxCarouselItems: 10,
    },
  },

  FACEBOOK: {
    supports: {
      FEED_POST: true,
      STORY: true,
      VERTICAL_VIDEO: true, // Reels
      BLOG_ARTICLE: false,
      LONG_VIDEO: true, // Facebook Watch
    },
    media: {
      maxMediaCount: 10,
      allowMultipleMedia: true,
      allowVideo: true,
      allowPhoto: true,
      allowMixedPhotoVideo: false,
    },
    captionLimits: {
      DEFAULT: 63206,
      FEED_POST: 63206,
      STORY: 63206,
      VERTICAL_VIDEO: 63206,
    },
    verticalVideo: {
      requiresVerticalAspect: true,
      canSelectCoverFrame: true,
      canUploadCustomCover: true,
      minDurationSec: 0.5,
      maxDurationSec: 90,
    },
    story: {
      maxDurationSec: 20,
      supportsPhoto: true,
      supportsVideo: true,
    },
    feedPost: {
      maxCaptionLength: 63206,
      supportsCarousel: true,
      maxCarouselItems: 10,
    },
    longVideo: {
      minDurationSec: 1,
      maxDurationSec: 240 * 60, // 4 hours
      requiresTitle: true,
      requiresDescription: false,
      canCustomThumbnail: true,
    },
  },

  TIKTOK: {
    supports: {
      FEED_POST: true, // TikTok supports photo posts and carousel
      STORY: false,
      VERTICAL_VIDEO: true,
      BLOG_ARTICLE: false,
      LONG_VIDEO: false,
    },
    media: {
      maxMediaCount: 10, // TikTok supports carousel posts
      allowMultipleMedia: true, // TikTok supports carousel
      allowVideo: true,
      allowPhoto: true, // TikTok supports photo posts
      allowMixedPhotoVideo: false,
    },
    captionLimits: {
      DEFAULT: 2200,
      FEED_POST: 2200,
      VERTICAL_VIDEO: 2200,
    },
    feedPost: {
      maxCaptionLength: 2200,
      supportsCarousel: true,
      maxCarouselItems: 10,
    },
    verticalVideo: {
      requiresVerticalAspect: true,
      canSelectCoverFrame: true,
      canUploadCustomCover: true,
      minDurationSec: 3,
      maxDurationSec: 10 * 60, // 10 minutes
    },
  },

  LINKEDIN: {
    supports: {
      FEED_POST: true,
      STORY: false,
      VERTICAL_VIDEO: false,
      BLOG_ARTICLE: true, // LinkedIn Articles
      LONG_VIDEO: true,
    },
    media: {
      maxMediaCount: 9,
      allowMultipleMedia: true,
      allowVideo: true,
      allowPhoto: true,
      allowMixedPhotoVideo: false,
    },
    captionLimits: {
      DEFAULT: 3000,
      FEED_POST: 3000,
    },
    feedPost: {
      maxCaptionLength: 3000,
      supportsCarousel: true,
      maxCarouselItems: 9,
    },
    longVideo: {
      minDurationSec: 1,
      maxDurationSec: 10 * 60, // 10 minutes
      requiresTitle: false,
      requiresDescription: false,
      canCustomThumbnail: true,
    },
  },

  X: {
    supports: {
      FEED_POST: true,
      STORY: false,
      VERTICAL_VIDEO: false,
      BLOG_ARTICLE: false,
      LONG_VIDEO: true, // X Video
    },
    media: {
      maxMediaCount: 4,
      allowMultipleMedia: true,
      allowVideo: true,
      allowPhoto: true,
      allowMixedPhotoVideo: true, // X allows mixing
    },
    captionLimits: {
      DEFAULT: 280,
      FEED_POST: 280,
    },
    feedPost: {
      maxCaptionLength: 280,
      supportsCarousel: true,
      maxCarouselItems: 4,
    },
    longVideo: {
      minDurationSec: 1,
      maxDurationSec: 2 * 60 * 60, // 2 hours
      requiresTitle: false,
      requiresDescription: false,
      canCustomThumbnail: false,
    },
  },

  YOUTUBE: {
    supports: {
      FEED_POST: false,
      STORY: false,
      VERTICAL_VIDEO: true, // YouTube Shorts
      BLOG_ARTICLE: false,
      LONG_VIDEO: true,
    },
    media: {
      maxMediaCount: 1,
      allowMultipleMedia: false,
      allowVideo: true,
      allowPhoto: false,
      allowMixedPhotoVideo: false,
    },
    captionLimits: {
      DEFAULT: 5000, // YouTube allows long descriptions, using reasonable default
      VERTICAL_VIDEO: 5000,
      LONG_VIDEO: 5000,
    },
    verticalVideo: {
      requiresVerticalAspect: true, // Shorts must be vertical
      canSelectCoverFrame: true,
      canUploadCustomCover: true,
      minDurationSec: 1,
      maxDurationSec: 60,
    },
    longVideo: {
      minDurationSec: 1,
      maxDurationSec: 12 * 60 * 60, // 12 hours
      requiresTitle: true,
      requiresDescription: false,
      canCustomThumbnail: true,
    },
  },

  WHATSAPP: {
    supports: {
      FEED_POST: false,
      STORY: true, // WhatsApp Status
      VERTICAL_VIDEO: false,
      BLOG_ARTICLE: false,
      LONG_VIDEO: false,
    },
    media: {
      maxMediaCount: 1,
      allowMultipleMedia: false,
      allowVideo: true,
      allowPhoto: true,
      allowMixedPhotoVideo: false,
    },
    captionLimits: {
      DEFAULT: 2000, // WhatsApp Status caption limit (reasonable default)
      STORY: 2000,
    },
    story: {
      maxDurationSec: 30,
      supportsPhoto: true,
      supportsVideo: true,
    },
  },

  PINTEREST: {
    supports: {
      FEED_POST: true, // Pins
      STORY: false,
      VERTICAL_VIDEO: false,
      BLOG_ARTICLE: false,
      LONG_VIDEO: false,
    },
    media: {
      maxMediaCount: 1,
      allowMultipleMedia: false,
      allowVideo: true,
      allowPhoto: true,
      allowMixedPhotoVideo: false,
    },
    captionLimits: {
      DEFAULT: 500,
      FEED_POST: 500,
    },
    feedPost: {
      maxCaptionLength: 500,
      supportsCarousel: false,
      maxCarouselItems: 1,
    },
  },
};

/**
 * Check if a form factor is supported by a platform
 */
export function isFormFactorSupported(
  platform: SocialPlatform,
  formFactor: ContentFormFactor
): boolean {
  const rule = PLATFORM_RULES[platform];
  return rule.supports[formFactor] ?? false;
}

/**
 * Check if a media count is valid for a platform and form factor
 */
export function isMediaCountValid(
  platform: SocialPlatform,
  formFactor: ContentFormFactor,
  mediaCount: number
): { valid: boolean; reason?: string } {
  const rule = PLATFORM_RULES[platform];

  // Check if form factor is supported
  if (!isFormFactorSupported(platform, formFactor)) {
    return {
      valid: false,
      reason: `${formFactor} is not supported on ${platform}`,
    };
  }

  // Check media count limits
  if (mediaCount === 0) {
    return {
      valid: false,
      reason: "At least one media item is required",
    };
  }

  if (rule.media.maxMediaCount === 0) {
    return {
      valid: false,
      reason: `${platform} does not support media for ${formFactor}`,
    };
  }

  if (mediaCount > rule.media.maxMediaCount) {
    return {
      valid: false,
      reason: `Maximum ${rule.media.maxMediaCount} media items allowed for ${platform}`,
    };
  }

  // Check multiple media support
  if (mediaCount > 1 && !rule.media.allowMultipleMedia) {
    return {
      valid: false,
      reason: `${platform} does not support multiple media items`,
    };
  }

  return { valid: true };
}

/**
 * Get compatibility status for a content configuration
 */
export type CompatibilityStatus = "OK" | "WARNING" | "INCOMPATIBLE";

export interface CompatibilityResult {
  status: CompatibilityStatus;
  message?: string;
  details?: string[];
}

/**
 * Check compatibility of content configuration with selected accounts
 */
export function checkContentCompatibility(
  formFactor: ContentFormFactor,
  mediaCount: number,
  platforms: SocialPlatform[]
): Record<SocialPlatform, CompatibilityResult> {
  const results: Record<SocialPlatform, CompatibilityResult> = {} as any;

  for (const platform of platforms) {
    const rule = PLATFORM_RULES[platform];
    const details: string[] = [];

    // Check form factor support
    if (!isFormFactorSupported(platform, formFactor)) {
      results[platform] = {
        status: "INCOMPATIBLE",
        message: `${formFactor} is not supported on ${platform}`,
        details: [`${platform} does not support ${formFactor}`],
      };
      continue;
    }

    // Check media count
    const mediaCheck = isMediaCountValid(platform, formFactor, mediaCount);
    if (!mediaCheck.valid) {
      results[platform] = {
        status: "INCOMPATIBLE",
        message: mediaCheck.reason,
        details: [mediaCheck.reason!],
      };
      continue;
    }

    // Check specific form factor rules
    if (formFactor === "VERTICAL_VIDEO" && rule.verticalVideo) {
      const vvRule = rule.verticalVideo;
      if (vvRule.requiresVerticalAspect) {
        details.push("Requires vertical (9:16) aspect ratio");
      }
      if (vvRule.minDurationSec || vvRule.maxDurationSec) {
        const min = vvRule.minDurationSec ?? 0;
        const max = vvRule.maxDurationSec ?? Infinity;
        details.push(`Duration must be between ${min}s and ${max}s`);
      }
    }

    if (formFactor === "STORY" && rule.story) {
      const storyRule = rule.story;
      if (storyRule.maxDurationSec) {
        details.push(`Maximum duration: ${storyRule.maxDurationSec}s`);
      }
    }

    if (formFactor === "FEED_POST" && rule.feedPost) {
      const feedRule = rule.feedPost;
      if (feedRule.maxCaptionLength) {
        details.push(`Maximum caption length: ${feedRule.maxCaptionLength} characters`);
      }
    }

    results[platform] = {
      status: details.length > 0 ? "WARNING" : "OK",
      message: details.length > 0 ? "Some constraints apply" : undefined,
      details: details.length > 0 ? details : undefined,
    };
  }

  return results;
}

/**
 * Get all supported form factors for a platform
 */
export function getSupportedFormFactors(
  platform: SocialPlatform
): ContentFormFactor[] {
  const rule = PLATFORM_RULES[platform];
  return (Object.keys(rule.supports) as ContentFormFactor[]).filter(
    (ff) => rule.supports[ff]
  );
}

/**
 * Get maximum media count for a platform and form factor
 */
export function getMaxMediaCount(
  platform: SocialPlatform,
  formFactor: ContentFormFactor
): number {
  if (!isFormFactorSupported(platform, formFactor)) {
    return 0;
  }

  const rule = PLATFORM_RULES[platform];
  return rule.media.maxMediaCount;
}

/**
 * Check if platform supports multiple media (carousel)
 */
export function supportsMultipleMedia(
  platform: SocialPlatform,
  formFactor: ContentFormFactor
): boolean {
  if (!isFormFactorSupported(platform, formFactor)) {
    return false;
  }

  const rule = PLATFORM_RULES[platform];
  return rule.media.allowMultipleMedia;
}

/**
 * Get caption character limit for a platform and form factor
 * 
 * @param platform - The social media platform
 * @param formFactor - The content form factor (FEED_POST, STORY, VERTICAL_VIDEO, etc.)
 * @returns The maximum caption length in characters, or Infinity if not defined
 */
export function getCaptionLimitFor(
  platform: SocialPlatform,
  formFactor: ContentFormFactor
): number {
  const rules = PLATFORM_RULES[platform];
  if (!rules || !rules.captionLimits) {
    return Infinity; // veya çok yüksek bir fallback
  }

  const limits = rules.captionLimits;

  switch (formFactor) {
    case "FEED_POST":
      return limits.FEED_POST ?? limits.DEFAULT;
    case "STORY":
      return limits.STORY ?? limits.DEFAULT;
    case "VERTICAL_VIDEO":
      return limits.VERTICAL_VIDEO ?? limits.DEFAULT;
    case "LONG_VIDEO":
      return limits.LONG_VIDEO ?? limits.DEFAULT;
    default:
      return limits.DEFAULT;
  }
}

/**
 * Platform rules export (for backward compatibility)
 */
export const PLATFORM_CONFIG = PLATFORM_RULES;
