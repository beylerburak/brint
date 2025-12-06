/**
 * Task Service
 * 
 * Business logic layer for Task operations.
 * Handles validation, permissions, checklist/attachment management, and activity logging.
 */

import { TaskRepository } from './task.repository.js';
import { TaskStatusRepository } from './task-status.repository.js';
import { CommentRepository } from '../comment/comment.repository.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { logActivity } from '../../core/activity/activity-log.service.js';
import { ActivityActorType, ActivityEntityType } from '@prisma/client';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskDto,
  TaskWithRelationsDto,
  TaskDetailDto,
} from './task.entity.js';
import type { TaskPriority } from '@prisma/client';

const taskRepository = new TaskRepository();
const taskStatusRepository = new TaskStatusRepository();
const commentRepository = new CommentRepository();

/**
 * Parse due date string - if it's YYYY-MM-DD format, set to UTC midnight
 * Otherwise parse as ISO string
 */
function parseDueDate(dueDate: string | null | undefined): Date | null {
  if (!dueDate) return null;
  
  // Check if it's YYYY-MM-DD format (no time component)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    // Parse as UTC midnight to indicate "date only, no time"
    const date = new Date(dueDate + 'T00:00:00.000Z');
    return date;
  }
  
  // Otherwise parse as ISO string
  return new Date(dueDate);
}

/**
 * Service context from authenticated request
 */
export type TaskServiceContext = {
  userId: string;
  workspaceId: string;
};

/**
 * Convert Prisma task to DTO
 */
async function toTaskDto(task: any): Promise<TaskWithRelationsDto & { assignedTo?: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null }>; checklistItems?: Array<{ id: string; title: string; isCompleted: boolean; sortOrder: number }> }> {
  let avatarUrl: string | null = null;
  
  if (task.assigneeUser?.avatarMediaId) {
    if (task.assigneeUser?.avatarMedia) {
      try {
        const bucket = task.assigneeUser.avatarMedia.bucket;
        const variants = task.assigneeUser.avatarMedia.variants;
        
        if (bucket && variants) {
          const isPublic = false; // User avatars are typically private
          avatarUrl = await getMediaVariantUrlAsync(
            bucket,
            variants,
            'thumbnail',
            isPublic
          );
        } else {
          console.warn('Avatar media missing bucket or variants:', { bucket, variants });
        }
      } catch (error) {
        // If URL generation fails, avatarUrl remains null
        console.error('Failed to generate avatar URL:', error);
      }
    } else {
      console.warn('Avatar media relation not found for avatarMediaId:', task.assigneeUser.avatarMediaId);
    }
  }
  
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    brandId: task.brandId,
    projectId: task.projectId,
    statusId: task.statusId,
    taskNumber: task.taskNumber,
    title: task.title,
    description: task.description,
    priority: task.priority,
    assigneeUserId: task.assigneeUserId,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdByUserId: task.createdByUserId,
    updatedByUserId: task.updatedByUserId,
    deletedAt: task.deletedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    status: {
      id: task.status.id,
      workspaceId: task.status.workspaceId,
      brandId: task.status.brandId,
      group: task.status.group,
      key: task.status.key,
      label: task.status.label,
      color: task.status.color,
      isDefault: task.status.isDefault,
      isSystem: task.status.isSystem,
      isActive: task.status.isActive,
      sortOrder: task.status.sortOrder,
      createdAt: task.status.createdAt.toISOString(),
      updatedAt: task.status.updatedAt.toISOString(),
    },
    checklistItemCount: task._count?.checklistItems ?? 0,
    attachmentCount: task._count?.attachments ?? 0,
    assignedTo: task.assigneeUser ? [{
      id: task.assigneeUser.id,
      name: task.assigneeUser.name,
      email: task.assigneeUser.email,
      avatarUrl,
    }] : [],
    checklistItems: task.checklistItems ? task.checklistItems.map((item: any) => ({
      id: item.id,
      title: item.title,
      isCompleted: item.isCompleted,
      sortOrder: item.sortOrder,
    })) : undefined,
  };
}

/**
 * Create a new task
 */
