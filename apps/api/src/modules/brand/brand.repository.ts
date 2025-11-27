/**
 * Brand Repository
 * 
 * Data access layer for Brand entities using Prisma.
 * Handles all database operations related to brands.
 */

import { prisma } from '../../lib/prisma.js';
import { BrandEntity } from './brand.entity.js';
import { Prisma } from '@prisma/client';
import { logger } from '../../lib/logger.js';

export interface CreateBrandInput {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export class BrandRepository {
  /**
   * Finds a brand by ID
   * @returns BrandEntity or null if not found
   */
  async findById(id: string): Promise<BrandEntity | null> {
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      return null;
    }

    return BrandEntity.fromPrisma(brand);
  }

  /**
   * Finds a brand by slug within a workspace
   * @returns BrandEntity or null if not found
   */
  async findBySlug(workspaceId: string, slug: string): Promise<BrandEntity | null> {
    const brand = await prisma.brand.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug,
        },
      },
    });

    if (!brand) {
      return null;
    }

    return BrandEntity.fromPrisma(brand);
  }

  /**
   * Lists all active brands for a workspace
   * @returns Array of BrandEntity (only isActive = true)
   */
  async listByWorkspace(workspaceId: string): Promise<BrandEntity[]> {
    const brands = await prisma.brand.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return brands.map((brand) => BrandEntity.fromPrisma(brand));
  }

  /**
   * Creates a new brand
   * @param input Brand creation data
   * @returns Created BrandEntity
   * @throws Error if slug already exists in workspace or validation fails
   */
  async createBrand(input: CreateBrandInput): Promise<BrandEntity> {
    // Use BrandEntity.create to apply invariants
    const brandEntity = BrandEntity.create({
      workspaceId: input.workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      isActive: true,
      createdBy: input.createdBy ?? null,
    });

    try {
      const brand = await prisma.brand.create({
        data: brandEntity.toPrismaCreateInput(),
      });

      return BrandEntity.fromPrisma(brand);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraint violation (workspaceId, slug)
        logger.warn(
          {
            workspaceId: input.workspaceId,
            slug: brandEntity.slug,
            errorCode: error.code,
          },
          'Brand creation failed: slug already exists in workspace'
        );
        throw new Error(
          `Brand with slug "${brandEntity.slug}" already exists in this workspace`
        );
      }
      throw error;
    }
  }
}

// Export singleton instance
export const brandRepository = new BrandRepository();
