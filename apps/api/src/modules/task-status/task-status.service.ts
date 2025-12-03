/**
 * TaskStatus Service
 * 
 * Business logic layer for TaskStatus domain.
 * Manages user-defined task statuses grouped by TODO, IN_PROGRESS, DONE.
 */

import type { TaskStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { slugify } from "../../lib/slugify.js";
import { BadRequestError, NotFoundError } from "../../lib/http-errors.js";
import type {
  CreateTaskStatusInput,
  UpdateTaskStatusInput,
  TaskStatusQueryFilters,
} from "./task-status.types.js";

/**
 * List task statuses with filters
 * 
 * When brandId is provided, returns BOTH:
 * - Workspace-level statuses (brandId = null)
 * - Brand-specific statuses (brandId = X)
 */
export async function listTaskStatuses(
  filters: TaskStatusQueryFilters
): Promise<TaskStatus[]> {
  const { workspaceId, brandId, group } = filters;

  return prisma.taskStatus.findMany({
    where: {
      workspaceId,
      ...(brandId !== undefined
        ? {
            OR: [
              { brandId: null }, // Workspace-level statuses
              { brandId }, // Brand-specific statuses
            ],
          }
        : { brandId: null }), // If no brandId, only workspace-level
      ...(group !== undefined ? { group } : {}),
    },
    orderBy: [
      { group: "asc" }, // Group statuses by TODO -> IN_PROGRESS -> DONE
      { order: "asc" },
      { name: "asc" },
    ],
  });
}

/**
 * Get task status by ID
 */
export async function getTaskStatusById(
  id: string,
  workspaceId: string
): Promise<TaskStatus> {
  const status = await prisma.taskStatus.findFirst({
    where: {
      id,
      workspaceId,
    },
  });

  if (!status) {
    throw new NotFoundError("TASK_STATUS_NOT_FOUND", { id });
  }

  return status;
}

/**
 * Create task status
 */
export async function createTaskStatus(
  workspaceId: string,
  input: CreateTaskStatusInput
): Promise<TaskStatus> {
  const slug = input.slug || slugify(input.name);

  // Check if slug already exists in this workspace+brand context
  const existing = await prisma.taskStatus.findFirst({
    where: {
      workspaceId,
      brandId: input.brandId || null,
      slug,
    },
  });

  if (existing) {
    throw new BadRequestError("TASK_STATUS_SLUG_EXISTS", { slug });
  }

  return prisma.taskStatus.create({
    data: {
      workspaceId,
      brandId: input.brandId || null,
      name: input.name,
      slug,
      group: input.group,
      color: input.color || null,
      icon: input.icon || null,
      description: input.description || null,
      isDefault: input.isDefault || false,
      order: input.order || 0,
    },
  });
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  id: string,
  workspaceId: string,
  input: UpdateTaskStatusInput
): Promise<TaskStatus> {
  const status = await getTaskStatusById(id, workspaceId);

  // Prevent changing group for default statuses
  if (status.isDefault && input.group && input.group !== status.group) {
    throw new BadRequestError("CANNOT_CHANGE_DEFAULT_STATUS_GROUP", { 
      id,
      message: "Cannot change group for default statuses. Only name and color can be updated." 
    });
  }

  // If slug is being updated, check for conflicts
  if (input.slug && input.slug !== status.slug) {
    const existing = await prisma.taskStatus.findFirst({
      where: {
        workspaceId,
        brandId: status.brandId,
        slug: input.slug,
        id: { not: id },
      },
    });

    if (existing) {
      throw new BadRequestError("TASK_STATUS_SLUG_EXISTS", { slug: input.slug });
    }
  }

  return prisma.taskStatus.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.group !== undefined && { group: input.group }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      ...(input.order !== undefined && { order: input.order }),
    },
  });
}

/**
 * Delete task status
 */
export async function deleteTaskStatus(
  id: string,
  workspaceId: string
): Promise<void> {
  const status = await getTaskStatusById(id, workspaceId);

  // Prevent deleting default statuses
  if (status.isDefault) {
    throw new BadRequestError("CANNOT_DELETE_DEFAULT_STATUS", { id });
  }

  // Check if any tasks are using this status
  const taskCount = await prisma.task.count({
    where: { statusId: id },
  });

  if (taskCount > 0) {
    throw new BadRequestError("TASK_STATUS_IN_USE", { id, taskCount });
  }

  await prisma.taskStatus.delete({
    where: { id },
  });
}

