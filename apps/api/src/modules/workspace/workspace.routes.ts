import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { updateWorkspace, isSlugAvailable } from './workspace-update.service.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';

/**
 * Registers workspace routes
 * - GET /workspaces - List user's workspaces
 * - GET /workspaces/:workspaceId - Get workspace details
 */
export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  // GET /workspaces - List user's workspaces
  app.get('/workspaces', {
    schema: {
      tags: ['Workspace'],
      summary: 'List user workspaces',
      description: 'Returns all workspaces the authenticated user is a member of',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            workspaces: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  ownerUserId: { type: 'string' },
                  avatarUrl: { type: ['string', 'null'] },
                  timezone: { type: 'string' },
                  locale: { type: 'string' },
                  baseCurrency: { type: 'string' },
                  plan: { type: 'string', enum: ['FREE', 'STARTER', 'PRO', 'AGENCY'] },
                  role: { type: 'string', enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
                required: ['id', 'name', 'slug', 'role'],
              },
            },
          },
          required: ['success', 'workspaces'],
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Check authentication
    if (!request.auth || !request.auth.tokenPayload) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userId = request.auth.tokenPayload.sub;

    // Fetch user's workspace memberships with workspace details
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerUserId: true,
            avatarUrl: true,
            timezone: true,
            locale: true,
            baseCurrency: true,
            plan: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerUserId: m.workspace.ownerUserId,
      avatarUrl: m.workspace.avatarUrl,
      timezone: m.workspace.timezone,
      locale: m.workspace.locale,
      baseCurrency: m.workspace.baseCurrency,
      plan: m.workspace.plan,
      role: m.role,
      createdAt: m.workspace.createdAt.toISOString(),
      updatedAt: m.workspace.updatedAt.toISOString(),
    }));

    return reply.status(200).send({
      success: true,
      workspaces,
    });
  });

  // GET /workspaces/:workspaceId - Get workspace details
  app.get('/workspaces/:workspaceId', {
    preHandler: requireWorkspaceRoleFor('workspace:view'),
    schema: {
      tags: ['Workspace'],
      summary: 'Get workspace details',
      description: 'Returns detailed information about a specific workspace. Requires VIEWER role or higher.',
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
        },
        required: ['workspaceId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            workspace: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                ownerUserId: { type: 'string' },
                avatarUrl: { type: ['string', 'null'] },
                timezone: { type: 'string' },
                locale: { type: 'string' },
                baseCurrency: { type: 'string' },
                plan: { type: 'string', enum: ['FREE', 'STARTER', 'PRO', 'AGENCY'] },
                settings: { type: ['object', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                memberCount: { type: 'number' },
                userRole: { type: 'string', enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] },
              },
              required: ['id', 'name', 'slug', 'userRole'],
            },
          },
          required: ['success', 'workspace'],
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = request.auth!.tokenPayload!.sub;

    // Fetch workspace details
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!workspace) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found',
        },
      });
    }

    // Get user's role in this workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    return reply.status(200).send({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        ownerUserId: workspace.ownerUserId,
        avatarUrl: workspace.avatarUrl,
        timezone: workspace.timezone,
        locale: workspace.locale,
        baseCurrency: workspace.baseCurrency,
        plan: workspace.plan,
        settings: workspace.settings as Record<string, any> | null,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
        memberCount: workspace._count.members,
        userRole: membership!.role,
      },
    });
  });

  // GET /workspaces/slug/:slug/available - Check slug availability
  app.get('/workspaces/slug/:slug/available', {
    schema: {
      tags: ['Workspace'],
      summary: 'Check slug availability',
      description: 'Check if a workspace slug is available',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const { excludeWorkspaceId } = request.query as { excludeWorkspaceId?: string };

    const available = await isSlugAvailable(slug, excludeWorkspaceId);

    return reply.status(200).send({
      success: true,
      available,
      slug,
    });
  });

  // PATCH /workspaces/:workspaceId - Update workspace
  app.patch('/workspaces/:workspaceId', {
    preHandler: requireWorkspaceRoleFor('workspace:update'),
    schema: {
      tags: ['Workspace'],
      summary: 'Update workspace',
      description: 'Update workspace settings. Requires OWNER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = request.auth!.tokenPayload!.sub;

    try {
      const workspace = await updateWorkspace(workspaceId, userId, request.body as any);

      return reply.status(200).send({
        success: true,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          timezone: workspace.timezone,
          locale: workspace.locale,
          baseCurrency: workspace.baseCurrency,
          updatedAt: workspace.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'SLUG_TAKEN') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'SLUG_TAKEN',
              message: 'This slug is already taken',
            },
          });
        }
      }

      request.log.error({ error, workspaceId }, 'Workspace update failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update workspace',
        },
      });
    }
  });

  // GET /workspaces/:workspaceId/members - List workspace members
  app.get('/workspaces/:workspaceId/members', {
    preHandler: requireWorkspaceRoleFor('workspace:view'),
    schema: {
      tags: ['Workspace'],
      summary: 'List workspace members',
      description: 'Returns all members of a workspace. Requires VIEWER role or higher.',
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
        },
        required: ['workspaceId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            members: {
              type: 'array',
              items: {
                type: 'object',
                  properties: {
                  id: { type: 'string' },
                  name: { type: ['string', 'null'] },
                  email: { type: 'string' },
                  avatarMediaId: { type: ['string', 'null'] },
                  avatarUrl: { type: ['string', 'null'] },
                  role: { type: 'string' },
                },
                required: ['id', 'email', 'role'],
              },
            },
          },
          required: ['success', 'members'],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarMediaId: true,
            avatarMedia: {
              select: {
                id: true,
                bucket: true,
                variants: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const membersWithAvatars = await Promise.all(
      members.map(async (member) => {
        let avatarUrl: string | null = null;
        
        if (member.user.avatarMediaId && member.user.avatarMedia) {
          try {
            const isPublic = false; // User avatars are typically private
            avatarUrl = await getMediaVariantUrlAsync(
              member.user.avatarMedia.bucket,
              member.user.avatarMedia.variants,
              'thumbnail',
              isPublic
            );
          } catch (error) {
            // If URL generation fails, avatarUrl remains null
            console.error('Failed to generate avatar URL:', error);
          }
        }
        
        return {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          avatarMediaId: member.user.avatarMediaId,
          avatarUrl,
          role: member.role,
        };
      })
    );

    return reply.status(200).send({
      success: true,
      members: membersWithAvatars,
    });
  });
}