export async function createTask(
  ctx: TaskServiceContext,
  input: CreateTaskInput & {
    checklistItems?: Array<{ title: string; sortOrder?: number }>;
    attachmentMediaIds?: string[];
  }
): Promise<TaskWithRelationsDto> {
  const {
    title,
    description,
    brandId,
    projectId,
    statusId,
    priority,
    assigneeUserId,
    dueDate,
    checklistItems,
    attachmentMediaIds,
  } = input;

  logger.info(
    { workspaceId: ctx.workspaceId, title, brandId, projectId },
    'Creating task'
  );

  // Validate brand if provided
  if (brandId) {
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!brand) {
      throw new Error('BRAND_NOT_FOUND');
    }
  }

  // Validate project if provided
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId: ctx.workspaceId,
        ...(brandId ? { brandId } : {}),
      },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }
  }

  // Determine status
  let finalStatusId = statusId;
  if (!finalStatusId) {
    // Get default TODO status
    const defaultStatus = await taskStatusRepository.findDefaultStatusForGroup({
      workspaceId: ctx.workspaceId,
      brandId: brandId ?? undefined,
      group: 'TODO',
    });

    if (!defaultStatus) {
      throw new Error('NO_DEFAULT_STATUS');
    }

    finalStatusId = defaultStatus.id;
  } else {
    // Validate provided status
    const status = await taskStatusRepository.findStatusByIdWithValidation({
      id: finalStatusId,
      workspaceId: ctx.workspaceId,
    });

    if (!status) {
      throw new Error('STATUS_NOT_FOUND');
    }
  }

  // Validate assignee if provided
  if (assigneeUserId) {
    const assignee = await prisma.workspaceMember.findFirst({
      where: {
        userId: assigneeUserId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!assignee) {
      throw new Error('ASSIGNEE_NOT_MEMBER');
    }
  }

  // Get next task number for this workspace
  const lastTask = await prisma.task.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
    },
    orderBy: {
      taskNumber: 'desc',
    },
    select: {
      taskNumber: true,
    },
  });

  const nextTaskNumber = (lastTask?.taskNumber ?? 0) + 1;

  // Create task
  const task = await taskRepository.createTask({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? null,
    projectId: projectId ?? null,
    statusId: finalStatusId,
    taskNumber: nextTaskNumber,
    title,
    description: description ?? null,
    priority: (priority as TaskPriority) ?? 'MEDIUM',
    assigneeUserId: assigneeUserId ?? null,
    dueDate: parseDueDate(dueDate),
    createdByUserId: ctx.userId,
  });

  // Create checklist items if provided
  if (checklistItems && checklistItems.length > 0) {
    await Promise.all(
      checklistItems.map((item, index) =>
        taskRepository.createChecklistItem({
          taskId: task.id,
          title: item.title,
          sortOrder: item.sortOrder ?? index,
          createdByUserId: ctx.userId,
        })
      )
    );
  }

  // Create attachments if provided
  if (attachmentMediaIds && attachmentMediaIds.length > 0) {
    // Validate media IDs belong to workspace
    const mediaRecords = await prisma.media.findMany({
      where: {
        id: { in: attachmentMediaIds },
        workspaceId: ctx.workspaceId,
      },
      select: { id: true },
    });

    const validMediaIds = mediaRecords.map((m) => m.id);

    await Promise.all(
      validMediaIds.map((mediaId) =>
        taskRepository.createAttachment({
          taskId: task.id,
          mediaId,
          createdByUserId: ctx.userId,
        })
      )
    );
  }

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? null,
    entityType: ActivityEntityType.TASK,
    entityId: task.id,
    eventKey: 'task.created',
    message: `Task created: ${task.title}`,
    context: 'task',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      taskId: task.id,
      title: task.title,
      statusId: task.statusId,
      priority: task.priority,
      projectId: task.projectId,
      brandId: task.brandId,
    },
  });

  // Fetch complete task with relations
  const completeTask = await taskRepository.findTaskById(task.id);
  return await toTaskDto(completeTask);
}

/**
 * Update a task
 */
