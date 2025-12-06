/**
 * TaskStatus Repository
 * 
 * Data access layer for TaskStatus entities.
 */

import { prisma } from '../../lib/prisma.js';
import type { TaskStatusGroup } from '@prisma/client';

export class TaskStatusRepository {
  /**
   * Find statuses for workspace and brand
   * Returns both workspace-level and brand-specific statuses
   */
  async findStatusesForWorkspaceAndBrand(params: {
    workspaceId: string;
    brandId?: string | null;
  }) {
    const { workspaceId, brandId } = params;

    return prisma.taskStatus.findMany({
      where: {
        workspaceId,
        OR: [
          { brandId: null }, // Workspace-level statuses
          ...(brandId ? [{ brandId }] : []), // Brand-specific statuses if brandId provided
        ],
        isActive: true,
      },
      orderBy: [
        { group: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
  }

  /**
   * Find a status by ID
   */
  async findStatusById(id: string) {
    return prisma.taskStatus.findUnique({
      where: { id },
    });
  }

  /**
   * Find a status by ID with workspace validation
   */
  async findStatusByIdWithValidation(params: {
    id: string;
    workspaceId: string;
  }) {
    const { id, workspaceId } = params;

    return prisma.taskStatus.findFirst({
      where: {
        id,
        workspaceId,
      },
    });
  }

  /**
   * Find default status for a group
   */
  async findDefaultStatusForGroup(params: {
    workspaceId: string;
    brandId?: string | null;
    group: TaskStatusGroup;
  }) {
    const { workspaceId, brandId, group } = params;

    // First try to find brand-specific default
    if (brandId) {
      const brandDefault = await prisma.taskStatus.findFirst({
        where: {
          workspaceId,
          brandId,
          group,
          isDefault: true,
          isActive: true,
        },
      });

      if (brandDefault) {
        return brandDefault;
      }
    }

    // Fall back to workspace-level default
    return prisma.taskStatus.findFirst({
      where: {
        workspaceId,
        brandId: null,
        group,
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Create a status
   */
  async createStatus(data: {
    workspaceId: string;
    brandId?: string | null;
    group: TaskStatusGroup;
    key: string;
    label: string;
    color?: string | null;
    isDefault?: boolean;
    isSystem?: boolean;
    sortOrder?: number;
  }) {
    return prisma.taskStatus.create({
      data: {
        workspaceId: data.workspaceId,
        brandId: data.brandId ?? null,
        group: data.group,
        key: data.key,
        label: data.label,
        color: data.color ?? null,
        isDefault: data.isDefault ?? false,
        isSystem: data.isSystem ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  /**
   * Update a status
   */
  async updateStatusById(
    id: string,
    data: {
      label?: string;
      color?: string | null;
      isDefault?: boolean;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    return prisma.taskStatus.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Unset default flag for other statuses in the same group
   */
  async unsetDefaultForGroup(params: {
    workspaceId: string;
    brandId?: string | null;
    group: TaskStatusGroup;
    excludeId?: string;
  }) {
    const { workspaceId, brandId, group, excludeId } = params;

    return prisma.taskStatus.updateMany({
      where: {
        workspaceId,
        ...(brandId !== undefined ? { brandId } : {}),
        group,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: {
        isDefault: false,
      },
    });
  }

  /**
   * Soft delete a status (set isActive to false)
   */
  async softDeleteStatusById(id: string) {
    return prisma.taskStatus.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Count tasks using a status
   */
  async countTasksUsingStatus(statusId: string) {
    return prisma.task.count({
      where: {
        statusId,
        deletedAt: null,
      },
    });
  }

  /**
   * Create default system statuses for workspace
   */
  async createDefaultStatusesForWorkspace(workspaceId: string) {
    const defaultStatuses = [
      {
        group: 'TODO' as TaskStatusGroup,
        key: 'NOT_STARTED',
        label: 'Not Started',
        color: '#94a3b8',
        isDefault: true,
        isSystem: true,
        sortOrder: 0,
      },
      {
        group: 'IN_PROGRESS' as TaskStatusGroup,
        key: 'IN_PROGRESS',
        label: 'In Progress',
        color: '#3b82f6',
        isDefault: true,
        isSystem: true,
        sortOrder: 0,
      },
      {
        group: 'DONE' as TaskStatusGroup,
        key: 'COMPLETED',
        label: 'Completed',
        color: '#22c55e',
        isDefault: true,
        isSystem: true,
        sortOrder: 0,
      },
    ];

    return prisma.$transaction(
      defaultStatuses.map((status) =>
        prisma.taskStatus.create({
          data: {
            workspaceId,
            brandId: null,
            ...status,
          },
        })
      )
    );
  }
}

