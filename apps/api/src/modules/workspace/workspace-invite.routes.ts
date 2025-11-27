import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import { workspaceInviteService } from "./workspace-invite.service.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { prisma } from "../../lib/prisma.js";

export async function workspaceInviteRoutes(app: FastifyInstance) {
  // List invites for a workspace
  app.get("/workspaces/:workspaceId/invites", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE)],
    schema: {
      tags: ["Workspaces"],
      summary: "List workspace invites",
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
            data: { type: "array", items: { type: "object" } },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: invites });
  });

  // Create invite
  app.post("/workspaces/:workspaceId/invites", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE)],
    schema: {
      tags: ["Workspaces"],
      summary: "Create a workspace invite",
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
          email: { type: "string" },
          expiresAt: { type: ["string", "null"], format: "date-time" },
        },
        required: ["email"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = request.body as any;
    const token = randomUUID();
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const invite = await workspaceInviteService.create({
      email: body.email,
      workspaceId,
      invitedBy: request.auth?.userId ?? "system",
      token,
      expiresAt,
    });

    return reply.send({ success: true, data: invite });
  });

  // Accept invite by token
  app.post("/workspace-invites/:token/accept", {
    schema: {
      tags: ["Workspaces"],
      summary: "Accept a workspace invite",
      params: {
        type: "object",
        properties: {
          token: { type: "string" },
        },
        required: ["token"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth?.userId) {
      return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }
    const { token } = request.params as { token: string };
    const invite = await workspaceInviteService.getByToken(token);
    if (!invite) {
      return reply.status(404).send({ success: false, error: { code: "INVITE_NOT_FOUND", message: "Invite not found" } });
    }
    if (invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      return reply.status(400).send({ success: false, error: { code: "INVITE_EXPIRED", message: "Invite expired or already used" } });
    }

    // Upsert workspace member as MEMBER
    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: request.auth.userId,
          workspaceId: invite.workspaceId,
        },
      },
      update: {
        role: "MEMBER",
        status: "active",
        joinedAt: new Date(),
      },
      create: {
        userId: request.auth.userId,
        workspaceId: invite.workspaceId,
        role: "MEMBER",
        status: "active",
        invitedBy: invite.invitedBy,
        invitedAt: invite.invitedAt ?? new Date(),
        joinedAt: new Date(),
      },
    });

    await workspaceInviteService.updateStatus(invite.id, "ACCEPTED");

    return reply.send({ success: true, data: { workspaceId: invite.workspaceId, status: "ACCEPTED" } });
  });
}
