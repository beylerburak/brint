/**
 * Brand Service
 * 
 * Business logic layer for Brand domain.
 * Handles readiness calculation, change tracking, and activity logging.
 */

import type { Brand, BrandHashtagPreset } from "@prisma/client";
import * as brandRepository from "./brand.repository.js";
import type {
  BrandChangeDiff,
  ReadinessScoreResult,
  CreateBrandInput,
  UpdateBrandInput,
  CreateHashtagPresetInput,
  UpdateHashtagPresetInput,
} from "./brand.types.js";
import { logActivity } from "../activity/activity.service.js";
import { BadRequestError, NotFoundError } from "../../lib/http-errors.js";
import { slugify, generateUniqueSlug } from "../../lib/slugify.js";
import type { FastifyRequest } from "fastify";

// ====================
// Readiness Calculation
// ====================

/**
 * Calculate brand readiness score
 * 
 * Score breakdown:
 * - profileCompleted: +40 points
 * - hasAtLeastOneSocialAccount: +40 points
 * - publishingDefaultsConfigured: +20 points
 * 
 * @param brand - Brand entity
 * @returns Readiness score result
 */
export function calculateReadinessScore(brand: Brand): ReadinessScoreResult {
  let score = 0;

  if (brand.profileCompleted) {
    score += 40;
  }

  if (brand.hasAtLeastOneSocialAccount) {
    score += 40;
  }

  if (brand.publishingDefaultsConfigured) {
    score += 20;
  }

  return {
    score,
    profileCompleted: brand.profileCompleted,
    hasAtLeastOneSocialAccount: brand.hasAtLeastOneSocialAccount,
    publishingDefaultsConfigured: brand.publishingDefaultsConfigured,
  };
}

/**
 * Check if brand profile should be marked as completed
 * 
 * Profile is complete when all required fields are filled:
 * - name (required for create)
 * - description
 * - industry
 * - language
 * - timezone
 */
export function shouldMarkProfileComplete(brand: Brand): boolean {
  return !!(
    brand.name &&
    brand.description &&
    brand.industry &&
    brand.language &&
    brand.timezone
  );
}

// ====================
// Change Tracking
// ====================

/**
 * Fields to track for change diff
 */
const TRACKED_FIELDS = [
  "name",
  "slug",
  "description",
  "industry",
  "language",
  "timezone",
  "toneOfVoice",
  "primaryColor",
  "secondaryColor",
  "websiteUrl",
] as const;

/**
 * Calculate the diff between old and new brand data
 * 
 * @param oldBrand - Brand before update
 * @param newData - Update input data
 * @returns Object with changed fields and their before/after values
 */
export function calculateBrandChangeDiff(
  oldBrand: Brand,
  newData: UpdateBrandInput
): BrandChangeDiff {
  const changes: BrandChangeDiff = {};

  for (const field of TRACKED_FIELDS) {
    if (field in newData) {
      const oldValue = oldBrand[field];
      const newValue = newData[field as keyof UpdateBrandInput];

      // Only track if value actually changed
      if (oldValue !== newValue) {
        changes[field] = {
          before: oldValue,
          after: newValue,
        };
      }
    }
  }

  return changes;
}

// ====================
// Brand Service Functions
// ====================

export interface ListBrandsParams {
  workspaceId: string;
  limit?: number;
  cursor?: string | null;
  includeArchived?: boolean;
}

export interface ListBrandsResult {
  items: Brand[];
  nextCursor: string | null;
}

/**
 * List brands for a workspace
 */
export async function listBrands(params: ListBrandsParams): Promise<ListBrandsResult> {
  const { workspaceId, limit = 50, cursor, includeArchived = false } = params;

  return brandRepository.listBrands({
    workspaceId,
    limit,
    cursor,
    includeArchived,
  });
}

/**
 * Get a brand by ID with workspace validation
 */
export async function getBrand(brandId: string, workspaceId: string): Promise<Brand> {
  const brand = await brandRepository.getBrandById(brandId);

  if (!brand) {
    throw new NotFoundError("BRAND_NOT_FOUND", "Brand not found", { brandId });
  }

  if (brand.workspaceId !== workspaceId) {
    throw new NotFoundError("BRAND_NOT_FOUND", "Brand not found", { brandId });
  }

  return brand;
}

/**
 * Get a brand by slug with workspace validation
 */
export async function getBrandBySlug(slug: string, workspaceId: string): Promise<Brand> {
  const brand = await brandRepository.getBrandBySlug(workspaceId, slug);

  if (!brand) {
    throw new NotFoundError("BRAND_NOT_FOUND", "Brand not found", { slug });
  }

  return brand;
}

