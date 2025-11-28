import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError, ForbiddenError } from "../../lib/http-errors.js";
import { ensureDefaultWorkspaceRoles } from "./workspace-role.service.js";
import { requireWorkspaceMatch } from "../../core/auth/require-workspace.js";

export async function registerWorkspaceRoleRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/roles", {
    preHandler: [requirePermission(PERMISSIONS.WORKSPACE_MEMBERS_MANAGE), requireWorkspaceMatch()],
    schema: {
      tags: ["Workspaces"],
      summary: "List workspace roles with permissions",
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
                  workspaceId: { type: ["string", "null"] },
                  key: { type: "string" },
                  name: { type: "string" },
                  description: { type: ["string", "null"] },
                  builtIn: { type: "boolean" },
                  order: { type: "integer" },
                  permissions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        description: { type: ["string", "null"] },
                      },
                      required: ["key", "description"],
                    },
                  },
                },
                required: [
                  "id",
                  "workspaceId",
                  "key",
                  "name",
                  "builtIn",
                  "order",
                  "permissions",
                ],
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    // Backfill built-in roles if this workspace was created before defaults existed
    await ensureDefaultWorkspaceRoles(prisma, workspaceId);

    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { workspaceId },
          { workspaceId: null }, // global roles (if any)
        ],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [
        { order: "asc" },
        { createdAt: "asc" },
      ],
    });

    const data = roles.map((role) => {
      const permissions: { key: string; description: string | null }[] = [];
      const seen = new Set<string>();

      for (const rp of role.rolePermissions) {
        if (seen.has(rp.permission.key)) continue;
        seen.add(rp.permission.key);
        permissions.push({
          key: rp.permission.key,
          description: rp.permission.description ?? null,
        });
      }

      return {
        id: role.id,
        workspaceId: role.workspaceId ?? null,
        key: role.key,
        name: role.name,
        description: role.description ?? null,
        builtIn: role.builtIn,
        order: role.order,
        permissions,
      };
    });

    return reply.send({ success: true, data });
  });
}
