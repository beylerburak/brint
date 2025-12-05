/**
 * Brand Service
 * 
 * Handles Brand CRUD operations with validation.
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { z } from 'zod';
import type { BrandStatus, WorkspacePlan, BrandContactType, Prisma } from '@prisma/client';
import { ActivityActorType } from '@prisma/client';
import { APP_CONFIG } from '../../config/app-config.js';
import { logActivity, buildBrandActivity } from '../../core/activity/activity-log.service.js';
import {
  BrandProfileDataSchema,
  type BrandProfileData,
  type CreateBrandContactChannelInput,
  type UpdateBrandContactChannelInput,
  CreateBrandContactChannelSchema,
  UpdateBrandContactChannelSchema,
} from './domain/brand-profile.schema.js';
import { calculateBrandOptimizationScore } from './utils/brand-optimization-score.js';
import { cacheService, CacheKeys } from '../../core/cache/cache.service.js';

/**
 * Helper to convert nullable JSON to Prisma-compatible format
 */
function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

const CreateBrandSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  primaryLocale: z.string().optional(),
  timezone: z.string().optional(),
  logoMediaId: z.string().optional(),
});

const UpdateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  primaryLocale: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  logoMediaId: z.string().nullable().optional(),
});

export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;

/**
 * Check if a slug is available
 */
export async function isBrandSlugAvailable(slug: string, excludeBrandId?: string): Promise<boolean> {
  const existing = await prisma.brand.findFirst({
    where: {
      slug,
      ...(excludeBrandId ? { id: { not: excludeBrandId } } : {}),
    },
  });

  return !existing;
}

/**
 * Create a new brand
 */
export async function createBrand(
  workspaceId: string,
  data: CreateBrandInput,
  userId?: string
) {
  logger.info({ workspaceId, slug: data.slug }, 'Creating brand');

  // Validate input
  const validated = CreateBrandSchema.parse(data);

  // Check slug availability
  const available = await isBrandSlugAvailable(validated.slug);
  if (!available) {
    throw new Error('SLUG_TAKEN');
  }

  // Create brand
  const brand = await prisma.brand.create({
    data: {
      workspaceId,
      name: validated.name,
      slug: validated.slug,
      description: validated.description,
      industry: validated.industry,
      country: validated.country,
      city: validated.city,
      primaryLocale: validated.primaryLocale,
      timezone: validated.timezone,
      logoMediaId: validated.logoMediaId,
    },
  });

  logger.info({ brandId: brand.id, slug: brand.slug }, 'Brand created');

  // Invalidate brands list cache
  await cacheService.delete(CacheKeys.patterns.allBrands(workspaceId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId: brand.id,
      entityId: brand.id,
      eventKey: 'brand.created',
      message: `Brand created: ${brand.name}`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      payload: {
        name: brand.name,
        slug: brand.slug,
        industry: brand.industry,
        country: brand.country,
        city: brand.city,
      },
    })
  );

  return brand;
}

/**
 * Update brand
 */
export async function updateBrand(
  brandId: string,
  workspaceId: string,
  data: UpdateBrandInput,
  userId?: string
) {
  logger.info({ brandId, workspaceId }, 'Updating brand');

  // Validate input
  const validated = UpdateBrandSchema.parse(data);

  // Check slug availability if slug is being changed
  if (validated.slug) {
    const available = await isBrandSlugAvailable(validated.slug, brandId);
    if (!available) {
      throw new Error('SLUG_TAKEN');
    }
  }

  // Update brand
  const brand = await prisma.brand.update({
    where: {
      id: brandId,
      workspaceId, // Ensure brand belongs to workspace
    },
    data: validated,
  });

  logger.info({ brandId }, 'Brand updated');

  // Invalidate brand and brands list cache
  await cacheService.delete(CacheKeys.brand(brandId));
  await cacheService.delete(CacheKeys.patterns.allBrands(workspaceId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: brandId,
      eventKey: 'brand.updated',
      message: `Brand updated: ${brand.name}`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      context: 'brand_profile',
      payload: validated,
    })
  );

  return brand;
}

/**
 * Delete brand
 */
