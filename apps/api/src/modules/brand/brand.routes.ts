/**
 * Brand Routes
 * 
 * Fastify route definitions for Brand domain.
 * All routes are registered under /v1/brands prefix.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requirePermission } from "../../core/auth/require-permission.js";
import { PERMISSIONS } from "../../core/auth/permissions.registry.js";
import { BadRequestError, ForbiddenError } from "../../lib/http-errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validation.js";
import {
  createBrandSchema,
  updateBrandSchema,
  brandParamsSchema,
  brandListQuerySchema,
  createBrandHashtagPresetSchema,
  updateBrandHashtagPresetSchema,
  hashtagPresetParamsSchema,
  cursorPaginationQuerySchema,
} from "@brint/core-validation";
import {
  normalizeCursorPaginationInput,
} from "../../lib/pagination.js";
import * as brandService from "./brand.service.js";
import { prisma } from "../../lib/prisma.js";
import { S3StorageService } from "../../lib/storage/s3.storage.service.js";
import { storageConfig } from "../../config/index.js";

const storage = new S3StorageService();

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

  // If workspaceId is provided in route params, ensure it matches header
  if (workspaceIdFromParam && headerWorkspaceId !== workspaceIdFromParam) {
    throw new ForbiddenError("WORKSPACE_MISMATCH", {
      headerWorkspaceId,
      paramWorkspaceId: workspaceIdFromParam,
    });
  }

  return headerWorkspaceId;
}

/**
 * Helper to generate logo URL for a brand
 */
async function getBrandLogoUrl(logoMediaId: string | null): Promise<string | null> {
  if (!logoMediaId) return null;
  
  const media = await prisma.media.findUnique({ where: { id: logoMediaId } });
  if (!media) return null;
  
  // Use CDN URL if available, otherwise use presigned URL
  if (storageConfig.cdnBaseUrl) {
    return `${storageConfig.cdnBaseUrl}/${media.objectKey}`;
  }
  
  return storage.getPresignedDownloadUrl(media.objectKey, {
    expiresInSeconds: storageConfig.presign.downloadExpireSeconds,
  });
}

