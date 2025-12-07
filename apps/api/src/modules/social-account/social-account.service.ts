/**
 * Social Account Service
 * 
 * Handles brand-based social media account management.
 * Single source of truth for social platform connections.
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { z } from 'zod';
import type { SocialPlatform, SocialAccountStatus, Prisma } from '@prisma/client';
import { ActivityActorType } from '@prisma/client';
import { logActivity, buildBrandActivity } from '../../core/activity/activity-log.service.js';
import { cacheService, CacheKeys } from '../../core/cache/cache.service.js';
import { getPlanLimits, canAddSocialAccount } from '@brint/shared-config/plans';

// ============================================================================
// Type Definitions
// ============================================================================

export type SocialAccountDto = {
  id: string;
  platform: SocialPlatform;
  platformAccountId: string;
  displayName: string | null;
  username: string | null;
  externalAvatarUrl: string | null;
  avatarUrl: string | null;
  status: SocialAccountStatus;
  canPublish: boolean;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialAccountWithTokens = SocialAccountDto & {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  tokenData: unknown;
  rawProfile: unknown;
};

// ============================================================================
// Validation Schemas
// ============================================================================

export const CreateOrUpdateFromOAuthSchema = z.object({
  brandId: z.string().min(1, 'Brand ID is required'),
  platform: z.enum(['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'YOUTUBE', 'WHATSAPP', 'PINTEREST']),
  platformAccountId: z.string().min(1, 'Platform account ID is required'),
  displayName: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  externalAvatarUrl: z.string().url().optional().nullable().or(z.literal('').transform(() => null)),
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional().nullable(),
  tokenExpiresAt: z.date().optional().nullable(),
  scopes: z.array(z.string()).default([]),
  tokenData: z.unknown().optional().nullable(),
  rawProfile: z.unknown().optional().nullable(),
  canPublish: z.boolean().optional(), // Optional, defaults to true for most platforms, false for LinkedIn
});

export type CreateOrUpdateFromOAuthInput = z.infer<typeof CreateOrUpdateFromOAuthSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert nullable JSON to Prisma-compatible format
 */
function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

/**
 * Map database model to DTO (excludes sensitive token data)
 */
function toDto(account: any): SocialAccountDto {
  return {
    id: account.id,
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    displayName: account.displayName,
    username: account.username,
    externalAvatarUrl: account.externalAvatarUrl,
    avatarUrl: account.avatarUrl,
    status: account.status,
    canPublish: account.canPublish,
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    lastErrorCode: account.lastErrorCode,
    lastErrorMessage: account.lastErrorMessage,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

/**
 * Map database model to DTO with tokens (internal use only)
 */
function toDtoWithTokens(account: any): SocialAccountWithTokens {
  return {
    ...toDto(account),
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    scopes: account.scopes,
    tokenData: account.tokenData,
    rawProfile: account.rawProfile,
  };
}

// ============================================================================
// Brand Permission Check
// ============================================================================

/**
 * Check if brand belongs to workspace
 */
async function checkBrandBelongsToWorkspace(
  brandId: string,
  workspaceId: string
): Promise<boolean> {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId },
    select: { id: true },
  });
  return !!brand;
}

/**
 * Check if social account belongs to brand and workspace
 */
async function checkSocialAccountBelongsToWorkspace(
  accountId: string,
  workspaceId: string
): Promise<{ valid: boolean; brandId?: string }> {
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId },
    include: {
      brand: {
        select: { id: true, workspaceId: true },
      },
    },
  });

  if (!account) {
    return { valid: false };
  }

  if (account.brand.workspaceId !== workspaceId) {
    return { valid: false };
  }

  return { valid: true, brandId: account.brandId };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * List all social accounts for a brand
 */
