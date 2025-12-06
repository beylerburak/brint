/**
 * TaskStatus Service
 * 
 * Business logic layer for TaskStatus operations.
 * Handles workspace/brand-level status management and default status creation.
 */

import { TaskStatusRepository } from './task-status.repository.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { logActivity } from '../../core/activity/activity-log.service.js';
import { ActivityActorType, ActivityEntityType } from '@prisma/client';
import type { TaskStatusGroup } from '@prisma/client';
import type {
  CreateTaskStatusInput,
  UpdateTaskStatusInput,
  TaskStatusDto,
} from './task.entity.js';

const taskStatusRepository = new TaskStatusRepository();

/**
 * Service context from authenticated request
 */
export type TaskStatusServiceContext = {
  userId: string;
  workspaceId: string;
};

/**
 * Convert Prisma status to DTO
 */
function toTaskStatusDto(status: any): TaskStatusDto {
  return {
    id: status.id,
    workspaceId: status.workspaceId,
    brandId: status.brandId,
    group: status.group,
    key: status.key,
    label: status.label,
    color: status.color,
    isDefault: status.isDefault,
    isSystem: status.isSystem,
    isActive: status.isActive,
    sortOrder: status.sortOrder,
    createdAt: status.createdAt.toISOString(),
    updatedAt: status.updatedAt.toISOString(),
  };
}

/**
 * Get statuses for workspace/brand scope (grouped by group)
 */
export async function getStatusesForScope(
  ctx: TaskStatusServiceContext,
  params: { brandId?: string }
): Promise<{
  TODO: TaskStatusDto[];
  IN_PROGRESS: TaskStatusDto[];
  DONE: TaskStatusDto[];
}> {
  const { brandId } = params;

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

  const statuses = await taskStatusRepository.findStatusesForWorkspaceAndBrand({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? undefined,
  });

  const grouped = {
    TODO: statuses.filter((s) => s.group === 'TODO').map(toTaskStatusDto),
    IN_PROGRESS: statuses.filter((s) => s.group === 'IN_PROGRESS').map(toTaskStatusDto),
    DONE: statuses.filter((s) => s.group === 'DONE').map(toTaskStatusDto),
  };

  return grouped;
}

/**
 * Create a custom status
 */
export async function createCustomStatus(
  ctx: TaskStatusServiceContext,
  input: CreateTaskStatusInput
): Promise<TaskStatusDto> {
  const { group, key, label, color, brandId, isDefault, sortOrder } = input;

  logger.info(
    { workspaceId: ctx.workspaceId, group, label, brandId },
    'Creating custom status'
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

  // If setting as default, unset other defaults in the same group
  if (isDefault) {
    await taskStatusRepository.unsetDefaultForGroup({
      workspaceId: ctx.workspaceId,
      brandId: brandId ?? undefined,
      group: group as TaskStatusGroup,
    });
  }

  // Create status
  const status = await taskStatusRepository.createStatus({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? null,
    group: group as TaskStatusGroup,
    key,
    label,
    color: color ?? null,
    isDefault: isDefault ?? false,
    isSystem: false,
    sortOrder: sortOrder ?? 0,
  });

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? null,
    entityType: ActivityEntityType.OTHER,
    entityId: status.id,
    eventKey: 'task_status.created',
    message: `Task status created: ${status.label}`,
    context: 'task_status',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      statusId: status.id,
      group: status.group,
      label: status.label,
      brandId: status.brandId,
    },
  });

  return toTaskStatusDto(status);
}

/**
 * Update a status
 */