export async function updateTask(
  ctx: TaskServiceContext,
  taskId: string,
  input: UpdateTaskInput & {
    checklistItems?: Array<{ id?: string; title: string; isCompleted?: boolean; sortOrder?: number }>;
    attachmentMediaIds?: string[];
  }
): Promise<TaskWithRelationsDto> {
  logger.info(
    { workspaceId: ctx.workspaceId, taskId, userId: ctx.userId },
    'Updating task'
  );

  // Find task with validation
  const existingTask = await taskRepository.findTaskByIdWithValidation({
    id: taskId,
    workspaceId: ctx.workspaceId,
  });

  if (!existingTask) {
    throw new Error('TASK_NOT_FOUND');
  }

  const {
    title,
    description,
    statusId,
    priority,
    assigneeUserId,
    dueDate,
    projectId,
    brandId,
    checklistItems,
    attachmentMediaIds,
  } = input;

  // Validate status if being updated
  if (statusId) {
    const status = await taskStatusRepository.findStatusByIdWithValidation({
      id: statusId,
      workspaceId: ctx.workspaceId,
    });

    if (!status) {
      throw new Error('STATUS_NOT_FOUND');
    }
  }

  // Validate brand if being updated
  if (brandId !== undefined && brandId !== null) {
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!brand) {
      throw new Error('BRAND_NOT_FOUND');
    }
  }

  // Validate project if being updated
  if (projectId !== undefined && projectId !== null) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }
  }

  // Validate assignee if being updated
  if (assigneeUserId !== undefined && assigneeUserId !== null) {
    const assignee = await prisma.workspaceMember.findFirst({
      where: {
        userId: assigneeUserId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!assignee) {
      throw new Error('ASSIGNEE_NOT_MEMBER');
    }
  }

  // Update task
  await taskRepository.updateTaskById(taskId, {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(statusId !== undefined && { statusId }),
    ...(priority !== undefined && { priority: priority as TaskPriority }),
    ...(assigneeUserId !== undefined && { assigneeUserId }),
    ...(dueDate !== undefined && {
      dueDate: parseDueDate(dueDate),
    }),
    ...(projectId !== undefined && { projectId }),
    ...(brandId !== undefined && { brandId }),
    updatedByUserId: ctx.userId,
  });

  // Update checklist items if provided
  if (checklistItems !== undefined) {
    const existingItems = await taskRepository.findChecklistItemsByTaskId(taskId);
    const existingIds = existingItems.map((item) => item.id);
    const providedIds = checklistItems.filter((item) => item.id).map((item) => item.id!);

    // Create new items
    const newItems = checklistItems.filter((item) => !item.id);
    await Promise.all(
      newItems.map((item, index) =>
        taskRepository.createChecklistItem({
          taskId,
          title: item.title,
          sortOrder: item.sortOrder ?? index,
          createdByUserId: ctx.userId,
        })
      )
    );

    // Update existing items
    const updateItems = checklistItems.filter((item) => item.id);
    await Promise.all(
      updateItems.map((item) =>
        taskRepository.updateChecklistItem(item.id!, {
          title: item.title,
          isCompleted: item.isCompleted,
          sortOrder: item.sortOrder,
          completedByUserId: item.isCompleted ? ctx.userId : null,
        })
      )
    );

    // Delete items not in the list
    const idsToDelete = existingIds.filter((id) => !providedIds.includes(id));
    if (idsToDelete.length > 0) {
      await taskRepository.deleteChecklistItemsNotIn(taskId, providedIds);
    }
  }

  // Update attachments if provided
  if (attachmentMediaIds !== undefined) {
    const existingAttachments = await taskRepository.findAttachmentsByTaskId(taskId);
    const existingMediaIds = existingAttachments.map((att) => att.mediaId);

    // Validate new media IDs
    const mediaRecords = await prisma.media.findMany({
      where: {
        id: { in: attachmentMediaIds },
        workspaceId: ctx.workspaceId,
      },
      select: { id: true },
    });

    const validMediaIds = mediaRecords.map((m) => m.id);

    // Create new attachments
    const newMediaIds = validMediaIds.filter((id) => !existingMediaIds.includes(id));
    await Promise.all(
      newMediaIds.map((mediaId) =>
        taskRepository.createAttachment({
          taskId,
          mediaId,
          createdByUserId: ctx.userId,
        })
      )
    );

    // Delete attachments not in the list
    const attachmentsToKeep = existingAttachments
      .filter((att) => validMediaIds.includes(att.mediaId))
      .map((att) => att.id);

    if (attachmentsToKeep.length < existingAttachments.length) {
      await taskRepository.deleteAttachmentsNotIn(taskId, attachmentsToKeep);
    }
  }

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingTask.brandId,
    entityType: ActivityEntityType.TASK,
    entityId: taskId,
    eventKey: 'task.updated',
    message: `Task updated: ${title || existingTask.title}`,
    context: 'task',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      taskId,
      changes: input,
    },
  });

  // Fetch updated task with relations
  const updatedTask = await taskRepository.findTaskById(taskId);
  return await toTaskDto(updatedTask);
}

/**
 * Get a task by ID with optional includes
 */
