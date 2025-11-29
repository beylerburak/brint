import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { createLimitGuard } from '../../core/subscription/limit-checker.js';
import { prisma } from '../../lib/prisma.js';
import { ensureDefaultWorkspaceRoles } from './workspace-role.service.js';
import { workspaceCreateSchema } from '@brint/core-validation';
import { validateBody } from '../../lib/validation.js';

function requireAuthContext(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth?.userId) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }
}

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  app.post(
    '/workspaces',
    {
      preHandler: [
        async (request, reply) => {
          return requireAuthContext(request, reply);
        },
        createLimitGuard('workspace.maxCount', (req) => {
          // Parse body early for plan override (before validation)
          const body = req.body as { plan?: 'FREE' | 'PRO' | 'ENTERPRISE' } | undefined;
          return {
            userId: req.auth?.userId,
            planOverride: body?.plan,
          };
        }),
      ],
      schema: {
        tags: ['Workspaces'],
        summary: 'Create workspace (enforces subscription limits)',
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            plan: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
          },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      if (!request.auth?.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = validateBody(workspaceCreateSchema, request);
      const { name, slug, plan } = body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const workspace = await tx.workspace.create({
            data: {
              name,
              slug,
            },
          });

          // Ensure built-in roles + permissions exist for this workspace
          await ensureDefaultWorkspaceRoles(tx, workspace.id);

          await tx.workspaceMember.create({
            data: {
              userId: request.auth!.userId,
              workspaceId: workspace.id,
              role: 'OWNER',
              joinedAt: new Date(),
            },
          });

          const subscription = await tx.subscription.create({
            data: {
              workspaceId: workspace.id,
              plan,
              status: 'ACTIVE',
            },
          });

          return { workspace, subscription };
        });

        return reply.status(201).send({
          success: true,
          data: {
            workspace: result.workspace,
            subscription: result.subscription,
          },
        });
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'WORKSPACE_SLUG_EXISTS',
              message: 'Workspace slug already exists',
            },
          });
        }

        throw error;
      }
    }
  );
}
