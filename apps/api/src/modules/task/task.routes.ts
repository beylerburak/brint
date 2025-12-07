/**
 * Task Routes
 * 
 * HTTP endpoints for task CRUD operations including checklist and attachments.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { getWorkspaceIdFromRequest } from '../../core/auth/workspace-context.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';
import { prisma } from '../../lib/prisma.js';
import {
  createTask,
  updateTask,
  getTaskById,
  listTasks,
  deleteTask,
} from './task.service.js';
import {
  listCommentsForEntity,
  createComment,
  updateComment,
  deleteComment,
} from '../comment/comment.service.js';
import {
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
} from './task.entity.js';
import {
  UpdateCommentInputSchema,
} from '../comment/comment.entity.js';
import { ZodError } from 'zod';
import { broadcastTaskEvent } from './task-websocket.routes.js';
import { ActivityEntityType } from '@prisma/client';

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  // GET /tasks - List tasks
  app.get('/tasks', {
    preHandler: requireWorkspaceRoleFor('task:list'),
    schema: {
      tags: ['Task'],
      summary: 'List tasks',
      description: 'Returns all tasks in the workspace. Requires VIEWER role.',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string' },
          projectId: { type: 'string' },
          statusIds: { type: 'array', items: { type: 'string' } },
          assigneeUserId: { type: 'string' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const query = request.query as any;

      const result = await listTasks(
        { userId, workspaceId },
        {
          brandId: query.brandId,
          projectId: query.projectId,
          statusIds: query.statusIds,
          assigneeUserId: query.assigneeUserId,
          page: query.page ? parseInt(query.page) : 1,
          limit: query.limit ? parseInt(query.limit) : 20,
        }
      );

      return reply.status(200).send({
        success: true,
        tasks: result.tasks,
        pagination: result.pagination,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to list tasks');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list tasks',
        },
      });
    }
  });

  // POST /tasks - Create a task
  app.post('/tasks', {
    preHandler: requireWorkspaceRoleFor('task:create'),
    schema: {
      tags: ['Task'],
      summary: 'Create a task',
      description: 'Create a new task with optional checklist and attachments. Requires EDITOR role.',
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          brandId: { type: 'string' },
          projectId: { type: 'string' },
          statusId: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          assigneeUserId: { type: 'string' },
          dueDate: { type: 'string', format: 'date-time' },
          checklistItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                sortOrder: { type: 'number' },
              },
              required: ['title'],
            },
          },
          attachmentMediaIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const body = request.body as any;
      const input = {
        ...CreateTaskInputSchema.parse(body),
        checklistItems: body.checklistItems,
        attachmentMediaIds: body.attachmentMediaIds,
      };

      const task = await createTask(
        { userId, workspaceId },
        input
      );

      // Broadcast task created event
      broadcastTaskEvent(workspaceId, {
        type: 'task.created',
        data: task,
      }, input.brandId || undefined);

      return reply.status(201).send({
        success: true,
        task,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid task data',
            details: error.errors,
          },
        });
      }

      if (error instanceof Error) {
        if (error.message === 'BRAND_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'BRAND_NOT_FOUND',
              message: 'Brand not found',
            },
          });
        }

        if (error.message === 'PROJECT_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project not found',
            },
          });
        }

        if (error.message === 'STATUS_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'STATUS_NOT_FOUND',
              message: 'Task status not found',
            },
          });
        }

        if (error.message === 'NO_DEFAULT_STATUS') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'NO_DEFAULT_STATUS',
              message: 'No default status found. Please specify a status.',
            },
          });
        }

        if (error.message === 'ASSIGNEE_NOT_MEMBER') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'ASSIGNEE_NOT_MEMBER',
              message: 'Assignee must be a workspace member',
            },
          });
        }
      }

      request.log.error({ error }, 'Failed to create task');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create task',
        },
      });
    }
  });

  // GET /tasks/:taskId - Get task details
  app.get('/tasks/:taskId', {
    preHandler: requireWorkspaceRoleFor('task:view'),
    schema: {
      tags: ['Task'],
      summary: 'Get task details',
      description: 'Returns detailed information about a specific task including checklist and attachments.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId } = request.params as { taskId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const task = await getTaskById(
        { userId, workspaceId },
        taskId
      );

      if (!task) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: 'Task not found',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        task,
      });
    } catch (error) {
      request.log.error({ error, taskId }, 'Failed to get task');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get task',
        },
      });
    }
  });

  // PATCH /tasks/:taskId - Update a task
  app.patch('/tasks/:taskId', {
    preHandler: requireWorkspaceRoleFor('task:update'),
    schema: {
      tags: ['Task'],
      summary: 'Update a task',
      description: 'Update an existing task including checklist and attachments. Requires EDITOR role.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          brandId: { type: 'string' },
          projectId: { type: 'string' },
          statusId: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          assigneeUserId: { type: 'string', nullable: true },
          dueDate: { type: 'string', format: 'date-time' },
          checklistItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                isCompleted: { type: 'boolean' },
                sortOrder: { type: 'number' },
              },
              required: ['title'],
            },
          },
          attachmentMediaIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId } = request.params as { taskId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const body = request.body as any;
      const input = {
        ...UpdateTaskInputSchema.parse(body),
        checklistItems: body.checklistItems,
        attachmentMediaIds: body.attachmentMediaIds,
      };

      const task = await updateTask(
        { userId, workspaceId },
        taskId,
        input
      );

      // Broadcast task updated event
      broadcastTaskEvent(workspaceId, {
        type: 'task.updated',
        data: task,
      }, task.brandId || undefined);

      return reply.status(200).send({
        success: true,
        task,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid task data',
            details: error.errors,
          },
        });
      }

      if (error instanceof Error) {
        if (error.message === 'TASK_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'TASK_NOT_FOUND',
              message: 'Task not found',
            },
          });
        }

        if (error.message === 'STATUS_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'STATUS_NOT_FOUND',
              message: 'Task status not found',
            },
          });
        }

        if (error.message === 'BRAND_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'BRAND_NOT_FOUND',
              message: 'Brand not found',
            },
          });
        }

        if (error.message === 'PROJECT_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project not found',
            },
          });
        }

        if (error.message === 'ASSIGNEE_NOT_MEMBER') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'ASSIGNEE_NOT_MEMBER',
              message: 'Assignee must be a workspace member',
            },
          });
        }
      }

      request.log.error({ error, taskId }, 'Failed to update task');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update task',
        },
      });
    }
  });

  // DELETE /tasks/:taskId - Delete a task
  app.delete('/tasks/:taskId', {
    preHandler: requireWorkspaceRoleFor('task:delete'),
    schema: {
      tags: ['Task'],
      summary: 'Delete a task',
      description: 'Soft delete a task. Requires ADMIN role.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId } = request.params as { taskId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      // Get task before deletion to get brandId for WebSocket broadcast
      const task = await getTaskById({ userId, workspaceId }, taskId);

      await deleteTask(
        { userId, workspaceId },
        taskId
      );

      // Broadcast task deleted event
      broadcastTaskEvent(workspaceId, {
        type: 'task.deleted',
        data: { id: taskId },
      }, task?.brandId || undefined);

      return reply.status(200).send({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'TASK_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: 'Task not found',
          },
        });
      }

      request.log.error({ error, taskId }, 'Failed to delete task');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete task',
        },
      });
    }
  });

  // ============================================================================
  // Task Comment Routes (Sugar endpoints - use generic /comments API)
  // ============================================================================

  // GET /tasks/:taskId/comments - List comments for a task
  app.get('/tasks/:taskId/comments', {
    preHandler: requireWorkspaceRoleFor('comment:list'),
    schema: {
      tags: ['Task', 'Comment'],
      summary: 'List comments for a task',
      description: 'Returns all comments for a specific task. Sugar endpoint over /comments.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId } = request.params as { taskId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);
    const query = request.query as any;

    try {
      const result = await listCommentsForEntity(
        { userId, workspaceId },
        {
          entityType: 'TASK',
          entityId: taskId,
          page: query.page ? parseInt(query.page) : 1,
          limit: query.limit ? parseInt(query.limit) : 20,
          includeDeleted: false,
        }
      );

      return reply.status(200).send({
        success: true,
        comments: result.comments,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'TASK_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: 'Task not found',
          },
        });
      }

      request.log.error({ error, taskId }, 'Failed to list task comments');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list task comments',
        },
      });
    }
  });

  // POST /tasks/:taskId/comments - Create a comment on a task
  app.post('/tasks/:taskId/comments', {
    preHandler: requireWorkspaceRoleFor('comment:create'),
    schema: {
      tags: ['Task', 'Comment'],
      summary: 'Create a comment on a task',
      description: 'Add a new comment to a task. Sugar endpoint over /comments.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
      body: {
        type: 'object',
        properties: {
          body: { type: 'string' },
          parentId: { type: 'string' },
        },
        required: ['body'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId } = request.params as { taskId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);
    const { body, parentId } = request.body as { body: string; parentId?: string };

    try {
      const comment = await createComment(
        { userId, workspaceId },
        {
          entityType: 'TASK',
          entityId: taskId,
          body,
          parentId: parentId ?? null,
        }
      );

      return reply.status(201).send({
        success: true,
        comment,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'TASK_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'TASK_NOT_FOUND',
              message: 'Task not found',
            },
          });
        }
      }

      request.log.error({ error, taskId }, 'Failed to create task comment');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create task comment',
        },
      });
    }
  });

  // PATCH /tasks/:taskId/comments/:commentId - Update a comment
  app.patch('/tasks/:taskId/comments/:commentId', {
    preHandler: requireWorkspaceRoleFor('comment:update'),
    schema: {
      tags: ['Task', 'Comment'],
      summary: 'Update a task comment',
      description: 'Update an existing comment on a task. Only author can update.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          commentId: { type: 'string' },
        },
        required: ['taskId', 'commentId'],
      },
      body: {
        type: 'object',
        properties: {
          body: { type: 'string' },
        },
        required: ['body'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId, commentId } = request.params as { taskId: string; commentId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const input = UpdateCommentInputSchema.parse(request.body);

      // Verify comment belongs to this task (consistency check)
      const existingComment = await prisma.comment.findFirst({
        where: {
          id: commentId,
          entityType: 'TASK',
          entityId: taskId,
          workspaceId,
        },
      });

      if (!existingComment) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found for this task',
          },
        });
      }

      const comment = await updateComment(
        { userId, workspaceId },
        commentId,
        input
      );

      return reply.status(200).send({
        success: true,
        comment,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid comment data',
            details: error.errors,
          },
        });
      }

      if (error instanceof Error) {
        if (error.message === 'FORBIDDEN') {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only update your own comments',
            },
          });
        }
      }

      request.log.error({ error, taskId, commentId }, 'Failed to update task comment');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update task comment',
        },
      });
    }
  });

  // DELETE /tasks/:taskId/comments/:commentId - Delete a comment
  app.delete('/tasks/:taskId/comments/:commentId', {
    preHandler: requireWorkspaceRoleFor('comment:delete'),
    schema: {
      tags: ['Task', 'Comment'],
      summary: 'Delete a task comment',
      description: 'Soft delete a comment on a task. Only author can delete.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          commentId: { type: 'string' },
        },
        required: ['taskId', 'commentId'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId, commentId } = request.params as { taskId: string; commentId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      // Verify comment belongs to this task (consistency check)
      const existingComment = await prisma.comment.findFirst({
        where: {
          id: commentId,
          entityType: 'TASK',
          entityId: taskId,
          workspaceId,
        },
      });

      if (!existingComment) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found for this task',
          },
        });
      }

      await deleteComment(
        { userId, workspaceId },
        commentId
      );

      return reply.status(200).send({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'FORBIDDEN') {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only delete your own comments',
            },
          });
        }
      }

      request.log.error({ error, taskId, commentId }, 'Failed to delete task comment');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete task comment',
        },
      });
    }
  });

  // GET /tasks/:taskId/activity - Get task activity logs
  app.get('/tasks/:taskId/activity', {
    preHandler: requireWorkspaceRoleFor('task:view'),
    schema: {
      tags: ['Task'],
      summary: 'Get task activity logs',
      description: 'Returns activity logs for a specific task. Requires VIEWER role.',
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { taskId } = request.params as { taskId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);
    const query = request.query as { page?: number; limit?: number };

    try {
      // Verify task exists and user has access
      const task = await getTaskById(
        { userId, workspaceId },
        taskId
      );

      if (!task) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: 'Task not found',
          },
        });
      }

      const page = query.page ? parseInt(String(query.page)) : 1;
      const limit = query.limit ? parseInt(String(query.limit)) : 50;
      const skip = (page - 1) * limit;

      // Fetch activity logs for this task
      const [activityLogs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: {
            workspaceId,
            entityType: ActivityEntityType.TASK,
            entityId: taskId,
          },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.activityLog.count({
          where: {
            workspaceId,
            entityType: ActivityEntityType.TASK,
            entityId: taskId,
          },
        }),
      ]);

      // Fetch actor user information for USER type actors
      const actorUserIds = activityLogs
        .filter(log => log.actorType === 'USER' && log.actorUserId)
        .map(log => log.actorUserId!)
        .filter((id, index, self) => self.indexOf(id) === index); // unique

      const actorUsers = actorUserIds.length > 0
        ? await prisma.user.findMany({
          where: {
            id: { in: actorUserIds },
          },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            avatarMediaId: true,
            avatarMedia: {
              select: {
                bucket: true,
                variants: true,
              },
            },
          },
        })
        : [];

      // Generate avatar URLs for users
      await Promise.all(actorUsers.map(async (user: any) => {
        if (!user.avatarUrl && user.avatarMediaId && user.avatarMedia) {
          try {
            const { bucket, variants } = user.avatarMedia;
            if (bucket && variants) {
              user.avatarUrl = await getMediaVariantUrlAsync(bucket, variants, 'thumbnail', false);
            }
          } catch (error) {
            // Ignore error, keep null
          }
        }
      }));

      const actorUserMap = new Map(actorUsers.map(user => [user.id, user]));

      // Format activity logs with actor information
      const formattedLogs = activityLogs.map(log => {
        const actorUser = log.actorUserId ? actorUserMap.get(log.actorUserId) : null;

        return {
          id: log.id,
          eventKey: log.eventKey,
          message: log.message,
          context: log.context,
          actorType: log.actorType,
          actorUserId: log.actorUserId,
          actorLabel: log.actorLabel,
          actor: actorUser ? {
            id: actorUser.id,
            name: actorUser.name,
            email: actorUser.email,
            avatarUrl: actorUser.avatarUrl,
            avatarMediaId: actorUser.avatarMediaId,
          } : null,
          payload: log.payload,
          severity: log.severity,
          visibility: log.visibility,
          createdAt: log.createdAt.toISOString(),
        };
      });

      return reply.status(200).send({
        success: true,
        activities: formattedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      request.log.error({ error, taskId }, 'Failed to get task activity logs');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get task activity logs',
        },
      });
    }
  });
}

