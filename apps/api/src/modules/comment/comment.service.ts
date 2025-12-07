/**
 * Comment Service
 * 
 * Business logic layer for Comment operations.
 * Handles validation, permissions, and activity logging.
 */

import { CommentRepository } from './comment.repository.js';
import { TaskRepository } from '../task/task.repository.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { logActivity } from '../../core/activity/activity-log.service.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';
import { ActivityActorType, ActivityEntityType } from '@prisma/client';
import type {
  CreateCommentInput,
  UpdateCommentInput,
  ListCommentsQuery,
  CommentWithAuthorDto,
  PaginatedCommentsDto,
} from './comment.entity.js';

const commentRepository = new CommentRepository();
const taskRepository = new TaskRepository();

/**
 * Service context from authenticated request
 */
export type CommentServiceContext = {
  userId: string;
  workspaceId: string;
  brandId?: string | null;
};

/**
 * Entity validation result
 */
type EntityValidationResult = {
  workspaceId: string;
  brandId: string | null;
  entityType: string;
  entityId: string;
  taskId?: string; // For TASK entity type
  projectId?: string | null; // For enriching ActivityLog
};

/**
 * Validate and authorize access to entity for commenting
 * 
 * Ensures:
 * - Entity exists
 * - Entity belongs to the workspace
 * - User has permission to access the entity
 * - Returns correct brandId from entity (not from input)
 */
async function assertCanAccessEntityForComment(
  ctx: CommentServiceContext,
  params: {
    entityType: string;
    entityId: string;
    brandId?: string | null;
  }
): Promise<EntityValidationResult> {
  const { entityType, entityId } = params;

  // TASK entity validation
  if (entityType === 'TASK') {
    // Find task with workspace validation
    const task = await taskRepository.findTaskByIdWithValidation({
      id: entityId,
      workspaceId: ctx.workspaceId,
    });

    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }

    // Brand validation if task has brandId
    if (task.brandId) {
      // Verify user has access to this brand
      const member = await prisma.workspaceMember.findFirst({
        where: {
          userId: ctx.userId,
          workspaceId: ctx.workspaceId,
        },
      });

      if (!member) {
        throw new Error('FORBIDDEN');
      }

      // Additional brand check could be added here if needed
      // For now, workspace membership is sufficient
    }

    return {
      workspaceId: ctx.workspaceId,
      brandId: task.brandId, // Use brandId from Task, not from input
      entityType: 'TASK',
      entityId: task.id,
      taskId: task.id,
      projectId: task.projectId,
    };
  }

  // TODO: Add validation for other entity types (CONTENT, CRM_CONTACT, etc.)
  // For now, just do basic workspace membership check
  logger.warn(
    { entityType, entityId },
    'Entity type validation not implemented, using basic workspace check'
  );

  // Basic workspace membership check
  const member = await prisma.workspaceMember.findFirst({
    where: {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
    },
  });

  if (!member) {
    throw new Error('FORBIDDEN');
  }

  return {
    workspaceId: ctx.workspaceId,
    brandId: params.brandId ?? null,
    entityType,
    entityId,
  };
}

/**
 * Convert Prisma comment to DTO with avatar URL generation
 */
async function toCommentDto(comment: any): Promise<CommentWithAuthorDto> {
  let avatarUrl = comment.authorUser.avatarUrl;

  if (!avatarUrl && comment.authorUser.avatarMediaId && comment.authorUser.avatarMedia) {
    try {
      const { bucket, variants } = comment.authorUser.avatarMedia;
      if (bucket && variants) {
        avatarUrl = await getMediaVariantUrlAsync(bucket, variants, 'thumbnail', false);
      }
    } catch (error) {
      // Ignore error, keep null
    }
  }

  return {
    id: comment.id,
    workspaceId: comment.workspaceId,
    brandId: comment.brandId,
    entityType: comment.entityType,
    entityId: comment.entityId,
    authorUserId: comment.authorUserId,
    body: comment.body,
    parentId: comment.parentId,
    isEdited: comment.isEdited,
    editedAt: comment.editedAt?.toISOString() ?? null,
    deletedAt: comment.deletedAt?.toISOString() ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: {
      id: comment.authorUser.id,
      name: comment.authorUser.name,
      email: comment.authorUser.email,
      avatarUrl,
      avatarMediaId: comment.authorUser.avatarMediaId,
    },
  };
}

/**
 * List comments for a specific entity
 */
export async function listCommentsForEntity(
  ctx: CommentServiceContext,
  query: ListCommentsQuery
): Promise<PaginatedCommentsDto> {
  const { entityType, entityId, brandId, page, limit, includeDeleted } = query;

  logger.info(
    { workspaceId: ctx.workspaceId, entityType, entityId },
    'Listing comments for entity'
  );

  // Validate entity access and get correct brandId
  const validation = await assertCanAccessEntityForComment(ctx, {
    entityType,
    entityId,
    brandId,
  });

  const result = await commentRepository.findManyByEntity({
    workspaceId: validation.workspaceId,
    brandId: validation.brandId, // Use validated brandId from entity
    entityType,
    entityId,
    includeDeleted,
    page,
    limit,
  });

  const comments = await Promise.all(result.comments.map(toCommentDto));

  return {
    comments,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  };
}

/**
 * Create a new comment
 */
