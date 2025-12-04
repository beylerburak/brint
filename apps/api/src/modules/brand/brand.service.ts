/**
 * Brand Service
 * 
 * Handles Brand CRUD operations with validation.
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { z } from 'zod';
import type { BrandStatus, WorkspacePlan } from '@prisma/client';
import { APP_CONFIG } from '../../config/app-config.js';

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
export async function createBrand(workspaceId: string, data: CreateBrandInput) {
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

  return brand;
}

/**
 * Update brand
 */
export async function updateBrand(
  brandId: string,
  workspaceId: string,
  data: UpdateBrandInput
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

  return brand;
}

/**
 * Delete brand
 */
export async function deleteBrand(brandId: string, workspaceId: string) {
  logger.info({ brandId, workspaceId }, 'Deleting brand');

  // Delete brand
  await prisma.brand.delete({
    where: {
      id: brandId,
      workspaceId, // Ensure brand belongs to workspace
    },
  });

  logger.info({ brandId }, 'Brand deleted');
}

/**
 * Get brand by ID
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