export async function updateStatus(
  ctx: TaskStatusServiceContext,
  statusId: string,
  input: UpdateTaskStatusInput
): Promise<TaskStatusDto> {
  logger.info(
    { workspaceId: ctx.workspaceId, statusId, userId: ctx.userId },
    'Updating status'
  );

  // Find status with validation
  const existingStatus = await taskStatusRepository.findStatusByIdWithValidation({
    id: statusId,
    workspaceId: ctx.workspaceId,
  });

  if (!existingStatus) {
    throw new Error('STATUS_NOT_FOUND');
  }

  const { label, color, isDefault, sortOrder } = input;

  // If setting as default, unset other defaults in the same group
  if (isDefault && !existingStatus.isDefault) {
    await taskStatusRepository.unsetDefaultForGroup({
      workspaceId: ctx.workspaceId,
      brandId: existingStatus.brandId ?? undefined,
      group: existingStatus.group,
      excludeId: statusId,
    });
  }

  // Update status (label and color can be updated even for system statuses)
  const updatedStatus = await taskStatusRepository.updateStatusById(statusId, {
    ...(label !== undefined && { label }),
    ...(color !== undefined && { color }),
    ...(isDefault !== undefined && { isDefault }),
    ...(sortOrder !== undefined && { sortOrder }),
  });

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingStatus.brandId,
    entityType: ActivityEntityType.OTHER,
    entityId: statusId,
    eventKey: 'task_status.updated',
    message: `Task status updated: ${updatedStatus.label}`,
    context: 'task_status',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      statusId,
      changes: input,
    },
  });

  return toTaskStatusDto(updatedStatus);
}

/**
 * Delete a status (soft delete)
 */
export async function deleteStatus(
  ctx: TaskStatusServiceContext,
  statusId: string
): Promise<void> {
  logger.info(
    { workspaceId: ctx.workspaceId, statusId, userId: ctx.userId },
    'Deleting status'
  );

  // Find status with validation
  const existingStatus = await taskStatusRepository.findStatusByIdWithValidation({
    id: statusId,
    workspaceId: ctx.workspaceId,
  });

  if (!existingStatus) {
    throw new Error('STATUS_NOT_FOUND');
  }

  // Cannot delete system statuses
  if (existingStatus.isSystem) {
    throw new Error('CANNOT_DELETE_SYSTEM_STATUS');
  }

  // Check if status is in use
  const taskCount = await taskStatusRepository.countTasksUsingStatus(statusId);
  if (taskCount > 0) {
    throw new Error('STATUS_IN_USE');
  }

  // If this was the default, ensure another default exists
  if (existingStatus.isDefault) {
    const otherStatuses = await taskStatusRepository.findStatusesForWorkspaceAndBrand({
      workspaceId: ctx.workspaceId,
      brandId: existingStatus.brandId ?? undefined,
    });

    const sameGroupStatuses = otherStatuses.filter(
      (s) => s.group === existingStatus.group && s.id !== statusId
    );

    if (sameGroupStatuses.length === 0) {
      throw new Error('CANNOT_DELETE_LAST_STATUS_IN_GROUP');
    }

    // Set another status as default
    const nextDefault = sameGroupStatuses[0];
    await taskStatusRepository.updateStatusById(nextDefault.id, {
      isDefault: true,
    });
  }

  // Soft delete status
  await taskStatusRepository.softDeleteStatusById(statusId);

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingStatus.brandId,
    entityType: ActivityEntityType.OTHER,
    entityId: statusId,
    eventKey: 'task_status.deleted',
    message: `Task status deleted: ${existingStatus.label}`,
    context: 'task_status',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      statusId,
      label: existingStatus.label,
      group: existingStatus.group,
    },
  });
}

/**
 * Ensure default statuses exist for workspace
 * 
 * TODO: Call this when a workspace is created
 * This creates 3 default system statuses (NOT_STARTED, IN_PROGRESS, COMPLETED)
 */
export async function ensureDefaultStatusesForWorkspace(
  workspaceId: string
): Promise<void> {
  logger.info({ workspaceId }, 'Ensuring default statuses for workspace');

  // Check if default statuses already exist
  const existing = await taskStatusRepository.findStatusesForWorkspaceAndBrand({
    workspaceId,
    brandId: null,
  });

  if (existing.length > 0) {
    logger.info({ workspaceId }, 'Default statuses already exist');
    return;
  }

  // Create default statuses
  await taskStatusRepository.createDefaultStatusesForWorkspace(workspaceId);

  logger.info({ workspaceId }, 'Default statuses created');
}

