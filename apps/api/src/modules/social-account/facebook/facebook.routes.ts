/**
 * Facebook/Instagram OAuth Routes
 * 
 * Handles Facebook OAuth authorization and callback endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildFacebookAuthorizeUrl, handleFacebookCallback } from './facebook-oauth.service.js';
import { requireWorkspaceRoleFor } from '../../../core/auth/workspace-guard.js';
import { getWorkspaceIdFromRequest } from '../../../core/auth/workspace-context.js';
import { facebookConfig } from '../../../config/facebook.config.js';

export async function registerFacebookRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts/facebook/authorize
  // Get Facebook OAuth authorize URL
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts/facebook/authorize', {
    preHandler: requireWorkspaceRoleFor('social-account:create'),
    schema: {
      tags: ['Social Account - Facebook'],
      summary: 'Get Facebook OAuth authorize URL',
      description: 'Returns the Facebook OAuth authorization URL to redirect the user to. Requires ADMIN role.',
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
      // Verify brand belongs to workspace
      const { prisma } = await import('../../../lib/prisma.js');
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          workspaceId,
        },
        select: { id: true },
      });

      if (!brand) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRAND_NOT_FOUND',
            message: 'Brand not found',
          },
        });
      }

      // Build authorize URL with locale
      const authorizeUrl = buildFacebookAuthorizeUrl({
        brandId,
        workspaceId,
        userId,
        locale: locale || 'tr',
      });

      return reply.status(200).send({
        success: true,
        authorizeUrl,
      });
    } catch (error) {
      request.log.error({ error, workspaceId, brandId }, 'Failed to generate Facebook authorize URL');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AUTHORIZE_URL_FAILED',
          message: 'Failed to generate authorization URL',
        },
      });
    }
  });

  // ============================================================================
  // GET /api/auth/facebook/callback
  // Facebook OAuth callback handler
  // ============================================================================
  app.get('/api/auth/facebook/callback', {
    schema: {
      tags: ['Social Account - Facebook'],
      summary: 'Facebook OAuth callback',
      description: 'Handles Facebook OAuth callback and redirects to frontend.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as {
      code?: string;
      state?: string;
    };

    if (!code || !state) {
      request.log.warn('Facebook callback missing code or state');
      const errorUrl = `${facebookConfig.frontendUrl}/auth/error?source=facebook&error=missing_params`;
      return reply.redirect(302, errorUrl);
    }

    try {
      // Decode state to get workspaceId (we need it for the service call)
      const { decodeFacebookState } = await import('./facebook-state.js');
      const decoded = decodeFacebookState(state);
      const workspaceId = decoded.workspaceId;

      // Handle callback
      const result = await handleFacebookCallback(code, state, workspaceId);

      // Fetch workspace and brand slugs for redirect URL
      const { prisma } = await import('../../../lib/prisma.js');
      const workspace = await prisma.workspace.findUnique({
        where: { id: result.workspaceId },
        select: { slug: true },
      });

      const brand = await prisma.brand.findUnique({
        where: { id: result.brandId },
        select: { slug: true },
      });

      if (!workspace || !brand) {
        request.log.error({ workspaceId: result.workspaceId, brandId: result.brandId }, 'Workspace or brand not found for redirect');
        const errorUrl = `${facebookConfig.frontendUrl}/auth/error?source=facebook&error=not_found`;
        return reply.redirect(302, errorUrl);
      }

      // Redirect to frontend success page with slugs
      // Format: /{locale}/{workspaceSlug}/{brandSlug}/social-accounts
      const locale = result.locale || 'tr';
      const successUrl = `${facebookConfig.frontendUrl}/${locale}/${workspace.slug}/${brand.slug}/social-accounts?connected=facebook`;
      return reply.redirect(302, successUrl);
    } catch (error) {
      request.log.error({ error, code: !!code, state: !!state }, 'Facebook callback error');
      
      // Redirect to frontend error page
      const errorUrl = `${facebookConfig.frontendUrl}/auth/error?source=facebook&error=callback_failed`;
      return reply.redirect(302, errorUrl);
    }
  });
}
