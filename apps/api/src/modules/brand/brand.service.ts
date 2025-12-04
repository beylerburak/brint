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
 */
export async function getBrandById(brandId: string, workspaceId: string) {
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
 */
export async function listBrands(
  workspaceId: string,
  options?: {
    status?: BrandStatus;
    limit?: number;
    offset?: number;
  }
) {
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

  return brands;
}

// ============================================================================
// Brand Profile Functions
// ============================================================================

/**
 * Update brand profile data
 * Creates profile if it doesn't exist (upsert)
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

  // Log activity
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
        hasOptimizationScore: profile.optimizationScore != null,
      },
    })
  );

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

