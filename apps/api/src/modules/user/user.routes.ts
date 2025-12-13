/**
 * User Routes
 * 
 * User profile and settings endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { UserSettingsPatchSchema, mergeUserSettings, parseUserSettings } from '@brint/shared-config';

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
    .optional(),
  phoneNumber: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  dateFormat: z.enum(['DMY', 'MDY', 'YMD']).optional(),
  timeFormat: z.enum(['H24', 'H12']).optional(),
  timezonePreference: z.enum(['WORKSPACE', 'LOCAL']).optional(),
  avatarMediaId: z.string().nullable().optional(),
});

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  // GET /users/username/:username/available - Check username availability
  app.get('/users/username/:username/available', {
    schema: {
      tags: ['User'],
      summary: 'Check username availability',
      description: 'Check if a username is available',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };
    const { excludeUserId } = request.query as { excludeUserId?: string };

    const existing = await prisma.user.findFirst({
      where: {
        username,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    });

    return reply.send({
      success: true,
      available: !existing,
      username,
    });
  });

  // PATCH /me - Update current user profile
  app.patch('/me', {
    schema: {
      tags: ['User'],
      summary: 'Update current user profile',
      description: 'Updates the authenticated user profile.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth?.tokenPayload?.sub;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    try {
      const body = UpdateProfileSchema.parse(request.body);

      // Check username availability if username is being changed
      if (body.username) {
        const existing = await prisma.user.findFirst({
          where: {
            username: body.username,
            id: { not: userId },
          },
        });

        if (existing) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'USERNAME_TAKEN',
              message: 'This username is already taken',
            },
          });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: body.name,
          username: body.username,
          phoneNumber: body.phoneNumber,
          timezone: body.timezone,
          locale: body.locale,
          dateFormat: body.dateFormat,
          timeFormat: body.timeFormat,
          timezonePreference: body.timezonePreference,
          avatarMediaId: body.avatarMediaId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatarUrl: true,
          avatarMediaId: true,
          phoneNumber: true,
          timezone: true,
          locale: true,
          dateFormat: true,
          timeFormat: true,
          timezonePreference: true,
          avatarMedia: {
            select: {
              id: true,
              baseKey: true,
              bucket: true,
              variants: true,
              mimeType: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      request.log.error({ error, userId }, 'Failed to update user profile');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update profile',
        },
      });
    }
  });

  // PATCH /users/me/settings - Update user settings
  app.patch('/users/me/settings', {
    schema: {
      tags: ['User'],
      summary: 'Update user settings',
      description: 'Updates the authenticated user settings (theme, language, etc.)',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth?.tokenPayload?.sub;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    try {
      // Validate patch body
      const patch = UserSettingsPatchSchema.parse(request.body);

      // Fetch current user with settings
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      if (!currentUser) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Merge patch with current settings
      const nextSettings = mergeUserSettings(currentUser.settings, patch);

      // Update user settings
      await prisma.user.update({
        where: { id: userId },
        data: { settings: nextSettings },
      });

      // Return normalized settings
      return reply.send({
        success: true,
        settings: nextSettings,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid settings data',
            details: error.errors,
          },
        });
      }

      request.log.error({ error, userId }, 'Failed to update user settings');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update settings',
        },
      });
    }
  });
}

