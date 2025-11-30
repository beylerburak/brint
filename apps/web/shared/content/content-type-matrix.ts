/**
 * Content Type Matrix & Platform Checker
 * 
 * Defines canonical content types and their support levels across platforms.
 * Based on: docs/03-content-type-matrix-and-platform-checker.md
 */

// ============================================================================
// Types
// ============================================================================

export type AppContentType =
  | "single_post"      // tek kreatif, klasik feed / post
  | "carousel"         // çoklu görsel / frame
  | "vertical_video"   // kısa dikey video (reel/short)
  | "story";           // 24 saatlik dikey, ephemeral içerik

export type PlatformId =
  | "instagram"
  | "facebook"
  | "x"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest";

export type SupportLevel =
  | "native"       // platformda birebir karşılığı var (ideal)
  | "degraded"     // teknik olarak mümkün ama UX / ürün birebir değil
  | "unsupported"; // desteklenmiyor, UI'da seçilemez

export interface Mapping {
  support: SupportLevel;
  platformType?: string;   // Platformun kendi ürün adı: "Reel", "Tweet", "Pin" vb.
  notes?: string;          // UI tooltip / help text için kısa açıklama
}

export type ContentTypeMatrix = Record<AppContentType, Record<PlatformId, Mapping>>;

// ============================================================================
// Platform Mappings
// ============================================================================

const instagramMappings: Record<AppContentType, Mapping> = {
  single_post: {
    support: "native",
    platformType: "feed_post",
    notes: "Instagram gönderisi (fotoğraf veya video).",
  },
  carousel: {
    support: "native",
    platformType: "carousel_post",
    notes: "2-10 görsellik Instagram carousel gönderisi.",
  },
  vertical_video: {
    support: "native",
    platformType: "reel",
    notes: "Instagram Reel (dikey kısa video).",
  },
  story: {
    support: "native",
    platformType: "story",
    notes: "24 saatlik Instagram Story.",
  },
};

const facebookMappings: Record<AppContentType, Mapping> = {
  single_post: {
    support: "native",
    platformType: "feed_post",
    notes: "Facebook sayfa gönderisi (text + medya + link).",
  },
  carousel: {
    support: "native",
    platformType: "carousel_post",
    notes: "Facebook carousel gönderisi (özellikle sayfa/ads tarafında).",
  },
  vertical_video: {
    support: "native",
    platformType: "reel",
    notes: "Facebook Reel (dikey kısa video).",
  },
  story: {
    support: "native",
    platformType: "story",
    notes: "24 saatlik Facebook Story.",
  },
};

const xMappings: Record<AppContentType, Mapping> = {
  single_post: {
    support: "native",
    platformType: "tweet",
    notes: "Standart X post (tweet).",
  },
  carousel: {
    support: "degraded",
    platformType: "multi_image_tweet",
    notes: "X'te gerçek carousel ürünü yok; 2-4 görsel bir post içinde gösterilir.",
  },
  vertical_video: {
    support: "degraded",
    platformType: "video_tweet",
    notes: "X'te özel 'shorts' ürünü yok; normal video post olarak paylaşılır.",
  },
  story: {
    support: "unsupported",
    notes: "X (Twitter) story benzeri ürünü (Fleets) kapattı.",
  },
};

const linkedinMappings: Record<AppContentType, Mapping> = {
  single_post: {
    support: "native",
    platformType: "feed_post",
    notes: "LinkedIn feed post (text + image/video/link).",
  },
  carousel: {
    support: "degraded",
    platformType: "multi_image_post",
    notes: "LinkedIn'de 'document carousel' var ama v1'de kullanılmıyor; çoklu görsel post olarak paylaşılır.",
  },
  vertical_video: {
    support: "degraded",
    platformType: "video_post",
    notes: "LinkedIn'de kısa video için ayrı bir ürün yok; normal video post olarak paylaşılır.",
  },
  story: {
    support: "unsupported",
    notes: "LinkedIn Stories ürünü kaldırıldı.",
  },
};

const tiktokMappings: Record<AppContentType, Mapping> = {
  single_post: {
    support: "native",
    platformType: "video_post",
    notes: "Standart TikTok video post. Geliştikçe 'photo mode' için ayrı payload'lar eklenebilir.",
  },
  carousel: {
    support: "native",
    platformType: "photo_mode",
    notes: "TikTok photo mode / multi-image post. Kullanıcı görüntüleri kaydırarak ilerler.",
  },
  vertical_video: {
    support: "native",
    platformType: "video_post",
    notes: "Dikey kısa video. Bizim tarafımızda TikTok video ile aynı endpoint; ayrım UI'da yapılır.",
  },
  story: {
    support: "native",
    platformType: "story",
    notes: "TikTok Story (24 saatlik, dikey içerik).",
  },
};

