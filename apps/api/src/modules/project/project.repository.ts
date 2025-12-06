/**
 * Project Repository
 * 
 * Data access layer for Project entities using Prisma.
 * Handles all database operations related to projects.
 */

import { prisma } from '../../lib/prisma.js';
import type { Prisma, ProjectStatus } from '@prisma/client';

export class ProjectRepository {
  /**
   * Create a new project
   */
  async createProject(data: {
    workspaceId: string;
    brandId?: string | null;
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    startDate?: Date | null;
    endDate?: Date | null;
    createdByUserId: string;
  }) {
    return prisma.project.create({
      data: {
        workspaceId: data.workspaceId,
        brandId: data.brandId ?? null,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'PLANNED',
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        createdByUserId: data.createdByUserId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Update a project by ID
   */
  async updateProjectById(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      status?: ProjectStatus;
      startDate?: Date | null;
      endDate?: Date | null;
      brandId?: string | null;
      updatedByUserId: string;
    }
  ) {
    return prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.brandId !== undefined && { brandId: data.brandId }),
        updatedByUserId: data.updatedByUserId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Find a project by ID
   */
  async findProjectById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });
  }

  /**
   * Find a project by ID with workspace validation
   */
  async findProjectByIdWithValidation(params: {
    id: string;
    workspaceId: string;
    brandId?: string | null;
  }) {
    const { id, workspaceId, brandId } = params;

    return prisma.project.findFirst({
      where: {
        id,
        workspaceId,
        ...(brandId !== undefined ? { brandId } : {}),
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });
  }

  /**
   * List projects by workspace
   */
  async listProjectsByWorkspace(params: {
    workspaceId: string;
    brandId?: string | null;
    status?: ProjectStatus;
    page?: number;
    limit?: number;
  }) {
    const { workspaceId, brandId, status, page = 1, limit = 20 } = params;

    const where: Prisma.ProjectWhereInput = {
      workspaceId,
      ...(brandId !== undefined ? { brandId } : {}),
      ...(status ? { status } : {}),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              tasks: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Archive a project (set status to ARCHIVED)
   */
  async archiveProjectById(id: string, updatedByUserId: string) {
    return prisma.project.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        updatedByUserId,
      },
    });
  }

  /**
   * Count projects by workspace
   */
  async countProjectsByWorkspace(params: {
    workspaceId: string;
    brandId?: string | null;
    status?: ProjectStatus;
  }) {
    const { workspaceId, brandId, status } = params;

    return prisma.project.count({
      where: {
        workspaceId,
        ...(brandId !== undefined ? { brandId } : {}),
        ...(status ? { status } : {}),
      },
    });
  }
}

