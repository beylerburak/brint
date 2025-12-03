/**
 * TaskStatus Routes
 * 
 * Fastify route definitions for TaskStatus domain.
 * All routes are registered under /v1/task-statuses prefix.
 * 
 * TaskStatus allows users to define custom statuses grouped by:
 * - TODO: Statuses for planned/backlog items
 * - IN_PROGRESS: Statuses for work in progress
 * - DONE: Statuses for completed/cancelled items
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError } from "../../lib/http-errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validation.js";
import {
  createTaskStatusSchema,
  updateTaskStatusSchema,
  taskStatusParamsSchema,
  taskStatusListQuerySchema,
} from "@brint/core-validation";
import * as taskStatusService from "./task-status.service.js";

/**
 * Validates workspace header is present
 */
function requireWorkspaceId(request: FastifyRequest): string {
  const workspaceId = request.auth?.workspaceId;

  if (!workspaceId) {
    throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
  }

  return workspaceId;
}

export async function registerTaskStatusRoutes(app: FastifyInstance) {
  /**
   * GET /v1/task-statuses
   * List task statuses for the current workspace
   */
  app.get("/task-statuses", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_VIEW)],
    schema: {
      tags: ["Task Statuses"],
      summary: "List task statuses",
      description: "Get task statuses for the current workspace, optionally filtered by brand or group",
      querystring: {
        type: "object",
        properties: {
          brandId: { type: "string", nullable: true },
          group: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const query = validateQuery(taskStatusListQuerySchema, request.query);

    const statuses = await taskStatusService.listTaskStatuses({
      workspaceId,
      brandId: query.brandId,
      group: query.group,
    });

    return reply.send({
      data: statuses,
    });
  });

  /**
   * POST /v1/task-statuses
   * Create a new task status
   */
  app.post("/task-statuses", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_MANAGE_STATUSES)],
    schema: {
      tags: ["Task Statuses"],
      summary: "Create task status",
      description: "Create a new task status for the current workspace",
      body: {
        type: "object",
        required: ["name", "group"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          slug: { type: "string" },
          group: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
          color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", nullable: true },
          icon: { type: "string", maxLength: 50, nullable: true },
          description: { type: "string", maxLength: 500, nullable: true },
          isDefault: { type: "boolean" },
          order: { type: "integer", minimum: 0 },
          brandId: { type: "string", nullable: true },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const body = validateBody(createTaskStatusSchema, request);

    const status = await taskStatusService.createTaskStatus(workspaceId, body);

    return reply.status(201).send({
      data: status,
    });
  });

  /**
   * PATCH /v1/task-statuses/:statusId
   * Update a task status
   */
  app.patch("/task-statuses/:statusId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_MANAGE_STATUSES)],
    schema: {
      tags: ["Task Statuses"],
      summary: "Update task status",
      description: "Update an existing task status",
      params: {
        type: "object",
        required: ["statusId"],
        properties: {
          statusId: { type: "string" },
        },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          slug: { type: "string" },
          group: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
          color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", nullable: true },
          icon: { type: "string", maxLength: 50, nullable: true },
          description: { type: "string", maxLength: 500, nullable: true },
          isDefault: { type: "boolean" },
          order: { type: "integer", minimum: 0 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const params = validateParams(taskStatusParamsSchema, request.params);
    const body = validateBody(updateTaskStatusSchema, request);

    const status = await taskStatusService.updateTaskStatus(
      params.statusId,
      workspaceId,
      body
    );

    return reply.send({
      data: status,
    });
  });

  /**
   * DELETE /v1/task-statuses/:statusId
   * Delete a task status
   */
  app.delete("/task-statuses/:statusId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_MANAGE_STATUSES)],
    schema: {
      tags: ["Task Statuses"],
      summary: "Delete task status",
      description: "Delete a task status (cannot delete default statuses or statuses in use)",
      params: {
        type: "object",
        required: ["statusId"],
        properties: {
          statusId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const params = validateParams(taskStatusParamsSchema, request.params);

    await taskStatusService.deleteTaskStatus(params.statusId, workspaceId);

    return reply.status(204).send();
  });
}

