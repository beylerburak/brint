/**
 * Publication Service
 * 
 * Business logic layer for Publication domain.
 * Handles scheduling publications, validation, and queue integration.
 */

import type { Publication } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { publicationRepository } from "./publication.repository.js";
import {
  mapPublishPlatformToDbPlatform,
  mapInstagramContentTypeToDb,
  mapFacebookContentTypeToDb,
  mapSocialPlatformToPublishPlatform,
  type CreateInstagramPublicationInput,
  type CreateFacebookPublicationInput,
  type PublicationListItem,
  toPublicationListItem,
} from "./publication.types.js";
import { logActivity } from "../activity/activity.service.js";
import { socialAccountRepository } from "../social-account/social-account.repository.js";
import * as brandService from "../brand/brand.service.js";
import { BadRequestError, NotFoundError } from "../../lib/http-errors.js";
import {
  enqueueInstagramPublish,
  enqueueFacebookPublish,
} from "../../core/queue/publication.queue.js";

// ====================
// Instagram Publishing
// ====================

/**
 * Schedule an Instagram publication
 * 
 * Flow:
 * 1. Validate workspace/brand/socialAccount
 * 2. Verify platform is INSTAGRAM_BUSINESS
 * 3. Create Publication record with status SCHEDULED
 * 4. Enqueue publish job
 * 5. Log activity event
 */
export async function scheduleInstagramPublication(
  input: CreateInstagramPublicationInput,
  request?: FastifyRequest
): Promise<Publication> {
  const {
    workspaceId,
    brandId,
    socialAccountId,
    publishAt,
    payload,
    actorUserId,
    clientRequestId,
  } = input;

  // 1. Validate brand exists and belongs to workspace
  const brand = await brandService.getBrand(brandId, workspaceId);

  // 2. Get and validate social account
  const socialAccount = await socialAccountRepository.findByIdAndWorkspace(
    socialAccountId,
    workspaceId
  );

  if (!socialAccount) {
    throw new NotFoundError(
      "SOCIAL_ACCOUNT_NOT_FOUND",
      "Social account not found",
      { socialAccountId }
    );
  }

  if (socialAccount.brandId !== brandId) {
    throw new BadRequestError(
      "SOCIAL_ACCOUNT_BRAND_MISMATCH",
      "Social account does not belong to this brand",
      { socialAccountId, brandId }
    );
  }

  // 3. Verify platform is Instagram
  const publishPlatform = mapSocialPlatformToPublishPlatform(socialAccount.platform);
  if (publishPlatform !== "INSTAGRAM") {
    throw new BadRequestError(
      "SOCIAL_ACCOUNT_PLATFORM_MISMATCH",
      `Expected Instagram social account, got ${socialAccount.platform}`,
      { expectedPlatform: "INSTAGRAM", actualPlatform: socialAccount.platform }
    );
  }

  if (socialAccount.status !== "ACTIVE") {
    throw new BadRequestError(
      "SOCIAL_ACCOUNT_NOT_ACTIVE",
      "Social account is not active",
      { status: socialAccount.status }
    );
  }

  // 4. Check for idempotency (clientRequestId)
  if (clientRequestId) {
    const existing = await publicationRepository.getPublicationByClientRequestId(
      workspaceId,
      brandId,
      clientRequestId
    );
    if (existing) {
      // Return existing publication (idempotent)
      return existing;
    }
  }

  // 5. Map content type
  const contentType = mapInstagramContentTypeToDb(payload.contentType);
  const platform = mapPublishPlatformToDbPlatform("INSTAGRAM");

  // 6. Extract caption (STORY payloads don't have caption)
  const caption = "caption" in payload ? (payload.caption ?? null) : null;

  // 7. Calculate scheduled time
  const scheduledAt = publishAt ?? null;

  // 8. Create publication
  const publication = await publicationRepository.createPublication({
    workspaceId,
    brandId,
    socialAccountId,
    platform,
    contentType,
    status: "scheduled",
    scheduledAt,
    caption,
    payloadJson: payload,
    clientRequestId: clientRequestId ?? null,
  });

  // 9. Enqueue job
  const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
  
  await enqueueInstagramPublish({
    publicationId: publication.id,
    workspaceId,
    brandId,
  }, delay);

  // 10. Log activity
  void logActivity({
    type: "publication.scheduled",
    workspaceId,
    userId: actorUserId,
    actorType: "user",
    source: "api",
    scopeType: "publication",
    scopeId: publication.id,
    metadata: {
      publicationId: publication.id,
      platform: "instagram",
      contentType: payload.contentType,
      scheduledAt: scheduledAt?.toISOString() ?? "immediate",
      socialAccountId,
      brandName: brand.name,
    },
    request,
  });

  return publication;
}

// ====================
// Facebook Publishing
// ====================

/**
 * Schedule a Facebook publication
 * 
 * Flow:
 * 1. Validate workspace/brand/socialAccount
 * 2. Verify platform is FACEBOOK_PAGE
 * 3. Create Publication record with status SCHEDULED
 * 4. Enqueue publish job
 * 5. Log activity event
 */
