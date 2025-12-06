/**
 * Comment Repository
 * 
 * Data access layer for Comment entities using Prisma.
 * Handles all database operations related to comments.
 */

import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export class CommentRepository {
  /**
   * Find comments by entity (with pagination and filtering)
   */
  async findManyByEntity(params: {
    workspaceId: string;
    brandId?: string | null;
    entityType: string;
    entityId: string;
    includeDeleted?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { workspaceId, brandId, entityType, entityId, includeDeleted = false, page = 1, limit = 20 } = params;

    const where: Prisma.CommentWhereInput = {
      workspaceId,
      entityType,
      entityId,
      ...(brandId !== undefined ? { brandId } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          authorUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      comments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a comment by ID
   */
  async findById(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      include: {
        authorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find a comment by ID with workspace/brand validation
   */
  async findByIdWithValidation(params: {
    id: string;
    workspaceId: string;
    brandId?: string | null;
  }) {
    const { id, workspaceId, brandId } = params;

    return prisma.comment.findFirst({
      where: {
        id,
        workspaceId,
        ...(brandId !== undefined ? { brandId } : {}),
      },
      include: {
        authorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Create a new comment
   */
  async create(data: {
    workspaceId: string;
    brandId?: string | null;
    entityType: string;
    entityId: string;
    authorUserId: string;
    body: string;
    parentId?: string | null;
  }) {
    return prisma.comment.create({
      data: {
        workspaceId: data.workspaceId,
        brandId: data.brandId ?? null,
        entityType: data.entityType,
        entityId: data.entityId,
        authorUserId: data.authorUserId,
        body: data.body,
        parentId: data.parentId ?? null,
      },
      include: {
        authorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Update a comment
   */
  async updateById(id: string, data: { body: string }) {
    return prisma.comment.update({
      where: { id },
      data: {
        body: data.body,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        authorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a comment
   */
  async softDeleteById(id: string) {
    return prisma.comment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Count comments by entity
   */
  async countByEntity(params: {
    workspaceId: string;
    entityType: string;
    entityId: string;
    includeDeleted?: boolean;
  }) {
    const { workspaceId, entityType, entityId, includeDeleted = false } = params;

    return prisma.comment.count({
      where: {
        workspaceId,
        entityType,
        entityId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  /**
   * Find replies for a comment
   */
  async findReplies(parentId: string) {
    return prisma.comment.findMany({
      where: {
        parentId,
        deletedAt: null,
      },
      include: {
        authorUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}

