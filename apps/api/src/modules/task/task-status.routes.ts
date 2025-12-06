/**
 * TaskStatus Routes
 * 
 * HTTP endpoints for task status management.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { getWorkspaceIdFromRequest } from '../../core/auth/workspace-context.js';
import {
  getStatusesForScope,
  createCustomStatus,
  updateStatus,
  deleteStatus,
} from './task-status.service.js';
import {
  CreateTaskStatusInputSchema,
  UpdateTaskStatusInputSchema,
} from './task.entity.js';
import { ZodError } from 'zod';

export async function registerTaskStatusRoutes(app: FastifyInstance): Promise<void> {
  // GET /task-statuses - List task statuses (grouped)
  app.get('/task-statuses', {
    preHandler: requireWorkspaceRoleFor('task:list'),
    schema: {
      tags: ['TaskStatus'],
      summary: 'List task statuses',
      description: 'Returns all task statuses grouped by category (TODO, IN_PROGRESS, DONE). Requires VIEWER role.',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string', description: 'Filter by brand ID (optional)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            statuses: {
              type: 'object',
              properties: {
                TODO: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                      color: { type: ['string', 'null'] },
                      isDefault: { type: 'boolean' },
                      isSystem: { type: 'boolean' },
                      sortOrder: { type: 'number' },
                    },
                  },
                },
                IN_PROGRESS: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                      color: { type: ['string', 'null'] },
                      isDefault: { type: 'boolean' },
                      isSystem: { type: 'boolean' },
                      sortOrder: { type: 'number' },
                    },
                  },
                },
                DONE: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                      color: { type: ['string', 'null'] },
                      isDefault: { type: 'boolean' },
                      isSystem: { type: 'boolean' },
                      sortOrder: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const query = request.query as any;

      const statuses = await getStatusesForScope(
        { userId, workspaceId },
        { brandId: query.brandId }
      );

      return reply.status(200).send({
        success: true,
        statuses,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'BRAND_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      request.log.error({ error }, 'Failed to list task statuses');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list task statuses',
        },
      });
    }
  });

  // POST /task-statuses - Create a custom status
  app.post('/task-statuses', {
    preHandler: requireWorkspaceRoleFor('task:update'),
    schema: {
      tags: ['TaskStatus'],
      summary: 'Create a custom task status',
      description: 'Create a new custom task status (workspace-level or brand-level). Requires EDITOR role.',
      body: {
        type: 'object',
        properties: {
          group: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
          key: { type: 'string' },
          label: { type: 'string' },
          color: { type: 'string' },
          brandId: { type: 'string' },
          isDefault: { type: 'boolean' },
          sortOrder: { type: 'number' },
        },
        required: ['group', 'key', 'label'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const input = CreateTaskStatusInputSchema.parse(request.body);

      const status = await createCustomStatus(
        { userId, workspaceId },
        input
      );

      return reply.status(201).send({
        success: true,
        status,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status data',
            details: error.errors,
          },
        });
      }

      if (error instanceof Error && error.message === 'BRAND_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      request.log.error({ error }, 'Failed to create task status');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create task status',
        },
      });
    }
  });

  // PATCH /task-statuses/:statusId - Update a status
  app.patch('/task-statuses/:statusId', {
    preHandler: requireWorkspaceRoleFor('task:update'),
    schema: {
      tags: ['TaskStatus'],
      summary: 'Update a task status',
      description: 'Update an existing task status. Label and color can be updated even for system statuses. Requires EDITOR role.',
      params: {
        type: 'object',
        properties: {
          statusId: { type: 'string' },
        },
        required: ['statusId'],
      },
      body: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          color: { type: 'string' },
          isDefault: { type: 'boolean' },
          sortOrder: { type: 'number' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { statusId } = request.params as { statusId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const input = UpdateTaskStatusInputSchema.parse(request.body);

      const status = await updateStatus(
        { userId, workspaceId },
        statusId,
        input
      );

      return reply.status(200).send({
        success: true,
        status,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status data',
            details: error.errors,
          },
        });
      }

      if (error instanceof Error && error.message === 'STATUS_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'STATUS_NOT_FOUND',
            message: 'Status not found',
          },
        });
      }

      request.log.error({ error, statusId }, 'Failed to update task status');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update task status',
        },
      });
    }
  });

  // DELETE /task-statuses/:statusId - Delete a status
  app.delete('/task-statuses/:statusId', {
    preHandler: requireWorkspaceRoleFor('task:delete'),
    schema: {
      tags: ['TaskStatus'],
      summary: 'Delete a task status',
      description: 'Soft delete a task status. System statuses cannot be deleted. Requires ADMIN role.',
      params: {
        type: 'object',
        properties: {
          statusId: { type: 'string' },
        },
        required: ['statusId'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { statusId } = request.params as { statusId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      await deleteStatus(
        { userId, workspaceId },
        statusId
      );

      return reply.status(200).send({
        success: true,
        message: 'Task status deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'STATUS_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'STATUS_NOT_FOUND',
              message: 'Status not found',
            },
          });
        }

        if (error.message === 'CANNOT_DELETE_SYSTEM_STATUS') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'CANNOT_DELETE_SYSTEM_STATUS',
              message: 'System statuses cannot be deleted',
            },
          });
        }

        if (error.message === 'STATUS_IN_USE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'STATUS_IN_USE',
              message: 'Cannot delete status that is in use by tasks',
            },
          });
        }

        if (error.message === 'CANNOT_DELETE_LAST_STATUS_IN_GROUP') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'CANNOT_DELETE_LAST_STATUS_IN_GROUP',
              message: 'Cannot delete the last status in a group',
            },
          });
        }
      }

      request.log.error({ error, statusId }, 'Failed to delete task status');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete task status',
        },
      });
    }
  });
}