export async function registerBrandRoutes(app: FastifyInstance) {
  // ====================
  // Brand CRUD Routes
  // ====================

  /**
   * GET /v1/brands
   * List brands for the current workspace
   */
  app.get("/brands", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)],
    schema: {
      tags: ["Brands"],
      summary: "List brands",
      description: "Get a paginated list of brands for the current workspace",
      querystring: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 100 },
          cursor: { type: "string" },
          includeArchived: { type: "boolean" },
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
                      name: { type: "string" },
                      slug: { type: "string" },
                      description: { type: ["string", "null"] },
                      industry: { type: ["string", "null"] },
                      readinessScore: { type: "number" },
                      profileCompleted: { type: "boolean" },
                      hasAtLeastOneSocialAccount: { type: "boolean" },
                      publishingDefaultsConfigured: { type: "boolean" },
                      isArchived: { type: "boolean" },
                      logoMediaId: { type: ["string", "null"] },
                      logoUrl: { type: ["string", "null"] },
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
    const workspaceId = requireWorkspaceMatch(request);
    const query = validateQuery(brandListQuerySchema, request.query);
    const pagination = normalizeCursorPaginationInput({
      limit: query.limit,
      cursor: query.cursor,
    });

    const result = await brandService.listBrands({
      workspaceId,
      limit: pagination.limit,
      cursor: pagination.cursor,
      includeArchived: query.includeArchived,
    });

    // Generate logo URLs for brands that have logos
    const brandsWithLogos = await Promise.all(
      result.items.map(async (brand) => {
        const logoUrl = await getBrandLogoUrl(brand.logoMediaId);
        return {
          id: brand.id,
          workspaceId: brand.workspaceId,
          name: brand.name,
          slug: brand.slug,
          description: brand.description,
          industry: brand.industry,
          readinessScore: brand.readinessScore,
          profileCompleted: brand.profileCompleted,
          hasAtLeastOneSocialAccount: brand.hasAtLeastOneSocialAccount,
          publishingDefaultsConfigured: brand.publishingDefaultsConfigured,
          isArchived: brand.isArchived,
          logoMediaId: brand.logoMediaId,
          logoUrl,
          createdAt: brand.createdAt.toISOString(),
          updatedAt: brand.updatedAt.toISOString(),
        };
      })
    );

    return reply.send({
      success: true,
      data: {
        items: brandsWithLogos,
        nextCursor: result.nextCursor,
      },
    });
  });

  /**
   * POST /v1/brands
   * Create a new brand
   */
  app.post("/brands", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_CREATE)],
    schema: {
      tags: ["Brands"],
      summary: "Create brand",
      description: "Create a new brand in the current workspace",
      body: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255 },
          slug: { type: "string", minLength: 1, maxLength: 255, description: "Optional - will be auto-generated from name if not provided" },
          description: { type: ["string", "null"], maxLength: 2000 },
          industry: { type: ["string", "null"], maxLength: 255 },
          language: { type: ["string", "null"], maxLength: 10 },
          timezone: { type: ["string", "null"], maxLength: 100 },
          toneOfVoice: { type: ["string", "null"], maxLength: 500 },
          primaryColor: { type: ["string", "null"], maxLength: 20 },
          secondaryColor: { type: ["string", "null"], maxLength: 20 },
          websiteUrl: { type: ["string", "null"], maxLength: 2000 },
        },
        required: ["name"],
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
                name: { type: "string" },
                slug: { type: "string" },
                readinessScore: { type: "number" },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const input = validateBody(createBrandSchema, request);

    const brand = await brandService.createBrand({
      workspaceId,
      input,
      userId,
      request,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        readinessScore: brand.readinessScore,
      },
    });
  });

  /**
   * GET /v1/brands/by-slug/:slug
   * Get brand by slug
   * NOTE: This route MUST be defined before /brands/:brandId to avoid route conflicts
   */
  app.get("/brands/by-slug/:slug", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)],
    schema: {
      tags: ["Brands"],
      summary: "Get brand by slug",
      description: "Get detailed information about a brand using its slug",
      params: {
        type: "object",
        properties: {
          slug: { type: "string" },
        },
        required: ["slug"],
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
                name: { type: "string" },
                slug: { type: "string" },
                description: { type: ["string", "null"] },
                industry: { type: ["string", "null"] },
                language: { type: ["string", "null"] },
                timezone: { type: ["string", "null"] },
                toneOfVoice: { type: ["string", "null"] },
                primaryColor: { type: ["string", "null"] },
                secondaryColor: { type: ["string", "null"] },
                websiteUrl: { type: ["string", "null"] },
                logoMediaId: { type: ["string", "null"] },
                logoUrl: { type: ["string", "null"] },
                readinessScore: { type: "number" },
                profileCompleted: { type: "boolean" },
                hasAtLeastOneSocialAccount: { type: "boolean" },
                publishingDefaultsConfigured: { type: "boolean" },
                isArchived: { type: "boolean" },
                isActive: { type: "boolean" },
                createdBy: { type: ["string", "null"] },
                updatedBy: { type: ["string", "null"] },
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
    const workspaceId = requireWorkspaceMatch(request);
    const { slug } = request.params as { slug: string };

    const brand = await brandService.getBrandBySlug(slug, workspaceId);
    const logoUrl = await getBrandLogoUrl(brand.logoMediaId);

    return reply.send({
      success: true,
      data: {
        id: brand.id,
        workspaceId: brand.workspaceId,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        industry: brand.industry,
        language: brand.language,
        timezone: brand.timezone,
        toneOfVoice: brand.toneOfVoice,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        websiteUrl: brand.websiteUrl,
        logoMediaId: brand.logoMediaId,
        logoUrl,
        readinessScore: brand.readinessScore,
        profileCompleted: brand.profileCompleted,
        hasAtLeastOneSocialAccount: brand.hasAtLeastOneSocialAccount,
        publishingDefaultsConfigured: brand.publishingDefaultsConfigured,
        isArchived: brand.isArchived,
        isActive: brand.isActive,
        createdBy: brand.createdBy,
        updatedBy: brand.updatedBy,
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
      },
    });
  });

  /**
   * GET /v1/brands/:brandId
   * Get brand details
   */
  app.get("/brands/:brandId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_VIEW)],
    schema: {
      tags: ["Brands"],
      summary: "Get brand details",
      description: "Get detailed information about a specific brand",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
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
                name: { type: "string" },
                slug: { type: "string" },
                description: { type: ["string", "null"] },
                industry: { type: ["string", "null"] },
                language: { type: ["string", "null"] },
                timezone: { type: ["string", "null"] },
                toneOfVoice: { type: ["string", "null"] },
                primaryColor: { type: ["string", "null"] },
                secondaryColor: { type: ["string", "null"] },
                websiteUrl: { type: ["string", "null"] },
                logoMediaId: { type: ["string", "null"] },
                logoUrl: { type: ["string", "null"] },
                readinessScore: { type: "number" },
                profileCompleted: { type: "boolean" },
                hasAtLeastOneSocialAccount: { type: "boolean" },
                publishingDefaultsConfigured: { type: "boolean" },
                isArchived: { type: "boolean" },
                isActive: { type: "boolean" },
                createdBy: { type: ["string", "null"] },
                updatedBy: { type: ["string", "null"] },
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
    const workspaceId = requireWorkspaceMatch(request);
    const { brandId } = validateParams(brandParamsSchema, request.params);

    const brand = await brandService.getBrand(brandId, workspaceId);
    const logoUrl = await getBrandLogoUrl(brand.logoMediaId);

    return reply.send({
      success: true,
      data: {
        id: brand.id,
        workspaceId: brand.workspaceId,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        industry: brand.industry,
        language: brand.language,
        timezone: brand.timezone,
        toneOfVoice: brand.toneOfVoice,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        websiteUrl: brand.websiteUrl,
        logoMediaId: brand.logoMediaId,
        logoUrl,
        readinessScore: brand.readinessScore,
        profileCompleted: brand.profileCompleted,
        hasAtLeastOneSocialAccount: brand.hasAtLeastOneSocialAccount,
        publishingDefaultsConfigured: brand.publishingDefaultsConfigured,
        isArchived: brand.isArchived,
        isActive: brand.isActive,
        createdBy: brand.createdBy,
        updatedBy: brand.updatedBy,
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
      },
    });
  });

  /**
   * PATCH /v1/brands/:brandId
   * Update brand profile
   */
  app.patch("/brands/:brandId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_UPDATE)],
    schema: {
      tags: ["Brands"],
      summary: "Update brand",
      description: "Update brand profile information",
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
          name: { type: "string", minLength: 1, maxLength: 255 },
          slug: { type: "string", minLength: 1, maxLength: 255 },
          description: { type: ["string", "null"], maxLength: 2000 },
          industry: { type: ["string", "null"], maxLength: 255 },
          language: { type: ["string", "null"], maxLength: 10 },
          timezone: { type: ["string", "null"], maxLength: 100 },
          toneOfVoice: { type: ["string", "null"], maxLength: 500 },
          primaryColor: { type: ["string", "null"], maxLength: 20 },
          secondaryColor: { type: ["string", "null"], maxLength: 20 },
          websiteUrl: { type: ["string", "null"], maxLength: 2000 },
          logoMediaId: { type: ["string", "null"], maxLength: 50 },
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
                id: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
                readinessScore: { type: "number" },
                profileCompleted: { type: "boolean" },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId } = validateParams(brandParamsSchema, request.params);
    const input = validateBody(updateBrandSchema, request);

    const brand = await brandService.updateBrand({
      brandId,
      workspaceId,
      input,
      userId,
      request,
    });

    return reply.send({
      success: true,
      data: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        readinessScore: brand.readinessScore,
        profileCompleted: brand.profileCompleted,
      },
    });
  });

  /**
   * DELETE /v1/brands/:brandId
   * Archive (soft delete) a brand
   */
  app.delete("/brands/:brandId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_DELETE)],
    schema: {
      tags: ["Brands"],
      summary: "Delete brand",
      description: "Archive (soft delete) a brand",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" },
                brandId: { type: "string" },
                isArchived: { type: "boolean" },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId } = validateParams(brandParamsSchema, request.params);

    const brand = await brandService.archiveBrand({
      brandId,
      workspaceId,
      userId,
      request,
    });

    return reply.send({
      success: true,
      data: {
        message: "Brand archived successfully",
        brandId: brand.id,
        isArchived: brand.isArchived,
      },
    });
  });

  // ====================
  // Hashtag Preset Routes
  // ====================

  /**
   * GET /v1/brands/:brandId/hashtag-presets
   * List hashtag presets for a brand
   */
  app.get("/brands/:brandId/hashtag-presets", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_UPDATE)],
    schema: {
      tags: ["Brands", "Hashtag Presets"],
      summary: "List hashtag presets",
      description: "Get all hashtag presets for a brand",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
        },
        required: ["brandId"],
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
                      brandId: { type: "string" },
                      name: { type: "string" },
                      tags: { type: "array", items: { type: "string" } },
                      createdAt: { type: "string" },
                      updatedAt: { type: "string" },
                    },
                  },
                },
              },
              required: ["items"],
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceMatch(request);
    const { brandId } = validateParams(brandParamsSchema, request.params);

    const presets = await brandService.listHashtagPresets({
      brandId,
      workspaceId,
    });

    return reply.send({
      success: true,
      data: {
        items: presets.map((preset) => ({
          id: preset.id,
          brandId: preset.brandId,
          name: preset.name,
          tags: preset.tags as string[],
          createdAt: preset.createdAt.toISOString(),
          updatedAt: preset.updatedAt.toISOString(),
        })),
      },
    });
  });

  /**
   * POST /v1/brands/:brandId/hashtag-presets
   * Create a new hashtag preset
   */
  app.post("/brands/:brandId/hashtag-presets", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_UPDATE)],
    schema: {
      tags: ["Brands", "Hashtag Presets"],
      summary: "Create hashtag preset",
      description: "Create a new hashtag preset for a brand",
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
          name: { type: "string", minLength: 1, maxLength: 255 },
          tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
        },
        required: ["name", "tags"],
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
                brandId: { type: "string" },
                name: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId } = validateParams(brandParamsSchema, request.params);
    const input = validateBody(createBrandHashtagPresetSchema, request);

    const preset = await brandService.createHashtagPreset({
      brandId,
      workspaceId,
      input,
      userId,
      request,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: preset.id,
        brandId: preset.brandId,
        name: preset.name,
        tags: preset.tags as string[],
      },
    });
  });

  /**
   * PATCH /v1/brands/:brandId/hashtag-presets/:presetId
   * Update a hashtag preset
   */
  app.patch("/brands/:brandId/hashtag-presets/:presetId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_UPDATE)],
    schema: {
      tags: ["Brands", "Hashtag Presets"],
      summary: "Update hashtag preset",
      description: "Update an existing hashtag preset",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
          presetId: { type: "string" },
        },
        required: ["brandId", "presetId"],
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255 },
          tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
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
                id: { type: "string" },
                brandId: { type: "string" },
                name: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId, presetId } = validateParams(hashtagPresetParamsSchema, request.params);
    const input = validateBody(updateBrandHashtagPresetSchema, request);

    const preset = await brandService.updateHashtagPreset({
      presetId,
      brandId,
      workspaceId,
      input,
      userId,
      request,
    });

    return reply.send({
      success: true,
      data: {
        id: preset.id,
        brandId: preset.brandId,
        name: preset.name,
        tags: preset.tags as string[],
      },
    });
  });

  /**
   * DELETE /v1/brands/:brandId/hashtag-presets/:presetId
   * Delete a hashtag preset
   */
  app.delete("/brands/:brandId/hashtag-presets/:presetId", {
    preHandler: [requirePermission(PERMISSIONS.STUDIO_BRAND_UPDATE)],
    schema: {
      tags: ["Brands", "Hashtag Presets"],
      summary: "Delete hashtag preset",
      description: "Delete a hashtag preset",
      params: {
        type: "object",
        properties: {
          brandId: { type: "string" },
          presetId: { type: "string" },
        },
        required: ["brandId", "presetId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" },
              },
            },
          },
          required: ["success", "data"],
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = requireWorkspaceMatch(request);
    const userId = request.auth?.userId;

    if (!userId) {
      throw new BadRequestError("USER_ID_REQUIRED", "User ID is required");
    }

    const { brandId, presetId } = validateParams(hashtagPresetParamsSchema, request.params);

    await brandService.deleteHashtagPreset({
      presetId,
      brandId,
      workspaceId,
      userId,
      request,
    });

    return reply.send({
      success: true,
      data: {
        message: "Hashtag preset deleted successfully",
      },
    });
  });
}

