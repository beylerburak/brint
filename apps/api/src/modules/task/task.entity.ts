/**
 * Task Domain Schemas
 * 
 * Zod schemas and TypeScript types for Task, TaskStatus, TaskChecklistItem, and TaskAttachment.
 */

import { z } from 'zod';
import type { TaskPriority, TaskStatusGroup } from '@prisma/client';

// ============================================================================
// Enums
// ============================================================================

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const TaskStatusGroupSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);

// ============================================================================
// TaskStatus Schemas
// ============================================================================

export const CreateTaskStatusInputSchema = z.object({
  brandId: z.string().nullable().optional(),
  group: TaskStatusGroupSchema,
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  color: z.string().max(50).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const UpdateTaskStatusInputSchema = z.object({
  group: TaskStatusGroupSchema.optional(),
  key: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100).optional(),
  color: z.string().max(50).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateTaskStatusInput = z.infer<typeof CreateTaskStatusInputSchema>;
export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusInputSchema>;

export type TaskStatusDto = {
  id: string;
  workspaceId: string;
  brandId: string | null;
  group: TaskStatusGroup;
  key: string;
  label: string;
  color: string | null;
  isDefault: boolean;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// Task Schemas
// ============================================================================

export const CreateTaskInputSchema = z.object({
  brandId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  statusId: z.string().min(1).optional(), // Optional - backend will use default TODO status if not provided
  title: z.string().min(1, 'Task title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  priority: TaskPrioritySchema.optional().default('MEDIUM'),
  assigneeUserId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const UpdateTaskInputSchema = z.object({
  brandId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  statusId: z.string().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: TaskPrioritySchema.optional(),
  assigneeUserId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export type TaskDto = {
  id: string;
  workspaceId: string;
  brandId: string | null;
  projectId: string | null;
  statusId: string;
  taskNumber: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assigneeUserId: string | null;
  dueDate: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskWithRelationsDto = TaskDto & {
  status: TaskStatusDto;
  checklistItemCount?: number;
  attachmentCount?: number;
};

export type TaskDetailDto = TaskDto & {
  status: TaskStatusDto;
  project?: {
    id: string;
    name: string;
  } | null;
  assigneeUser?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  checklistItems?: TaskChecklistItemDto[];
  attachments?: TaskAttachmentDto[];
  comments?: Array<{
    id: string;
    body: string;
    authorUserId: string;
    parentId: string | null;
    isEdited: boolean;
    editedAt: string | null;
    createdAt: string;
    updatedAt: string;
    author: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
};

// ============================================================================
// TaskChecklistItem Schemas
// ============================================================================

export const CreateTaskChecklistItemInputSchema = z.object({
  title: z.string().min(1, 'Checklist item title is required').max(500),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const UpdateTaskChecklistItemInputSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateTaskChecklistItemInput = z.infer<typeof CreateTaskChecklistItemInputSchema>;
export type UpdateTaskChecklistItemInput = z.infer<typeof UpdateTaskChecklistItemInputSchema>;

export type TaskChecklistItemDto = {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdByUserId: string;
  completedAt: string | null;
  completedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// TaskAttachment Schemas
// ============================================================================

export const CreateTaskAttachmentInputSchema = z.object({
  mediaId: z.string().min(1, 'Media ID is required'),
  title: z.string().max(200).nullable().optional(),
});

export type CreateTaskAttachmentInput = z.infer<typeof CreateTaskAttachmentInputSchema>;

export type TaskAttachmentDto = {
  id: string;
  taskId: string;
  mediaId: string;
  title: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

