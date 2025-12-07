/**
 * Social Account Routes
 * 
 * Brand-based social account management endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  listByBrand,
  getById,
  createOrUpdateFromOAuth,
  markAsExpired,
  disconnect,
  updateAvatar,
  deleteSocialAccount,
  type CreateOrUpdateFromOAuthInput,
} from './social-account.service.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import type { SocialPlatform, SocialAccountStatus } from '@prisma/client';

export async function registerSocialAccountRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts
  // List social accounts for a brand
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts', {
    preHandler: requireWorkspaceRoleFor('brand:view'),
    schema: {
      tags: ['Social Account'],
      summary: 'List social accounts for a brand',
      description: 'Get all connected social accounts for a brand. Requires VIEWER role.',
      querystring: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'YOUTUBE', 'WHATSAPP', 'PINTEREST'],
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRED', 'REVOKED'],
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as { workspaceId: string; brandId: string };
    const { platform, status } = request.query as {
      platform?: SocialPlatform;
      status?: SocialAccountStatus;
    };

    try {
      const accounts = await listByBrand(brandId, workspaceId, { platform, status });

      return reply.status(200).send({
        success: true,
        socialAccounts: accounts,
        total: accounts.length,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'BRAND_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      request.log.error({ error, workspaceId, brandId }, 'Failed to list social accounts');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'LIST_FAILED',
          message: 'Failed to list social accounts',
        },
      });
    }
  });

  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId
  // Get a single social account (without tokens)
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId', {
    preHandler: requireWorkspaceRoleFor('brand:view'),
    schema: {
      tags: ['Social Account'],
      summary: 'Get social account details',
      description: 'Get details of a specific social account. Requires VIEWER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, accountId } = request.params as {
      workspaceId: string;
      brandId: string;
      accountId: string;
    };

    try {
      const account = await getById(accountId, workspaceId);

      if (!account) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SOCIAL_ACCOUNT_NOT_FOUND',
            message: 'Social account not found',
          },
        });
      }

      // Remove sensitive token data from response
      const { accessToken, refreshToken, tokenExpiresAt, scopes, tokenData, rawProfile, ...safeAccount } = account;

      return reply.status(200).send({
        success: true,
        socialAccount: safeAccount,
      });
    } catch (error) {
      request.log.error({ error, workspaceId, accountId }, 'Failed to get social account');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'GET_FAILED',
          message: 'Failed to get social account',
        },
      });
    }
  });

  // ============================================================================
  // POST /workspaces/:workspaceId/brands/:brandId/social-accounts/oauth/:platform/callback
  // Handle OAuth callback - create or update social account
  // ============================================================================
  app.post('/workspaces/:workspaceId/brands/:brandId/social-accounts/oauth/:platform/callback', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Social Account'],
      summary: 'OAuth callback handler',
      description: 'Handle OAuth callback from social platforms. Creates or updates social account. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId, platform } = request.params as {
      workspaceId: string;
      brandId: string;
      platform: string;
    };
    const userId = request.auth?.userId;

    // Validate platform
    const validPlatforms = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'YOUTUBE', 'WHATSAPP', 'PINTEREST'];
    const normalizedPlatform = platform.toUpperCase();
    
    if (!validPlatforms.includes(normalizedPlatform)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_PLATFORM',
          message: `Invalid platform: ${platform}. Valid platforms: ${validPlatforms.join(', ')}`,
        },
      });
    }

    const body = request.body as {
      platformAccountId: string;
      displayName?: string;
      username?: string;
      externalAvatarUrl?: string;
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: string;
      scopes?: string[];
      tokenData?: unknown;
      rawProfile?: unknown;
    };

    try {
      const input: CreateOrUpdateFromOAuthInput = {
        brandId,
        platform: normalizedPlatform as SocialPlatform,
        platformAccountId: body.platformAccountId,
        displayName: body.displayName,
        username: body.username,
        externalAvatarUrl: body.externalAvatarUrl,
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : undefined,
        scopes: body.scopes || [],
        tokenData: body.tokenData,
        rawProfile: body.rawProfile,
      };

      const account = await createOrUpdateFromOAuth(input, workspaceId, userId);

      return reply.status(200).send({
        success: true,
        socialAccount: account,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'BRAND_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'BRAND_NOT_FOUND',
              message: 'Brand not found',
            },
          });
        }
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error,
            },
          });
        }
      }

      request.log.error({ error, workspaceId, brandId, platform }, 'OAuth callback failed');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'OAUTH_CALLBACK_FAILED',
          message: 'Failed to process OAuth callback',
        },
      });
    }
  });

  // ============================================================================
  // POST /workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId/disconnect
  // Disconnect (revoke) a social account
  // ============================================================================
  app.post('/workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId/disconnect', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Social Account'],
      summary: 'Disconnect social account',
      description: 'Disconnect a social account. Sets status to REVOKED and canPublish to false. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, accountId } = request.params as {
      workspaceId: string;
      brandId: string;
      accountId: string;
    };
    const userId = request.auth?.userId;

    try {
      const account = await disconnect(accountId, workspaceId, userId);

      return reply.status(200).send({
        success: true,
        socialAccount: account,
        message: 'Social account disconnected successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SOCIAL_ACCOUNT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SOCIAL_ACCOUNT_NOT_FOUND',
            message: 'Social account not found',
          },
        });
      }

      request.log.error({ error, workspaceId, accountId }, 'Failed to disconnect social account');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DISCONNECT_FAILED',
          message: 'Failed to disconnect social account',
        },
      });
    }
  });

  // ============================================================================
  // POST /workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId/mark-expired
  // Mark a social account as expired (token expired)
  // ============================================================================
  app.post('/workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId/mark-expired', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Social Account'],
      summary: 'Mark social account as expired',
      description: 'Mark a social account as expired when token is invalid. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, accountId } = request.params as {
      workspaceId: string;
      brandId: string;
      accountId: string;
    };

    const body = request.body as {
      errorCode?: string;
      errorMessage?: string;
    } | undefined;

    try {
      const account = await markAsExpired(
        accountId,
        workspaceId,
        body?.errorCode,
        body?.errorMessage
      );

      return reply.status(200).send({
        success: true,
        socialAccount: account,
        message: 'Social account marked as expired',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SOCIAL_ACCOUNT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SOCIAL_ACCOUNT_NOT_FOUND',
            message: 'Social account not found',
          },
        });
      }

      request.log.error({ error, workspaceId, accountId }, 'Failed to mark social account as expired');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'MARK_EXPIRED_FAILED',
          message: 'Failed to mark social account as expired',
        },
      });
    }
  });

  // ============================================================================
  // PATCH /workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId/avatar
  // Update avatar for a social account
  // ============================================================================
  app.patch('/workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId/avatar', {
    preHandler: requireWorkspaceRoleFor('brand:update'),
    schema: {
      tags: ['Social Account'],
      summary: 'Update social account avatar',
      description: 'Update the avatar URL for a social account. Requires ADMIN role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, accountId } = request.params as {
      workspaceId: string;
      brandId: string;
      accountId: string;
    };

    const body = request.body as {
      avatarUrl: string;
      externalAvatarUrl?: string;
    };

    if (!body?.avatarUrl) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'avatarUrl is required',
        },
      });
    }

    try {
      const account = await updateAvatar(
        accountId,
        workspaceId,
        body.avatarUrl,
        body.externalAvatarUrl
      );

      return reply.status(200).send({
        success: true,
        socialAccount: account,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SOCIAL_ACCOUNT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SOCIAL_ACCOUNT_NOT_FOUND',
            message: 'Social account not found',
          },
        });
      }

      request.log.error({ error, workspaceId, accountId }, 'Failed to update social account avatar');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPDATE_AVATAR_FAILED',
          message: 'Failed to update social account avatar',
        },
      });
    }
  });

  // ============================================================================
  // DELETE /workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId
  // Delete a social account completely
  // ============================================================================
  app.delete('/workspaces/:workspaceId/brands/:brandId/social-accounts/:accountId', {
    preHandler: requireWorkspaceRoleFor('brand:delete'),
    schema: {
      tags: ['Social Account'],
      summary: 'Delete social account',
      description: 'Permanently delete a social account. Requires OWNER role.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, accountId } = request.params as {
      workspaceId: string;
      brandId: string;
      accountId: string;
    };
    const userId = request.auth?.userId;

    try {
      await deleteSocialAccount(accountId, workspaceId, userId);

      return reply.status(200).send({
        success: true,
        message: 'Social account deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SOCIAL_ACCOUNT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SOCIAL_ACCOUNT_NOT_FOUND',
            message: 'Social account not found',
          },
        });
      }

      request.log.error({ error, workspaceId, accountId }, 'Failed to delete social account');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete social account',
        },
      });
    }
  });
}