export async function deleteBrand(
  brandId: string,
  workspaceId: string,
  userId?: string
) {
  logger.info({ brandId, workspaceId }, 'Deleting brand');

  // Get brand info before deletion
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId },
    select: { id: true, name: true, slug: true },
  });

  if (!brand) {
    throw new Error('BRAND_NOT_FOUND');
  }

  // Delete brand
  await prisma.brand.delete({
    where: {
      id: brandId,
      workspaceId, // Ensure brand belongs to workspace
    },
  });

  logger.info({ brandId }, 'Brand deleted');

  // Invalidate brand and brands list cache
  await cacheService.delete(CacheKeys.patterns.allBrandData(brandId));
  await cacheService.delete(CacheKeys.patterns.allBrands(workspaceId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: brandId,
      eventKey: 'brand.deleted',
      message: `Brand deleted: ${brand.name}`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      payload: {
        name: brand.name,
        slug: brand.slug,
      },
    })
  );
}

/**
 * Get brand by ID with full details including profile and contact channels
 * Uses Redis cache with 5 minute TTL
 */
export async function getBrandById(brandId: string, workspaceId: string) {
  const cacheKey = CacheKeys.brand(brandId);

  // Try cache first
  const cached = await cacheService.get<any>(cacheKey);
  if (cached) {
    logger.debug({ brandId }, 'Brand loaded from Redis cache');
    return cached;
  }

  // Cache miss - fetch from database
  const brand = await prisma.brand.findFirst({
    where: {
      id: brandId,
      workspaceId,
    },
    include: {
      _count: {
        select: {
          media: true,
        },
      },
      contactChannels: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
      profile: true,
      logoMedia: {
        select: {
          id: true,
          baseKey: true,
          bucket: true,
          variants: true,
          isPublic: true,
        },
      },
    },
  });

  // Cache the result (5 minutes TTL)
  if (brand) {
    await cacheService.set(cacheKey, brand, 300);
  }

  return brand;
}

/**
 * Get brand by slug with full details
 */
export async function getBrandBySlug(slug: string, workspaceId: string) {
  const brand = await prisma.brand.findFirst({
    where: {
      slug,
      workspaceId,
    },
    include: {
      _count: {
        select: {
          media: true,
        },
      },
      contactChannels: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
      profile: true,
      logoMedia: {
        select: {
          id: true,
          baseKey: true,
          bucket: true,
          variants: true,
          isPublic: true,
        },
      },
    },
  });

  return brand;
}

/**
 * List brands in workspace
 * Uses Redis cache with 3 minute TTL
 */
