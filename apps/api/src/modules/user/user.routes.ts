import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { userRepository } from "./user.repository.js";

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

    return reply.send({ success: true, data: user.toJSON() });
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

    const body = request.body as any;
    const completedOnboarding = body.completedOnboarding;

    const updated = await userRepository.updateUser(request.auth.userId, {
      name: body.name,
      username: body.username,
      locale: body.locale,
      timezone: body.timezone,
      phone: body.phone,
      completedOnboarding,
      firstOnboardedAt: completedOnboarding ? new Date() : undefined,
    });

    return reply.send({ success: true, data: updated?.toJSON() });
  });
}
