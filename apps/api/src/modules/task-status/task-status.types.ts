/**
 * TaskStatus Domain Types
 * 
 * Domain-level type definitions for the TaskStatus module.
 * TaskStatus allows users to define custom statuses grouped by
 * three main categories: TODO, IN_PROGRESS, DONE.
 */

import type { TaskStatus, TaskStatusGroup } from "@prisma/client";

/**
 * TaskStatus list item
 */
export interface TaskStatusListItem {
  id: string;
  workspaceId: string;
  brandId: string | null;
  name: string;
  slug: string;
  group: TaskStatusGroup;
  color: string | null;
  icon: string | null;
  description: string | null;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create task status input
 */
export interface CreateTaskStatusInput {
  name: string;
  slug?: string;
  group: TaskStatusGroup;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  isDefault?: boolean;
  order?: number;
  brandId?: string | null;
}

/**
 * Update task status input
 */
export interface UpdateTaskStatusInput {
  name?: string;
  slug?: string;
  group?: TaskStatusGroup;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  isDefault?: boolean;
  order?: number;
}

/**
 * Task status query filters
 */
export interface TaskStatusQueryFilters {
  workspaceId: string;
  brandId?: string | null;
  group?: TaskStatusGroup;
}

