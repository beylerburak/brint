/**
 * Publication Routes
 * 
 * Fastify route definitions for Publication domain.
 * Provides endpoints for Instagram and Facebook publishing.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError, ForbiddenError } from "../../lib/http-errors.js";
import { validateBody, validateParams, validateQuery } from "../../lib/validation.js";
import {
  createInstagramPublicationSchema,
  createFacebookPublicationSchema,
  createDraftInstagramPublicationSchema,
  createDraftFacebookPublicationSchema,
  brandParamsSchema,
  cursorPaginationQuerySchema,
} from "@brint/core-validation";
import { publicationService } from "./publication.service.js";

/**
 * Validates workspace header matches route param
 */
function requireWorkspaceMatch(
  request: FastifyRequest,
  workspaceIdFromParam?: string
): string {
  const headerWorkspaceId = request.auth?.workspaceId;

  if (!headerWorkspaceId) {
    throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
  }

  if (workspaceIdFromParam && headerWorkspaceId !== workspaceIdFromParam) {
    throw new ForbiddenError("WORKSPACE_MISMATCH", {
      headerWorkspaceId,
      paramWorkspaceId: workspaceIdFromParam,
    });
  }

  return headerWorkspaceId;
}

export async function registerPublicationRoutes(app: FastifyInstance) {
  // ====================
  // Instagram Publication Endpoint
  // ====================

  /**
   * POST /v1/brands/:brandId/publications/instagram
   * Schedule an Instagram publication
   */
  app.post("/brands/:brandId/publications/instagram", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_CONTENT_PUBLISH)],
      schema: {
      tags: ["Publications", "Instagram"],
      summary: "Schedule Instagram publication",
      description: "Schedule a new publication to Instagram (IMAGE, CAROUSEL, REEL, or STORY)",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
      },
      body: {
        type: "object",
        properties: {
          socialAccountId: { type: "string", description: "ID of the Instagram social account to publish from" },
          publishAt: { type: "string", format: "date-time", description: "ISO datetime for scheduled publish (optional, immediate if not provided)" },
          clientRequestId: { type: "string", description: "Client-provided idempotency key" },
          payload: {
            type: "object",
            description: "Instagram-specific payload (IMAGE, CAROUSEL, REEL, or STORY)",
            properties: {
              contentType: { type: "string", enum: ["IMAGE", "CAROUSEL", "REEL", "STORY"] },
              caption: { type: "string" },
              imageMediaId: { type: "string" },
              videoMediaId: { type: "string" },
              storyType: { type: "string", enum: ["IMAGE", "VIDEO"] },
              items: { type: "array" },
            },
            required: ["contentType"],
          },
        },
        required: ["socialAccountId", "payload"],
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                scheduledAt: { type: ["string", "null"] },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = validateParams(brandParamsSchema, request.params);
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const body = validateBody(createInstagramPublicationSchema, request);

    const publication = await publicationService.scheduleInstagramPublication({
      workspaceId,
      brandId,
      socialAccountId: body.socialAccountId,
      publishAt: body.publishAt ? new Date(body.publishAt) : undefined,
      payload: body.payload,
      actorUserId: userId,
      clientRequestId: body.clientRequestId,
    }, request);

    return reply.status(201).send({
      success: true,
      data: {
        id: publication.id,
        status: publication.status,
        scheduledAt: publication.scheduledAt?.toISOString() ?? null,
      },
    });
  });

  // ====================
  // Facebook Publication Endpoint
  // ====================

  /**
   * POST /v1/brands/:brandId/publications/facebook
   * Schedule a Facebook publication
   */
  app.post("/brands/:brandId/publications/facebook", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_CONTENT_PUBLISH)],
      schema: {
      tags: ["Publications", "Facebook"],
      summary: "Schedule Facebook publication",
      description: "Schedule a new publication to Facebook (PHOTO, VIDEO, LINK, STORY, or CAROUSEL)",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
      },
      body: {
        type: "object",
        properties: {
          socialAccountId: { type: "string", description: "ID of the Facebook Page social account to publish from" },
          publishAt: { type: "string", format: "date-time", description: "ISO datetime for scheduled publish (optional, immediate if not provided)" },
          clientRequestId: { type: "string", description: "Client-provided idempotency key" },
          payload: {
            type: "object",
            description: "Facebook-specific payload (PHOTO, VIDEO, LINK, STORY, or CAROUSEL)",
            properties: {
              contentType: { type: "string", enum: ["PHOTO", "VIDEO", "LINK", "STORY", "CAROUSEL"] },
              message: { type: "string" },
              imageMediaId: { type: "string" },
              videoMediaId: { type: "string" },
              linkUrl: { type: "string" },
              storyType: { type: "string", enum: ["IMAGE", "VIDEO"] },
              items: { type: "array" },
            },
            required: ["contentType"],
          },
        },
        required: ["socialAccountId", "payload"],
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                scheduledAt: { type: ["string", "null"] },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = validateParams(brandParamsSchema, request.params);
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const body = validateBody(createFacebookPublicationSchema, request);

    const publication = await publicationService.scheduleFacebookPublication({
      workspaceId,
      brandId,
      socialAccountId: body.socialAccountId,
      publishAt: body.publishAt ? new Date(body.publishAt) : undefined,
      payload: body.payload,
      actorUserId: userId,
      clientRequestId: body.clientRequestId,
    }, request);

    return reply.status(201).send({
      success: true,
      data: {
        id: publication.id,
        status: publication.status,
        scheduledAt: publication.scheduledAt?.toISOString() ?? null,
      },
    });
  });

  // ====================
  // Draft Publication Endpoints
  // ====================

  /**
   * POST /v1/brands/:brandId/publications/instagram/draft
   * Create a draft Instagram publication
   */
  app.post("/brands/:brandId/publications/instagram/draft", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_CONTENT_PUBLISH)],
    schema: {
      tags: ["Publications", "Instagram", "Drafts"],
      summary: "Create draft Instagram publication",
      description: "Create a draft publication for Instagram (not published automatically)",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
      },
      body: {
        type: "object",
        properties: {
          socialAccountId: { type: "string", description: "ID of the Instagram social account" },
          clientRequestId: { type: "string", description: "Client-provided idempotency key" },
          payload: {
            type: "object",
            description: "Instagram-specific payload (IMAGE, CAROUSEL, REEL, or STORY)",
            properties: {
              contentType: { type: "string", enum: ["IMAGE", "CAROUSEL", "REEL", "STORY"] },
              caption: { type: "string" },
              imageMediaId: { type: "string" },
              videoMediaId: { type: "string" },
              storyType: { type: "string", enum: ["IMAGE", "VIDEO"] },
              items: { type: "array" },
            },
            required: ["contentType"],
          },
        },
        required: ["socialAccountId", "payload"],
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                scheduledAt: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = validateParams(brandParamsSchema, request.params);
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;
    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    // Debug: Log request body
    console.log("📥 Draft Instagram request body:", JSON.stringify(request.body, null, 2));
    const body = validateBody(createDraftInstagramPublicationSchema, request);
    console.log("✅ Draft Instagram validated body:", JSON.stringify(body, null, 2));

    const publication = await publicationService.createDraftInstagramPublication({
      workspaceId,
      brandId,
      socialAccountId: body.socialAccountId,
      payload: body.payload,
      actorUserId: userId,
      clientRequestId: body.clientRequestId,
    }, request);

    return reply.status(201).send({
      success: true,
      data: {
        id: publication.id,
        status: publication.status,
        scheduledAt: publication.scheduledAt?.toISOString() ?? null,
      },
    });
  });

  /**
   * POST /v1/brands/:brandId/publications/facebook/draft
   * Create a draft Facebook publication
   */
  app.post("/brands/:brandId/publications/facebook/draft", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_CONTENT_PUBLISH)],
    schema: {
      tags: ["Publications", "Facebook", "Drafts"],
      summary: "Create draft Facebook publication",
      description: "Create a draft publication for Facebook (not published automatically)",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
      },
      body: {
        type: "object",
        properties: {
          socialAccountId: { type: "string", description: "ID of the Facebook social account" },
          clientRequestId: { type: "string", description: "Client-provided idempotency key" },
          payload: {
            type: "object",
            description: "Facebook-specific payload (PHOTO, VIDEO, LINK, or STORY)",
            properties: {
              contentType: { type: "string", enum: ["PHOTO", "VIDEO", "LINK", "STORY", "CAROUSEL"] },
              message: { type: "string" },
              imageMediaId: { type: "string" },
              videoMediaId: { type: "string" },
              linkUrl: { type: "string" },
              storyType: { type: "string", enum: ["IMAGE", "VIDEO"] },
              items: { type: "array" },
            },
            required: ["contentType"],
          },
        },
        required: ["socialAccountId", "payload"],
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                scheduledAt: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = validateParams(brandParamsSchema, request.params);
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;
    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    // Debug: Log request body
    console.log("📥 Draft Facebook request body:", JSON.stringify(request.body, null, 2));
    const body = validateBody(createDraftFacebookPublicationSchema, request);
    console.log("✅ Draft Facebook validated body:", JSON.stringify(body, null, 2));

    const publication = await publicationService.createDraftFacebookPublication({
      workspaceId,
      brandId,
      socialAccountId: body.socialAccountId,
      payload: body.payload,
      actorUserId: userId,
      clientRequestId: body.clientRequestId,
    }, request);

    return reply.status(201).send({
      success: true,
      data: {
        id: publication.id,
        status: publication.status,
        scheduledAt: publication.scheduledAt?.toISOString() ?? null,
      },
    });
  });

  // ====================
  // List Publications Endpoint
  // ====================

  /**
   * GET /v1/brands/:brandId/publications
   * List publications for a brand
   */
  app.get("/brands/:brandId/publications", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_CONTENT_VIEW)],
    schema: {
      tags: ["Publications"],
      summary: "List publications",
      description: "Get a paginated list of publications for a brand",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
      },
      querystring: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 100 },
          cursor: { type: "string" },
          status: { type: "string", enum: ["draft", "scheduled", "publishing", "published", "failed", "cancelled"] },
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
                      platform: { type: "string" },
                      contentType: { type: "string" },
                      status: { type: "string" },
                      caption: { type: ["string", "null"] },
                      socialAccountId: { type: "string" },
                      payloadJson: { type: ["object", "null"] },
                      mediaThumbnails: { type: "array", items: { type: "string" } },
                      mediaUrls: { type: "array", items: { type: "string" } },
                      scheduledAt: { type: ["string", "null"] },
                      publishedAt: { type: ["string", "null"] },
                      failedAt: { type: ["string", "null"] },
                      permalink: { type: ["string", "null"] },
                      externalPostId: { type: ["string", "null"] },
                      createdAt: { type: "string" },
                      updatedAt: { type: "string" },
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
    const { brandId } = validateParams(brandParamsSchema, request.params);
    const workspaceId = requireWorkspaceMatch(request);
    const { limit, cursor } = validateQuery(cursorPaginationQuerySchema, request.query);
    const { status } = request.query as { status?: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled" };

    const result = await publicationService.listBrandPublications({
      workspaceId,
      brandId,
      limit,
      cursor,
      status: status as any, // Type assertion to PublicationStatus enum
    });

    return reply.send({
      success: true,
      data: {
        items: result.items.map((item) => ({
          id: item.id,
          platform: item.platform,
          contentType: item.contentType,
          status: item.status,
          caption: item.caption,
          socialAccountId: item.socialAccountId,
          payloadJson: item.payloadJson,
          mediaThumbnails: item.mediaThumbnails || [],
          mediaUrls: item.mediaUrls || [],
          scheduledAt: item.scheduledAt?.toISOString() ?? null,
          publishedAt: item.publishedAt?.toISOString() ?? null,
          failedAt: item.failedAt?.toISOString() ?? null,
          permalink: item.permalink,
          externalPostId: item.externalPostId,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        nextCursor: result.nextCursor,
      },
    });
  });

  // ====================
  // Get Publication Endpoint
  // ====================

  /**
   * GET /v1/brands/:brandId/publications/:publicationId
   * Get a single publication
   */
  app.get("/brands/:brandId/publications/:publicationId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_CONTENT_VIEW)],
    schema: {
      tags: ["Publications"],
      summary: "Get publication details",
      description: "Get detailed information about a specific publication",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
          publicationId: { type: "string" },
        },
        required: ["brandId", "publicationId"],
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
                brandId: { type: "string" },
                socialAccountId: { type: ["string", "null"] },
                platform: { type: "string" },
                contentType: { type: "string" },
                status: { type: "string" },
                caption: { type: ["string", "null"] },
                scheduledAt: { type: ["string", "null"] },
                publishedAt: { type: ["string", "null"] },
                failedAt: { type: ["string", "null"] },
                permalink: { type: ["string", "null"] },
                externalPostId: { type: ["string", "null"] },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = validateParams(brandParamsSchema, request.params);
    const { publicationId } = request.params as { publicationId: string };
    const workspaceId = requireWorkspaceMatch(request);

    const publication = await publicationService.getPublication(
      publicationId,
      workspaceId,
      brandId
    );

    return reply.send({
      success: true,
      data: {
        id: publication.id,
        workspaceId: publication.workspaceId,
        brandId: publication.brandId,
        socialAccountId: publication.socialAccountId,
        platform: publication.platform,
        contentType: publication.contentType,
        status: publication.status,
        caption: publication.caption,
        scheduledAt: publication.scheduledAt?.toISOString() ?? null,
        publishedAt: publication.publishedAt?.toISOString() ?? null,
        failedAt: publication.failedAt?.toISOString() ?? null,
        permalink: publication.permalink,
        externalPostId: publication.externalPostId,
        createdAt: publication.createdAt.toISOString(),
        updatedAt: publication.updatedAt.toISOString(),
      },
    });
  });
}

