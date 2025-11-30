/**
 * Social Account Service
 * 
 * Business logic layer for SocialAccount domain.
 * Handles credential encryption, activity logging, and brand readiness integration.
 */

import type { SocialAccount, SocialAccountStatus } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { buildPublicUrl } from "../../lib/storage/public-url.js";
import { socialAccountRepository } from "./social-account.repository.js";
import {
  encryptSocialCredentials,
  toSocialAccountListItem,
  type ConnectSocialAccountInput,
  type SocialAccountListItem,
  type AnySocialCredentials,
} from "./social-account.types.js";
import { logActivity } from "../activity/activity.service.js";
import * as brandService from "../brand/brand.service.js";
import * as brandRepository from "../brand/brand.repository.js";
import { NotFoundError, ConflictError } from "../../lib/http-errors.js";

// ====================
// List Operations
// ====================

export interface ListSocialAccountsParams {
  workspaceId: string;
  brandId: string;
  limit?: number;
  cursor?: string | null;
  status?: SocialAccountStatus;
  includeRemoved?: boolean;
}

export interface ListSocialAccountsResult {
  items: SocialAccountListItem[];
  nextCursor: string | null;
}

/**
 * List social accounts for a brand
 */
export async function listBrandAccounts(
  params: ListSocialAccountsParams
): Promise<ListSocialAccountsResult> {
  const { workspaceId, brandId, limit = 50, cursor, status, includeRemoved = false } = params;

  // Validate brand exists and belongs to workspace
  await brandService.getBrand(brandId, workspaceId);

  const result = await socialAccountRepository.listByBrand({
    workspaceId,
    brandId,
    limit,
    cursor,
    status,
    includeRemoved,
  });

  // Enrich with avatar URLs
  const itemsWithAvatars = await enrichWithAvatarUrls(result.items);

  return {
    items: itemsWithAvatars,
    nextCursor: result.nextCursor,
  };
}

/**
 * Enrich social accounts with avatar URLs
 * 
 * Uses public CDN URLs for media with isPublic: true (our saved avatars).
 * Falls back to platform CDN URLs from platformData.
 */
async function enrichWithAvatarUrls(
  accounts: SocialAccount[]
): Promise<SocialAccountListItem[]> {
  // Get all media IDs that need URLs
  const mediaIds = accounts
    .map((a) => a.avatarMediaId)
    .filter((id): id is string => id !== null);

  if (mediaIds.length === 0) {
    // No saved avatars, but still check platformData for CDN URLs
    return accounts.map((account) => {
      const avatarUrl = extractPlatformAvatarUrl(account);
      return toSocialAccountListItem(account, avatarUrl);
    });
  }

  // Fetch media records
  const mediaRecords = await prisma.media.findMany({
    where: { id: { in: mediaIds } },
    select: { id: true, objectKey: true, variants: true, isPublic: true },
  });

  // Build URL map using public CDN URLs (for isPublic media)
  const mediaUrlMap = new Map<string, string>();
  for (const media of mediaRecords) {
    // Try to use thumbnail variant if available, otherwise use original
    const variants = media.variants as Record<string, { key?: string }> | null;
    const objectKey = variants?.thumbnail?.key || media.objectKey;
    
    // Build public URL (only works if CDN is configured and media is public)
    const publicUrl = buildPublicUrl(objectKey);
    if (publicUrl) {
      mediaUrlMap.set(media.id, publicUrl);
    }
  }

  // Map accounts with avatar URLs (with platform data fallback)
  return accounts.map((account) => {
    // Try public CDN URL from our S3 first
    let avatarUrl = account.avatarMediaId
      ? mediaUrlMap.get(account.avatarMediaId) ?? null
      : null;

    // Fallback to platform's CDN URL if we don't have our own
    if (!avatarUrl) {
      avatarUrl = extractPlatformAvatarUrl(account);
    }

    return toSocialAccountListItem(account, avatarUrl);
  });
}

/**
 * Extract avatar URL from platform data
 */
function extractPlatformAvatarUrl(account: SocialAccount): string | null {
  const platformData = account.platformData as Record<string, unknown> | null;
  if (!platformData) return null;

  // Different platforms store avatar URLs differently
  if (typeof platformData.pictureUrl === 'string') {
    return platformData.pictureUrl;
  }
  if (typeof platformData.profilePictureUrl === 'string') {
    return platformData.profilePictureUrl;
  }
  if (typeof platformData.avatarUrl === 'string') {
    return platformData.avatarUrl;
  }
  return null;
}

