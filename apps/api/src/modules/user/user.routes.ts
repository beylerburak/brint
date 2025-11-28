import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { userRepository } from "./user.repository.js";
import { prisma } from "../../lib/prisma.js";
import { S3StorageService } from "../../lib/storage/s3.storage.service.js";
import { storageConfig } from "../../config/index.js";
import { MediaDeleteService } from "../media/application/media-delete.service.js";
import { UnauthorizedError, NotFoundError, HttpError, BadRequestError } from "../../lib/http-errors.js";
import { requireAuth } from "../../core/auth/require-auth.js";

const storage = new S3StorageService();
const mediaDeleteService = new MediaDeleteService(storage);

type UpdateUserBody = {
  name?: string | null;
  username?: string | null;
  locale?: string;
  timezone?: string;
  phone?: string | null;
  avatarMediaId?: string | null;
  completedOnboarding?: boolean;
};

const UpdateUserSchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .nullable()
    .optional(),
  locale: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().min(2).max(50).optional(),
  phone: z.string().trim().min(5).max(30).nullable().optional(),
  avatarMediaId: z.string().uuid().nullable().optional(),
  completedOnboarding: z.boolean().optional(),
});

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/users/me", {
    preHandler: [requireAuth()],
    schema: {
      tags: ["Users"],
      summary: "Get current user profile",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: ["string", "null"] },
                username: { type: ["string", "null"] },
                firstOnboardedAt: { type: ["string", "null"], format: "date-time" },
                completedOnboarding: { type: "boolean" },
                lastLoginAt: { type: ["string", "null"], format: "date-time" },
                locale: { type: "string" },
                timezone: { type: "string" },
                phone: { type: ["string", "null"] },
                avatarMediaId: { type: ["string", "null"] },
                avatarUrl: { type: ["string", "null"] },
                googleId: { type: ["string", "null"] },
                status: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
              required: ["id", "email", "createdAt", "updatedAt", "completedOnboarding", "locale", "timezone", "status"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: UpdateUserBody }>, reply: FastifyReply) => {

    const user = await userRepository.findUserById(request.auth.userId);
    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", "User not found");
    }

    // Get googleId from database
    const dbUser = await prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: { googleId: true },
    });

    let avatarUrl: string | null = null;
    if (user.avatarMediaId) {
      const media = await prisma.media.findUnique({ where: { id: user.avatarMediaId } });
      if (media) {
        avatarUrl = await storage.getPresignedDownloadUrl(media.objectKey, {
          expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
        });
      }
    }

    return reply.send({ 
      success: true, 
      data: { 
        ...user.toJSON(), 
        avatarMediaId: user.avatarMediaId, 
        avatarUrl,
        googleId: dbUser?.googleId ?? null,
      } 
    });
  });

  app.patch("/users/me", {
    preHandler: [requireAuth()],
    schema: {
      tags: ["Users"],
      summary: "Update current user profile",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          name: { type: ["string", "null"] },
          username: { type: ["string", "null"] },
          locale: { type: "string" },
          timezone: { type: "string" },
          phone: { type: ["string", "null"] },
          avatarMediaId: { type: ["string", "null"] },
          completedOnboarding: { type: "boolean" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: ["string", "null"] },
                username: { type: ["string", "null"] },
                firstOnboardedAt: { type: ["string", "null"], format: "date-time" },
                completedOnboarding: { type: "boolean" },
                lastLoginAt: { type: ["string", "null"], format: "date-time" },
                locale: { type: "string" },
                timezone: { type: "string" },
                phone: { type: ["string", "null"] },
                avatarMediaId: { type: ["string", "null"] },
                avatarUrl: { type: ["string", "null"] },
                googleId: { type: ["string", "null"] },
                status: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
              required: ["id", "email", "createdAt", "updatedAt", "completedOnboarding", "locale", "timezone", "status"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const currentUser = await userRepository.findUserById(request.auth.userId);
    if (!currentUser) {
      throw new NotFoundError("USER_NOT_FOUND", "User not found");
    }

    const parsed = UpdateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError("INVALID_BODY", "Invalid user payload", parsed.error.flatten());
    }

    const body = parsed.data;
    const completedOnboarding = body.completedOnboarding;
    const shouldRemoveAvatar = body.avatarMediaId === null;
    const avatarToDelete = shouldRemoveAvatar ? currentUser.avatarMediaId : null;

    const updated = await userRepository.updateUser(request.auth.userId, {
      name: body.name,
      username: body.username,
      locale: body.locale,
      timezone: body.timezone,
      phone: body.phone,
      avatarMediaId: body.avatarMediaId,
      completedOnboarding,
      firstOnboardedAt: completedOnboarding ? new Date() : undefined,
    });

    if (avatarToDelete) {
      try {
        await mediaDeleteService.deleteById(avatarToDelete, {
          workspaceId: request.auth.workspaceId,
        });
      } catch (error) {
        request.log.error({ error, avatarToDelete }, "Failed to delete avatar media");
        throw new HttpError(500, "AVATAR_DELETE_FAILED", "Failed to delete avatar media");
      }
    }

    let avatarUrl: string | null = null;
    if (updated?.avatarMediaId) {
      const media = await prisma.media.findUnique({ where: { id: updated.avatarMediaId } });
      if (media) {
        avatarUrl = await storage.getPresignedDownloadUrl(media.objectKey, {
          expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
        });
      }
    }

    // Get googleId from database
    const dbUser = await prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: { googleId: true },
    });

    return reply.send({ 
      success: true, 
      data: { 
        ...updated?.toJSON(), 
        avatarMediaId: updated?.avatarMediaId ?? null, 
        avatarUrl,
        googleId: dbUser?.googleId ?? null,
      } 
    });
  });

  app.delete("/users/me/google-connection", {
    preHandler: [requireAuth()],
    schema: {
      tags: ["Users"],
      summary: "Disconnect Google account for current user",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: ["string", "null"] },
                username: { type: ["string", "null"] },
                firstOnboardedAt: { type: ["string", "null"], format: "date-time" },
                completedOnboarding: { type: "boolean" },
                lastLoginAt: { type: ["string", "null"], format: "date-time" },
                locale: { type: "string" },
                timezone: { type: "string" },
                phone: { type: ["string", "null"] },
                avatarMediaId: { type: ["string", "null"] },
                avatarUrl: { type: ["string", "null"] },
                googleId: { type: ["string", "null"] },
                status: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
              required: ["id", "email", "createdAt", "updatedAt", "completedOnboarding", "locale", "timezone", "status"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const user = await userRepository.findUserById(request.auth.userId);
    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", "User not found");
    }

    // Clear googleId
    const updatedUser = await prisma.user.update({
      where: { id: request.auth.userId },
      data: { googleId: null },
    });

    const refreshedUser = await userRepository.findUserById(request.auth.userId);

    let avatarUrl: string | null = null;
    if (updatedUser.avatarMediaId) {
      const media = await prisma.media.findUnique({ where: { id: updatedUser.avatarMediaId } });
      if (media) {
        avatarUrl = await storage.getPresignedDownloadUrl(media.objectKey, {
          expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
        });
      }
    }

    return reply.send({
      success: true,
      data: {
        ...(refreshedUser?.toJSON() ?? updatedUser),
        avatarMediaId: updatedUser.avatarMediaId ?? null,
        avatarUrl,
        googleId: null,
      },
    });
  });

  app.get("/users/check-username/:username", {
    schema: {
      tags: ["Users"],
      summary: "Check if username is available",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          username: { type: "string" },
        },
        required: ["username"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                available: { type: "boolean" },
              },
              required: ["available"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const params = request.params as { username: string };
    const username = params.username.trim().toLowerCase();

    if (!username) {
      throw new BadRequestError("INVALID_USERNAME", "Username is required");
    }

    // Check if username is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    // Username is available if:
    // 1. No user has this username, OR
    // 2. The current user already has this username
    const currentUser = await userRepository.findUserById(request.auth.userId);
    const isAvailable = !existingUser || (currentUser?.username === username);

    return reply.send({
      success: true,
      data: { available: isAvailable },
    });
  });
}
