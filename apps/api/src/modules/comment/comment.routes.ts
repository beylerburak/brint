/**
 * Comment Routes
 * 
 * HTTP endpoints for comment CRUD operations.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { getWorkspaceIdFromRequest } from '../../core/auth/workspace-context.js';
import {
  listCommentsForEntity,
  createComment,
  updateComment,
  deleteComment,
  getCommentById,
} from './comment.service.js';
import {
  CreateCommentInputSchema,
  UpdateCommentInputSchema,
  ListCommentsQuerySchema,
} from './comment.entity.js';
import { ZodError } from 'zod';

export async function registerCommentRoutes(app: FastifyInstance): Promise<void> {
  // GET /comments - List comments for an entity
  app.get('/comments', {
    preHandler: requireWorkspaceRoleFor('comment:list'),
    schema: {
      tags: ['Comment'],
      summary: 'List comments for an entity',
      description: 'Returns all comments for a specific entity (e.g., Task, Content). Requires VIEWER role.',
      querystring: {
        type: 'object',
        properties: {
          entityType: { type: 'string', description: 'Entity type (e.g., TASK, CONTENT)' },
          entityId: { type: 'string', description: 'Entity ID' },
          brandId: { type: 'string', description: 'Brand ID (optional)' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          includeDeleted: { type: 'boolean', default: false },
        },
        required: ['entityType', 'entityId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            comments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  workspaceId: { type: 'string' },
                  brandId: { type: ['string', 'null'] },
                  entityType: { type: 'string' },
                  entityId: { type: 'string' },
                  authorUserId: { type: 'string' },
                  body: { type: 'string' },
                  parentId: { type: ['string', 'null'] },
                  isEdited: { type: 'boolean' },
                  editedAt: { type: ['string', 'null'] },
                  deletedAt: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  author: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: ['string', 'null'] },
                      email: { type: 'string' },
                      avatarUrl: { type: ['string', 'null'] },
                    },
                  },
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
      // Validate query params
      const query = ListCommentsQuerySchema.parse(request.query);

      const result = await listCommentsForEntity(
        { userId, workspaceId },
        query
      );

      return reply.status(200).send({
        success: true,
        comments: result.comments,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
        });
      }

      request.log.error({ error }, 'Failed to list comments');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list comments',
        },
      });
    }
  });

  // POST /comments - Create a comment
  app.post('/comments', {
    preHandler: requireWorkspaceRoleFor('comment:create'),
    schema: {
      tags: ['Comment'],
      summary: 'Create a comment',
      description: 'Create a new comment on an entity. Requires VIEWER role.',
      body: {
        type: 'object',
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          body: { type: 'string' },
          brandId: { type: ['string', 'null'] },
          parentId: { type: ['string', 'null'] },
        },
        required: ['entityType', 'entityId', 'body'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            comment: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                workspaceId: { type: 'string' },
                brandId: { type: ['string', 'null'] },
                entityType: { type: 'string' },
                entityId: { type: 'string' },
                authorUserId: { type: 'string' },
                body: { type: 'string' },
                parentId: { type: ['string', 'null'] },
                isEdited: { type: 'boolean' },
                editedAt: { type: ['string', 'null'] },
                deletedAt: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                author: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: ['string', 'null'] },
                    email: { type: 'string' },
                    avatarUrl: { type: ['string', 'null'] },
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
      // Validate input
      const input = CreateCommentInputSchema.parse(request.body);

      const comment = await createComment(
        { userId, workspaceId },
        input
      );

      return reply.status(201).send({
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

      request.log.error({ error }, 'Failed to create comment');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create comment',
        },
      });
    }
  });

  // PATCH /comments/:commentId - Update a comment
  app.patch('/comments/:commentId', {
    preHandler: requireWorkspaceRoleFor('comment:update'),
    schema: {
      tags: ['Comment'],
      summary: 'Update a comment',
      description: 'Update an existing comment. Only the author can update their comment.',
      params: {
        type: 'object',
        properties: {
          commentId: { type: 'string' },
        },
        required: ['commentId'],
      },
      body: {
        type: 'object',
        properties: {
          body: { type: 'string' },
        },
        required: ['body'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            comment: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                body: { type: 'string' },
                isEdited: { type: 'boolean' },
                editedAt: { type: ['string', 'null'] },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { commentId } = request.params as { commentId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      // Validate input
      const input = UpdateCommentInputSchema.parse(request.body);

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
        if (error.message === 'COMMENT_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'COMMENT_NOT_FOUND',
              message: 'Comment not found',
            },
          });
        }

        if (error.message === 'FORBIDDEN') {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only update your own comments',
            },
          });
        }

        if (error.message === 'COMMENT_DELETED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'COMMENT_DELETED',
              message: 'Cannot update a deleted comment',
            },
          });
        }
      }

      request.log.error({ error, commentId }, 'Failed to update comment');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update comment',
        },
      });
    }
  });

  // DELETE /comments/:commentId - Delete a comment
  app.delete('/comments/:commentId', {
    preHandler: requireWorkspaceRoleFor('comment:delete'),
    schema: {
      tags: ['Comment'],
      summary: 'Delete a comment',
      description: 'Soft delete a comment. Only the author can delete their comment.',
      params: {
        type: 'object',
        properties: {
          commentId: { type: 'string' },
        },
        required: ['commentId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth!.tokenPayload!.sub;
    const { commentId } = request.params as { commentId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
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
        if (error.message === 'COMMENT_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'COMMENT_NOT_FOUND',
              message: 'Comment not found',
            },
          });
        }

        if (error.message === 'FORBIDDEN') {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only delete your own comments',
            },
          });
        }

        if (error.message === 'COMMENT_ALREADY_DELETED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'COMMENT_ALREADY_DELETED',
              message: 'Comment is already deleted',
            },
          });
        }
      }

      request.log.error({ error, commentId }, 'Failed to delete comment');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete comment',
        },
      });
    }
  });

  // GET /comments/:commentId - Get a single comment
  app.get('/comments/:commentId', {
    preHandler: requireWorkspaceRoleFor('comment:list'),
    schema: {
      tags: ['Comment'],
      summary: 'Get a comment by ID',
      description: 'Returns a single comment by its ID.',
      params: {
        type: 'object',
        properties: {
          commentId: { type: 'string' },
        },
        required: ['commentId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            comment: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                workspaceId: { type: 'string' },
                brandId: { type: ['string', 'null'] },
                entityType: { type: 'string' },
                entityId: { type: 'string' },
                authorUserId: { type: 'string' },
                body: { type: 'string' },
                parentId: { type: ['string', 'null'] },
                isEdited: { type: 'boolean' },
                editedAt: { type: ['string', 'null'] },
                deletedAt: { type: ['string', 'null'] },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                author: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: ['string', 'null'] },
                    email: { type: 'string' },
                    avatarUrl: { type: ['string', 'null'] },
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
    const { commentId } = request.params as { commentId: string };
    const workspaceId = getWorkspaceIdFromRequest(request);

    try {
      const comment = await getCommentById(
        { userId, workspaceId },
        commentId
      );

      if (!comment) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Comment not found',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        comment,
      });
    } catch (error) {
      request.log.error({ error, commentId }, 'Failed to get comment');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get comment',
        },
      });
    }
  });
}

