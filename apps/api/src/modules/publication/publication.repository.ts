/**
 * Publication Repository
 * 
 * Prisma data access layer for Publication domain.
 * All database operations go through this repository.
 */

import { prisma } from "../../lib/prisma.js";
import type {
  Prisma,
  Publication,
  PublicationPlatform,
  PublicationContentType,
  PublicationStatus,
} from "@prisma/client";

// ====================
// Create Operations
// ====================

export interface CreatePublicationData {
  workspaceId: string;
  brandId: string;
  socialAccountId: string;
  platform: PublicationPlatform;
  contentType: PublicationContentType;
  status: PublicationStatus;
  scheduledAt?: Date | null;
  caption?: string | null;
  payloadJson: unknown;
  clientRequestId?: string | null;
}

/**
 * Create a new publication
 */
export async function createPublication(data: CreatePublicationData): Promise<Publication> {
  return prisma.publication.create({
    data: {
      workspaceId: data.workspaceId,
      brandId: data.brandId,
      socialAccountId: data.socialAccountId,
      platform: data.platform,
      contentType: data.contentType,
      status: data.status,
      scheduledAt: data.scheduledAt ?? null,
      caption: data.caption ?? null,
      payloadJson: data.payloadJson as Prisma.InputJsonValue,
      clientRequestId: data.clientRequestId ?? null,
      settings: {}, // Legacy field, empty for new publications
    },
  });
}

// ====================
// Update Operations
// ====================

export interface UpdatePublicationStatusData {
  status?: PublicationStatus;
  publishedAt?: Date | null;
  failedAt?: Date | null;
  permalink?: string | null;
  externalPostId?: string | null;
  providerResponseJson?: unknown;
  jobId?: string | null;
}

/**
 * Update publication status and related fields
 */
export async function updatePublicationStatus(
  id: string,
  data: UpdatePublicationStatusData
): Promise<Publication> {
  const updateData: Prisma.PublicationUpdateInput = {};

  if (data.status !== undefined) updateData.status = data.status;
  if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt;
  if (data.failedAt !== undefined) updateData.failedAt = data.failedAt;
  if (data.permalink !== undefined) updateData.permalink = data.permalink;
  if (data.externalPostId !== undefined) updateData.externalPostId = data.externalPostId;
  if (data.jobId !== undefined) updateData.jobId = data.jobId;

  if (data.providerResponseJson !== undefined) {
    updateData.providerResponseJson = data.providerResponseJson as Prisma.InputJsonValue;
  }

  return prisma.publication.update({
    where: { id },
    data: updateData,
  });
}

// ====================
// Read Operations
// ====================

/**
 * Get publication by ID
 */
export async function getPublicationById(id: string): Promise<Publication | null> {
  return prisma.publication.findUnique({
    where: { id },
  });
}

/**
 * Get publication by ID with workspace validation
 */
export async function getPublicationByIdAndWorkspace(
  id: string,
  workspaceId: string
): Promise<Publication | null> {
  return prisma.publication.findFirst({
    where: {
      id,
      workspaceId,
    },
  });
}

/**
 * Get publication with related data (socialAccount, brand)
 */
export async function getPublicationWithRelations(id: string) {
  return prisma.publication.findUnique({
    where: { id },
    include: {
      socialAccount: true,
      brand: true,
      workspace: true,
    },
  });
}

/**
 * Get publication by client request ID (for idempotency)
 */
export async function getPublicationByClientRequestId(
  workspaceId: string,
  brandId: string,
  clientRequestId: string
): Promise<Publication | null> {
  return prisma.publication.findFirst({
    where: {
      workspaceId,
      brandId,
      clientRequestId,
    },
  });
}

// ====================
// List Operations
// ====================

export interface ListPublicationsParams {
  workspaceId: string;
  brandId: string;
  limit: number;
  cursor?: string | null;
  status?: PublicationStatus;
  platform?: PublicationPlatform;
}

export interface ListPublicationsResult {
  items: Publication[];
  nextCursor: string | null;
}

/**
 * List publications for a brand with cursor pagination
 */
export async function listByBrand(
  params: ListPublicationsParams
): Promise<ListPublicationsResult> {
  const { workspaceId, brandId, limit, cursor, status, platform } = params;

  const where: Prisma.PublicationWhereInput = {
    workspaceId,
    brandId,
  };

  if (status) {
    where.status = status;
  }

  if (platform) {
    where.platform = platform;
  }

  // Cursor-based pagination
  if (cursor) {
    const cursorPublication = await prisma.publication.findUnique({
      where: { id: cursor },
      select: { createdAt: true, id: true },
    });

    if (cursorPublication) {
      where.OR = [
        { createdAt: { lt: cursorPublication.createdAt } },
        {
          createdAt: cursorPublication.createdAt,
          id: { lt: cursorPublication.id },
        },
      ];
    }
  }

  const publications = await prisma.publication.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  let nextCursor: string | null = null;
  if (publications.length > limit) {
    const lastItem = publications[publications.length - 1];
    nextCursor = lastItem.id;
    publications.pop();
  }

  return { items: publications, nextCursor };
}

// ====================
// Scheduled Publications (for worker)
// ====================

/**
 * Get publications ready for processing
 * Returns scheduled publications where scheduledAt <= now
 */
export async function getScheduledPublicationsReady(
  platform?: PublicationPlatform,
  limit: number = 100
): Promise<Publication[]> {
  const where: Prisma.PublicationWhereInput = {
    status: "scheduled",
    OR: [
      { scheduledAt: { lte: new Date() } },
      { scheduledAt: null }, // Immediate publish
    ],
  };

  if (platform) {
    where.platform = platform;
  }

  return prisma.publication.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
}

// ====================
// Export as object for consistency
// ====================

export const publicationRepository = {
  createPublication,
  updatePublicationStatus,
  getPublicationById,
  getPublicationByIdAndWorkspace,
  getPublicationWithRelations,
  getPublicationByClientRequestId,
  listByBrand,
  getScheduledPublicationsReady,
};

