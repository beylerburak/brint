import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getWorkspaceActivity } from "./activity.service.js";
import { projectActivityEventForAI } from "./activity.projection.js";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "../../lib/http-errors.js";
import { prisma } from "../../lib/prisma.js";

const querySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const num = typeof v === "string" ? parseInt(v, 10) : v;
      return isNaN(num) ? undefined : num;
    })
    .pipe(z.number().int().min(1).max(100).optional()),
  cursor: z.string().optional(),
  since: z
    .union([z.string(), z.instanceof(Date)])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return typeof v === "string" ? new Date(v) : v;
    }),
  includeSystemEvents: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return true;
      if (typeof v === "boolean") return v;
      return v !== "false";
    }),
});

/**
 * Register activity routes
 * 
 * GET /workspaces/:workspaceId/activity - Get workspace activity events
 */
export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/workspaces/:workspaceId/activity",
    {
      schema: {
        tags: ["Activity"],
        summary: "Get workspace activity events",
        description: "Returns paginated activity events for a workspace with AI-friendly projection",
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
            since: { type: "string", format: "date-time" },
            includeSystemEvents: { type: "boolean" },
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
                        timestamp: { type: "string" },
                        type: { type: "string" },
                        actorType: { type: "string" },
                        source: { type: "string" },
                        workspaceId: { type: ["string", "null"] },
                        userId: { type: ["string", "null"] },
                        scopeType: { type: ["string", "null"] },
                        scopeId: { type: ["string", "null"] },
                        title: { type: "string" },
                        summary: { type: "string" },
                        details: { type: ["string", "null"] },
                        metadata: { type: "object" },
                      },
                      required: ["id", "timestamp", "type", "actorType", "source", "title", "summary", "metadata"],
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
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const userId = request.auth?.userId;
      const headerWorkspaceId = request.auth?.workspaceId;

      // Require authentication
      if (!userId) {
        throw new UnauthorizedError("AUTH_REQUIRED", "Authentication required");
      }

      // Validate workspace ID matches header
      if (!headerWorkspaceId) {
        throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
      }

      if (headerWorkspaceId !== workspaceId) {
        throw new ForbiddenError("WORKSPACE_MISMATCH", {
          headerWorkspaceId,
          paramWorkspaceId: workspaceId,
        });
      }

      // Check if user is a member of the workspace
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId,
          },
        },
      });

      if (!membership || membership.status !== "active") {
        throw new ForbiddenError("WORKSPACE_ACCESS_DENIED", "You are not a member of this workspace");
      }

      // Parse and validate query parameters
      const parsed = querySchema.safeParse(request.query);

      if (!parsed.success) {
        throw new BadRequestError("INVALID_QUERY", "Invalid activity query parameters", {
          issues: parsed.error.issues,
        });
      }

      const { limit, cursor, since, includeSystemEvents } = parsed.data;

      try {
        const { items, nextCursor } = await getWorkspaceActivity({
          workspaceId,
          limit,
          cursor: cursor ?? null,
          since: since ?? null,
          includeSystemEvents: includeSystemEvents ?? true,
        });

        // Project events to AI-friendly format
        const projected = items.map(projectActivityEventForAI);

        return reply.send({
          success: true,
          data: {
            items: projected,
            nextCursor,
          },
        });
      } catch (error) {
        // Re-throw known errors
        if (error instanceof BadRequestError || error instanceof ForbiddenError) {
          throw error;
        }

        // Log unexpected errors
        request.log.error(
          {
            error,
            workspaceId,
          },
          "Failed to fetch workspace activity"
        );

        throw new BadRequestError("ACTIVITY_FETCH_FAILED", "Failed to fetch activity events");
      }
    }
  );
}

