import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError, UnauthorizedError } from "../../lib/http-errors.js";
import { permissionService } from "../../core/auth/permission.service.js";
import { S3StorageService } from "../../lib/storage/s3.storage.service.js";
import { storageConfig } from "../../config/index.js";
import { requireWorkspaceMatch } from "../../core/auth/require-workspace.js";

const storage = new S3StorageService();

type WorkspaceParams = {
  workspaceId: string;
};

type WorkspaceMemberParams = WorkspaceParams & {
  userId: string;
};

type UpdateWorkspaceMemberBody = {
  role?: "OWNER" | "ADMIN" | "MEMBER";
  status?: string;
};

const UpdateWorkspaceMemberSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
  status: z.string().trim().min(1).max(50).optional(),
});

export async function registerWorkspaceMemberRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/members", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE), requireWorkspaceMatch()],
    schema: {
      tags: ["Workspaces"],
      summary: "Get workspace members list",
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
                  userId: { type: "string" },
                  workspaceId: { type: "string" },
                  role: { type: "string" },
                  status: { type: "string" },
                  joinedAt: { type: "string" },
                  user: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      email: { type: "string" },
                      name: { type: "string", nullable: true },
                      username: { type: "string", nullable: true },
                      avatarUrl: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: WorkspaceParams }>, reply: FastifyReply) => {
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: request.params.workspaceId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            avatarMediaId: true,
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    // Collect all unique avatar media IDs
    const avatarMediaIds = members
      .map((m) => m.user.avatarMediaId)
      .filter((id): id is string => id !== null);

    // Fetch all media objects in one query
    const mediaMap = new Map<string, { objectKey: string }>();
    if (avatarMediaIds.length > 0) {
      const mediaList = await prisma.media.findMany({
        where: {
          id: { in: avatarMediaIds },
        },
        select: {
          id: true,
          objectKey: true,
        },
      });
      mediaList.forEach((media) => {
        mediaMap.set(media.id, { objectKey: media.objectKey });
      });
    }

    // Map members to include avatarUrl if available
    const membersWithAvatar = await Promise.all(
      members.map(async (member) => {
        let avatarUrl: string | null = null;
        if (member.user.avatarMediaId) {
          const media = mediaMap.get(member.user.avatarMediaId);
          if (media) {
            // Use CDN URL if available, otherwise use presigned URL
            if (storageConfig.cdnBaseUrl) {
              avatarUrl = `${storageConfig.cdnBaseUrl}/${media.objectKey}`;
            } else {
              avatarUrl = await storage.getPresignedDownloadUrl(media.objectKey, {
                expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
              });
            }
          }
        }

        return {
          id: member.id,
          userId: member.userId,
          workspaceId: member.workspaceId,
          role: member.role,
          status: member.status,
          joinedAt: member.joinedAt.toISOString(),
          user: {
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
            username: member.user.username,
            avatarUrl,
          },
        };
      })
    );

    return reply.send({ success: true, data: membersWithAvatar });
  });

  app.patch("/workspaces/:workspaceId/members/:userId", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE), requireWorkspaceMatch()],
    schema: {
      tags: ["Workspaces"],
      summary: "Update workspace member role/status",
      params: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          userId: { type: "string" },
        },
        required: ["workspaceId", "userId"],
      },
      body: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["OWNER", "ADMIN", "MEMBER"] },
          status: { type: "string" },
        },
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
  }, async (request: FastifyRequest<{ Params: WorkspaceMemberParams; Body: UpdateWorkspaceMemberBody }>, reply: FastifyReply) => {
    const { workspaceId, userId } = request.params;
    const headerWorkspaceId = request.auth?.workspaceId;

    if (!headerWorkspaceId) {
      throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
    }

    if (headerWorkspaceId !== workspaceId) {
      throw new ForbiddenError("WORKSPACE_MISMATCH", { headerWorkspaceId, paramWorkspaceId: workspaceId });
    }

    const parsed = UpdateWorkspaceMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError("INVALID_BODY", "Invalid member payload", parsed.error.flatten());
    }

    const member = await prisma.workspaceMember.update({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      data: {
        role: parsed.data.role ?? undefined,
        status: parsed.data.status ?? undefined,
      },
    });

    await permissionService.invalidateUserWorkspace(userId, workspaceId);

    return reply.send({ success: true, data: member });
  });
}