export async function listByBrand(
  brandId: string,
  workspaceId: string,
  options?: {
    platform?: SocialPlatform;
    status?: SocialAccountStatus;
  }
): Promise<SocialAccountDto[]> {
  logger.info({ brandId, workspaceId, options }, 'Listing social accounts for brand');

  // Check brand belongs to workspace
  const belongs = await checkBrandBelongsToWorkspace(brandId, workspaceId);
  if (!belongs) {
    throw new Error('BRAND_NOT_FOUND');
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      brandId,
      ...(options?.platform ? { platform: options.platform } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: [
      { platform: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  logger.info({ brandId, count: accounts.length }, 'Social accounts listed');

  return accounts.map(toDto);
}

/**
 * Get a single social account by ID (internal, includes tokens)
 */
export async function getById(
  accountId: string,
  workspaceId: string
): Promise<SocialAccountWithTokens | null> {
  logger.info({ accountId, workspaceId }, 'Getting social account by ID');

  const { valid, brandId } = await checkSocialAccountBelongsToWorkspace(accountId, workspaceId);
  if (!valid) {
    return null;
  }

  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return null;
  }

  return toDtoWithTokens(account);
}

/**
 * Get a social account by platform and platformAccountId for a brand (internal, includes tokens)
 */
export async function getByPlatformAccount(
  brandId: string,
  platform: SocialPlatform,
  platformAccountId: string
): Promise<SocialAccountWithTokens | null> {
  const account = await prisma.socialAccount.findUnique({
    where: {
      brand_platform_account_unique: {
        brandId,
        platform,
        platformAccountId,
      },
    },
  });

  if (!account) {
    return null;
  }

  return toDtoWithTokens(account);
}

/**
 * Create or update a social account from OAuth callback
 */
export async function createOrUpdateFromOAuth(
  input: CreateOrUpdateFromOAuthInput,
  workspaceId: string,
  userId?: string
): Promise<SocialAccountDto> {
  logger.info(
    { brandId: input.brandId, platform: input.platform, platformAccountId: input.platformAccountId },
    'Creating/updating social account from OAuth'
  );

  // Validate input
  let validated;
  try {
    validated = CreateOrUpdateFromOAuthSchema.parse(input);
  } catch (validationError) {
    logger.error({ 
      error: validationError,
      input: {
        brandId: input.brandId,
        platform: input.platform,
        platformAccountId: input.platformAccountId,
        displayName: input.displayName,
        hasRawProfile: !!input.rawProfile,
        rawProfileType: typeof input.rawProfile,
        rawProfileKeys: input.rawProfile && typeof input.rawProfile === 'object' ? Object.keys(input.rawProfile) : undefined
      }
    }, 'Validation failed for createOrUpdateFromOAuth');
    throw new Error(`Validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`);
  }

  // Check brand belongs to workspace
  const belongs = await checkBrandBelongsToWorkspace(validated.brandId, workspaceId);
  if (!belongs) {
    throw new Error('BRAND_NOT_FOUND');
  }

  // Get workspace to check plan limits
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  // Check if account already exists
  const existing = await prisma.socialAccount.findUnique({
    where: {
      brand_platform_account_unique: {
        brandId: validated.brandId,
        platform: validated.platform,
        platformAccountId: validated.platformAccountId,
      },
    },
  });

  let account;
  let isNew = false;

  // Determine canPublish: use provided value, or default based on platform
  const canPublish = validated.canPublish !== undefined
    ? validated.canPublish
    : validated.platform === 'LINKEDIN' ? false : true; // LinkedIn defaults to false

  if (existing) {
    // Update existing account
    account = await prisma.socialAccount.update({
      where: { id: existing.id },
      data: {
        displayName: validated.displayName,
        username: validated.username,
        externalAvatarUrl: validated.externalAvatarUrl,
        accessToken: validated.accessToken,
        refreshToken: validated.refreshToken,
        tokenExpiresAt: validated.tokenExpiresAt,
        scopes: validated.scopes,
        tokenData: toPrismaJson(validated.tokenData),
        rawProfile: toPrismaJson(validated.rawProfile),
        status: 'ACTIVE', // Reconnecting reactivates the account
        canPublish, // Use determined value
        lastSyncedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    logger.info({ accountId: account.id, platform: account.platform }, 'Social account updated');
  } else {
    // Check plan limits for new account
    const currentCount = await prisma.socialAccount.count({
      where: {
        brandId: validated.brandId,
        platform: validated.platform,
      },
    });

    if (!canAddSocialAccount(workspace.plan, validated.platform, currentCount)) {
      const limits = getPlanLimits(workspace.plan);
      throw new Error(`PLAN_LIMIT_REACHED: Maximum ${limits.maxSocialAccountsPerPlatform === -1 ? 'unlimited' : limits.maxSocialAccountsPerPlatform} ${validated.platform} account(s) per brand allowed for ${workspace.plan} plan`);
    }

    // Create new account
    account = await prisma.socialAccount.create({
      data: {
        brandId: validated.brandId,
        platform: validated.platform,
        platformAccountId: validated.platformAccountId,
        displayName: validated.displayName,
        username: validated.username,
        externalAvatarUrl: validated.externalAvatarUrl,
        accessToken: validated.accessToken,
        refreshToken: validated.refreshToken,
        tokenExpiresAt: validated.tokenExpiresAt,
        scopes: validated.scopes,
        tokenData: toPrismaJson(validated.tokenData),
        rawProfile: toPrismaJson(validated.rawProfile),
        status: 'ACTIVE',
        canPublish, // Use determined value
        lastSyncedAt: new Date(),
      },
    });
    isNew = true;

    logger.info({ accountId: account.id, platform: account.platform }, 'Social account created');
  }

  // Invalidate brand cache
  try {
    await cacheService.delete(CacheKeys.brand(validated.brandId));
  } catch (cacheError) {
    logger.warn({ error: cacheError, brandId: validated.brandId }, 'Failed to invalidate brand cache');
  }

  // Log activity (don't fail if activity logging fails)
  try {
    await logActivity(
      buildBrandActivity({
        workspaceId,
        brandId: validated.brandId,
        entityId: account.id,
        eventKey: isNew ? 'social_account.connected' : 'social_account.reconnected',
        message: `${validated.platform} account ${isNew ? 'connected' : 'reconnected'}: ${validated.displayName || validated.username || validated.platformAccountId}`,
        actorType: userId ? ActivityActorType.USER : ActivityActorType.INTEGRATION,
        actorUserId: userId,
        context: 'social_account',
        payload: {
          accountId: account.id,
          platform: validated.platform,
        platformAccountId: validated.platformAccountId,
        displayName: validated.displayName,
        username: validated.username,
      },
    })
    );
  } catch (activityError) {
    logger.warn({ error: activityError, accountId: account.id }, 'Failed to log activity for social account');
    // Don't fail the whole operation if activity logging fails
  }

  return toDto(account);
}

/**
 * Mark a social account as expired (token expired/invalid)
 */
export async function markAsExpired(
  accountId: string,
  workspaceId: string,
  errorCode?: string,
  errorMessage?: string
): Promise<SocialAccountDto> {
  logger.info({ accountId, errorCode }, 'Marking social account as expired');

  // Check account belongs to workspace
  const { valid, brandId } = await checkSocialAccountBelongsToWorkspace(accountId, workspaceId);
  if (!valid || !brandId) {
    throw new Error('SOCIAL_ACCOUNT_NOT_FOUND');
  }

  const account = await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      status: 'EXPIRED',
      canPublish: false,
      lastErrorCode: errorCode ?? 'TOKEN_EXPIRED',
      lastErrorMessage: errorMessage ?? 'Token has expired. Please reconnect your account.',
    },
  });

  logger.info({ accountId: account.id, platform: account.platform }, 'Social account marked as expired');

  // Invalidate brand cache
  await cacheService.delete(CacheKeys.brand(brandId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: accountId,
      eventKey: 'social_account.expired',
      message: `${account.platform} account token expired`,
      actorType: ActivityActorType.SYSTEM,
      context: 'social_account',
      payload: {
        accountId,
        platform: account.platform,
        errorCode,
        errorMessage,
      },
    })
  );

  return toDto(account);
}

/**
 * Disconnect (revoke) a social account
 */
export async function disconnect(
  accountId: string,
  workspaceId: string,
  userId?: string
): Promise<SocialAccountDto> {
  logger.info({ accountId }, 'Disconnecting social account');

  // Check account belongs to workspace
  const { valid, brandId } = await checkSocialAccountBelongsToWorkspace(accountId, workspaceId);
  if (!valid || !brandId) {
    throw new Error('SOCIAL_ACCOUNT_NOT_FOUND');
  }

  const account = await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      status: 'REVOKED',
      canPublish: false,
      lastErrorCode: 'DISCONNECTED',
      lastErrorMessage: 'Account was manually disconnected by user.',
    },
  });

  logger.info({ accountId: account.id, platform: account.platform }, 'Social account disconnected');

  // Invalidate brand cache
  await cacheService.delete(CacheKeys.brand(brandId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: accountId,
      eventKey: 'social_account.disconnected',
      message: `${account.platform} account disconnected`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      context: 'social_account',
      payload: {
        accountId,
        platform: account.platform,
        displayName: account.displayName,
        username: account.username,
      },
    })
  );

  return toDto(account);
}

