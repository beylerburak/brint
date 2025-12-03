/**
 * TaskCategory Domain Types
 * 
 * Domain-level type definitions for the TaskCategory module.
 */

import type { TaskCategory } from "@prisma/client";

/**
 * TaskCategory list item
 */
export interface TaskCategoryListItem {
  id: string;
  workspaceId: string;
  brandId: string | null;
  name: string;
  slug: string;
  color: string | null;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create task category input
 */
export interface CreateTaskCategoryInput {
  name: string;
  slug?: string;
  color?: string | null;
  isDefault?: boolean;
  order?: number;
  brandId?: string | null;
}

/**
 * Update task category input
 */
export interface UpdateTaskCategoryInput {
  name?: string;
  slug?: string;
  color?: string | null;
  isDefault?: boolean;
  order?: number;
}

/**
 * Task category query filters
 */
export interface TaskCategoryQueryFilters {
  workspaceId: string;
  brandId?: string | null;
}