export async function scheduleFacebookPublication(
  input: CreateFacebookPublicationInput,
  request?: FastifyRequest
): Promise<Publication> {
  const {
    workspaceId,
    brandId,
    socialAccountId,
    publishAt,
    payload,
    actorUserId,
    clientRequestId,
  } = input;

  // 1. Validate brand exists and belongs to workspace
  const brand = await brandService.getBrand(brandId, workspaceId);

  // 2. Get and validate social account
  const socialAccount = await socialAccountRepository.findByIdAndWorkspace(
    socialAccountId,
    workspaceId
  );

  if (!socialAccount) {
    throw new NotFoundError(
      "SOCIAL_ACCOUNT_NOT_FOUND",
      "Social account not found",
      { socialAccountId }
    );
  }

  if (socialAccount.brandId !== brandId) {
    throw new BadRequestError(
      "SOCIAL_ACCOUNT_BRAND_MISMATCH",
      "Social account does not belong to this brand",
      { socialAccountId, brandId }
    );
  }

  // 3. Verify platform is Facebook
  const publishPlatform = mapSocialPlatformToPublishPlatform(socialAccount.platform);
  if (publishPlatform !== "FACEBOOK") {
    throw new BadRequestError(
      "SOCIAL_ACCOUNT_PLATFORM_MISMATCH",
      `Expected Facebook social account, got ${socialAccount.platform}`,
      { expectedPlatform: "FACEBOOK", actualPlatform: socialAccount.platform }
    );
  }

  if (socialAccount.status !== "ACTIVE") {
    throw new BadRequestError(
      "SOCIAL_ACCOUNT_NOT_ACTIVE",
      "Social account is not active",
      { status: socialAccount.status }
    );
  }

  // 4. Check for idempotency (clientRequestId)
  if (clientRequestId) {
    const existing = await publicationRepository.getPublicationByClientRequestId(
      workspaceId,
      brandId,
      clientRequestId
    );
    if (existing) {
      return existing;
    }
  }

  // 5. Map content type
  const contentType = mapFacebookContentTypeToDb(payload.contentType);
  const platform = mapPublishPlatformToDbPlatform("FACEBOOK");

  // 6. Extract message as caption (STORY payloads don't have message)
  const caption = "message" in payload ? (payload.message ?? null) : null;

  // 7. Calculate scheduled time
  const scheduledAt = publishAt ?? null;

  // 8. Create publication
  const publication = await publicationRepository.createPublication({
    workspaceId,
    brandId,
    socialAccountId,
    platform,
    contentType,
    status: "scheduled",
    scheduledAt,
    caption,
    payloadJson: payload,
    clientRequestId: clientRequestId ?? null,
  });

  // 9. Enqueue job
  const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
  
  await enqueueFacebookPublish({
    publicationId: publication.id,
    workspaceId,
    brandId,
  }, delay);

  // 10. Log activity
  void logActivity({
    type: "publication.scheduled",
    workspaceId,
    userId: actorUserId,
    actorType: "user",
    source: "api",
    scopeType: "publication",
    scopeId: publication.id,
    metadata: {
      publicationId: publication.id,
      platform: "facebook",
      contentType: payload.contentType,
      scheduledAt: scheduledAt?.toISOString() ?? "immediate",
      socialAccountId,
      brandName: brand.name,
    },
    request,
  });

  return publication;
}

// ====================
// List Operations
// ====================

export interface ListPublicationsParams {
  workspaceId: string;
  brandId: string;
  limit?: number;
  cursor?: string | null;
}

export interface ListPublicationsResult {
  items: PublicationListItem[];
  nextCursor: string | null;
}

/**
 * List publications for a brand
 */
export async function listBrandPublications(
  params: ListPublicationsParams
): Promise<ListPublicationsResult> {
  const { workspaceId, brandId, limit = 50, cursor } = params;

  // Validate brand exists
  await brandService.getBrand(brandId, workspaceId);

  const result = await publicationRepository.listByBrand({
    workspaceId,
    brandId,
    limit,
    cursor,
  });

  return {
    items: result.items.map(toPublicationListItem),
    nextCursor: result.nextCursor,
  };
}

// ====================
// Get Operations
// ====================

/**
 * Get a single publication with workspace/brand validation
 */
export async function getPublication(
  publicationId: string,
  workspaceId: string,
  brandId: string
): Promise<Publication> {
  // Validate brand exists
  await brandService.getBrand(brandId, workspaceId);

  const publication = await publicationRepository.getPublicationByIdAndWorkspace(
    publicationId,
    workspaceId
  );

  if (!publication) {
    throw new NotFoundError(
      "PUBLICATION_NOT_FOUND",
      "Publication not found",
      { publicationId }
    );
  }

  if (publication.brandId !== brandId) {
    throw new NotFoundError(
      "PUBLICATION_NOT_FOUND",
      "Publication not found",
      { publicationId }
    );
  }

  return publication;
}

// ====================
// Export as object for consistency
// ====================

export const publicationService = {
  scheduleInstagramPublication,
  scheduleFacebookPublication,
  listBrandPublications,
  getPublication,
};