// ====================
// Get Operations
// ====================

/**
 * Get a social account by ID with workspace/brand validation
 */
export async function getSocialAccount(
  socialAccountId: string,
  workspaceId: string,
  brandId: string
): Promise<SocialAccount> {
  // Validate brand exists and belongs to workspace
  await brandService.getBrand(brandId, workspaceId);

  const account = await socialAccountRepository.findByIdAndWorkspace(
    socialAccountId,
    workspaceId
  );

  if (!account) {
    throw new NotFoundError(
      "SOCIAL_ACCOUNT_NOT_FOUND",
      "Social account not found",
      { socialAccountId }
    );
  }

  if (account.brandId !== brandId) {
    throw new NotFoundError(
      "SOCIAL_ACCOUNT_NOT_FOUND",
      "Social account not found",
      { socialAccountId }
    );
  }

  return account;
}

// ====================
// Connect Operations
// ====================

export interface ConnectSocialAccountParams {
  workspaceId: string;
  brandId: string;
  input: ConnectSocialAccountInput;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Connect a new social account to a brand
 * 
 * - Encrypts credentials
 * - Creates SocialAccount with status ACTIVE
 * - Logs activity events
 * - Recalculates brand readiness
 */
export async function connectSocialAccount(
  params: ConnectSocialAccountParams
): Promise<SocialAccountListItem> {
  const { workspaceId, brandId, input, userId, request } = params;

  // 1. Validate brand exists and belongs to workspace
  const brand = await brandService.getBrand(brandId, workspaceId);

  // 2. Check for duplicate (same platform + externalId in workspace)
  const existing = await socialAccountRepository.findByPlatformAndExternalId(
    workspaceId,
    input.platform,
    input.externalId
  );

  if (existing) {
    throw new ConflictError(
      "SOCIAL_ACCOUNT_ALREADY_EXISTS",
      `A social account with this ${input.platform} ID already exists in the workspace`,
      {
        platform: input.platform,
        externalId: input.externalId,
        existingAccountId: existing.id,
        existingBrandId: existing.brandId,
      }
    );
  }

  // 3. Check if this was the first active account (for brand-level event)
  const activeCountBefore = await socialAccountRepository.countActiveByBrand(
    workspaceId,
    brandId
  );
  const isFirstAccount = activeCountBefore === 0;

  // 4. Encrypt credentials
  const credentialsEncrypted = encryptSocialCredentials(input.credentials);

  // 5. Create social account
  const account = await socialAccountRepository.create({
    workspaceId,
    brandId,
    platform: input.platform,
    externalId: input.externalId,
    username: input.username,
    displayName: input.displayName,
    profileUrl: input.profileUrl,
    credentialsEncrypted,
    platformData: input.platformData,
  });

  // 6. Log social_account.connected event
  void logActivity({
    type: "social_account.connected",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "social_account",
    scopeId: account.id,
    metadata: {
      platform: input.platform,
      externalId: input.externalId,
      username: input.username,
      displayName: input.displayName,
      brandId,
      brandName: brand.name,
    },
    request,
  });

  // 7. If this was the first account, log brand.social_account_connected
  if (isFirstAccount) {
    void logActivity({
      type: "brand.social_account_connected",
      workspaceId,
      userId,
      actorType: "user",
      source: "api",
      scopeType: "brand",
      scopeId: brandId,
      metadata: {
        name: brand.name,
        provider: input.platform,
        handle: input.username || input.externalId,
        isFirstAccount: true,
      },
      request,
    });
  }

  // 8. Recalculate brand readiness
  await recalculateBrandSocialAccountReadiness(workspaceId, brandId);

  return toSocialAccountListItem(account);
}

// ====================
// Disconnect Operations
// ====================

export interface DisconnectSocialAccountParams {
  workspaceId: string;
  brandId: string;
  socialAccountId: string;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Disconnect a social account
 * 
 * - Sets status to DISCONNECTED
 * - Wipes credentials
 * - Logs activity
 * - Recalculates brand readiness
 */
export async function disconnectSocialAccount(
  params: DisconnectSocialAccountParams
): Promise<SocialAccountListItem> {
  const { workspaceId, brandId, socialAccountId, userId, request } = params;

  // 1. Get account and validate
  const account = await getSocialAccount(socialAccountId, workspaceId, brandId);
  const brand = await brandService.getBrand(brandId, workspaceId);

  if (account.status !== "ACTIVE") {
    throw new ConflictError(
      "SOCIAL_ACCOUNT_NOT_ACTIVE",
      "Social account is not active and cannot be disconnected",
      { status: account.status }
    );
  }

  // 2. Disconnect (wipe credentials, set status)
  const updatedAccount = await socialAccountRepository.disconnect(socialAccountId);

  // 3. Log social_account.disconnected event
  void logActivity({
    type: "social_account.disconnected",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "social_account",
    scopeId: socialAccountId,
    metadata: {
      platform: account.platform,
      externalId: account.externalId,
      username: account.username,
      displayName: account.displayName,
      brandId,
      brandName: brand.name,
    },
    request,
  });

  // 4. Log brand-level event
  void logActivity({
    type: "brand.social_account_disconnected",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "brand",
    scopeId: brandId,
    metadata: {
      name: brand.name,
      provider: account.platform,
      handle: account.username || account.externalId,
    },
    request,
  });

  // 5. Recalculate brand readiness
  await recalculateBrandSocialAccountReadiness(workspaceId, brandId);

  return toSocialAccountListItem(updatedAccount);
}

// ====================
// Remove Operations
// ====================

export interface RemoveSocialAccountParams {
  workspaceId: string;
  brandId: string;
  socialAccountId: string;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Remove a social account (soft delete)
 * 
 * - Sets status to REMOVED
 * - Wipes credentials
 * - Logs activity
 * - Recalculates brand readiness
 */
export async function removeSocialAccount(
  params: RemoveSocialAccountParams
): Promise<SocialAccountListItem> {
  const { workspaceId, brandId, socialAccountId, userId, request } = params;

  // 1. Get account and validate
  const account = await getSocialAccount(socialAccountId, workspaceId, brandId);
  const brand = await brandService.getBrand(brandId, workspaceId);

  if (account.status === "REMOVED") {
    throw new ConflictError(
      "SOCIAL_ACCOUNT_ALREADY_REMOVED",
      "Social account has already been removed",
      { status: account.status }
    );
  }

  // 2. Soft remove (wipe credentials, set status)
  const updatedAccount = await socialAccountRepository.softRemove(socialAccountId);

  // 3. Log social_account.removed event
  void logActivity({
    type: "social_account.removed",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "social_account",
    scopeId: socialAccountId,
    metadata: {
      platform: account.platform,
      externalId: account.externalId,
      username: account.username,
      displayName: account.displayName,
      brandId,
      brandName: brand.name,
    },
    request,
  });

  // 4. Recalculate brand readiness
  await recalculateBrandSocialAccountReadiness(workspaceId, brandId);

  return toSocialAccountListItem(updatedAccount);
}

// ====================
// Brand Readiness Integration
// ====================

/**
 * Recalculate brand's hasAtLeastOneSocialAccount flag and readiness score
 * Called after any social account status change
 */
export async function recalculateBrandSocialAccountReadiness(
  workspaceId: string,
  brandId: string
): Promise<void> {
  // Get current brand
  const brand = await brandService.getBrand(brandId, workspaceId);

  // Count active social accounts
  const activeCount = await socialAccountRepository.countActiveByBrand(
    workspaceId,
    brandId
  );

  const hasAtLeastOneSocialAccount = activeCount > 0;

  // Only update if changed
  if (brand.hasAtLeastOneSocialAccount !== hasAtLeastOneSocialAccount) {
    // Calculate new readiness score
    const tempBrand = {
      ...brand,
      hasAtLeastOneSocialAccount,
    };
    const readinessResult = brandService.calculateReadinessScore(tempBrand);

    // Update brand
    await brandRepository.updateBrand(brandId, {
      hasAtLeastOneSocialAccount,
      readinessScore: readinessResult.score,
    });
  }
}

// ====================
// Export as object for consistency
// ====================

export const socialAccountService = {
  listBrandAccounts,
  getSocialAccount,
  connectSocialAccount,
  disconnectSocialAccount,
  removeSocialAccount,
  recalculateBrandSocialAccountReadiness,
};