const youtubeMappings: Record<AppContentType, Mapping> = {
  single_post: {
    support: "native",
    platformType: "community_post",
    notes: "YouTube Community post (text + image). Default single creative olarak düşünülür.",
  },
  carousel: {
    support: "native",
    platformType: "community_post_multi_image",
    notes: "Çoklu görsellere sahip community post. IG carousel gibi değil ama benzer deneyim.",
  },
  vertical_video: {
    support: "native",
    platformType: "short",
    notes: "YouTube Shorts (dikey kısa video). Uzun video upload bu kapsamın dışında, ayrı content type.",
  },
  story: {
    support: "unsupported",
    notes: "YouTube Stories ürünü kaldırıldı.",
  },
};

const pinterestMappings: Record<AppContentType, Mapping> = {
  single_post: {
    support: "native",
    platformType: "pin",
    notes: "Standart Pinterest Pin (görsel veya video).",
  },
  carousel: {
    support: "native",
    platformType: "carousel_pin",
    notes: "Carousel / Idea Pin tarzı çoklu görselli/pageli kreatif. Ephemeral değildir.",
  },
  vertical_video: {
    support: "native",
    platformType: "video_pin",
    notes: "Video içeren Pin veya Idea Pin. Genellikle dikey format tercih edilir.",
  },
  story: {
    support: "unsupported",
    notes: "Pinterest'te ephemeral story ürünü yok; eski Story Pins artık Idea Pin olarak kalıcı.",
  },
};

// ============================================================================
// Content Type Matrix
// ============================================================================

export const CONTENT_TYPE_MATRIX: ContentTypeMatrix = {
  single_post: {
    instagram: instagramMappings.single_post,
    facebook: facebookMappings.single_post,
    x: xMappings.single_post,
    linkedin: linkedinMappings.single_post,
    tiktok: tiktokMappings.single_post,
    youtube: youtubeMappings.single_post,
    pinterest: pinterestMappings.single_post,
  },
  carousel: {
    instagram: instagramMappings.carousel,
    facebook: facebookMappings.carousel,
    x: xMappings.carousel,
    linkedin: linkedinMappings.carousel,
    tiktok: tiktokMappings.carousel,
    youtube: youtubeMappings.carousel,
    pinterest: pinterestMappings.carousel,
  },
  vertical_video: {
    instagram: instagramMappings.vertical_video,
    facebook: facebookMappings.vertical_video,
    x: xMappings.vertical_video,
    linkedin: linkedinMappings.vertical_video,
    tiktok: tiktokMappings.vertical_video,
    youtube: youtubeMappings.vertical_video,
    pinterest: pinterestMappings.vertical_video,
  },
  story: {
    instagram: instagramMappings.story,
    facebook: facebookMappings.story,
    x: xMappings.story,
    linkedin: linkedinMappings.story,
    tiktok: tiktokMappings.story,
    youtube: youtubeMappings.story,
    pinterest: pinterestMappings.story,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get platform mapping for a content type
 */
export function getPlatformMapping(
  contentType: AppContentType,
  platform: PlatformId
): Mapping {
  return CONTENT_TYPE_MATRIX[contentType][platform];
}

/**
 * Get supported platforms for a content type
 */
export function getSupportedPlatforms(
  contentType: AppContentType,
  options?: { includeDegraded?: boolean }
): PlatformId[] {
  const mapping = CONTENT_TYPE_MATRIX[contentType];

  return Object.entries(mapping)
    .filter(([, m]) => {
      if (m.support === "unsupported") return false;
      if (!options?.includeDegraded && m.support === "degraded") return false;
      return true;
    })
    .map(([platform]) => platform as PlatformId);
}

/**
 * Check if a platform supports a content type
 */
export function isPlatformSupported(
  contentType: AppContentType,
  platform: PlatformId,
  options?: { includeDegraded?: boolean }
): boolean {
  const mapping = getPlatformMapping(contentType, platform);
  
  if (mapping.support === "unsupported") return false;
  if (!options?.includeDegraded && mapping.support === "degraded") return false;
  
  return true;
}

/**
 * Get platform type label (e.g., "Reel", "Tweet", "Pin")
 */
export function getPlatformTypeLabel(
  contentType: AppContentType,
  platform: PlatformId
): string | null {
  const mapping = getPlatformMapping(contentType, platform);
  return mapping.platformType || null;
}

/**
 * Map SocialPlatform to PlatformId
 * Helper to convert backend platform enum to matrix platform ID
 */
export function mapSocialPlatformToPlatformId(
  platform: string
): PlatformId | null {
  const mapping: Record<string, PlatformId> = {
    INSTAGRAM_BUSINESS: "instagram",
    INSTAGRAM_BASIC: "instagram",
    FACEBOOK_PAGE: "facebook",
    X_ACCOUNT: "x",
    LINKEDIN_PAGE: "linkedin",
    TIKTOK_BUSINESS: "tiktok",
    YOUTUBE_CHANNEL: "youtube",
    PINTEREST_PROFILE: "pinterest",
  };

  return mapping[platform] || null;
}

