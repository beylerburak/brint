/**
 * Task Service
 * 
 * Business logic layer for Task domain.
 */

import type { Task } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../lib/http-errors.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskQueryFilters,
  TaskWithRelations,
} from "./task.types.js";

/**
 * List tasks with filters
 * 
 * Returns tasks with their associated statuses.
 * Status filtering works with both workspace-level and brand-specific statuses.
 */
export async function listTasks(
  filters: TaskQueryFilters
): Promise<TaskWithRelations[]> {
  const { workspaceId, brandId, statusId, statusGroup, categoryId, assigneeId, search } = filters;

  return prisma.task.findMany({
    where: {
      workspaceId,
      ...(brandId !== undefined ? { brandId } : {}),
      ...(statusId && { statusId }),
      ...(statusGroup && { status: { group: statusGroup } }),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
      },
      status: {
        select: {
          id: true,
          name: true,
          slug: true,
          group: true,
          color: true,
          icon: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
  });
}

/**
 * Get task by ID
 */
export async function getTaskById(
  id: string,
  workspaceId: string
): Promise<TaskWithRelations> {
  const task = await prisma.task.findFirst({
    where: {
      id,
      workspaceId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
      },
      status: {
        select: {
          id: true,
          name: true,
          slug: true,
          group: true,
          color: true,
          icon: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError("TASK_NOT_FOUND", { id });
  }

  return task;
}

/**
 * Create task
 */
export async function createTask(
  workspaceId: string,
  reporterId: string,
  input: CreateTaskInput
): Promise<TaskWithRelations> {
  // If statusId not provided, use default "Not Started" status
  let statusId = input.statusId;
  if (!statusId) {
    const defaultStatus = await prisma.taskStatus.findFirst({
      where: {
        workspaceId,
        brandId: input.brandId || null,
        slug: 'not-started',
        isDefault: true,
      },
    });

    if (!defaultStatus) {
      // Fallback: try to find any Not Started status in the workspace
      const fallbackStatus = await prisma.taskStatus.findFirst({
        where: {
          workspaceId,
          slug: 'not-started',
        },
      });

      if (!fallbackStatus) {
        throw new Error('No default task status found. Please run seed.');
      }

      statusId = fallbackStatus.id;
    } else {
      statusId = defaultStatus.id;
    }
  }

  const task = await prisma.task.create({
    data: {
      workspaceId,
      brandId: input.brandId || null,
      title: input.title,
      description: input.description || null,
      categoryId: input.categoryId || null,
      statusId,
      priority: input.priority || 'MEDIUM',
      assigneeId: input.assigneeId || null,
      reporterId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      source: 'MANUAL',
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
      },
      status: {
        select: {
          id: true,
          name: true,
          slug: true,
          group: true,
          color: true,
          icon: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return task;
}

/**
 * Update task
 */
export async function updateTask(
  id: string,
  workspaceId: string,
  input: UpdateTaskInput
): Promise<TaskWithRelations> {
  const task = await getTaskById(id, workspaceId);

  // Auto-set completedAt when status changes to DONE group
  let completedAt = task.completedAt;
  if (input.statusId) {
    const newStatus = await prisma.taskStatus.findUnique({
      where: { id: input.statusId },
      select: { group: true },
    });

    if (newStatus?.group === 'DONE' && !completedAt) {
      completedAt = new Date();
    } else if (newStatus?.group !== 'DONE') {
      completedAt = null;
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.statusId !== undefined && { statusId: input.statusId }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
      ...(input.startDate !== undefined && { startDate: input.startDate ? new Date(input.startDate) : null }),
      completedAt,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
      },
      status: {
        select: {
          id: true,
          name: true,
          slug: true,
          group: true,
          color: true,
          icon: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return updatedTask;
}

/**
 * Delete task
 */
export async function deleteTask(
  id: string,
  workspaceId: string
): Promise<void> {
  await getTaskById(id, workspaceId);

  await prisma.task.delete({
    where: { id },
  });
}