/**
 * Update avatar for a social account
 */
export async function updateAvatar(
  accountId: string,
  workspaceId: string,
  avatarUrl: string,
  externalAvatarUrl?: string
): Promise<SocialAccountDto> {
  logger.info({ accountId, avatarUrl }, 'Updating social account avatar');

  // Check account belongs to workspace
  const { valid, brandId } = await checkSocialAccountBelongsToWorkspace(accountId, workspaceId);
  if (!valid || !brandId) {
    throw new Error('SOCIAL_ACCOUNT_NOT_FOUND');
  }

  const account = await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      avatarUrl,
      ...(externalAvatarUrl !== undefined ? { externalAvatarUrl } : {}),
    },
  });

  logger.info({ accountId: account.id }, 'Social account avatar updated');

  // Invalidate brand cache
  await cacheService.delete(CacheKeys.brand(brandId));

  return toDto(account);
}

/**
 * Update tokens for a social account (for token refresh flows)
 */
export async function updateTokens(
  accountId: string,
  workspaceId: string,
  data: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    tokenData?: unknown;
  }
): Promise<void> {
  logger.info({ accountId }, 'Updating social account tokens');

  // Check account belongs to workspace
  const { valid } = await checkSocialAccountBelongsToWorkspace(accountId, workspaceId);
  if (!valid) {
    throw new Error('SOCIAL_ACCOUNT_NOT_FOUND');
  }

  await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      accessToken: data.accessToken,
      ...(data.refreshToken !== undefined ? { refreshToken: data.refreshToken } : {}),
      ...(data.tokenExpiresAt !== undefined ? { tokenExpiresAt: data.tokenExpiresAt } : {}),
      ...(data.tokenData !== undefined ? { tokenData: toPrismaJson(data.tokenData) } : {}),
      lastSyncedAt: new Date(),
    },
  });

  logger.info({ accountId }, 'Social account tokens updated');
}

