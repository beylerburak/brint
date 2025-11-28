import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createLimitGuard } from '../../core/subscription/limit-checker.js';
import { prisma } from '../../lib/prisma.js';
import { ensureDefaultWorkspaceRoles } from './workspace-role.service.js';
import { UnauthorizedError, ConflictError } from '../../lib/http-errors.js';
import { validateBody } from '../../lib/validation.js';
import { requireAuth } from '../../core/auth/require-auth.js';

const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).default('FREE').optional(),
});

type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceSchema>;

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  app.post(
    '/workspaces',
    {
      preHandler: [
        requireAuth(),
        async (request) => {
          request.body = validateBody(CreateWorkspaceSchema, request.body);
        },
        createLimitGuard('workspace.maxCount', (req) => ({
          userId: req.auth?.userId,
          planOverride: (req.body as CreateWorkspaceBody | undefined)?.plan,
        })),
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
      request: FastifyRequest<{ Body: CreateWorkspaceBody }>,
      reply: FastifyReply
    ) => {
      if (!request.auth?.userId) {
        throw new UnauthorizedError('UNAUTHORIZED');
      }

      const { name, slug, plan = 'FREE' } = request.body;

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
          throw new ConflictError('WORKSPACE_SLUG_EXISTS', 'Workspace slug already exists');
        }

        throw error;
      }
    }
  );
}
