/**
 * Social Account Routes
 * 
 * Fastify route definitions for SocialAccount domain.
 * All routes are registered under /v1/brands/:brandId/social-accounts prefix.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError } from "../../lib/http-errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validation.js";
import {
  brandParamsSchema,
  connectSocialAccountSchema,
  socialAccountParamsSchema,
  socialAccountListQuerySchema,
} from "@brint/core-validation";
import { normalizeCursorPaginationInput } from "../../lib/pagination.js";
import * as socialAccountService from "./social-account.service.js";

/**
 * Validates workspace header is present
 */
function requireWorkspaceId(request: FastifyRequest): string {
  const headerWorkspaceId = request.auth?.workspaceId;

  if (!headerWorkspaceId) {
    throw new BadRequestError("WORKSPACE_ID_REQUIRED", "X-Workspace-Id header is required");
  }

  return headerWorkspaceId;
}

export async function registerSocialAccountRoutes(app: FastifyInstance) {
  // ====================
  // Social Account CRUD Routes
  // ====================

  /**
   * GET /v1/brands/:brandId/social-accounts
   * List social accounts for a brand
   */
  app.get("/brands/:brandId/social-accounts", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_VIEW)],
    schema: {
      tags: ["Social Accounts"],
      summary: "List social accounts",
      description: "Get a paginated list of social accounts for a brand",
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
          status: { type: "string", enum: ["ACTIVE", "DISCONNECTED", "REMOVED"] },
          includeRemoved: { type: "boolean" },
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
                      workspaceId: { type: "string" },
                      brandId: { type: "string" },
                      platform: { type: "string" },
                      externalId: { type: "string" },
                      username: { type: ["string", "null"] },
                      displayName: { type: ["string", "null"] },
                      profileUrl: { type: ["string", "null"] },
                      status: { type: "string" },
                      lastSyncedAt: { type: ["string", "null"] },
                      avatarMediaId: { type: ["string", "null"] },
                      avatarUrl: { type: ["string", "null"] },
                      platformData: { type: ["object", "null"] },
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
    const workspaceId = requireWorkspaceId(request);
    const { brandId } = validateParams(brandParamsSchema, request.params);
    const query = validateQuery(socialAccountListQuerySchema, request.query);
    const pagination = normalizeCursorPaginationInput({
      limit: query.limit,
      cursor: query.cursor,
    });

    const result = await socialAccountService.listBrandAccounts({
      workspaceId,
      brandId,
      limit: pagination.limit,
      cursor: pagination.cursor,
      status: query.status,
      includeRemoved: query.includeRemoved,
    });

    return reply.send({
      success: true,
      data: {
        items: result.items.map((account) => ({
          id: account.id,
          workspaceId: account.workspaceId,
          brandId: account.brandId,
          platform: account.platform,
          externalId: account.externalId,
          username: account.username,
          displayName: account.displayName,
          profileUrl: account.profileUrl,
          status: account.status,
          lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
          avatarMediaId: account.avatarMediaId,
          platformData: account.platformData,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
        })),
        nextCursor: result.nextCursor,
      },
    });
  });

  /**
   * POST /v1/brands/:brandId/social-accounts
   * Connect a new social account
   */
  app.post("/brands/:brandId/social-accounts", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_CONNECT)],
    schema: {
      tags: ["Social Accounts"],
      summary: "Connect social account",
      description: "Connect a new social account to a brand",
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
          platform: {
            type: "string",
            enum: ["FACEBOOK_PAGE", "INSTAGRAM_BUSINESS", "INSTAGRAM_BASIC", "YOUTUBE_CHANNEL", "TIKTOK_BUSINESS", "PINTEREST_PROFILE", "X_ACCOUNT", "LINKEDIN_PAGE"],
          },
          externalId: { type: "string", minLength: 1, maxLength: 500 },
          username: { type: "string", minLength: 1, maxLength: 255 },
          displayName: { type: "string", minLength: 1, maxLength: 255 },
          profileUrl: { type: "string", format: "uri" },
          platformData: { type: "object" },
          credentials: {
            type: "object",
            properties: {
              platform: { type: "string" },
              data: { type: "object" },
            },
            required: ["platform", "data"],
          },
        },
        required: ["platform", "externalId", "credentials"],
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
                workspaceId: { type: "string" },
                brandId: { type: "string" },
                platform: { type: "string" },
                externalId: { type: "string" },
                username: { type: ["string", "null"] },
                displayName: { type: ["string", "null"] },
                profileUrl: { type: ["string", "null"] },
                status: { type: "string" },
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
    const workspaceId = requireWorkspaceId(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId } = validateParams(brandParamsSchema, request.params);
    const input = validateBody(connectSocialAccountSchema, request);

    const account = await socialAccountService.connectSocialAccount({
      workspaceId,
      brandId,
      input: {
        platform: input.platform,
        externalId: input.externalId,
        username: input.username,
        displayName: input.displayName,
        profileUrl: input.profileUrl,
        platformData: input.platformData,
        credentials: input.credentials as any, // Type assertion - service validates further
      },
      userId,
      request,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: account.id,
        workspaceId: account.workspaceId,
        brandId: account.brandId,
        platform: account.platform,
        externalId: account.externalId,
        username: account.username,
        displayName: account.displayName,
        profileUrl: account.profileUrl,
        status: account.status,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      },
    });
  });

  /**
   * POST /v1/brands/:brandId/social-accounts/:socialAccountId/disconnect
   * Disconnect a social account
   */
  app.post("/brands/:brandId/social-accounts/:socialAccountId/disconnect", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DISCONNECT)],
    schema: {
      tags: ["Social Accounts"],
      summary: "Disconnect social account",
      description: "Disconnect a social account from a brand (wipes credentials, sets status to DISCONNECTED)",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
          socialAccountId: { type: "string" },
        },
        required: ["brandId", "socialAccountId"],
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
                message: { type: "string" },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId, socialAccountId } = validateParams(
      socialAccountParamsSchema,
      request.params
    );

    const account = await socialAccountService.disconnectSocialAccount({
      workspaceId,
      brandId,
      socialAccountId,
      userId,
      request,
    });

    return reply.send({
      success: true,
      data: {
        id: account.id,
        status: account.status,
        message: "Social account disconnected successfully",
      },
    });
  });

  /**
   * DELETE /v1/brands/:brandId/social-accounts/:socialAccountId
   * Remove (soft delete) a social account
   */
  app.delete("/brands/:brandId/social-accounts/:socialAccountId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_SOCIAL_ACCOUNT_DELETE)],
    schema: {
      tags: ["Social Accounts"],
      summary: "Remove social account",
      description: "Remove (soft delete) a social account from a brand",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
          socialAccountId: { type: "string" },
        },
        required: ["brandId", "socialAccountId"],
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
                message: { type: "string" },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceId(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId, socialAccountId } = validateParams(
      socialAccountParamsSchema,
      request.params
    );

    const account = await socialAccountService.removeSocialAccount({
      workspaceId,
      brandId,
      socialAccountId,
      userId,
      request,
    });

    return reply.send({
      success: true,
      data: {
        id: account.id,
        status: account.status,
        message: "Social account removed successfully",
      },
    });
  });
}

