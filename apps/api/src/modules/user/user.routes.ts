import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { userRepository } from "./user.repository.js";
import { prisma } from "../../lib/prisma.js";
import { S3StorageService } from "../../lib/storage/s3.storage.service.js";
import { storageConfig } from "../../config/index.js";
import { MediaDeleteService } from "../media/application/media-delete.service.js";

const storage = new S3StorageService();
const mediaDeleteService = new MediaDeleteService(storage);

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/users/me", {
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth?.userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const user = await userRepository.findUserById(request.auth.userId);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
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
    if (!request.auth?.userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const currentUser = await userRepository.findUserById(request.auth.userId);
    if (!currentUser) {
      return reply.status(404).send({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
    }

    const body = request.body as any;
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
        return reply.status(500).send({
          success: false,
          error: { code: "AVATAR_DELETE_FAILED", message: "Failed to delete avatar media" },
        });
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
    if (!request.auth?.userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const user = await userRepository.findUserById(request.auth.userId);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
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
    if (!request.auth?.userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const params = request.params as { username: string };
    const username = params.username.trim().toLowerCase();

    if (!username) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_USERNAME", message: "Username is required" },
      });
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