export async function createComment(
  ctx: CommentServiceContext,
  input: CreateCommentInput
): Promise<CommentWithAuthorDto> {
  const { entityType, entityId, body, parentId } = input;

  logger.info(
    { workspaceId: ctx.workspaceId, entityType, entityId, authorUserId: ctx.userId },
    'Creating comment'
  );

  // Validate entity access and get correct brandId
  const validation = await assertCanAccessEntityForComment(ctx, {
    entityType,
    entityId,
    brandId: input.brandId,
  });

  // Create comment with validated data
  const comment = await commentRepository.create({
    workspaceId: validation.workspaceId,
    brandId: validation.brandId, // Use brandId from entity (Task.brandId)
    entityType,
    entityId,
    authorUserId: ctx.userId,
    body,
    parentId: parentId ?? null,
  });

  // Log activity with enriched payload
  const activityPayload: any = {
    commentId: comment.id,
    targetEntityType: entityType,
    targetEntityId: entityId,
    isReply: !!parentId,
    parentId: parentId ?? null,
  };

  // Enrich payload for TASK entity
  if (entityType === 'TASK' && validation.taskId) {
    activityPayload.taskId = validation.taskId;
    if (validation.projectId) {
      activityPayload.projectId = validation.projectId;
    }
  }

  await logActivity({
    workspaceId: validation.workspaceId,
    brandId: validation.brandId,
    entityType: ActivityEntityType.COMMENT,
    entityId: comment.id,
    eventKey: 'comment.created',
    message: `Comment added to ${entityType}`,
    context: 'comment',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: activityPayload,
  });

  return toCommentDto(comment);
}

/**
 * Update a comment
 */
export async function updateComment(
  ctx: CommentServiceContext,
  commentId: string,
  input: UpdateCommentInput
): Promise<CommentWithAuthorDto> {
  logger.info(
    { workspaceId: ctx.workspaceId, commentId, userId: ctx.userId },
    'Updating comment'
  );

  // Find comment with validation
  const existingComment = await commentRepository.findByIdWithValidation({
    id: commentId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
  });

  if (!existingComment) {
    throw new Error('COMMENT_NOT_FOUND');
  }

  // Check if user is the author
  if (existingComment.authorUserId !== ctx.userId) {
    throw new Error('FORBIDDEN');
  }

  // Check if comment is deleted
  if (existingComment.deletedAt) {
    throw new Error('COMMENT_DELETED');
  }

  // Update comment
  const updatedComment = await commentRepository.updateById(commentId, {
    body: input.body,
  });

  // Enrich activity log payload for TASK entity
  const activityPayload: any = {
    commentId,
    targetEntityType: existingComment.entityType,
    targetEntityId: existingComment.entityId,
  };

  // Add taskId and projectId if commenting on a TASK
  if (existingComment.entityType === 'TASK') {
    const task = await taskRepository.findTaskByIdWithValidation({
      id: existingComment.entityId,
      workspaceId: ctx.workspaceId,
    });

    if (task) {
      activityPayload.taskId = task.id;
      if (task.projectId) {
        activityPayload.projectId = task.projectId;
      }
    }
  }

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingComment.brandId,
    entityType: ActivityEntityType.COMMENT,
    entityId: commentId,
    eventKey: 'comment.updated',
    message: 'Comment updated',
    context: 'comment',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: activityPayload,
  });

  return toCommentDto(updatedComment);
}

/**
 * Delete a comment (soft delete)
 */
export async function deleteComment(
  ctx: CommentServiceContext,
  commentId: string
): Promise<void> {
  logger.info(
    { workspaceId: ctx.workspaceId, commentId, userId: ctx.userId },
    'Deleting comment'
  );

  // Find comment with validation
  const existingComment = await commentRepository.findByIdWithValidation({
    id: commentId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
  });

  if (!existingComment) {
    throw new Error('COMMENT_NOT_FOUND');
  }

  // Check if user is the author
  if (existingComment.authorUserId !== ctx.userId) {
    throw new Error('FORBIDDEN');
  }

  // Check if already deleted
  if (existingComment.deletedAt) {
    throw new Error('COMMENT_ALREADY_DELETED');
  }

  // Soft delete
  await commentRepository.softDeleteById(commentId);

  // Enrich activity log payload for TASK entity
  const activityPayload: any = {
    commentId,
    targetEntityType: existingComment.entityType,
    targetEntityId: existingComment.entityId,
  };

  // Add taskId and projectId if commenting on a TASK
  if (existingComment.entityType === 'TASK') {
    const task = await taskRepository.findTaskByIdWithValidation({
      id: existingComment.entityId,
      workspaceId: ctx.workspaceId,
    });

    if (task) {
      activityPayload.taskId = task.id;
      if (task.projectId) {
        activityPayload.projectId = task.projectId;
      }
    }
  }

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingComment.brandId,
    entityType: ActivityEntityType.COMMENT,
    entityId: commentId,
    eventKey: 'comment.deleted',
    message: 'Comment deleted',
    context: 'comment',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: activityPayload,
  });
}

/**
 * Get a single comment by ID
 */
export async function getCommentById(
  ctx: CommentServiceContext,
  commentId: string
): Promise<CommentWithAuthorDto | null> {
  const comment = await commentRepository.findByIdWithValidation({
    id: commentId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
  });

  if (!comment) {
    return null;
  }

  return toCommentDto(comment);
}

