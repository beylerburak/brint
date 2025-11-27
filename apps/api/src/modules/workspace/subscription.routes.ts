import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError, ForbiddenError, HttpError } from "../../lib/http-errors.js";

export async function registerSubscriptionRoutes(app: FastifyInstance) {
  // Workspace-scoped subscription (uses X-Workspace-Id)
  app.get("/workspace/subscription", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)],
    schema: {
      tags: ["Workspaces"],
      summary: "Get current workspace subscription (header-based)",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                workspaceId: { type: "string" },
                plan: { type: "string" },
                status: { type: "string" },
                renewsAt: { type: ["string", "null"], format: "date-time" },
              },
              required: ["workspaceId", "plan", "status", "renewsAt"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.auth?.workspaceId;

    if (!workspaceId) {
      throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
    }

    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    }

    return reply.send({
      success: true,
      data: {
        workspaceId,
        plan: subscription.plan,
        status: subscription.status,
        renewsAt: subscription.periodEnd ? subscription.periodEnd.toISOString() : null,
      },
    });
  });

  app.get("/workspaces/:workspaceId/subscription", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)],
    schema: {
      tags: ["Workspaces"],
      summary: "Get workspace subscription",
      params: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
        required: ["workspaceId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    workspaceId: { type: "string" },
                    plan: { type: "string" },
                    status: { type: "string" },
                    periodStart: { type: ["string", "null"], format: "date-time" },
                    periodEnd: { type: ["string", "null"], format: "date-time" },
                    cancelAt: { type: ["string", "null"], format: "date-time" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                  required: ["id", "workspaceId", "plan", "status", "createdAt", "updatedAt"],
                },
              ],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId: paramWorkspaceId } = request.params as { workspaceId: string };
    const workspaceId = request.auth?.workspaceId;

    if (!workspaceId) {
      throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
    }

    if (workspaceId !== paramWorkspaceId) {
      throw new ForbiddenError("WORKSPACE_MISMATCH", { headerWorkspaceId: workspaceId, paramWorkspaceId });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
    });
    return reply.send({ success: true, data: subscription });
  });

  app.put("/workspaces/:workspaceId/subscription", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW)],
    schema: {
      tags: ["Workspaces"],
      summary: "Upsert workspace subscription",
      params: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
        required: ["workspaceId"],
      },
      body: {
        type: "object",
        properties: {
          plan: { type: "string", enum: ["FREE", "PRO", "ENTERPRISE"] },
          status: { type: "string", enum: ["ACTIVE", "CANCELED", "PAST_DUE"] },
          periodStart: { type: ["string", "null"], format: "date-time" },
          periodEnd: { type: ["string", "null"], format: "date-time" },
          cancelAt: { type: ["string", "null"], format: "date-time" },
        },
        required: ["plan"],
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
                workspaceId: { type: "string" },
                plan: { type: "string" },
                status: { type: "string" },
                periodStart: { type: ["string", "null"], format: "date-time" },
                periodEnd: { type: ["string", "null"], format: "date-time" },
                cancelAt: { type: ["string", "null"], format: "date-time" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
              required: ["id", "workspaceId", "plan", "status", "createdAt", "updatedAt"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId: paramWorkspaceId } = request.params as { workspaceId: string };
    const workspaceId = request.auth?.workspaceId;

    if (!workspaceId) {
      throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
    }

    if (workspaceId !== paramWorkspaceId) {
      throw new ForbiddenError("WORKSPACE_MISMATCH", { headerWorkspaceId: workspaceId, paramWorkspaceId });
    }

    const body = request.body as any;
    try {
      const subscription = await prisma.subscription.upsert({
        where: { workspaceId },
        update: {
          plan: body.plan,
          status: body.status ?? undefined,
          periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
          periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
          cancelAt: body.cancelAt ? new Date(body.cancelAt) : null,
        },
        create: {
          workspaceId,
          plan: body.plan,
          status: body.status ?? "ACTIVE",
          periodStart: body.periodStart ? new Date(body.periodStart) : null,
          periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
          cancelAt: body.cancelAt ? new Date(body.cancelAt) : null,
        },
      });
      return reply.send({ success: true, data: subscription });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return reply.status(400).send({ success: false, error: { code: error.code, message: error.message } });
      }
      return reply.status(500).send({ success: false, error: { code: "INTERNAL", message: "Failed to upsert subscription" } });
    }
  });
}
