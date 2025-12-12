/**
 * TikTok OAuth Routes
 * 
 * Handles TikTok OAuth authorization and callback endpoints.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildTikTokAuthorizeUrl, handleTikTokCallback } from './tiktok-oauth.service.js';
import { requireWorkspaceRoleFor } from '../../../core/auth/workspace-guard.js';
import { tiktokConfig } from '../../../config/tiktok.config.js';
import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';

export async function registerTikTokRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // GET /workspaces/:workspaceId/brands/:brandId/social-accounts/tiktok/authorize
  // Get TikTok OAuth authorize URL
  // ============================================================================
  app.get('/workspaces/:workspaceId/brands/:brandId/social-accounts/tiktok/authorize', {
    preHandler: requireWorkspaceRoleFor('social-account:create'),
    schema: {
      tags: ['Social Account - TikTok'],
      summary: 'Get TikTok OAuth authorize URL',
      description: 'Returns the TikTok OAuth authorization URL to redirect the user to. Requires ADMIN role.',
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
      const authorizeUrl = buildTikTokAuthorizeUrl({
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
      request.log.error({ error, workspaceId, brandId }, 'Failed to generate TikTok authorize URL');
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
  // GET /api/social-accounts/tiktok/callback
  // TikTok OAuth callback handler
  // ============================================================================
  app.get('/api/social-accounts/tiktok/callback', {
    schema: {
      tags: ['Social Account - TikTok'],
      summary: 'TikTok OAuth callback',
      description: 'Handles TikTok OAuth callback and redirects to frontend.',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as {
      code?: string;
      state?: string;
    };

    if (!code || !state) {
      request.log.warn('TikTok callback missing code or state');
      const errorUrl = `${tiktokConfig.frontendUrl}/auth/error?source=tiktok&error=missing_params`;
      return reply.redirect(302, errorUrl);
    }

    let decoded: { workspaceId: string; brandId: string; locale?: string } | null = null;
    
    try {
      // Decode state to get workspaceId (we need it for the service call)
      const { decodeTikTokState } = await import('./tiktok-state.js');
      decoded = decodeTikTokState(state);
      const workspaceId = decoded.workspaceId;

      request.log.info({ workspaceId, brandId: decoded.brandId, locale: decoded.locale }, 'TikTok callback - decoded state');

      // Handle callback
      const result = await handleTikTokCallback(code, state, workspaceId);

      request.log.info({ 
        workspaceId: result.workspaceId, 
        brandId: result.brandId,
        locale: result.locale 
      }, 'TikTok callback - handleTikTokCallback completed successfully');

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
        // Fallback to workspace home if we can't construct social accounts URL
        const locale = result.locale || 'tr';
        const fallbackUrl = workspace 
          ? `${tiktokConfig.frontendUrl}/${locale}/${workspace.slug}/home?error=tiktok_not_found`
          : `${tiktokConfig.frontendUrl}/${locale}?error=tiktok_not_found`;
        return reply.redirect(302, fallbackUrl);
      }

      // Redirect to frontend success page with slugs
      const locale = result.locale || 'tr';
      const successUrl = `${tiktokConfig.frontendUrl}/${locale}/${workspace.slug}/${brand.slug}/social-accounts?connected=tiktok`;
      
      request.log.info({ successUrl, workspaceSlug: workspace.slug, brandSlug: brand.slug, locale }, 'TikTok callback - redirecting to frontend');
      
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
      }, 'TikTok callback error - attempting graceful redirect');
      
      // Try to redirect to social accounts page even on error
      if (decoded) {
        try {
          const workspace = await prisma.workspace.findUnique({
            where: { id: decoded.workspaceId },
            select: { slug: true },
          });
          
          const brand = await prisma.brand.findUnique({
            where: { id: decoded.brandId },
            select: { slug: true },
          });
          
          if (workspace && brand) {
            const locale = decoded.locale || 'tr';
            const fallbackUrl = `${tiktokConfig.frontendUrl}/${locale}/${workspace.slug}/${brand.slug}/social-accounts?error=tiktok_callback_failed&message=${encodeURIComponent(errorMessage)}`;
            request.log.info({ fallbackUrl }, 'TikTok callback - redirecting to social accounts page on error');
            return reply.redirect(302, fallbackUrl);
          } else if (workspace) {
            // If brand not found, fallback to workspace home
            const locale = decoded.locale || 'tr';
            const fallbackUrl = `${tiktokConfig.frontendUrl}/${locale}/${workspace.slug}/home?error=tiktok_callback_failed&message=${encodeURIComponent(errorMessage)}`;
            request.log.info({ fallbackUrl }, 'TikTok callback - redirecting to workspace home on error (brand not found)');
            return reply.redirect(302, fallbackUrl);
          }
        } catch (fallbackError) {
          request.log.error({ fallbackError }, 'Failed to get workspace/brand for error redirect');
        }
      }
      
      // Last resort: redirect to root with error
      const errorUrl = `${tiktokConfig.frontendUrl}/tr?error=tiktok_callback_failed&message=${encodeURIComponent(errorMessage)}`;
      return reply.redirect(302, errorUrl);
    }
  });
}