export async function getTaskById(
  ctx: TaskServiceContext,
  taskId: string,
  options?: {
    includeChecklist?: boolean;
    includeAttachments?: boolean;
    includeComments?: boolean;
  }
): Promise<TaskDetailDto | null> {
  const {
    includeChecklist = true,
    includeAttachments = true,
    includeComments = true,
  } = options || {};

  const task = await taskRepository.findTaskByIdWithValidation({
    id: taskId,
    workspaceId: ctx.workspaceId,
  });

  if (!task) {
    return null;
  }

  // Build response DTO
  const taskDto: TaskDetailDto = {
    id: task.id,
    workspaceId: task.workspaceId,
    brandId: task.brandId,
    projectId: task.projectId,
    statusId: task.statusId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    assigneeUserId: task.assigneeUserId,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdByUserId: task.createdByUserId,
    updatedByUserId: task.updatedByUserId,
    deletedAt: task.deletedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    status: {
      id: task.status.id,
      workspaceId: task.status.workspaceId,
      brandId: task.status.brandId,
      group: task.status.group,
      key: task.status.key,
      label: task.status.label,
      color: task.status.color,
      isDefault: task.status.isDefault,
      isSystem: task.status.isSystem,
      isActive: task.status.isActive,
      sortOrder: task.status.sortOrder,
      createdAt: task.status.createdAt.toISOString(),
      updatedAt: task.status.updatedAt.toISOString(),
    },
  };

  // Add project if available
  if (task.project) {
    taskDto.project = {
      id: task.project.id,
      name: task.project.name,
    };
  }

  // Add assignee if available
  if (task.assigneeUser) {
    taskDto.assigneeUser = {
      id: task.assigneeUser.id,
      name: task.assigneeUser.name,
      email: task.assigneeUser.email,
      avatarUrl: task.assigneeUser.avatarUrl,
    };
  }

  // Add checklist items
  if (includeChecklist && task.checklistItems) {
    taskDto.checklistItems = task.checklistItems.map((item: any) => ({
      id: item.id,
      taskId: item.taskId,
      title: item.title,
      isCompleted: item.isCompleted,
      sortOrder: item.sortOrder,
      createdByUserId: item.createdByUserId,
      completedAt: item.completedAt?.toISOString() ?? null,
      completedByUserId: item.completedByUserId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  // Add attachments
  if (includeAttachments && task.attachments) {
    taskDto.attachments = task.attachments.map((att: any) => ({
      id: att.id,
      taskId: att.taskId,
      mediaId: att.mediaId,
      title: att.title,
      createdByUserId: att.createdByUserId,
      createdAt: att.createdAt.toISOString(),
      updatedAt: att.updatedAt.toISOString(),
    }));
  }

  // Add comments
  if (includeComments) {
    const commentsResult = await commentRepository.findManyByEntity({
      workspaceId: ctx.workspaceId,
      brandId: task.brandId ?? undefined,
      entityType: 'TASK',
      entityId: task.id,
      includeDeleted: false,
      page: 1,
      limit: 100, // Get all comments for task detail (adjust if needed)
    });

    taskDto.comments = commentsResult.comments.map((comment: any) => ({
      id: comment.id,
      body: comment.body,
      authorUserId: comment.authorUserId,
      parentId: comment.parentId,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt?.toISOString() ?? null,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: {
        id: comment.authorUser.id,
        name: comment.authorUser.name,
        email: comment.authorUser.email,
        avatarUrl: comment.authorUser.avatarUrl,
      },
    }));
  }

  return taskDto;
}

/**
 * List tasks
 */
export async function listTasks(
  ctx: TaskServiceContext,
  query: {
    brandId?: string;
    projectId?: string;
    statusIds?: string[];
    assigneeUserId?: string;
    page?: number;
    limit?: number;
  }
): Promise<{
  tasks: TaskWithRelationsDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const { brandId, projectId, statusIds, assigneeUserId, page = 1, limit = 20 } = query;

  const result = await taskRepository.listTasks({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? undefined,
    projectId: projectId ?? undefined,
    statusIds,
    assigneeUserId: assigneeUserId ?? undefined,
    page,
    limit,
  });

  const tasks = await Promise.all(result.tasks.map(toTaskDto));
  
  return {
    tasks,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  };
}

/**
 * Delete a task (soft delete)
 */
export async function deleteTask(
  ctx: TaskServiceContext,
  taskId: string
): Promise<void> {
  logger.info(
    { workspaceId: ctx.workspaceId, taskId, userId: ctx.userId },
    'Deleting task'
  );

  // Find task with validation
  const existingTask = await taskRepository.findTaskByIdWithValidation({
    id: taskId,
    workspaceId: ctx.workspaceId,
  });

  if (!existingTask) {
    throw new Error('TASK_NOT_FOUND');
  }

  // Soft delete task
  await taskRepository.softDeleteTaskById(taskId);

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingTask.brandId,
    entityType: ActivityEntityType.TASK,
    entityId: taskId,
    eventKey: 'task.deleted',
    message: `Task deleted: ${existingTask.title}`,
    context: 'task',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      taskId,
      title: existingTask.title,
    },
  });
}

