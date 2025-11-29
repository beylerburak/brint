/**
 * Social Account Domain Types (Frontend)
 * 
 * Mirrored from backend social-account-domain.md for type safety.
 */

// ============================================================================
// Social Account Types
// ============================================================================

/**
 * Social platform enum (matches backend)
 */
export type SocialPlatform =
  | "FACEBOOK_PAGE"
  | "INSTAGRAM_BUSINESS"
  | "INSTAGRAM_BASIC"
  | "YOUTUBE_CHANNEL"
  | "TIKTOK_BUSINESS"
  | "PINTEREST_PROFILE"
  | "X_ACCOUNT"
  | "LINKEDIN_PAGE";

/**
 * Social account status enum (matches backend)
 */
export type SocialAccountStatus = "ACTIVE" | "DISCONNECTED" | "REMOVED";

/**
 * Social account for list views
 */
export interface SocialAccount {
  id: string;
  workspaceId: string;
  brandId: string;
  platform: SocialPlatform;
  externalId: string;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  status: SocialAccountStatus;
  lastSyncedAt: string | null;
  avatarMediaId: string | null;
  avatarUrl: string | null;
  platformData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Connect social account request payload
 */
export interface ConnectSocialAccountRequest {
  platform: SocialPlatform;
  externalId: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  platformData?: Record<string, unknown>;
  credentials: {
    platform: SocialPlatform;
    data: Record<string, unknown>;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    nextCursor: string | null;
  };
}

/**
 * Single item response
 */
export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Action response (disconnect, remove)
 */
export interface ActionResponse {
  success: boolean;
  data: {
    id: string;
    status: SocialAccountStatus;
    message: string;
  };
}

// ============================================================================
// Platform Helpers
// ============================================================================

/**
 * Platform display info
 */
export interface PlatformInfo {
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
}

/**
 * Platform display info mapping
 */
export const PLATFORM_INFO: Record<SocialPlatform, PlatformInfo> = {
  FACEBOOK_PAGE: {
    name: "Facebook Page",
    shortName: "Facebook",
    color: "#1877F2",
    bgColor: "#1877F220",
  },
  INSTAGRAM_BUSINESS: {
    name: "Instagram Business",
    shortName: "Instagram",
    color: "#E4405F",
    bgColor: "#E4405F20",
  },
  INSTAGRAM_BASIC: {
    name: "Instagram Basic",
    shortName: "Instagram",
    color: "#E4405F",
    bgColor: "#E4405F20",
  },
  YOUTUBE_CHANNEL: {
    name: "YouTube Channel",
    shortName: "YouTube",
    color: "#FF0000",
    bgColor: "#FF000020",
  },
  TIKTOK_BUSINESS: {
    name: "TikTok Business",
    shortName: "TikTok",
    color: "#000000",
    bgColor: "#00000020",
  },
  PINTEREST_PROFILE: {
    name: "Pinterest Profile",
    shortName: "Pinterest",
    color: "#E60023",
    bgColor: "#E6002320",
  },
  X_ACCOUNT: {
    name: "X (Twitter)",
    shortName: "X",
    color: "#000000",
    bgColor: "#00000020",
  },
  LINKEDIN_PAGE: {
    name: "LinkedIn Page",
    shortName: "LinkedIn",
    color: "#0A66C2",
    bgColor: "#0A66C220",
  },
};

/**
 * All available platforms for select
 */
export const ALL_PLATFORMS: SocialPlatform[] = [
  "FACEBOOK_PAGE",
  "INSTAGRAM_BUSINESS",
  "INSTAGRAM_BASIC",
  "YOUTUBE_CHANNEL",
  "TIKTOK_BUSINESS",
  "PINTEREST_PROFILE",
  "X_ACCOUNT",
  "LINKEDIN_PAGE",
];

/**
 * Status display info
 */
export const STATUS_INFO: Record<SocialAccountStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: {
    label: "Active",
    variant: "default",
  },
  DISCONNECTED: {
    label: "Disconnected",
    variant: "secondary",
  },
  REMOVED: {
    label: "Removed",
    variant: "destructive",
  },
};

