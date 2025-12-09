/**
 * Tag Routes
 * 
 * Handles tag search and autocomplete endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';

export async function registerTagRoutes(app: FastifyInstance): Promise<void> {
  // GET /workspaces/:workspaceId/tags/search - Search tags
  app.get('/workspaces/:workspaceId/tags/search', {
    preHandler: requireWorkspaceRoleFor('content:view'),
    schema: {
      tags: ['Tag'],
      summary: 'Search tags',
      description: 'Search tags in a workspace by name or slug. Returns matching tags for autocomplete.',
      querystring: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (searches in name and slug)',
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results',
            default: 20,
            minimum: 1,
            maximum: 100,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  color: { type: ['string', 'null'] },
                },
                required: ['id', 'name', 'slug'],
              },
            },
          },
          required: ['success', 'items'],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { query, limit = 20 } = request.query as { query?: string; limit?: number };

    try {
      const where: any = {
        workspaceId,
        deletedAt: null,
      };

      // If query is provided, search in name and slug
      if (query && query.trim().length > 0) {
        const searchTerm = `%${query.trim()}%`;
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { slug: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      const tags = await prisma.tag.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
        orderBy: query
          ? [
              // If searching, prioritize exact matches, then name matches, then slug matches
              { name: 'asc' },
            ]
          : [
              // If no query, return most recently created
              { createdAt: 'desc' },
            ],
        take: Math.min(limit || 20, 100),
      });

      return reply.status(200).send({
        success: true,
        items: tags,
      });
    } catch (error) {
      request.log.error(error, 'Error searching tags');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'TAG_SEARCH_ERROR',
          message: 'Failed to search tags',
        },
      });
    }
  });
}
