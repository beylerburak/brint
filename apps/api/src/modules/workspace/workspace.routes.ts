import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { updateWorkspace, isSlugAvailable } from './workspace-update.service.js';
import { getMediaVariantUrlAsync } from '../../core/storage/s3-url.js';
import { getPlanLimits } from '@brint/shared-config/plans';

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
                  avatarMediaId: { type: ['string', 'null'] },
                avatarUrl: { type: ['string', 'null'] }, // Backward compatibility
                avatarUrls: {
                  type: ['object', 'null'],
                  properties: {
                    thumbnail: { type: ['string', 'null'] },
                    small: { type: ['string', 'null'] },
                    medium: { type: ['string', 'null'] },
                    large: { type: ['string', 'null'] },
                  },
                },
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
            avatarMediaId: true,
            avatarMedia: {
              select: {
                id: true,
                bucket: true,
                variants: true,
                isPublic: true,
              },
            },
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

    const workspaces = await Promise.all(memberships.map(async (m) => {
      let avatarUrl: string | null = null;
      if (m.workspace.avatarMediaId && m.workspace.avatarMedia) {
        try {
          const isPublic = m.workspace.avatarMedia.isPublic ?? false;
          avatarUrl = await getMediaVariantUrlAsync(
            m.workspace.avatarMedia.bucket,
            m.workspace.avatarMedia.variants,
            'thumbnail',
            isPublic
          );
        } catch (error) {
          console.error('Failed to generate workspace avatar URL:', error);
        }
      }
      
      return {
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        ownerUserId: m.workspace.ownerUserId,
        avatarUrl,
        timezone: m.workspace.timezone,
        locale: m.workspace.locale,
        baseCurrency: m.workspace.baseCurrency,
      plan: m.workspace.plan,
      role: m.role,
      createdAt: m.workspace.createdAt.toISOString(),
      updatedAt: m.workspace.updatedAt.toISOString(),
      };
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
                avatarMediaId: { type: ['string', 'null'] },
                avatarUrl: { type: ['string', 'null'] }, // Backward compatibility
                avatarUrls: {
                  type: ['object', 'null'],
                  properties: {
                    thumbnail: { type: ['string', 'null'] },
                    small: { type: ['string', 'null'] },
                    medium: { type: ['string', 'null'] },
                    large: { type: ['string', 'null'] },
                  },
                },
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
        avatarMedia: {
          select: {
            id: true,
            bucket: true,
            variants: true,
            isPublic: true,
          },
        },
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

      // Generate avatar URLs from media variants
      let avatarUrls = null;
      if (workspace.avatarMedia) {
        const isPublic = workspace.avatarMedia.isPublic ?? false;
        avatarUrls = {
          thumbnail: await getMediaVariantUrlAsync(workspace.avatarMedia.bucket, workspace.avatarMedia.variants, 'thumbnail', isPublic),
          small: await getMediaVariantUrlAsync(workspace.avatarMedia.bucket, workspace.avatarMedia.variants, 'small', isPublic),
          medium: await getMediaVariantUrlAsync(workspace.avatarMedia.bucket, workspace.avatarMedia.variants, 'medium', isPublic),
          large: await getMediaVariantUrlAsync(workspace.avatarMedia.bucket, workspace.avatarMedia.variants, 'large', isPublic),
        };
      }

      return reply.status(200).send({
        success: true,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          ownerUserId: workspace.ownerUserId,
          avatarMediaId: workspace.avatarMediaId,
          avatarUrl: avatarUrls?.small || avatarUrls?.thumbnail || null, // Backward compatibility
          avatarUrls: avatarUrls,
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

      // Fetch updated workspace with avatarMedia
      const updatedWorkspace = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        select: {
          id: true,
          name: true,
          slug: true,
          avatarMediaId: true,
          avatarMedia: {
            select: {
              id: true,
              bucket: true,
              variants: true,
              isPublic: true,
            },
          },
          timezone: true,
          locale: true,
          baseCurrency: true,
          updatedAt: true,
        },
      });

      // Generate avatar URLs if available
      let avatarUrls = null;
      if (updatedWorkspace?.avatarMedia) {
        const isPublic = updatedWorkspace.avatarMedia.isPublic ?? false;
        avatarUrls = {
          thumbnail: await getMediaVariantUrlAsync(updatedWorkspace.avatarMedia.bucket, updatedWorkspace.avatarMedia.variants, 'thumbnail', isPublic),
          small: await getMediaVariantUrlAsync(updatedWorkspace.avatarMedia.bucket, updatedWorkspace.avatarMedia.variants, 'small', isPublic),
          medium: await getMediaVariantUrlAsync(updatedWorkspace.avatarMedia.bucket, updatedWorkspace.avatarMedia.variants, 'medium', isPublic),
          large: await getMediaVariantUrlAsync(updatedWorkspace.avatarMedia.bucket, updatedWorkspace.avatarMedia.variants, 'large', isPublic),
        };
      }

      return reply.status(200).send({
        success: true,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          avatarMediaId: updatedWorkspace?.avatarMediaId || null,
          avatarUrl: avatarUrls?.small || avatarUrls?.thumbnail || null, // Backward compatibility
          avatarUrls: avatarUrls,
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
                  avatarMediaId: { type: ['string', 'null'] },
                avatarUrl: { type: ['string', 'null'] }, // Backward compatibility
                avatarUrls: {
                  type: ['object', 'null'],
                  properties: {
                    thumbnail: { type: ['string', 'null'] },
                    small: { type: ['string', 'null'] },
                    medium: { type: ['string', 'null'] },
                    large: { type: ['string', 'null'] },
                  },
                },
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

  // POST /workspaces/:workspaceId/members - Invite member to workspace
  app.post('/workspaces/:workspaceId/members', {
    preHandler: requireWorkspaceRoleFor('workspace:update'),
    schema: {
      tags: ['Workspace'],
      summary: 'Invite member to workspace',
      description: 'Invite a user to the workspace by email. Requires ADMIN role or higher.',
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
        },
        required: ['workspaceId'],
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'VIEWER'], default: 'VIEWER' },
        },
        required: ['email'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            member: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: ['string', 'null'] },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
        400: {
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
    const { email, role = 'VIEWER' } = request.body as { email: string; role?: 'ADMIN' | 'EDITOR' | 'VIEWER' };
    const currentUserId = request.auth!.tokenPayload!.sub;

    // Fetch workspace
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

    // Check plan limits
    const limits = getPlanLimits(workspace.plan);
    const currentMemberCount = workspace._count.members;
    
    if (limits.maxTeamMembers !== -1 && currentMemberCount >= limits.maxTeamMembers) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MEMBER_LIMIT_REACHED',
          message: `Plan limit reached. Maximum ${limits.maxTeamMembers} members allowed for ${workspace.plan} plan.`,
        },
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User with this email not found',
        },
      });
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
    });

    if (existingMember) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MEMBER_ALREADY_EXISTS',
          message: 'User is already a member of this workspace',
        },
      });
    }

    // Create workspace member
    const newMember = await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role: role as 'ADMIN' | 'EDITOR' | 'VIEWER',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarMediaId: true,
            avatarMedia: {
              select: {
                bucket: true,
                variants: true,
              },
            },
          },
        },
      },
    });

    // Generate avatar URL if available
    let avatarUrl: string | null = null;
    if (newMember.user.avatarMediaId && newMember.user.avatarMedia) {
      try {
        const isPublic = false;
        avatarUrl = await getMediaVariantUrlAsync(
          newMember.user.avatarMedia.bucket,
          newMember.user.avatarMedia.variants,
          'thumbnail',
          isPublic
        );
      } catch (error) {
        console.error('Failed to generate avatar URL:', error);
      }
    }

    return reply.status(200).send({
      success: true,
      member: {
        id: newMember.user.id,
        name: newMember.user.name,
        email: newMember.user.email,
        avatarUrl,
        role: newMember.role,
      },
    });
  });

  // PATCH /workspaces/:workspaceId/members/:userId - Update member role
  app.patch('/workspaces/:workspaceId/members/:userId', {
    preHandler: requireWorkspaceRoleFor('workspace:update'),
    schema: {
      tags: ['Workspace'],
      summary: 'Update member role',
      description: 'Update a workspace member\'s role. Requires ADMIN role or higher.',
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          userId: { type: 'string' },
        },
        required: ['workspaceId', 'userId'],
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] },
        },
        required: ['role'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            member: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: ['string', 'null'] },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
    const { role } = request.body as { role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' };
    const currentUserId = request.auth!.tokenPayload!.sub;

    // Check if target member exists
    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!targetMember) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found in this workspace',
        },
      });
    }

    // Cannot change own role
    if (userId === currentUserId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'CANNOT_CHANGE_OWN_ROLE',
          message: 'Cannot change your own role',
        },
      });
    }

    // Update role
    const updatedMember = await prisma.workspaceMember.update({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      data: {
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return reply.status(200).send({
      success: true,
      member: {
        id: updatedMember.user.id,
        name: updatedMember.user.name,
        email: updatedMember.user.email,
        role: updatedMember.role,
      },
    });
  });

  // DELETE /workspaces/:workspaceId/members/:userId - Remove member
  app.delete('/workspaces/:workspaceId/members/:userId', {
    preHandler: requireWorkspaceRoleFor('workspace:update'),
    schema: {
      tags: ['Workspace'],
      summary: 'Remove member',
      description: 'Remove a member from the workspace. Requires ADMIN role or higher. Cannot remove OWNER.',
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          userId: { type: 'string' },
        },
        required: ['workspaceId', 'userId'],
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
    const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
    const currentUserId = request.auth!.tokenPayload!.sub;

    // Check if target member exists
    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!targetMember) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found in this workspace',
        },
      });
    }

    // Cannot remove OWNER
    if (targetMember.role === 'OWNER') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'CANNOT_REMOVE_OWNER',
          message: 'Cannot remove the workspace owner',
        },
      });
    }

    // Cannot remove yourself
    if (userId === currentUserId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'CANNOT_REMOVE_SELF',
          message: 'Cannot remove yourself from the workspace',
        },
      });
    }

    // Remove member
    await prisma.workspaceMember.delete({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    return reply.status(200).send({
      success: true,
      message: 'Member removed successfully',
    });
  });
}

