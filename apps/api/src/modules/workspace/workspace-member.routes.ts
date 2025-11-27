import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";

export async function registerWorkspaceMemberRoutes(app: FastifyInstance) {
  app.patch("/workspaces/:workspaceId/members/:userId", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE)],
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

    return reply.send({ success: true, data: member });
  });
}