export async function listBrands(
  workspaceId: string,
  options?: {
    status?: BrandStatus;
    limit?: number;
    offset?: number;
  }
) {
  // Only cache if no pagination (limit/offset)
  const shouldCache = !options?.limit && !options?.offset;
  const cacheKey = CacheKeys.brandsList(workspaceId, options?.status);

  if (shouldCache) {
    // Try cache first
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      logger.debug({ workspaceId, status: options?.status }, 'Brands list loaded from Redis cache');
      return cached;
    }
  }

  // Cache miss or pagination - fetch from database
  const brands = await prisma.brand.findMany({
    where: {
      workspaceId,
      ...(options?.status ? { status: options.status } : {}),
    },
    include: {
      _count: {
        select: {
          media: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit,
    skip: options?.offset,
  });

  // Cache the result (3 minutes TTL) - only if no pagination
  if (shouldCache) {
    await cacheService.set(cacheKey, brands, 180);
  }

  return brands;
}

// ============================================================================
// Brand Profile Functions
// ============================================================================

/**
 * Update brand profile data
 * Creates profile if it doesn't exist (upsert)
 * Automatically calculates and saves optimization score after update
 */
export async function updateBrandProfile(input: {
  brandId: string;
  workspaceId: string;
  profileData: unknown;
  optimizationScore?: number | null;
  editorUserId: string;
}) {
  logger.info({ brandId: input.brandId }, 'Updating brand profile');

  // Validate profile data with Zod
  const parsed = BrandProfileDataSchema.parse(input.profileData);

  // Get existing profile for conditional updates
  const existing = await prisma.brandProfile.findUnique({
    where: { brandId: input.brandId },
  });

  const dataToSave = parsed as BrandProfileData;

  const profile = await prisma.brandProfile.upsert({
    where: { brandId: input.brandId },
    create: {
      brandId: input.brandId,
      data: dataToSave,
      optimizationScore: input.optimizationScore ?? null,
      optimizationScoreUpdatedAt: input.optimizationScore != null ? new Date() : null,
      lastEditedByUserId: input.editorUserId,
      lastEditedAt: new Date(),
    },
    update: {
      data: dataToSave,
      optimizationScore:
        input.optimizationScore != null ? input.optimizationScore : existing?.optimizationScore,
      optimizationScoreUpdatedAt:
        input.optimizationScore != null ? new Date() : existing?.optimizationScoreUpdatedAt,
      lastEditedByUserId: input.editorUserId,
      lastEditedAt: new Date(),
    },
  });

  logger.info({ brandId: input.brandId, profileId: profile.id }, 'Brand profile updated');

  // Automatically calculate and update optimization score
  let finalScore: number | null = profile.optimizationScore;
  let scoreChange: number | null = null;
  
  try {
    // Get brand with full details for score calculation
    const brand = await getBrandById(input.brandId, input.workspaceId);
    
    if (brand) {
      // Generate logoUrl if logo exists
      let logoUrl: string | null = null;
      if (brand.logoMedia) {
        const { getMediaVariantUrlAsync } = await import('../../core/storage/s3-url.js');
        logoUrl = await getMediaVariantUrlAsync(
          brand.logoMedia.bucket,
          brand.logoMedia.variants,
          'small',
          brand.logoMedia.isPublic
        );
      }

      // Prepare brand data for score calculation
      const brandData = {
        ...brand,
        logoUrl,
        profile: {
          ...brand.profile,
          data: dataToSave, // Use the newly saved data
        },
      };

      // Calculate optimization score
      const scoreResult = calculateBrandOptimizationScore(brandData);
      
      // Calculate score change
      const previousScore = existing?.optimizationScore;
      if (previousScore !== null && previousScore !== undefined) {
        scoreChange = scoreResult.score - previousScore;
      }

      // Update profile with new score
      await prisma.brandProfile.update({
        where: { brandId: input.brandId },
        data: {
          optimizationScore: scoreResult.score,
          optimizationScoreUpdatedAt: new Date(),
        },
      });

      logger.info(
        { brandId: input.brandId, score: scoreResult.score, change: scoreChange },
        'Optimization score auto-calculated and updated'
      );

      finalScore = scoreResult.score;

      // Invalidate brand cache (profile updated)
      await cacheService.delete(CacheKeys.brand(input.brandId));

      // Log activity with optimization score update
      await logActivity(
        buildBrandActivity({
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          entityId: input.brandId,
          eventKey: 'brand.profile_updated',
          message: `Brand profile updated (optimization score: ${scoreResult.score}%)`,
          actorType: ActivityActorType.USER,
          actorUserId: input.editorUserId,
          context: 'brand_profile',
          payload: {
            brandId: input.brandId,
            optimizationScore: scoreResult.score,
            previousScore: previousScore ?? null,
            scoreChange: scoreChange,
            autoCalculated: true,
          },
        })
      );

      // Return updated profile with new score
      return {
        ...profile,
        optimizationScore: scoreResult.score,
        optimizationScoreUpdatedAt: new Date(),
      };
    }
  } catch (error) {
    logger.error(
      { error, brandId: input.brandId },
      'Failed to auto-calculate optimization score, continuing anyway'
    );
    // Don't fail the whole profile update if score calculation fails
    
    // Invalidate brand cache anyway
    await cacheService.delete(CacheKeys.brand(input.brandId));
    
    // Log activity without optimization score
    await logActivity(
      buildBrandActivity({
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        entityId: input.brandId,
        eventKey: 'brand.profile_updated',
        message: 'Brand profile updated',
        actorType: ActivityActorType.USER,
        actorUserId: input.editorUserId,
        context: 'brand_profile',
        payload: {
          brandId: input.brandId,
          optimizationScore: finalScore,
          autoCalculationFailed: true,
        },
      })
    );
  }

  return profile;
}

/**
 * Get brand profile by brand ID
 */
export async function getBrandProfile(brandId: string) {
  const profile = await prisma.brandProfile.findUnique({
    where: { brandId },
  });

  return profile;
}

// ============================================================================
// Brand Contact Channel Functions
// ============================================================================

/**
 * List contact channels for a brand
 */
export async function listBrandContactChannels(brandId: string) {
  const channels = await prisma.brandContactChannel.findMany({
    where: { brandId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  return channels;
}

/**
 * Create a new contact channel for a brand
 */
export async function createBrandContactChannel(
  brandId: string,
  workspaceId: string,
  data: CreateBrandContactChannelInput,
  userId?: string
) {
  logger.info({ brandId, type: data.type }, 'Creating brand contact channel');

  const validated = CreateBrandContactChannelSchema.parse(data);

  const channel = await prisma.brandContactChannel.create({
    data: {
      brandId,
      type: validated.type,
      label: validated.label,
      value: validated.value,
      isPrimary: validated.isPrimary ?? false,
      order: validated.order ?? 0,
      metaJson: toPrismaJson(validated.metaJson),
    },
  });

  logger.info({ channelId: channel.id, brandId }, 'Brand contact channel created');

  // Invalidate brand cache (contact channels updated)
  await cacheService.delete(CacheKeys.brand(brandId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: channel.id,
      eventKey: 'brand.contact_channel_created',
      message: `Contact channel created: ${channel.type}`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      context: 'brand_contacts',
      payload: {
        channelId: channel.id,
        type: channel.type,
        label: channel.label,
        isPrimary: channel.isPrimary,
      },
    })
  );

  return channel;
}

/**
 * Update a contact channel
 */
export async function updateBrandContactChannel(
  channelId: string,
  brandId: string,
  workspaceId: string,
  data: UpdateBrandContactChannelInput,
  userId?: string
) {
  logger.info({ channelId, brandId }, 'Updating brand contact channel');

  const validated = UpdateBrandContactChannelSchema.parse(data);

  // Ensure channel belongs to the brand
  const existing = await prisma.brandContactChannel.findFirst({
    where: { id: channelId, brandId },
  });

  if (!existing) {
    throw new Error('CONTACT_CHANNEL_NOT_FOUND');
  }

  // Build update data, handling metaJson separately for Prisma compatibility
  const updateData: Prisma.BrandContactChannelUpdateInput = {
    ...(validated.type !== undefined && { type: validated.type }),
    ...(validated.label !== undefined && { label: validated.label }),
    ...(validated.value !== undefined && { value: validated.value }),
    ...(validated.isPrimary !== undefined && { isPrimary: validated.isPrimary }),
    ...(validated.order !== undefined && { order: validated.order }),
    ...(validated.metaJson !== undefined && { metaJson: toPrismaJson(validated.metaJson) }),
  };

  const channel = await prisma.brandContactChannel.update({
    where: { id: channelId },
    data: updateData,
  });

  logger.info({ channelId }, 'Brand contact channel updated');

  // Invalidate brand cache (contact channels updated)
  await cacheService.delete(CacheKeys.brand(brandId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: channel.id,
      eventKey: 'brand.contact_channel_updated',
      message: `Contact channel updated: ${channel.type}`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      context: 'brand_contacts',
      payload: {
        channelId: channel.id,
        type: channel.type,
        label: channel.label,
        isPrimary: channel.isPrimary,
      },
    })
  );

  return channel;
}

/**
 * Delete a contact channel
 */
export async function deleteBrandContactChannel(
  channelId: string,
  brandId: string,
  workspaceId: string,
  userId?: string
) {
  logger.info({ channelId, brandId }, 'Deleting brand contact channel');

  // Ensure channel belongs to the brand and get info before deletion
  const channel = await prisma.brandContactChannel.findFirst({
    where: { id: channelId, brandId },
  });

  if (!channel) {
    throw new Error('CONTACT_CHANNEL_NOT_FOUND');
  }

  await prisma.brandContactChannel.delete({
    where: { id: channelId },
  });

  logger.info({ channelId }, 'Brand contact channel deleted');

  // Invalidate brand cache (contact channels updated)
  await cacheService.delete(CacheKeys.brand(brandId));

  // Log activity
  await logActivity(
    buildBrandActivity({
      workspaceId,
      brandId,
      entityId: channelId,
      eventKey: 'brand.contact_channel_deleted',
      message: `Contact channel deleted: ${channel.type}`,
      actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
      actorUserId: userId,
      context: 'brand_contacts',
      payload: {
        channelId,
        type: channel.type,
        label: channel.label,
      },
    })
  );
}

/**
 * Bulk update contact channel order
 */
export async function reorderBrandContactChannels(
  brandId: string,
  channelOrders: { id: string; order: number }[]
) {
  logger.info({ brandId, count: channelOrders.length }, 'Reordering brand contact channels');

  await prisma.$transaction(
    channelOrders.map(({ id, order }) =>
      prisma.brandContactChannel.update({
        where: { id },
        data: { order },
      })
    )
  );

  logger.info({ brandId }, 'Brand contact channels reordered');
}

// ============================================================================
// Brand Optimization Score Functions
// ============================================================================

/**
 * Calculate optimization score for a brand
 */
export async function calculateAndGetBrandOptimizationScore(
  brandId: string,
  workspaceId: string
) {
  logger.info({ brandId }, 'Calculating brand optimization score');

  // Get brand with full details
  const brand = await getBrandById(brandId, workspaceId);

  if (!brand) {
    throw new Error('BRAND_NOT_FOUND');
  }

  // Generate logoUrl if logo exists
  let logoUrl: string | null = null;
  if (brand.logoMedia) {
    const { getMediaVariantUrlAsync } = await import('../../core/storage/s3-url.js');
    logoUrl = await getMediaVariantUrlAsync(
      brand.logoMedia.bucket,
      brand.logoMedia.variants,
      'small',
      brand.logoMedia.isPublic
    );
  }

  // Prepare brand data for score calculation
  const brandData = {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    industry: brand.industry,
    country: brand.country,
    city: brand.city,
    primaryLocale: brand.primaryLocale,
    timezone: brand.timezone,
    status: brand.status,
    logoMediaId: brand.logoMediaId,
    logoUrl,
    mediaCount: brand._count.media,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
    contactChannels: brand.contactChannels,
    profile: brand.profile,
  };

  // Calculate optimization score
  const result = calculateBrandOptimizationScore(brandData);

  logger.info({ brandId, score: result.score }, 'Brand optimization score calculated');

  return result;
}

/**
 * Calculate and save optimization score to profile
 */
export async function updateBrandOptimizationScore(
  brandId: string,
  workspaceId: string,
  userId?: string
) {
  logger.info({ brandId }, 'Updating brand optimization score');

  // Calculate score
  const result = await calculateAndGetBrandOptimizationScore(brandId, workspaceId);

  // Update profile with new score
  const existingProfile = await prisma.brandProfile.findUnique({
    where: { brandId },
  });

  if (existingProfile) {
    await prisma.brandProfile.update({
      where: { brandId },
      data: {
        optimizationScore: result.score,
        optimizationScoreUpdatedAt: new Date(),
      },
    });

    logger.info({ brandId, score: result.score }, 'Brand optimization score updated in profile');

    // Invalidate brand cache (optimization score updated)
    await cacheService.delete(CacheKeys.brand(brandId));

    // Log activity
    await logActivity(
      buildBrandActivity({
        workspaceId,
        brandId,
        entityId: brandId,
        eventKey: 'brand.optimization_score_refreshed',
        message: `Optimization score refreshed: ${result.score}%`,
        actorType: userId ? ActivityActorType.USER : ActivityActorType.SYSTEM,
        actorUserId: userId,
        context: 'brand_profile',
        payload: {
          score: result.score,
          percentage: result.percentage,
          previousScore: existingProfile.optimizationScore,
          breakdown: result.breakdown.map(b => ({
            section: b.section,
            score: b.score,
            maxScore: b.maxScore,
            issueCount: b.issues.length,
          })),
        },
      })
    );
  }

  return result;
}