export interface CreateBrandParams {
  workspaceId: string;
  input: CreateBrandInput;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Create a new brand
 * 
 * If slug is not provided, it will be generated from the name.
 * If the generated slug is already taken, a random suffix will be appended.
 */
export async function createBrand(params: CreateBrandParams): Promise<Brand> {
  const { workspaceId, input, userId, request } = params;

  // Generate slug from name if not provided
  let slug = input.slug;
  if (!slug) {
    slug = slugify(input.name);
    
    // If generated slug is empty (e.g., name was only special chars), use a fallback
    if (!slug) {
      slug = `brand-${Date.now()}`;
    }
  }

  // Check if slug is already taken
  let slugTaken = await brandRepository.isSlugTaken(workspaceId, slug);
  
  // If slug was auto-generated and is taken, append a random suffix
  if (slugTaken && !input.slug) {
    // Try up to 5 times with random suffixes
    for (let attempt = 0; attempt < 5; attempt++) {
      slug = generateUniqueSlug(slugify(input.name) || 'brand', 4);
      slugTaken = await brandRepository.isSlugTaken(workspaceId, slug);
      if (!slugTaken) break;
    }
  }

  // If slug is still taken (either user-provided or all retries failed), throw error
  if (slugTaken) {
    throw new BadRequestError("SLUG_TAKEN", `Slug "${slug}" is already in use`);
  }

  // Create brand with default readiness values
  const brand = await brandRepository.createBrand({
    workspaceId,
    name: input.name,
    slug, // Use resolved slug (may be auto-generated)
    description: input.description,
    industry: input.industry,
    language: input.language,
    timezone: input.timezone,
    toneOfVoice: input.toneOfVoice,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    websiteUrl: input.websiteUrl,
    createdBy: userId,
  });

  // Log activity
  void logActivity({
    type: "brand.created",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "brand",
    scopeId: brand.id,
    metadata: {
      name: brand.name,
      slug: brand.slug,
      readinessScore: brand.readinessScore,
    },
    request,
  });

  return brand;
}

export interface UpdateBrandParams {
  brandId: string;
  workspaceId: string;
  input: UpdateBrandInput;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Update a brand
 */
export async function updateBrand(params: UpdateBrandParams): Promise<Brand> {
  const { brandId, workspaceId, input, userId, request } = params;

  // Get existing brand
  const oldBrand = await getBrand(brandId, workspaceId);

  // Check slug uniqueness if being changed
  if (input.slug && input.slug !== oldBrand.slug) {
    const slugTaken = await brandRepository.isSlugTaken(workspaceId, input.slug, brandId);
    if (slugTaken) {
      throw new BadRequestError("SLUG_TAKEN", `Slug "${input.slug}" is already in use`);
    }
  }

  // Calculate changes
  const changes = calculateBrandChangeDiff(oldBrand, input);

  // Check if profile completion criteria will be met
  const updatedProfileData = {
    ...oldBrand,
    ...input,
  };
  const shouldCompleteProfile = shouldMarkProfileComplete(updatedProfileData as Brand);
  const wasProfileIncomplete = !oldBrand.profileCompleted;
  const profileJustCompleted = shouldCompleteProfile && wasProfileIncomplete;

  // Prepare update data
  const updateData: brandRepository.UpdateBrandData = {
    ...input,
    updatedBy: userId,
  };

  // If profile just completed, update the flag
  if (profileJustCompleted) {
    updateData.profileCompleted = true;
  }

  // Calculate new readiness score
  const tempBrand = {
    ...oldBrand,
    ...updateData,
    profileCompleted: updateData.profileCompleted ?? oldBrand.profileCompleted,
  };
  const readinessResult = calculateReadinessScore(tempBrand as Brand);
  updateData.readinessScore = readinessResult.score;

  // Update brand
  const updatedBrand = await brandRepository.updateBrand(brandId, updateData);

  // Log activity for update (only if something changed)
  if (Object.keys(changes).length > 0) {
    void logActivity({
      type: "brand.updated",
      workspaceId,
      userId,
      actorType: "user",
      source: "api",
      scopeType: "brand",
      scopeId: brandId,
      metadata: {
        name: updatedBrand.name,
        changes,
      },
      request,
    });
  }

  // Log profile completion if just happened
  if (profileJustCompleted) {
    void logActivity({
      type: "brand.profile_completed",
      workspaceId,
      userId,
      actorType: "user",
      source: "api",
      scopeType: "brand",
      scopeId: brandId,
      metadata: {
        name: updatedBrand.name,
        previousScore: oldBrand.readinessScore,
        newScore: updatedBrand.readinessScore,
      },
      request,
    });
  }

  return updatedBrand;
}

export interface ArchiveBrandParams {
  brandId: string;
  workspaceId: string;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Archive (soft delete) a brand
 */
export async function archiveBrand(params: ArchiveBrandParams): Promise<Brand> {
  const { brandId, workspaceId, userId, request } = params;

  // Validate brand exists and belongs to workspace
  const brand = await getBrand(brandId, workspaceId);

  // Archive the brand
  const archivedBrand = await brandRepository.archiveBrand(brandId, userId);

  // Log activity
  void logActivity({
    type: "brand.deleted",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "brand",
    scopeId: brandId,
    metadata: {
      name: brand.name,
      softDeleted: true,
    },
    request,
  });

  return archivedBrand;
}

// ====================
// Hashtag Preset Service Functions
// ====================

export interface ListHashtagPresetsParams {
  brandId: string;
  workspaceId: string;
}

/**
 * List hashtag presets for a brand
 */
export async function listHashtagPresets(params: ListHashtagPresetsParams): Promise<BrandHashtagPreset[]> {
  const { brandId, workspaceId } = params;

  // Validate brand exists and belongs to workspace
  await getBrand(brandId, workspaceId);

  return brandRepository.listHashtagPresets({
    workspaceId,
    brandId,
  });
}

/**
 * Get a hashtag preset by ID with brand/workspace validation
 */
export async function getHashtagPreset(
  presetId: string,
  brandId: string,
  workspaceId: string
): Promise<BrandHashtagPreset> {
  // Validate brand first
  await getBrand(brandId, workspaceId);

  const preset = await brandRepository.getHashtagPresetById(presetId);

  if (!preset) {
    throw new NotFoundError("HASHTAG_PRESET_NOT_FOUND", "Hashtag preset not found", { presetId });
  }

  if (preset.brandId !== brandId || preset.workspaceId !== workspaceId) {
    throw new NotFoundError("HASHTAG_PRESET_NOT_FOUND", "Hashtag preset not found", { presetId });
  }

  return preset;
}

export interface CreateHashtagPresetParams {
  brandId: string;
  workspaceId: string;
  input: CreateHashtagPresetInput;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Create a new hashtag preset
 */
export async function createHashtagPreset(params: CreateHashtagPresetParams): Promise<BrandHashtagPreset> {
  const { brandId, workspaceId, input, userId, request } = params;

  // Validate brand exists and belongs to workspace
  const brand = await getBrand(brandId, workspaceId);

  // Create preset
  const preset = await brandRepository.createHashtagPreset({
    workspaceId,
    brandId,
    name: input.name,
    tags: input.tags,
  });

  // Count presets for metadata
  const presetCount = await brandRepository.countHashtagPresets(brandId);

  // Log activity as brand.updated
  void logActivity({
    type: "brand.updated",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "brand",
    scopeId: brandId,
    metadata: {
      name: brand.name,
      changes: {
        hashtagPresetsCount: {
          before: presetCount - 1,
          after: presetCount,
        },
      },
    },
    request,
  });

  return preset;
}

export interface UpdateHashtagPresetParams {
  presetId: string;
  brandId: string;
  workspaceId: string;
  input: UpdateHashtagPresetInput;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Update a hashtag preset
 */
export async function updateHashtagPreset(params: UpdateHashtagPresetParams): Promise<BrandHashtagPreset> {
  const { presetId, brandId, workspaceId, input, userId, request } = params;

  // Validate preset exists and belongs to brand/workspace
  await getHashtagPreset(presetId, brandId, workspaceId);

  // Get brand for logging
  const brand = await getBrand(brandId, workspaceId);

  // Update preset
  const updatedPreset = await brandRepository.updateHashtagPreset(presetId, input);

  // Log activity as brand.updated
  void logActivity({
    type: "brand.updated",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "brand",
    scopeId: brandId,
    metadata: {
      name: brand.name,
      changes: {
        hashtagPresets: {
          action: "updated",
          presetId,
          presetName: updatedPreset.name,
        },
      },
    },
    request,
  });

  return updatedPreset;
}

export interface DeleteHashtagPresetParams {
  presetId: string;
  brandId: string;
  workspaceId: string;
  userId: string;
  request?: FastifyRequest;
}

/**
 * Delete a hashtag preset
 */
export async function deleteHashtagPreset(params: DeleteHashtagPresetParams): Promise<void> {
  const { presetId, brandId, workspaceId, userId, request } = params;

  // Validate preset exists and belongs to brand/workspace
  const preset = await getHashtagPreset(presetId, brandId, workspaceId);

  // Get brand for logging
  const brand = await getBrand(brandId, workspaceId);

  // Count presets before delete
  const presetCountBefore = await brandRepository.countHashtagPresets(brandId);

  // Delete preset
  await brandRepository.deleteHashtagPreset(presetId);

  // Log activity as brand.updated
  void logActivity({
    type: "brand.updated",
    workspaceId,
    userId,
    actorType: "user",
    source: "api",
    scopeType: "brand",
    scopeId: brandId,
    metadata: {
      name: brand.name,
      changes: {
        hashtagPresetsCount: {
          before: presetCountBefore,
          after: presetCountBefore - 1,
        },
      },
    },
    request,
  });
}

