import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import { z } from "zod";
import { workspaceInviteService } from "./workspace-invite.service.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { prisma } from "../../lib/prisma.js";
import { BadRequestError, ForbiddenError, UnauthorizedError, NotFoundError } from "../../lib/http-errors.js";
import { sendWorkspaceInviteEmail } from "../../core/email/email.service.js";
import { appUrlConfig } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import { setAuthCookies } from "../../core/auth/auth.cookies.js";
import { tokenService } from "../../core/auth/token.service.js";
import { sessionService } from "../../core/auth/session.service.js";
import { requireWorkspaceMatch } from "../../core/auth/require-workspace.js";

type WorkspaceParams = {
  workspaceId: string;
};

type WorkspaceInviteParams = WorkspaceParams & {
  inviteId: string;
};

type InviteTokenParam = {
  token: string;
};

type CreateInviteBody = {
  email: string;
  expiresAt?: string | null;
};

const CreateInviteSchema = z.object({
  email: z.string().trim().email(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const markDeprecated = (reply: FastifyReply, successor: string) => {
  reply.header("Deprecation", "true");
  reply.header("Link", `<${successor}>; rel="successor-version"`);
};

async function getInviteDetailsHandler(
  request: FastifyRequest<{ Params: InviteTokenParam }>,
  reply: FastifyReply
) {
  const { token } = request.params;
  const invite = await workspaceInviteService.getByToken(token);
  
    if (!invite) {
      throw new NotFoundError("INVITE_NOT_FOUND", "Invite not found");
    }

    if (invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      throw new BadRequestError("INVITE_EXPIRED", "Invite expired or already used");
    }

  const workspace = await prisma.workspace.findUnique({
    where: { id: invite.workspaceId },
    select: { id: true, name: true, slug: true },
  });

    if (!workspace) {
      throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found");
    }

  let inviterName: string | null = null;
  if (invite.invitedBy) {
    const inviter = await prisma.user.findUnique({
      where: { id: invite.invitedBy },
      select: { name: true, email: true },
    });
    inviterName = inviter?.name ?? inviter?.email ?? null;
  }

  return reply.send({
    success: true,
    data: {
      id: invite.id,
      email: invite.email,
      workspaceId: invite.workspaceId,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      invitedBy: invite.invitedBy,
      invitedByName: inviterName,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });
}

async function loginWithInviteHandler(
  request: FastifyRequest<{ Params: InviteTokenParam }>,
  reply: FastifyReply
) {
  const { token } = request.params;
  
  const invite = await workspaceInviteService.getByToken(token);
  
  if (!invite) {
    throw new NotFoundError("INVITE_NOT_FOUND", "Invite not found");
  }

  if (invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    throw new BadRequestError("INVITE_EXPIRED", "Invite expired or already used");
  }

  try {
    let user = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: invite.email,
          name: null,
          emailVerified: new Date(),
        },
      });
    } else if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    }

    const tid = randomUUID();
    await sessionService.createSession({
      userId: user.id,
      tid,
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    });

    const accessToken = tokenService.signAccessToken({
      sub: user.id,
    });

    const refreshToken = tokenService.signRefreshToken({
      sub: user.id,
      tid,
    });

    setAuthCookies(reply, {
      accessToken,
      refreshToken,
    });

    logger.info(
      {
        userId: user.id,
        inviteId: invite.id,
        email: invite.email,
      },
      "User logged in with invite token"
    );

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken,
      },
    });
  } catch (error) {
    logger.error(
      {
        error,
        inviteId: invite.id,
        email: invite.email,
      },
      "Error logging in with invite token"
    );
    throw new BadRequestError("INVITE_LOGIN_FAILED", "An unexpected error occurred", error);
  }
}

async function acceptInviteHandler(
  request: FastifyRequest<{ Params: InviteTokenParam }>,
  reply: FastifyReply
) {
    if (!request.auth?.userId) {
      throw new UnauthorizedError("UNAUTHORIZED");
    }
    const { token } = request.params;
    const invite = await workspaceInviteService.getByToken(token);
    if (!invite) {
      throw new NotFoundError("INVITE_NOT_FOUND", "Invite not found");
    }
    if (invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      throw new BadRequestError("INVITE_EXPIRED", "Invite expired or already used");
    }

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
}

