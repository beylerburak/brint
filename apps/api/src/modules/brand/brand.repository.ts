/**
 * Brand Repository
 * 
 * Prisma data access layer for Brand domain.
 * All database operations go through this repository.
 */

import { prisma } from "../../lib/prisma.js";
import type { Brand, BrandHashtagPreset, Prisma } from "@prisma/client";

// ====================
// Brand Repository
// ====================

export interface ListBrandsParams {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  includeArchived?: boolean;
}

export interface ListBrandsResult {
  items: Brand[];
  nextCursor: string | null;
}

/**
 * List brands for a workspace with cursor pagination
 */
export async function listBrands(params: ListBrandsParams): Promise<ListBrandsResult> {
  const { workspaceId, limit, cursor, includeArchived = false } = params;

  const where: Prisma.BrandWhereInput = {
    workspaceId,
    ...(includeArchived ? {} : { isArchived: false }),
  };

  // If cursor provided, get items after that cursor
  if (cursor) {
    const cursorBrand = await prisma.brand.findUnique({
      where: { id: cursor },
      select: { createdAt: true, id: true },
    });

    if (cursorBrand) {
      // Get items older than cursor (descending order by createdAt)
      where.OR = [
        { createdAt: { lt: cursorBrand.createdAt } },
        {
          createdAt: cursorBrand.createdAt,
          id: { lt: cursorBrand.id },
        },
      ];
    }
  }

  const brands = await prisma.brand.findMany({
    where,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: limit + 1, // Fetch one extra to check if there's a next page
  });

  let nextCursor: string | null = null;
  if (brands.length > limit) {
    const lastItem = brands[brands.length - 1];
    nextCursor = lastItem.id;
    brands.pop(); // Remove extra item
  }

  return { items: brands, nextCursor };
}

/**
 * Get a single brand by ID
 */
export async function getBrandById(id: string): Promise<Brand | null> {
  return prisma.brand.findUnique({
    where: { id },
  });
}

/**
 * Get a brand by workspace and slug
 */
export async function getBrandBySlug(workspaceId: string, slug: string): Promise<Brand | null> {
  return prisma.brand.findUnique({
    where: {
      workspaceId_slug: { workspaceId, slug },
    },
  });
}

/**
 * Check if a slug is already taken in a workspace
 */
export async function isSlugTaken(workspaceId: string, slug: string, excludeBrandId?: string): Promise<boolean> {
  const existing = await prisma.brand.findFirst({
    where: {
      workspaceId,
      slug,
      ...(excludeBrandId ? { id: { not: excludeBrandId } } : {}),
    },
    select: { id: true },
  });
  return !!existing;
}

export interface CreateBrandData {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  industry?: string | null;
  language?: string | null;
  timezone?: string | null;
  toneOfVoice?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  websiteUrl?: string | null;
  createdBy?: string | null;
}

/**
 * Create a new brand
 */
export async function createBrand(data: CreateBrandData): Promise<Brand> {
  return prisma.brand.create({
    data: {
      workspaceId: data.workspaceId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      industry: data.industry ?? null,
      language: data.language ?? null,
      timezone: data.timezone ?? null,
      toneOfVoice: data.toneOfVoice ?? null,
      primaryColor: data.primaryColor ?? null,
      secondaryColor: data.secondaryColor ?? null,
      websiteUrl: data.websiteUrl ?? null,
      createdBy: data.createdBy ?? null,
      // Wizard / readiness defaults
      profileCompleted: false,
      hasAtLeastOneSocialAccount: false,
      publishingDefaultsConfigured: false,
      readinessScore: 0,
      isArchived: false,
      isActive: true,
    },
  });
}

export interface UpdateBrandData {
  name?: string;
  slug?: string;
  description?: string | null;
  industry?: string | null;
  language?: string | null;
  timezone?: string | null;
  toneOfVoice?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  websiteUrl?: string | null;
  profileCompleted?: boolean;
  hasAtLeastOneSocialAccount?: boolean;
  publishingDefaultsConfigured?: boolean;
  readinessScore?: number;
  isArchived?: boolean;
  updatedBy?: string | null;
}

/**
 * Update a brand
 */
export async function updateBrand(id: string, data: UpdateBrandData): Promise<Brand> {
  return prisma.brand.update({
    where: { id },
    data,
  });
}

/**
 * Soft delete (archive) a brand
 * Also updates slug to free it up for reuse (appends _archived_{timestamp})
 */
export async function archiveBrand(id: string, updatedBy?: string): Promise<Brand> {
  // Get current brand to modify slug
  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { slug: true },
  });

  if (!brand) {
    throw new Error("Brand not found");
  }

  // Append _archived_{timestamp} to free up the slug
  const archivedSlug = `${brand.slug}_archived_${Date.now()}`;

  return prisma.brand.update({
    where: { id },
    data: {
      isArchived: true,
      slug: archivedSlug,
      updatedBy: updatedBy ?? null,
    },
  });
}

/**
 * Hard delete a brand (use with caution)
 */
export async function deleteBrand(id: string): Promise<Brand> {
  return prisma.brand.delete({
    where: { id },
  });
}

// ====================
// Hashtag Preset Repository
// ====================

export interface ListHashtagPresetsParams {
  workspaceId: string;
  brandId: string;
}

/**
 * List hashtag presets for a brand
 */
export async function listHashtagPresets(params: ListHashtagPresetsParams): Promise<BrandHashtagPreset[]> {
  return prisma.brandHashtagPreset.findMany({
    where: {
      workspaceId: params.workspaceId,
      brandId: params.brandId,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single hashtag preset by ID
 */
export async function getHashtagPresetById(id: string): Promise<BrandHashtagPreset | null> {
  return prisma.brandHashtagPreset.findUnique({
    where: { id },
  });
}

export interface CreateHashtagPresetData {
  workspaceId: string;
  brandId: string;
  name: string;
  tags: string[];
}

/**
 * Create a new hashtag preset
 */
export async function createHashtagPreset(data: CreateHashtagPresetData): Promise<BrandHashtagPreset> {
  return prisma.brandHashtagPreset.create({
    data: {
      workspaceId: data.workspaceId,
      brandId: data.brandId,
      name: data.name,
      tags: data.tags,
    },
  });
}

export interface UpdateHashtagPresetData {
  name?: string;
  tags?: string[];
}

/**
 * Update a hashtag preset
 */
export async function updateHashtagPreset(id: string, data: UpdateHashtagPresetData): Promise<BrandHashtagPreset> {
  return prisma.brandHashtagPreset.update({
    where: { id },
    data,
  });
}

/**
 * Delete a hashtag preset
 */
export async function deleteHashtagPreset(id: string): Promise<BrandHashtagPreset> {
  return prisma.brandHashtagPreset.delete({
    where: { id },
  });
}

/**
 * Count hashtag presets for a brand
 */
export async function countHashtagPresets(brandId: string): Promise<number> {
  return prisma.brandHashtagPreset.count({
    where: { brandId },
  });
}

