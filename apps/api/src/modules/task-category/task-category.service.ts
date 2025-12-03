/**
 * TaskCategory Service
 * 
 * Business logic layer for TaskCategory domain.
 */

import type { TaskCategory } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { slugify } from "../../lib/slugify.js";
import { BadRequestError, NotFoundError } from "../../lib/http-errors.js";
import type {
  CreateTaskCategoryInput,
  UpdateTaskCategoryInput,
  TaskCategoryQueryFilters,
} from "./task-category.types.js";

/**
 * List task categories with filters
 */
export async function listTaskCategories(
  filters: TaskCategoryQueryFilters
): Promise<TaskCategory[]> {
  const { workspaceId, brandId } = filters;

  return prisma.taskCategory.findMany({
    where: {
      workspaceId,
      ...(brandId !== undefined ? { brandId } : {}),
    },
    orderBy: [
      { order: "asc" },
      { name: "asc" },
    ],
  });
}

/**
 * Get task category by ID
 */
export async function getTaskCategoryById(
  id: string,
  workspaceId: string
): Promise<TaskCategory> {
  const category = await prisma.taskCategory.findFirst({
    where: {
      id,
      workspaceId,
    },
  });

  if (!category) {
    throw new NotFoundError("TASK_CATEGORY_NOT_FOUND", { id });
  }

  return category;
}

/**
 * Create task category
 */
export async function createTaskCategory(
  workspaceId: string,
  input: CreateTaskCategoryInput
): Promise<TaskCategory> {
  const slug = input.slug || slugify(input.name);

  // Check if slug already exists in this workspace+brand context
  const existing = await prisma.taskCategory.findFirst({
    where: {
      workspaceId,
      brandId: input.brandId || null,
      slug,
    },
  });

  if (existing) {
    throw new BadRequestError("TASK_CATEGORY_SLUG_EXISTS", { slug });
  }

  return prisma.taskCategory.create({
    data: {
      workspaceId,
      brandId: input.brandId || null,
      name: input.name,
      slug,
      color: input.color || null,
      isDefault: input.isDefault || false,
      order: input.order || 0,
    },
  });
}

/**
 * Update task category
 */
export async function updateTaskCategory(
  id: string,
  workspaceId: string,
  input: UpdateTaskCategoryInput
): Promise<TaskCategory> {
  const category = await getTaskCategoryById(id, workspaceId);

  // If slug is being updated, check for conflicts
  if (input.slug && input.slug !== category.slug) {
    const existing = await prisma.taskCategory.findFirst({
      where: {
        workspaceId,
        brandId: category.brandId,
        slug: input.slug,
        id: { not: id },
      },
    });

    if (existing) {
      throw new BadRequestError("TASK_CATEGORY_SLUG_EXISTS", { slug: input.slug });
    }
  }

  return prisma.taskCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      ...(input.order !== undefined && { order: input.order }),
    },
  });
}

/**
 * Delete task category
 */
export async function deleteTaskCategory(
  id: string,
  workspaceId: string
): Promise<void> {
  const category = await getTaskCategoryById(id, workspaceId);

  await prisma.taskCategory.delete({
    where: { id },
  });
}

