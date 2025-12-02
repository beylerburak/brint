/**
 * Publication Domain Types
 * 
 * Domain-level type definitions for the Publication module.
 * Includes platform-specific types for Instagram and Facebook publishing.
 */

import type { Publication, PublicationPlatform, PublicationContentType, PublicationStatus } from "@prisma/client";
import type {
  InstagramPublicationPayload,
  FacebookPublicationPayload,
} from "@brint/core-validation";

// ====================
// Platform Types
// ====================

/**
 * Simplified platform type for publications
 * Maps to our SocialPlatform enum but focused on publishing
 */
export type PublishPlatform = "INSTAGRAM" | "FACEBOOK";

/**
 * Map SocialPlatform to PublishPlatform
 */
export function mapSocialPlatformToPublishPlatform(
  platform: string
): PublishPlatform | null {
  if (platform === "INSTAGRAM_BUSINESS" || platform === "INSTAGRAM_BASIC") {
    return "INSTAGRAM";
  }
  if (platform === "FACEBOOK_PAGE") {
    return "FACEBOOK";
  }
  return null;
}

/**
 * Map PublishPlatform to PublicationPlatform (Prisma enum)
 */
export function mapPublishPlatformToDbPlatform(
  platform: PublishPlatform
): PublicationPlatform {
  if (platform === "INSTAGRAM") return "instagram";
  if (platform === "FACEBOOK") return "facebook";
  throw new Error(`Unknown platform: ${platform}`);
}

// ====================
// Content Type Mapping
// ====================

/**
 * Map Instagram payload contentType to Prisma PublicationContentType
 */
export function mapInstagramContentTypeToDb(
  contentType: "IMAGE" | "CAROUSEL" | "REEL" | "STORY"
): PublicationContentType {
  switch (contentType) {
    case "IMAGE":
      return "image";
    case "CAROUSEL":
      return "carousel";
    case "REEL":
      return "reel";
    case "STORY":
      return "story";
    default:
      throw new Error(`Unknown Instagram content type: ${contentType}`);
  }
}

/**
 * Map Facebook payload contentType to Prisma PublicationContentType
 */
export function mapFacebookContentTypeToDb(
  contentType: "PHOTO" | "VIDEO" | "LINK" | "STORY"
): PublicationContentType {
  switch (contentType) {
    case "PHOTO":
      return "image";
    case "CAROUSEL":
      return "carousel";
    case "VIDEO":
      return "video";
    case "LINK":
      return "link";
    case "STORY":
      return "story";
    default:
      throw new Error(`Unknown Facebook content type: ${contentType}`);
  }
}

// ====================
// Service Input Types
// ====================

/**
 * Base input for creating a publication
 */
export interface BaseCreatePublicationInput<TPayload> {
  workspaceId: string;
  brandId: string;
  socialAccountId: string;
  publishAt?: Date | null;
  payload: TPayload;
  actorUserId: string;
  clientRequestId?: string | null;
}

/**
 * Instagram publication creation input
 */
export type CreateInstagramPublicationInput =
  BaseCreatePublicationInput<InstagramPublicationPayload>;

/**
 * Facebook publication creation input
 */
export type CreateFacebookPublicationInput =
  BaseCreatePublicationInput<FacebookPublicationPayload>;

// ====================
// Credentials Types (for decrypted credentials)
// ====================

/**
 * Instagram credentials structure (decrypted from socialAccount.credentialsEncrypted)
 */
export interface InstagramCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO string
  scopes?: string[];
  igBusinessAccountId?: string;
}

/**
 * Facebook Page credentials structure
 */
export interface FacebookCredentials {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  scopes?: string[];
  pageId?: string;
  instagramBusinessAccountId?: string;
}

// ====================
// Platform Data Types (JSON in platformData field)
// ====================

/**
 * Instagram platform data structure
 */
export interface InstagramPlatformData {
  igBusinessAccountId: string;
  facebookPageId?: string;
  username?: string;
  profilePictureUrl?: string;
}

/**
 * Facebook Page platform data structure
 */
export interface FacebookPlatformData {
  pageId: string;
  pageName?: string;
  pageUrl?: string;
  pictureUrl?: string;
}

// ====================
// Response Types
// ====================

/**
 * Publication list item (safe for API responses)
 */
export interface PublicationListItem {
  id: string;
  workspaceId: string;
  brandId: string;
  socialAccountId: string | null;
  platform: PublicationPlatform;
  contentType: PublicationContentType;
  status: PublicationStatus;
  caption: string | null;
  payloadJson: any | null;
  mediaThumbnails?: string[];
  mediaUrls?: string[];
  scheduledAt: Date | null;
  publishedAt: Date | null;
  failedAt: Date | null;
  permalink: string | null;
  externalPostId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert Publication to safe list item
 */
export function toPublicationListItem(publication: Publication): PublicationListItem {
  return {
    id: publication.id,
    workspaceId: publication.workspaceId,
    brandId: publication.brandId,
    socialAccountId: publication.socialAccountId,
    platform: publication.platform,
    contentType: publication.contentType,
    status: publication.status,
    caption: publication.caption,
    payloadJson: publication.payloadJson,
    scheduledAt: publication.scheduledAt,
    publishedAt: publication.publishedAt,
    failedAt: publication.failedAt,
    permalink: publication.permalink,
    externalPostId: publication.externalPostId,
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt,
  };
}

// ====================
// Queue Job Types
// ====================

/**
 * Data passed to publication worker jobs
 */
export interface PublishJobData {
  publicationId: string;
  workspaceId: string;
  brandId: string;
}

// Re-export Prisma types for convenience
export type {
  Publication,
  PublicationPlatform,
  PublicationContentType,
  PublicationStatus,
} from "@prisma/client";

