import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const PreferenceQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

const UpsertPreferenceSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  workspaceId: z.string().nullable().optional(),
});

const BatchUpsertPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      key: z.string().min(1),
      value: z.any(),
      workspaceId: z.string().nullable().optional(),
    })
  ).min(1).max(100), // Limit to 100 preferences per batch
});

export async function registerPreferenceRoutes(app: FastifyInstance): Promise<void> {
  // GET /preferences - list preferences for authenticated user
  app.get('/preferences', {
    schema: {
      tags: ['Preference'],
      summary: 'List user preferences',
      description: 'Returns user preferences, optionally filtered by workspace context.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const queryResult = PreferenceQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: queryResult.error.issues,
        },
      });
    }

    const headerWorkspaceId = typeof request.headers['x-workspace-id'] === 'string'
      ? request.headers['x-workspace-id']
      : undefined;
    const workspaceId = queryResult.data.workspaceId ?? headerWorkspaceId;

    try {
      const preferences = await prisma.userPreference.findMany({
        where: {
          userId: request.auth.userId,
          ...(workspaceId
            ? {
                OR: [
                  { workspaceId },
                  { workspaceId: null },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: 'desc' },
      });

      return reply.send({
        success: true,
        preferences,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to list preferences');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load preferences',
        },
      });
    }
  });

  // PUT /preferences - upsert a preference
  app.put('/preferences', {
    schema: {
      tags: ['Preference'],
      summary: 'Upsert preference',
      description: 'Creates or updates a user preference value. Overwrites existing value for the same key and scope.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const bodyResult = UpsertPreferenceSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid preference data',
          details: bodyResult.error.issues,
        },
      });
    }

    const headerWorkspaceId = typeof request.headers['x-workspace-id'] === 'string'
      ? request.headers['x-workspace-id']
      : undefined;
    const workspaceId =
      bodyResult.data.workspaceId === null
        ? null
        : bodyResult.data.workspaceId ?? headerWorkspaceId ?? null;

    try {
      const preference = await prisma.userPreference.upsert({
        where: {
          userId_workspaceId_key: {
            userId: request.auth.userId,
            workspaceId,
            key: bodyResult.data.key,
          },
        },
        create: {
          userId: request.auth.userId,
          workspaceId,
          key: bodyResult.data.key,
          value: bodyResult.data.value,
        },
        update: {
          value: bodyResult.data.value,
        },
      });

      return reply.send({
        success: true,
        preference,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to upsert preference');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to save preference',
        },
      });
    }
  });

  // PUT /preferences/batch - batch upsert preferences
  app.put('/preferences/batch', {
    schema: {
      tags: ['Preference'],
      summary: 'Batch upsert preferences',
      description: 'Creates or updates multiple user preferences in a single transaction.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const bodyResult = BatchUpsertPreferencesSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid batch preference data',
          details: bodyResult.error.issues,
        },
      });
    }

    const headerWorkspaceId = typeof request.headers['x-workspace-id'] === 'string'
      ? request.headers['x-workspace-id']
      : undefined;

    try {
      // Use transaction for atomic batch upsert
      const preferences = await prisma.$transaction(
        bodyResult.data.preferences.map((pref) => {
          const workspaceId =
            pref.workspaceId === null
              ? null
              : pref.workspaceId ?? headerWorkspaceId ?? null;

          return prisma.userPreference.upsert({
            where: {
              userId_workspaceId_key: {
                userId: request.auth.userId,
                workspaceId,
                key: pref.key,
              },
            },
            create: {
              userId: request.auth.userId,
              workspaceId,
              key: pref.key,
              value: pref.value,
            },
            update: {
              value: pref.value,
            },
          });
        })
      );

      return reply.send({
        success: true,
        preferences,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to batch upsert preferences');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to save preferences',
        },
      });
    }
  });
}
