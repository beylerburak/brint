/**
 * Task Domain Types
 * 
 * Domain-level type definitions for the Task module.
 * Tasks now use user-defined statuses (TaskStatus model) instead of enum.
 */

import type { Task, TaskPriority, TaskSource, TaskStatusGroup } from "@prisma/client";

export type { TaskPriority, TaskSource, TaskStatusGroup } from "@prisma/client";

/**
 * Task with relations
 */
export interface TaskWithRelations extends Task {
  category?: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  } | null;
  status: {
    id: string;
    name: string;
    slug: string;
    group: TaskStatusGroup;
    color: string | null;
    icon: string | null;
  };
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  reporter: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Create task input
 */
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  statusId?: string | null; // If not provided, will use default "Backlog" status
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  brandId?: string | null;
}

/**
 * Update task input
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  statusId?: string; // Change to user-defined status
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
}

/**
 * Task query filters
 */
export interface TaskQueryFilters {
  workspaceId: string;
  brandId?: string | null;
  statusId?: string; // Filter by specific status
  statusGroup?: TaskStatusGroup; // Filter by status group (TODO, IN_PROGRESS, DONE)
  categoryId?: string | null;
  assigneeId?: string | null;
  search?: string;
}

