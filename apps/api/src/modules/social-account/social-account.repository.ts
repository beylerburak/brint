/**
 * Social Account Repository
 * 
 * Prisma data access layer for SocialAccount domain.
 * All database operations go through this repository.
 */

import { prisma } from "../../lib/prisma.js";
import { Prisma, type SocialAccount, type SocialPlatform, type SocialAccountStatus } from "@prisma/client";

// ====================
// List Operations
// ====================

export interface ListSocialAccountsParams {
  workspaceId: string;
  brandId: string;
  limit: number;
  cursor?: string | null;
  status?: SocialAccountStatus;
  includeRemoved?: boolean;
}

export interface ListSocialAccountsResult {
  items: SocialAccount[];
  nextCursor: string | null;
}

/**
 * List social accounts for a brand with cursor pagination
 * - If status is provided, filter by that status
 * - If status is not provided and includeRemoved is false (default), show ACTIVE + DISCONNECTED
 * - If includeRemoved is true, show all statuses
 */
export async function listByBrand(params: ListSocialAccountsParams): Promise<ListSocialAccountsResult> {
  const { workspaceId, brandId, limit, cursor, status, includeRemoved = false } = params;

  const where: Prisma.SocialAccountWhereInput = {
    workspaceId,
    brandId,
  };

  // Apply status filter
  if (status) {
    // Explicit status filter
    where.status = status;
  } else if (!includeRemoved) {
    // Default: show ACTIVE and DISCONNECTED, hide REMOVED
    where.status = { not: "REMOVED" };
  }
  // If includeRemoved is true and no status, show all

  // If cursor provided, get items after that cursor
  if (cursor) {
    const cursorAccount = await prisma.socialAccount.findUnique({
      where: { id: cursor },
      select: { createdAt: true, id: true },
    });

    if (cursorAccount) {
      // Get items older than cursor (descending order by createdAt)
      where.OR = [
        { createdAt: { lt: cursorAccount.createdAt } },
        {
          createdAt: cursorAccount.createdAt,
          id: { lt: cursorAccount.id },
        },
      ];
    }
  }

  const accounts = await prisma.socialAccount.findMany({
    where,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: limit + 1, // Fetch one extra to check if there's a next page
  });

  let nextCursor: string | null = null;
  if (accounts.length > limit) {
    const lastItem = accounts[accounts.length - 1];
    nextCursor = lastItem.id;
    accounts.pop(); // Remove extra item
  }

  return { items: accounts, nextCursor };
}

/**
 * List all active social accounts for a brand (no pagination)
 * Used for internal operations like readiness calculation
 */
export async function listAllActiveByBrand(
  workspaceId: string,
  brandId: string
): Promise<SocialAccount[]> {
  return prisma.socialAccount.findMany({
    where: {
      workspaceId,
      brandId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });
}

// ====================
// Single Record Operations
// ====================

/**
 * Get a single social account by ID
 */
export async function findById(id: string): Promise<SocialAccount | null> {
  return prisma.socialAccount.findUnique({
    where: { id },
  });
}

/**
 * Get a single social account by ID with workspace validation
 */
export async function findByIdAndWorkspace(
  id: string,
  workspaceId: string
): Promise<SocialAccount | null> {
  return prisma.socialAccount.findFirst({
    where: {
      id,
      workspaceId,
    },
  });
}

/**
 * Check if a social account exists with the same platform and externalId in workspace
 */
export async function findByPlatformAndExternalId(
  workspaceId: string,
  platform: SocialPlatform,
  externalId: string
): Promise<SocialAccount | null> {
  return prisma.socialAccount.findFirst({
    where: {
      workspaceId,
      platform,
      externalId,
    },
  });
}

// ====================
// Create/Update Operations
// ====================

export interface CreateSocialAccountData {
  workspaceId: string;
  brandId: string;
  platform: SocialPlatform;
  externalId: string;
  username?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  credentialsEncrypted: string;
  platformData?: Record<string, unknown> | null;
}

/**
 * Create a new social account
 */
export async function create(data: CreateSocialAccountData): Promise<SocialAccount> {
  return prisma.socialAccount.create({
    data: {
      workspaceId: data.workspaceId,
      brandId: data.brandId,
      platform: data.platform,
      externalId: data.externalId,
      username: data.username ?? null,
      displayName: data.displayName ?? null,
      profileUrl: data.profileUrl ?? null,
      credentialsEncrypted: data.credentialsEncrypted,
      platformData: data.platformData
        ? (data.platformData as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      status: "ACTIVE",
    },
  });
}

export interface UpdateSocialAccountData {
  username?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  credentialsEncrypted?: string;
  platformData?: Record<string, unknown> | null;
  status?: SocialAccountStatus;
  lastSyncedAt?: Date;
}

/**
 * Update a social account
 */
export async function update(id: string, data: UpdateSocialAccountData): Promise<SocialAccount> {
  const updateData: Prisma.SocialAccountUpdateInput = {
    username: data.username,
    displayName: data.displayName,
    profileUrl: data.profileUrl,
    credentialsEncrypted: data.credentialsEncrypted,
    status: data.status,
    lastSyncedAt: data.lastSyncedAt,
  };

  // Handle platformData separately for Prisma's JSON type
  if (data.platformData !== undefined) {
    updateData.platformData = data.platformData
      ? (data.platformData as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  return prisma.socialAccount.update({
    where: { id },
    data: updateData,
  });
}

// ====================
// Status Change Operations
// ====================

/**
 * Disconnect a social account (wipe credentials, set status)
 */
export async function disconnect(id: string): Promise<SocialAccount> {
  return prisma.socialAccount.update({
    where: { id },
    data: {
      status: "DISCONNECTED",
      credentialsEncrypted: "", // Wipe credentials
    },
  });
}

/**
 * Remove a social account (wipe credentials, set status to REMOVED)
 */
export async function softRemove(id: string): Promise<SocialAccount> {
  return prisma.socialAccount.update({
    where: { id },
    data: {
      status: "REMOVED",
      credentialsEncrypted: "", // Wipe credentials
    },
  });
}

// ====================
// Count Operations
// ====================

/**
 * Count active social accounts for a brand
 */
export async function countActiveByBrand(
  workspaceId: string,
  brandId: string
): Promise<number> {
  return prisma.socialAccount.count({
    where: {
      workspaceId,
      brandId,
      status: "ACTIVE",
    },
  });
}

/**
 * Count all social accounts for a brand (any status)
 */
export async function countAllByBrand(
  workspaceId: string,
  brandId: string
): Promise<number> {
  return prisma.socialAccount.count({
    where: {
      workspaceId,
      brandId,
    },
  });
}

// ====================
// Export as object for consistency
// ====================

export const socialAccountRepository = {
  listByBrand,
  listAllActiveByBrand,
  findById,
  findByIdAndWorkspace,
  findByPlatformAndExternalId,
  create,
  update,
  disconnect,
  softRemove,
  countActiveByBrand,
  countAllByBrand,
};

