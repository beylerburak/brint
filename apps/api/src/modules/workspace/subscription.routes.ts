import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError, ForbiddenError, HttpError, NotFoundError, ConflictError } from "../../lib/http-errors.js";
import { requireWorkspaceMatch } from "../../core/auth/require-workspace.js";

type WorkspaceParams = {
  workspaceId: string;
};

type UpsertSubscriptionBody = {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status?: "ACTIVE" | "CANCELED" | "PAST_DUE";
  periodStart?: string | null;
  periodEnd?: string | null;
  cancelAt?: string | null;
};

const UpsertSubscriptionSchema = z.object({
  plan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
  status: z.enum(["ACTIVE", "CANCELED", "PAST_DUE"]).optional(),
  periodStart: z.string().datetime().optional().nullable(),
  periodEnd: z.string().datetime().optional().nullable(),
  cancelAt: z.string().datetime().optional().nullable(),
});

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

    reply.header("Deprecation", "true");
    reply.header("Link", '</workspaces/:workspaceId/subscription>; rel="successor-version"');

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
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW), requireWorkspaceMatch()],
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
  }, async (request: FastifyRequest<{ Params: WorkspaceParams }>, reply: FastifyReply) => {
    const { workspaceId: paramWorkspaceId } = request.params;
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
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_VIEW), requireWorkspaceMatch()],
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
  }, async (request: FastifyRequest<{ Params: WorkspaceParams; Body: UpsertSubscriptionBody }>, reply: FastifyReply) => {
    const { workspaceId: paramWorkspaceId } = request.params;
    const workspaceId = request.auth?.workspaceId;

    if (!workspaceId) {
      throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
    }

    if (workspaceId !== paramWorkspaceId) {
      throw new ForbiddenError("WORKSPACE_MISMATCH", { headerWorkspaceId: workspaceId, paramWorkspaceId });
    }

    const parsed = UpsertSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError("INVALID_BODY", "Invalid subscription payload", parsed.error.flatten());
    }

    try {
      const subscription = await prisma.subscription.upsert({
        where: { workspaceId },
        update: {
          plan: parsed.data.plan,
          status: parsed.data.status ?? undefined,
          periodStart: parsed.data.periodStart ? new Date(parsed.data.periodStart) : undefined,
          periodEnd: parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : undefined,
          cancelAt: parsed.data.cancelAt ? new Date(parsed.data.cancelAt) : null,
        },
        create: {
          workspaceId,
          plan: parsed.data.plan,
          status: parsed.data.status ?? "ACTIVE",
          periodStart: parsed.data.periodStart ? new Date(parsed.data.periodStart) : null,
          periodEnd: parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : null,
          cancelAt: parsed.data.cancelAt ? new Date(parsed.data.cancelAt) : null,
        },
      });
      return reply.send({ success: true, data: subscription });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestError(error.code, error.message);
      }
      throw new HttpError(500, "INTERNAL", "Failed to upsert subscription");
    }
  });
}