/**
 * Get all active social accounts for publishing (includes tokens)
 */
export async function getActiveAccountsForBrand(
  brandId: string
): Promise<SocialAccountWithTokens[]> {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      brandId,
      status: 'ACTIVE',
      canPublish: true,
    },
  });

  return accounts.map(toDtoWithTokens);
}

/**
 * Delete a social account completely
 */
export async function deleteSocialAccount(
  accountId: string,
  workspaceId: string,
  userId?: string
): Promise<void> {
  logger.info({ accountId }, 'Deleting social account');

  // Check account belongs to workspace
  const { valid, brandId } = await checkSocialAccountBelongsToWorkspace(accountId, workspaceId);
  if (!valid || !brandId) {
    throw new Error('SOCIAL_ACCOUNT_NOT_FOUND');
  }

  // Get account info before deletion
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error('SOCIAL_ACCOUNT_NOT_FOUND');
  }

  await prisma.socialAccount.delete({
    where: { id: accountId },
  });

  logger.info({ accountId, platform: account.platform }, 'Social account deleted');

  // Invalidate brand cache
  await cacheService.delete(CacheKeys.brand(brandId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: accountId,
      eventKey: 'social_account.deleted',
      message: `${account.platform} account deleted`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      context: 'social_account',
      payload: {
        accountId,
        platform: account.platform,
        displayName: account.displayName,
        username: account.username,
      },
    })
  );
}
