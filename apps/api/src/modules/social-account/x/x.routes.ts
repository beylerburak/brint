/**
 * X OAuth Routes
 * 
 * Handles X OAuth authorization and callback endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildXAuthorizeUrl, handleXCallback } from './x-oauth.service.js';
import { requireWorkspaceRoleFor } from '../../../core/auth/workspace-guard.js';
import { xConfig } from '../../../config/x.config.js';
import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';

export async function registerXRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts/x/authorize
  // Get X OAuth authorize URL
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts/x/authorize', {
    preHandler: requireWorkspaceRoleFor('social-account:create'),
    schema: {
      tags: ['Social Account - X'],
      summary: 'Get X OAuth authorize URL',
      description: 'Returns the X OAuth authorization URL to redirect the user to. Requires ADMIN role.',
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
      const authorizeUrl = buildXAuthorizeUrl({
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
      request.log.error({ error, workspaceId, brandId }, 'Failed to generate X authorize URL');
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
  // GET /v1/social-accounts/oauth/x/callback
  // X OAuth callback handler
  // ============================================================================
  app.get('/v1/social-accounts/oauth/x/callback', {
    schema: {
      tags: ['Social Account - X'],
      summary: 'X OAuth callback',
      description: 'Handles X OAuth callback and redirects to frontend.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as {
      code?: string;
      state?: string;
    };

    if (!code || !state) {
      request.log.warn('X callback missing code or state');
      const errorUrl = `${xConfig.frontendUrl}/auth/error?source=x&error=missing_params`;
      return reply.redirect(302, errorUrl);
    }

    let decoded: { workspaceId: string; brandId: string; locale?: string } | null = null;
    
    try {
      // Decode state to get workspaceId (we need it for the service call)
      const { decodeXState } = await import('./x-state.js');
      decoded = decodeXState(state);
      const workspaceId = decoded.workspaceId;

      request.log.info({ workspaceId, brandId: decoded.brandId, locale: decoded.locale }, 'X callback - decoded state');

      // Handle callback
      const result = await handleXCallback(code, state, workspaceId);

      request.log.info({ 
        workspaceId: result.workspaceId, 
        brandId: result.brandId,
        locale: result.locale 
      }, 'X callback - handleXCallback completed successfully');

      // Fetch workspace and brand slugs for redirect URL
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
        // Fallback to workspace home
        const locale = result.locale || 'tr';
        const fallbackUrl = `${xConfig.frontendUrl}/${locale}/${workspace?.slug || 'unknown'}/home?error=x_not_found`;
        return reply.redirect(302, fallbackUrl);
      }

      // Redirect to frontend success page with slugs
      const locale = result.locale || 'tr';
      const successUrl = `${xConfig.frontendUrl}/${locale}/${workspace.slug}/${brand.slug}/social-accounts?connected=x`;
      
      request.log.info({ successUrl, workspaceSlug: workspace.slug, brandSlug: brand.slug, locale }, 'X callback - redirecting to frontend');
      
      return reply.redirect(302, successUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      request.log.error({ 
        error, 
        errorMessage,
        errorStack,
        code: !!code, 
        state: !!state,
        decoded: decoded ? { workspaceId: decoded.workspaceId, brandId: decoded.brandId } : null
      }, 'X callback error - attempting graceful redirect');
      
      // Try to redirect to workspace home even on error
      if (decoded) {
        try {
          const workspace = await prisma.workspace.findUnique({
            where: { id: decoded.workspaceId },
            select: { slug: true },
          });
          
          if (workspace) {
            const locale = decoded.locale || 'tr';
            const fallbackUrl = `${xConfig.frontendUrl}/${locale}/${workspace.slug}/home?error=x_callback_failed&message=${encodeURIComponent(errorMessage)}`;
            request.log.info({ fallbackUrl }, 'X callback - redirecting to workspace home on error');
            return reply.redirect(302, fallbackUrl);
          }
        } catch (fallbackError) {
          request.log.error({ fallbackError }, 'Failed to get workspace for error redirect');
        }
      }
      
      // Last resort: redirect to root with error
      const errorUrl = `${xConfig.frontendUrl}/tr?error=x_callback_failed&message=${encodeURIComponent(errorMessage)}`;
      return reply.redirect(302, errorUrl);
    }
  });
}
