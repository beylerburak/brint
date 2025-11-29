import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError, ForbiddenError } from "../../lib/http-errors.js";
import { permissionService } from "../../core/auth/permission.service.js";
import { S3StorageService } from "../../lib/storage/s3.storage.service.js";
import { storageConfig } from "../../config/index.js";
import { cursorPaginationQuerySchema } from "@brint/core-validation";
import {
  normalizeCursorPaginationInput,
  createCursorPaginationResult,
  getPrismaTakeValue,
} from "../../lib/pagination.js";

const storage = new S3StorageService();

export async function registerWorkspaceMemberRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/members", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_MANAGE)],
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
      querystring: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 100 },
          cursor: { type: "string" },
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
                items: {
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
                nextCursor: { type: ["string", "null"] },
              },
              required: ["items", "nextCursor"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const headerWorkspaceId = request.auth?.workspaceId;

    if (!headerWorkspaceId) {
      throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
    }

    if (headerWorkspaceId !== workspaceId) {
      throw new ForbiddenError("WORKSPACE_MISMATCH", { headerWorkspaceId, paramWorkspaceId: workspaceId });
    }

    // Parse and validate pagination query parameters
    const parsed = cursorPaginationQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      throw new BadRequestError("INVALID_QUERY", "Invalid pagination query parameters", {
        issues: parsed.error.issues,
      });
    }

    const { limit, cursor } = normalizeCursorPaginationInput({
      limit: parsed.data.limit,
      cursor: parsed.data.cursor ?? null,
    });

    // Build where clause with cursor pagination
    const where: any = {
      workspaceId,
    };

    if (cursor) {
      // Cursor-based pagination: get members created before the cursor member
      const cursorMember = await prisma.workspaceMember.findUnique({
        where: { id: cursor },
        select: { joinedAt: true, id: true },
      });

      if (!cursorMember) {
        // Cursor not found, return empty
        return reply.send({
          success: true,
          data: {
            items: [],
            nextCursor: null,
          },
        });
      }

      // For cursor pagination with joinedAt, we need to handle ties
      // Use id as secondary sort key for deterministic ordering
      where.OR = [
        { joinedAt: { lt: cursorMember.joinedAt } },
        {
          joinedAt: cursorMember.joinedAt,
          id: { lt: cursorMember.id },
        },
      ];
    }

    // Fetch members with pagination
    const members = await prisma.workspaceMember.findMany({
      where,
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
      orderBy: [
        { joinedAt: "desc" },
        { id: "desc" }, // Secondary sort for deterministic ordering
      ],
      take: getPrismaTakeValue(limit), // Fetch one extra to check if there's a next page
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

    // Create pagination result (removes extra item if present)
    const paginationResult = createCursorPaginationResult(members, limit, (member) => member.id);

    // Map members to include avatarUrl if available
    const membersWithAvatar = await Promise.all(
      paginationResult.items.map(async (member) => {
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
          joinedAt: member.joinedAt?.toISOString() ?? new Date().toISOString(),
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

    return reply.send({
      success: true,
      data: {
        items: membersWithAvatar,
        nextCursor: paginationResult.nextCursor,
      },
    });
  });

  app.patch("/workspaces/:workspaceId/members/:userId", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_SETTINGS_MANAGE)],
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
    const headerWorkspaceId = request.auth?.workspaceId;

    if (!headerWorkspaceId) {
      throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
    }

    if (headerWorkspaceId !== workspaceId) {
      throw new ForbiddenError("WORKSPACE_MISMATCH", { headerWorkspaceId, paramWorkspaceId: workspaceId });
    }

    const body = request.body as any;

    const member = await prisma.workspaceMember.update({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      data: {
        role: body.role ?? undefined,
        status: body.status ?? undefined,
      },
    });

    await permissionService.invalidateUserWorkspace(userId, workspaceId);

    return reply.send({ success: true, data: member });
  });
}
