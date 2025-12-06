/**
 * Task Repository
 * 
 * Data access layer for Task, TaskChecklistItem, and TaskAttachment entities.
 */

import { prisma } from '../../lib/prisma.js';
import type { Prisma, TaskPriority } from '@prisma/client';

export class TaskRepository {
  /**
   * Create a new task
   */
  async createTask(data: {
    workspaceId: string;
    brandId?: string | null;
    projectId?: string | null;
    statusId: string;
    taskNumber: number;
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    assigneeUserId?: string | null;
    dueDate?: Date | null;
    createdByUserId: string;
  }) {
    return prisma.task.create({
      data: {
        workspaceId: data.workspaceId,
        brandId: data.brandId ?? null,
        projectId: data.projectId ?? null,
        statusId: data.statusId,
        taskNumber: data.taskNumber,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? 'MEDIUM',
        assigneeUserId: data.assigneeUserId ?? null,
        dueDate: data.dueDate ?? null,
        createdByUserId: data.createdByUserId,
      },
      include: {
        status: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assigneeUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarMediaId: true,
            avatarMedia: {
              select: {
                id: true,
                bucket: true,
                variants: true,
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Update a task by ID
   */
  async updateTaskById(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      statusId?: string;
      priority?: TaskPriority;
      assigneeUserId?: string | null;
      dueDate?: Date | null;
      projectId?: string | null;
      brandId?: string | null;
      updatedByUserId: string;
    }
  ) {
    return prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.statusId !== undefined && { statusId: data.statusId }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assigneeUserId !== undefined && { assigneeUserId: data.assigneeUserId }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.brandId !== undefined && { brandId: data.brandId }),
        updatedByUserId: data.updatedByUserId,
      },
      include: {
        status: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assigneeUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarMediaId: true,
            avatarMedia: {
              select: {
                id: true,
                bucket: true,
                variants: true,
              },
            },
          },
        },
        updatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find a task by ID
   */
  async findTaskById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: {
        status: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assigneeUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarMediaId: true,
            avatarMedia: {
              select: {
                id: true,
                bucket: true,
                variants: true,
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        checklistItems: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        attachments: {
          include: {
            media: {
              select: {
                id: true,
                originalFilename: true,
                mimeType: true,
                sizeBytes: true,
                kind: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find a task by ID with workspace validation
   */
  async findTaskByIdWithValidation(params: {
    id: string;
    workspaceId: string;
  }) {
    const { id, workspaceId } = params;

    return prisma.task.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: {
        status: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assigneeUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarMediaId: true,
            avatarMedia: {
              select: {
                id: true,
                bucket: true,
                variants: true,
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        checklistItems: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        attachments: {
          include: {
            media: {
              select: {
                id: true,
                originalFilename: true,
                mimeType: true,
                sizeBytes: true,
                kind: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List tasks
   */
  async listTasks(params: {
    workspaceId: string;
    brandId?: string | null;
    projectId?: string | null;
    statusIds?: string[];
    assigneeUserId?: string | null;
    page?: number;
    limit?: number;
  }) {
    const {
      workspaceId,
      brandId,
      projectId,
      statusIds,
      assigneeUserId,
      page = 1,
      limit = 20,
    } = params;

    const where: Prisma.TaskWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(brandId !== undefined && { brandId }),
      ...(projectId !== undefined && { projectId }),
      ...(statusIds && statusIds.length > 0 && { statusId: { in: statusIds } }),
      ...(assigneeUserId !== undefined && { assigneeUserId }),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          status: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          assigneeUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarMediaId: true,
              avatarMedia: {
                select: {
                  id: true,
                  bucket: true,
                  variants: true,
                },
              },
            },
          },
          _count: {
            select: {
              checklistItems: true,
              attachments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Soft delete a task
   */
  async softDeleteTaskById(id: string) {
    return prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // Checklist Item Methods
  // ============================================================================

  /**
   * Find checklist items by task ID
   */
  async findChecklistItemsByTaskId(taskId: string) {
    return prisma.taskChecklistItem.findMany({
      where: { taskId },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  /**
   * Create a checklist item
   */
  async createChecklistItem(data: {
    taskId: string;
    title: string;
    sortOrder?: number;
    createdByUserId: string;
  }) {
    return prisma.taskChecklistItem.create({
      data: {
        taskId: data.taskId,
        title: data.title,
        sortOrder: data.sortOrder ?? 0,
        createdByUserId: data.createdByUserId,
      },
    });
  }

  /**
   * Update a checklist item
   */
  async updateChecklistItem(
    id: string,
    data: {
      title?: string;
      isCompleted?: boolean;
      sortOrder?: number;
      completedByUserId?: string | null;
    }
  ) {
    return prisma.taskChecklistItem.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.isCompleted !== undefined && {
          isCompleted: data.isCompleted,
          completedAt: data.isCompleted ? new Date() : null,
          completedByUserId: data.isCompleted ? data.completedByUserId : null,
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  /**
   * Delete checklist items not in the provided list
   */
  async deleteChecklistItemsNotIn(taskId: string, idsToKeep: string[]) {
    return prisma.taskChecklistItem.deleteMany({
      where: {
        taskId,
        id: {
          notIn: idsToKeep,
        },
      },
    });
  }

  /**
   * Delete all checklist items for a task
   */
  async deleteAllChecklistItems(taskId: string) {
    return prisma.taskChecklistItem.deleteMany({
      where: { taskId },
    });
  }

  // ============================================================================
  // Attachment Methods
  // ============================================================================

  /**
   * Find attachments by task ID
   */
  async findAttachmentsByTaskId(taskId: string) {
    return prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        media: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            kind: true,
          },
        },
      },
    });
  }

  /**
   * Create a task attachment
   */
  async createAttachment(data: {
    taskId: string;
    mediaId: string;
    title?: string | null;
    createdByUserId: string;
  }) {
    return prisma.taskAttachment.create({
      data: {
        taskId: data.taskId,
        mediaId: data.mediaId,
        title: data.title ?? null,
        createdByUserId: data.createdByUserId,
      },
      include: {
        media: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            kind: true,
          },
        },
      },
    });
  }

  /**
   * Delete attachments not in the provided list
   */
  async deleteAttachmentsNotIn(taskId: string, idsToKeep: string[]) {
    return prisma.taskAttachment.deleteMany({
      where: {
        taskId,
        id: {
          notIn: idsToKeep,
        },
      },
    });
  }

  /**
   * Delete all attachments for a task
   */
  async deleteAllAttachments(taskId: string) {
    return prisma.taskAttachment.deleteMany({
      where: { taskId },
    });
  }
}

