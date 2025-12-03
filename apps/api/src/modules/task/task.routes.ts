/**
 * Task Routes
 * 
 * Fastify route definitions for Task domain.
 * All routes are registered under /v1/tasks prefix.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError } from "../../lib/http-errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validation.js";
import {
  createTaskSchema,
  updateTaskSchema,
  taskParamsSchema,
  taskListQuerySchema,
} from "@brint/core-validation";
import * as taskService from "./task.service.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Validates workspace header and returns workspace ID and user ID
 */
function requireAuth(request: FastifyRequest): { workspaceId: string; userId: string } {
  const workspaceId = request.auth?.workspaceId;
  const userId = request.auth?.userId;

  if (!workspaceId) {
    throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
  }

  if (!userId) {
    throw new BadRequestError("USER_ID_REQUIRED", "Authentication required");
  }

  return { workspaceId, userId };
}

export async function registerTaskRoutes(app: FastifyInstance) {
  /**
   * GET /v1/tasks
   * List tasks for the current workspace
   */
  app.get("/tasks", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_VIEW)],
    schema: {
      tags: ["Tasks"],
      summary: "List tasks",
      description: "Get tasks for the current workspace with optional filters",
      querystring: {
        type: "object",
        properties: {
          brandId: { type: "string", nullable: true },
          statusId: { type: "string" },
          statusGroup: { type: "string", enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
          categoryId: { type: "string", nullable: true },
          assigneeId: { type: "string", nullable: true },
          search: { type: "string", maxLength: 255 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = requireAuth(request);
    const query = validateQuery(taskListQuerySchema, request.query);

    const tasks = await taskService.listTasks({
      workspaceId,
      brandId: query.brandId,
      statusId: query.statusId,
      statusGroup: query.statusGroup,
      categoryId: query.categoryId,
      assigneeId: query.assigneeId,
      search: query.search,
    });

    return reply.send({
      data: tasks,
    });
  });

  /**
   * GET /v1/tasks/:taskId
   * Get a single task by ID
   */
  app.get("/tasks/:taskId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_VIEW)],
    schema: {
      tags: ["Tasks"],
      summary: "Get task",
      description: "Get a single task by ID",
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = requireAuth(request);
    const params = validateParams(taskParamsSchema, request.params);

    const task = await taskService.getTaskById(params.taskId, workspaceId);

    return reply.send({
      data: task,
    });
  });

  /**
   * POST /v1/tasks
   * Create a new task
   */
  app.post("/tasks", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_CREATE)],
    schema: {
      tags: ["Tasks"],
      summary: "Create task",
      description: "Create a new task for the current workspace",
      body: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 255 },
          description: { type: "string", maxLength: 5000, nullable: true },
          categoryId: { type: "string", nullable: true },
          priority: { type: "string", enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          assigneeId: { type: "string", nullable: true },
          dueDate: { type: "string", nullable: true },
          startDate: { type: "string", nullable: true },
          brandId: { type: "string", nullable: true },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, userId } = requireAuth(request);
    const body = validateBody(createTaskSchema, request);

    const task = await taskService.createTask(workspaceId, userId, body);

    return reply.status(201).send({
      data: task,
    });
  });

  /**
   * PATCH /v1/tasks/:taskId
   * Update a task
   */
  app.patch("/tasks/:taskId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_UPDATE)],
    schema: {
      tags: ["Tasks"],
      summary: "Update task",
      description: "Update an existing task",
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
      body: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 255 },
          description: { type: "string", maxLength: 5000, nullable: true },
          categoryId: { type: "string", nullable: true },
          statusId: { type: "string" },
          priority: { type: "string", enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          assigneeId: { type: "string", nullable: true },
          dueDate: { type: "string", nullable: true },
          startDate: { type: "string", nullable: true },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = requireAuth(request);
    const params = validateParams(taskParamsSchema, request.params);
    const body = validateBody(updateTaskSchema, request);

    const task = await taskService.updateTask(params.taskId, workspaceId, body);

    return reply.send({
      data: task,
    });
  });

  /**
   * DELETE /v1/tasks/:taskId
   * Delete a task
   */
  app.delete("/tasks/:taskId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_DELETE)],
    schema: {
      tags: ["Tasks"],
      summary: "Delete task",
      description: "Delete a task",
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = requireAuth(request);
    const params = validateParams(taskParamsSchema, request.params);

    await taskService.deleteTask(params.taskId, workspaceId);

    return reply.status(204).send();
  });

  /**
   * POST /v1/tasks/:taskId/attachments
   * Add attachment to task
   */
  app.post("/tasks/:taskId/attachments", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_UPDATE)],
    schema: {
      tags: ["Tasks"],
      summary: "Add task attachment",
      description: "Add an attachment to a task",
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
      body: {
        type: "object",
        required: ["mediaId"],
        properties: {
          mediaId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, userId } = requireAuth(request);
    const params = validateParams(taskParamsSchema, request.params);
    const body = request.body as { mediaId: string };

    // Verify task exists and user has access
    await taskService.getTaskById(params.taskId, workspaceId);

    // Create attachment
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: params.taskId,
        mediaId: body.mediaId,
        uploadedBy: userId,
      },
      include: {
        media: {
          select: {
            id: true,
            originalName: true,
            contentType: true,
            sizeBytes: true,
            objectKey: true,
            createdAt: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return reply.status(201).send({
      data: attachment,
    });
  });

  /**
   * GET /v1/tasks/:taskId/attachments
   * List task attachments
   */
  app.get("/tasks/:taskId/attachments", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_VIEW)],
    schema: {
      tags: ["Tasks"],
      summary: "List task attachments",
      description: "Get attachments for a task",
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = requireAuth(request);
    const params = validateParams(taskParamsSchema, request.params);

    // Verify task exists and user has access
    await taskService.getTaskById(params.taskId, workspaceId);

    // Get attachments
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: params.taskId },
      include: {
        media: {
          select: {
            id: true,
            originalName: true,
            contentType: true,
            sizeBytes: true,
            objectKey: true,
            createdAt: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({
      data: attachments,
    });
  });

  /**
   * DELETE /v1/tasks/:taskId/attachments/:attachmentId
   * Delete task attachment
   */
  app.delete("/tasks/:taskId/attachments/:attachmentId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_UPDATE)],
    schema: {
      tags: ["Tasks"],
      summary: "Delete task attachment",
      description: "Delete an attachment from a task",
      params: {
        type: "object",
        required: ["taskId", "attachmentId"],
        properties: {
          taskId: { type: "string" },
          attachmentId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = requireAuth(request);
    const params = request.params as { taskId: string; attachmentId: string };

    // Verify task exists and user has access
    await taskService.getTaskById(params.taskId, workspaceId);

    // Delete attachment
    await prisma.taskAttachment.delete({
      where: { id: params.attachmentId },
    });

    return reply.status(204).send();
  });
}