export async function workspaceInviteRoutes(app: FastifyInstance) {
  // List invites for a workspace
  app.get("/workspaces/:workspaceId/invites", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE), requireWorkspaceMatch()],
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
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  workspaceId: { type: "string" },
                  invitedBy: { type: ["string", "null"] },
                  token: { type: "string" },
                  status: { type: "string", enum: ["PENDING", "ACCEPTED", "EXPIRED"] },
                  expiresAt: { type: "string", format: "date-time" },
                  invitedAt: { type: ["string", "null"], format: "date-time" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
                required: [
                  "id",
                  "email",
                  "workspaceId",
                  "token",
                  "status",
                  "expiresAt",
                  "createdAt",
                  "updatedAt",
                ],
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: WorkspaceParams }>, reply: FastifyReply) => {
    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: request.params.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    // Serialize dates properly
    const serializedInvites = invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      workspaceId: invite.workspaceId,
      token: invite.token,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
      invitedBy: invite.invitedBy,
      invitedAt: invite.invitedAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString(),
    }));

    return reply.send({ success: true, data: serializedInvites });
  });

  // Create invite
  app.post("/workspaces/:workspaceId/invites", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE), requireWorkspaceMatch()],
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
  }, async (request: FastifyRequest<{ Params: WorkspaceParams; Body: CreateInviteBody }>, reply: FastifyReply) => {
    const parsed = CreateInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError("INVALID_BODY", "Invalid invite payload", parsed.error.flatten());
    }

    const token = randomUUID();
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const invite = await workspaceInviteService.create({
      email: parsed.data.email,
      workspaceId,
      invitedBy: request.auth?.userId ?? "system",
      token,
      expiresAt,
    });

    // Fire-and-forget invite email; do not fail API if email sending fails
    const inviteUrl = `${appUrlConfig.baseUrl}/invites?token=${token}`;
    void sendWorkspaceInviteEmail(invite.email, inviteUrl).catch((err) => {
      logger.error({ err, inviteId: invite.id, email: invite.email }, "Failed to send workspace invite email");
    });

    // Ensure we return all fields properly serialized
    return reply.send({ 
      success: true, 
      data: {
        id: invite.id,
        email: invite.email,
        workspaceId: invite.workspaceId,
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        invitedBy: invite.invitedBy,
        invitedAt: invite.invitedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
        updatedAt: invite.updatedAt.toISOString(),
      }
    });
  });

  // Cancel invite (expire) before acceptance
  app.delete("/workspaces/:workspaceId/invites/:inviteId", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE), requireWorkspaceMatch()],
    schema: {
      tags: ["Workspaces"],
      summary: "Cancel a workspace invite (sets status to EXPIRED)",
      params: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          inviteId: { type: "string" },
        },
        required: ["workspaceId", "inviteId"],
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
                status: { type: "string" },
              },
              required: ["id", "status"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: WorkspaceInviteParams }>, reply: FastifyReply) => {
    const { workspaceId, inviteId } = request.params;

    const invite = await workspaceInviteService.getById(inviteId);
    if (!invite) {
      throw new NotFoundError("INVITE_NOT_FOUND", "Invite not found");
    }

    if (invite.workspaceId !== workspaceId) {
      throw new ForbiddenError("INVITE_WORKSPACE_MISMATCH", { inviteWorkspaceId: invite.workspaceId, paramWorkspaceId: workspaceId });
    }

    if (invite.status !== "PENDING") {
      throw new BadRequestError("INVITE_NOT_CANCELLABLE", "Invite is not pending");
    }

    const updated = await workspaceInviteService.updateStatus(invite.id, "EXPIRED");
    return reply.send({ success: true, data: { id: updated.id, status: updated.status } });
  });

  // Get invite details by token (public endpoint)
  app.get("/workspace-invites/:token", {
    schema: {
      tags: ["Workspaces"],
      summary: "Get workspace invite details by token",
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
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                workspaceId: { type: "string" },
                workspaceName: { type: "string" },
                workspaceSlug: { type: "string" },
                invitedBy: { type: ["string", "null"] },
                invitedByName: { type: ["string", "null"] },
                status: { type: "string", enum: ["PENDING", "ACCEPTED", "EXPIRED"] },
                expiresAt: { type: "string", format: "date-time" },
              },
            },
          },
          required: ["success", "data"],
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    markDeprecated(reply, "/public/invites/:token");
    return getInviteDetailsHandler(request, reply);
  });

  app.get("/public/invites/:token", {
    schema: {
      tags: ["Workspaces"],
      summary: "Get workspace invite details by token (public prefix)",
      params: {
        type: "object",
        properties: {
          token: { type: "string" },
        },
        required: ["token"],
      },
    },
  }, getInviteDetailsHandler);

  // Login with invite token (public endpoint)
  app.post("/workspace-invites/:token/login", {
    schema: {
      tags: ["Workspaces"],
      summary: "Login with workspace invite token",
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
            data: {
              type: "object",
              properties: {
                user: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: ["string", "null"] },
                  },
                },
                accessToken: { type: "string" },
              },
            },
          },
          required: ["success", "data"],
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    markDeprecated(reply, "/public/invites/:token/login");
    return loginWithInviteHandler(request, reply);
  });

  app.post("/public/invites/:token/login", {
    schema: {
      tags: ["Workspaces"],
      summary: "Login with workspace invite token (public prefix)",
      params: {
        type: "object",
        properties: {
          token: { type: "string" },
        },
        required: ["token"],
      },
    },
  }, loginWithInviteHandler);

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
  }, async (request, reply) => {
    markDeprecated(reply, "/public/invites/:token/accept");
    return acceptInviteHandler(request, reply);
  });

  app.post("/public/invites/:token/accept", {
    schema: {
      tags: ["Workspaces"],
      summary: "Accept a workspace invite (public prefix)",
      params: {
        type: "object",
        properties: {
          token: { type: "string" },
        },
        required: ["token"],
      },
    },
  }, acceptInviteHandler);
}
