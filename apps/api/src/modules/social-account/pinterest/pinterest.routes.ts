/**
 * Pinterest OAuth Routes
 * 
 * Handles Pinterest OAuth authorization and callback endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildPinterestAuthorizeUrl, handlePinterestCallback } from './pinterest-oauth.service.js';
import { requireWorkspaceRoleFor } from '../../../core/auth/workspace-guard.js';
import { pinterestConfig } from '../../../config/pinterest.config.js';
import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';

export async function registerPinterestRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts/pinterest/authorize
  // Get Pinterest OAuth authorize URL
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts/pinterest/authorize', {
    preHandler: requireWorkspaceRoleFor('social-account:create'),
    schema: {
      tags: ['Social Account - Pinterest'],
      summary: 'Get Pinterest OAuth authorize URL',
      description: 'Returns the Pinterest OAuth authorization URL to redirect the user to. Requires ADMIN role.',
      querystring: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            default: 'tr',
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, brandId } = request.params as {
      workspaceId: string;
      brandId: string;
    };
    const { locale } = request.query as { locale?: string };
    const userId = request.auth?.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
        },
      });
    }

    try {
      // Verify brand exists and belongs to workspace
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          workspaceId,
        },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found or does not belong to workspace',
          },
        });
      }

      const authorizeUrl = buildPinterestAuthorizeUrl({
        brandId,
        workspaceId,
        userId,
        locale: locale || 'tr',
      });

      return reply.send({
        success: true,
        authorizeUrl,
      });
    } catch (error) {
      logger.error({ error, workspaceId, brandId, userId }, 'Failed to generate Pinterest authorize URL');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate Pinterest authorize URL',
        },
      });
    }
  });

  // ============================================================================
  // GET /v1/social-accounts/oauth/pinterest/callback
  // Handle Pinterest OAuth callback
  // ============================================================================
  app.get('/v1/social-accounts/oauth/pinterest/callback', {
    schema: {
      tags: ['Social Account - Pinterest'],
      summary: 'Pinterest OAuth callback',
      description: 'Handles the OAuth callback from Pinterest and redirects to the frontend.',
      querystring: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
          },
          state: {
            type: 'string',
          },
        },
        required: ['code', 'state'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as {
      code?: string;
      state?: string;
    };

    if (!code || !state) {
      logger.warn('Pinterest callback missing code or state');
      return reply.redirect(302, `${pinterestConfig.frontendUrl}/?error=pinterest_callback_failed&message=Missing+code+or+state`);
    }

    try {
      // Decode state to get workspaceId for validation
      const { decodePinterestState } = await import('./pinterest-state.js');
      const decodedState = decodePinterestState(state);
      const decoded = await handlePinterestCallback(code, state, decodedState.workspaceId);

      // Fetch workspace and brand to get slugs for redirect
      const workspace = await prisma.workspace.findUnique({
        where: { id: decoded.workspaceId },
        select: { slug: true },
      });

      const brand = await prisma.brand.findUnique({
        where: { id: decoded.brandId },
        select: { slug: true },
      });

      if (!workspace || !brand) {
        logger.warn({ workspaceId: decoded.workspaceId, brandId: decoded.brandId }, 'Workspace or brand not found for Pinterest callback redirect');
        // Fallback to workspace home
        const fallbackUrl = workspace 
          ? `${pinterestConfig.frontendUrl}/${decoded.locale || 'tr'}/${workspace.slug}/home?connected=pinterest`
          : `${pinterestConfig.frontendUrl}/?connected=pinterest`;
        return reply.redirect(302, fallbackUrl);
      }

      // Redirect to social accounts page
      const redirectUrl = `${pinterestConfig.frontendUrl}/${decoded.locale || 'tr'}/${workspace.slug}/${brand.slug}/social-accounts?connected=pinterest`;
      return reply.redirect(302, redirectUrl);
    } catch (error) {
      logger.error({ error, hasCode: !!code, hasState: !!state }, 'Pinterest OAuth callback error');

      // Try to decode state for better error redirect
      let errorRedirectUrl = `${pinterestConfig.frontendUrl}/?error=pinterest_callback_failed`;
      
      try {
        const { decodePinterestState } = await import('./pinterest-state.js');
        const decoded = decodePinterestState(state);
        
        const workspace = await prisma.workspace.findUnique({
          where: { id: decoded.workspaceId },
          select: { slug: true },
        });

        const brand = await prisma.brand.findUnique({
          where: { id: decoded.brandId },
          select: { slug: true },
        });

        if (workspace && brand) {
          const errorMessage = encodeURIComponent(
            error instanceof Error ? error.message : 'Pinterest OAuth callback failed'
          );
          errorRedirectUrl = `${pinterestConfig.frontendUrl}/${decoded.locale || 'tr'}/${workspace.slug}/${brand.slug}/social-accounts?error=pinterest_callback_failed&message=${errorMessage}`;
        } else if (workspace) {
          errorRedirectUrl = `${pinterestConfig.frontendUrl}/${decoded.locale || 'tr'}/${workspace.slug}/home?error=pinterest_callback_failed`;
        }
      } catch {
        // If state decode fails, use default error URL
      }

      return reply.redirect(302, errorRedirectUrl);
    }
  });
}
