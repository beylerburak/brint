/**
 * Social Account Domain Types
 * 
 * Domain-level type definitions for the SocialAccount module.
 * Includes credential types for each platform and encryption helpers.
 */

import type { SocialAccount, SocialPlatform, SocialAccountStatus } from "@prisma/client";
import { encryptSecret, decryptSecret } from "../../lib/secret-encryption.js";

// ====================
// Platform Credential Types
// ====================

export type FacebookCredentials = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string; // ISO string
  scopes?: string[];
  pageId?: string;
  instagramBusinessAccountId?: string;
};

export type InstagramCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  igBusinessAccountId?: string;
};

export type LinkedInCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
};

export type XCredentials = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  scopes?: string[];
};

export type YouTubeCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  channelId?: string;
};

export type TikTokCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
};

export type PinterestCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
};

/**
 * Discriminated union for all platform credentials
 * The platform field determines which credential type is used
 */
export type AnySocialCredentials =
  | { platform: "FACEBOOK_PAGE"; data: FacebookCredentials }
  | { platform: "INSTAGRAM_BUSINESS"; data: InstagramCredentials }
  | { platform: "INSTAGRAM_BASIC"; data: InstagramCredentials }
  | { platform: "LINKEDIN_PAGE"; data: LinkedInCredentials }
  | { platform: "X_ACCOUNT"; data: XCredentials }
  | { platform: "YOUTUBE_CHANNEL"; data: YouTubeCredentials }
  | { platform: "TIKTOK_BUSINESS"; data: TikTokCredentials }
  | { platform: "PINTEREST_PROFILE"; data: PinterestCredentials };

// ====================
// Encryption Helpers
// ====================

/**
 * Encrypts social credentials for storage
 * 
 * @param input - Credentials with platform discriminator
 * @returns Encrypted string safe for database storage
 */
export function encryptSocialCredentials(input: AnySocialCredentials): string {
  const json = JSON.stringify(input);
  return encryptSecret(json);
}

/**
 * Decrypts stored social credentials
 * 
 * @param cipher - Encrypted credentials string from database
 * @returns Decrypted credentials with platform discriminator
 */
export function decryptSocialCredentials(cipher: string): AnySocialCredentials {
  const json = decryptSecret(cipher);
  return JSON.parse(json) as AnySocialCredentials;
}

// ====================
// Domain Types
// ====================

/**
 * Social account list item (used in list responses)
 * Never includes credentials
 */
export interface SocialAccountListItem {
  id: string;
  workspaceId: string;
  brandId: string;
  platform: SocialPlatform;
  externalId: string;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  status: SocialAccountStatus;
  lastSyncedAt: Date | null;
  avatarMediaId: string | null;
  avatarUrl: string | null;
  platformData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for connecting a new social account
 */
export interface ConnectSocialAccountInput {
  platform: SocialPlatform;
  externalId: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  platformData?: Record<string, unknown>;
  credentials: AnySocialCredentials;
}

/**
 * Input for updating a social account
 */
export interface UpdateSocialAccountInput {
  username?: string;
  displayName?: string;
  profileUrl?: string;
  platformData?: Record<string, unknown>;
  credentials?: AnySocialCredentials;
}

/**
 * Safe social account (without credentials)
 */
export type SafeSocialAccount = Omit<SocialAccount, "credentialsEncrypted">;

/**
 * Map prisma SocialAccount to safe version (without credentials)
 */
export function toSafeSocialAccount(account: SocialAccount): SafeSocialAccount {
  const { credentialsEncrypted: _, ...safe } = account;
  return safe;
}

/**
 * Map prisma SocialAccount to list item format
 * avatarUrl should be set separately via enrichWithAvatarUrls
 */
export function toSocialAccountListItem(
  account: SocialAccount,
  avatarUrl?: string | null
): SocialAccountListItem {
  return {
    id: account.id,
    workspaceId: account.workspaceId,
    brandId: account.brandId,
    platform: account.platform,
    externalId: account.externalId,
    username: account.username,
    displayName: account.displayName,
    profileUrl: account.profileUrl,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt,
    avatarMediaId: account.avatarMediaId,
    avatarUrl: avatarUrl ?? null,
    platformData: account.platformData as Record<string, unknown> | null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

// Re-export platform enum from Prisma for convenience
export type { SocialPlatform, SocialAccountStatus } from "@prisma/client";

