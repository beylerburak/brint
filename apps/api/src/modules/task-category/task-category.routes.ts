/**
 * TaskCategory Routes
 * 
 * Fastify route definitions for TaskCategory domain.
 * All routes are registered under /v1/task-categories prefix.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError } from "../../lib/http-errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validation.js";
import {
  createTaskCategorySchema,
  updateTaskCategorySchema,
  taskCategoryParamsSchema,
  taskCategoryListQuerySchema,
} from "@brint/core-validation";
import * as taskCategoryService from "./task-category.service.js";

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

export async function registerTaskCategoryRoutes(app: FastifyInstance) {
  /**
   * GET /v1/task-categories
   * List task categories for the current workspace
   */
  app.get("/task-categories", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_VIEW)],
    schema: {
      tags: ["Task Categories"],
      summary: "List task categories",
      description: "Get task categories for the current workspace, optionally filtered by brand",
      querystring: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const query = validateQuery(taskCategoryListQuerySchema, request.query);

    const categories = await taskCategoryService.listTaskCategories({
      workspaceId,
      brandId: query.brandId,
    });

    return reply.send({
      data: categories,
    });
  });

  /**
   * POST /v1/task-categories
   * Create a new task category
   */
  app.post("/task-categories", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_MANAGE_CATEGORIES)],
    schema: {
      tags: ["Task Categories"],
      summary: "Create task category",
      description: "Create a new task category for the current workspace",
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          slug: { type: "string" },
          color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", nullable: true },
          isDefault: { type: "boolean" },
          order: { type: "integer", minimum: 0 },
          brandId: { type: "string", nullable: true },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const body = validateBody(createTaskCategorySchema, request);

    const category = await taskCategoryService.createTaskCategory(workspaceId, body);

    return reply.status(201).send({
      data: category,
    });
  });

  /**
   * PATCH /v1/task-categories/:categoryId
   * Update a task category
   */
  app.patch("/task-categories/:categoryId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_MANAGE_CATEGORIES)],
    schema: {
      tags: ["Task Categories"],
      summary: "Update task category",
      description: "Update an existing task category",
      params: {
        type: "object",
        required: ["categoryId"],
        properties: {
          categoryId: { type: "string" },
        },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          slug: { type: "string" },
          color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", nullable: true },
          isDefault: { type: "boolean" },
          order: { type: "integer", minimum: 0 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const params = validateParams(taskCategoryParamsSchema, request.params);
    const body = validateBody(updateTaskCategorySchema, request);

    const category = await taskCategoryService.updateTaskCategory(
      params.categoryId,
      workspaceId,
      body
    );

    return reply.send({
      data: category,
    });
  });

  /**
   * DELETE /v1/task-categories/:categoryId
   * Delete a task category
   */
  app.delete("/task-categories/:categoryId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_TASK_MANAGE_CATEGORIES)],
    schema: {
      tags: ["Task Categories"],
      summary: "Delete task category",
      description: "Delete a task category",
      params: {
        type: "object",
        required: ["categoryId"],
        properties: {
          categoryId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const params = validateParams(taskCategoryParamsSchema, request.params);

    await taskCategoryService.deleteTaskCategory(params.categoryId, workspaceId);

    return reply.status(204).send();
  });
}

