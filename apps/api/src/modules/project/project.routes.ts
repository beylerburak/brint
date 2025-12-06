/**
 * Project Routes
 * 
 * HTTP endpoints for project CRUD operations.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { getWorkspaceIdFromRequest } from '../../core/auth/workspace-context.js';
import {
  createProject,
  updateProject,
  getProjectById,
  listProjects,
  archiveProject,
} from './project.service.js';
import {
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
} from './project.entity.js';
import { ZodError } from 'zod';

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  // GET /projects - List projects
  app.get('/projects', {
    preHandler: requireWorkspaceRoleFor('task:list'),
    schema: {
      tags: ['Project'],
      summary: 'List projects',
      description: 'Returns all projects in the workspace. Requires VIEWER role.',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string', description: 'Filter by brand ID' },
          status: { type: 'string', enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            projects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  workspaceId: { type: 'string' },
                  brandId: { type: ['string', 'null'] },
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  status: { type: 'string' },
                  startDate: { type: ['string', 'null'] },
                  endDate: { type: ['string', 'null'] },
                  taskCount: { type: 'number' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
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

      const result = await listProjects(
        { userId, workspaceId },
        {
          brandId: query.brandId,
          status: query.status,
          page: query.page ? parseInt(query.page) : 1,
          limit: query.limit ? parseInt(query.limit) : 20,
        }
      );

      return reply.status(200).send({
        success: true,
        projects: result.projects,
        pagination: result.pagination,
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

      request.log.error({ error }, 'Failed to list projects');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list projects',
        },
      });
    }
  });

  // POST /projects - Create a project
  app.post('/projects', {
    preHandler: requireWorkspaceRoleFor('task:create'),
    schema: {
      tags: ['Project'],
      summary: 'Create a project',
      description: 'Create a new project. Requires EDITOR role.',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          brandId: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
        required: ['name'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            project: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
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
      // Validate input
      const input = CreateProjectInputSchema.parse(request.body);

      const project = await createProject(
        { userId, workspaceId },
        input
      );

      return reply.status(201).send({
        success: true,
        project,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid project data',
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

      request.log.error({ error }, 'Failed to create project');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create project',
        },
      });
    }
  });

  // GET /projects/:projectId - Get project details
  app.get('/projects/:projectId', {
    preHandler: requireWorkspaceRoleFor('task:view'),
    schema: {
      tags: ['Project'],
      summary: 'Get project details',
      description: 'Returns detailed information about a specific project.',
      params: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
        },
        required: ['projectId'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { projectId } = request.params as { projectId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const project = await getProjectById(
        { userId, workspaceId },
        projectId
      );

      if (!project) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        project,
      });
    } catch (error) {
      request.log.error({ error, projectId }, 'Failed to get project');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get project',
        },
      });
    }
  });

  // PATCH /projects/:projectId - Update a project
  app.patch('/projects/:projectId', {
    preHandler: requireWorkspaceRoleFor('task:update'),
    schema: {
      tags: ['Project'],
      summary: 'Update a project',
      description: 'Update an existing project. Requires EDITOR role.',
      params: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
        },
        required: ['projectId'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          brandId: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { projectId } = request.params as { projectId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      // Validate input
      const input = UpdateProjectInputSchema.parse(request.body);

      const project = await updateProject(
        { userId, workspaceId },
        projectId,
        input
      );

      return reply.status(200).send({
        success: true,
        project,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid project data',
            details: error.errors,
          },
        });
      }

      if (error instanceof Error) {
        if (error.message === 'PROJECT_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project not found',
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
      }

      request.log.error({ error, projectId }, 'Failed to update project');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update project',
        },
      });
    }
  });

  // DELETE /projects/:projectId - Archive a project
  app.delete('/projects/:projectId', {
    preHandler: requireWorkspaceRoleFor('task:delete'),
    schema: {
      tags: ['Project'],
      summary: 'Archive a project',
      description: 'Archive a project (sets status to ARCHIVED). Requires ADMIN role.',
      params: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
        },
        required: ['projectId'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { projectId } = request.params as { projectId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      await archiveProject(
        { userId, workspaceId },
        projectId
      );

      return reply.status(200).send({
        success: true,
        message: 'Project archived successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
          },
        });
      }

      request.log.error({ error, projectId }, 'Failed to archive project');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to archive project',
        },
      });
    }
  });
}

