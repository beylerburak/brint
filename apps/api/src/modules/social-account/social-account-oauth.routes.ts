/**
 * Social Account OAuth Routes
 * 
 * Handles OAuth flows for connecting social media accounts to brands.
 * - Facebook Pages
 * - Instagram Business Accounts (via Facebook)
 * - TikTok Business Accounts
 */

import { randomBytes } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../../lib/redis.js';
import { prisma } from '../../lib/prisma.js';
import { appUrlConfig } from '../../config/index.js';
import { requirePermission } from '../../core/auth/require-permission.js';
import { BadRequestError, NotFoundError, ConflictError, HttpError } from '../../lib/http-errors.js';
import { logger } from '../../lib/logger.js';
import { logActivity } from '../activity/activity.service.js';
import { encryptSocialCredentials } from './social-account.types.js';
import { recalculateBrandSocialAccountReadiness } from './social-account.service.js';
import {
  generateFacebookAuthUrl,
  exchangeFacebookCode,
  getLongLivedToken,
  getFacebookPages,
  getInstagramBusinessAccount,
  extractInstagramAccounts,
  isFacebookOAuthEnabled,
  type FacebookPage,
  type InstagramBusinessAccount,
} from './facebook-oauth.service.js';
import {
  generateTikTokAuthUrl,
  exchangeTikTokCode,
  getTikTokUserInfo,
  isTikTokOAuthEnabled,
  type TikTokUserInfo,
} from './tiktok-oauth.service.js';
import {
  generateLinkedInAuthUrl,
  exchangeLinkedInCode,
  getLinkedInUserInfo,
  getLinkedInOrganizationAcls,
  getLinkedInOrganizations,
  isLinkedInOAuthEnabled,
  extractMemberIdFromUrn,
  extractOrganizationIdFromUrn,
  type LinkedInUserInfo,
  type LinkedInOrganizationAcl,
  type LinkedInOrganization,
} from './linkedin-oauth.service.js';

/**
 * Get download URL from LinkedIn digital media asset URN
 * This is a helper function to convert URN to actual image URL
 */
async function getLinkedInDigitalMediaAssetUrl(
  accessToken: string,
  assetUrn: string
): Promise<string | null> {
  if (!assetUrn.startsWith('urn:li:digitalmediaAsset:')) {
    return null;
  }

  try {
    // Extract asset ID from URN
    const assetId = assetUrn.replace('urn:li:digitalmediaAsset:', '');
    const digitalMediaAssetsUrl = 'https://api.linkedin.com/v2/digitalMediaAssets';
    const assetUrl = `${digitalMediaAssetsUrl}/${assetId}?projection=(downloadUrl)`;
    
    logger.debug({ assetId, assetUrl }, 'Fetching LinkedIn digital media asset URL');

    const assetResponse = await fetch(assetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!assetResponse.ok) {
      const errorText = await assetResponse.text();
      logger.warn({ 
        status: assetResponse.status, 
        error: errorText,
        assetId 
      }, 'Failed to fetch LinkedIn digital media asset URL');
      return null;
    }

    const assetData = await assetResponse.json() as { downloadUrl?: string };
    if (assetData.downloadUrl) {
      logger.debug({ assetId, downloadUrl: assetData.downloadUrl }, 'LinkedIn digital media asset URL fetched');
      return assetData.downloadUrl;
    }
    
    return null;
  } catch (err) {
    logger.warn({ error: err, assetUrn }, 'Error fetching LinkedIn digital media asset URL');
    return null;
  }
}
import {
  generateXAuthUrl,
  exchangeXCode,
  getXUserInfo,
  isXOAuthEnabled,
  generatePKCE,
  type XUserInfo,
} from './x-oauth.service.js';
import {
  generatePinterestAuthUrl,
  exchangePinterestCode,
  getPinterestUserInfo,
  isPinterestOAuthEnabled,
  type PinterestUserInfo,
} from './pinterest-oauth.service.js';
import {
  generateYouTubeAuthUrl,
  exchangeYouTubeCode,
  getYouTubeChannels,
  isYouTubeOAuthEnabled,
  type YouTubeChannel,
} from './youtube-oauth.service.js';
import { saveAvatarFromUrl } from './social-account-avatar.service.js';

// ============================================================================
// Types
// ============================================================================

interface OAuthStateData {
  brandId: string;
  workspaceId: string;
  userId: string;
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'LINKEDIN' | 'X' | 'PINTEREST' | 'YOUTUBE';
  createdAt: number;
  codeVerifier?: string; // For PKCE (X/Twitter)
}

interface SelectableAccount {
  type: 'facebook_page' | 'instagram_business' | 'tiktok_business' | 'linkedin_page' | 'x_account' | 'pinterest_profile' | 'youtube_channel';
  id: string;
  name: string;
  username?: string;
  profilePictureUrl?: string;
  category?: string;
  // Facebook-specific
  pageAccessToken?: string;
  // Instagram-specific
  linkedPageId?: string;
  linkedPageName?: string;
}

// ============================================================================
// Routes
// ============================================================================

export async function registerSocialAccountOAuthRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // GET /social-accounts/oauth/facebook/authorize
  // Initiate Facebook OAuth flow
  // ============================================================================
  app.get('/social-accounts/oauth/facebook/authorize', {
    preHandler: [requirePermission('studio:social_account.connect')],
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Initiate Facebook OAuth flow',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string' },
          platform: { type: 'string', enum: ['FACEBOOK', 'INSTAGRAM'] },
        },
        required: ['brandId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            redirectUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId, platform = 'FACEBOOK' } = request.query as { brandId: string; platform?: string };
    const { userId, workspaceId } = request.auth!;

    if (!isFacebookOAuthEnabled()) {
      throw new BadRequestError('FACEBOOK_OAUTH_NOT_CONFIGURED', 'Facebook OAuth is not configured');
    }

    // Verify brand exists and belongs to workspace
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
    });

    if (!brand) {
      throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found');
    }

    // Generate state and store in Redis
    const state = randomBytes(32).toString('hex');
    const stateData: OAuthStateData = {
      brandId,
      workspaceId: workspaceId!,
      userId: userId!,
      platform: platform as 'FACEBOOK' | 'INSTAGRAM',
      createdAt: Date.now(),
    };

    await redis.set(
      `oauth:facebook:state:${state}`,
      JSON.stringify(stateData),
      'EX',
      600 // 10 minutes
    );

    const redirectUrl = generateFacebookAuthUrl({
      brandId,
      workspaceId: workspaceId!,
      state,
    });

    return reply.send({
      success: true,
      redirectUrl,
    });
  });

  // ============================================================================
  // GET /social-accounts/oauth/facebook/callback
  // Handle Facebook OAuth callback
  // ============================================================================
  app.get('/social-accounts/oauth/facebook/callback', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Handle Facebook OAuth callback',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // Handle OAuth error
    if (error) {
      logger.warn({ error, error_description }, 'Facebook OAuth error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'OAuth failed')}`;
      return reply.redirect(errorUrl);
    }

    if (!code || !state) {
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=missing_params&message=${encodeURIComponent('Missing code or state parameter')}`;
      return reply.redirect(errorUrl);
    }

    try {
      // Validate state
      const stateKey = `oauth:facebook:state:${state}`;
      const stateDataStr = await redis.get(stateKey);

      if (!stateDataStr) {
        const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=invalid_state&message=${encodeURIComponent('Invalid or expired state')}`;
        return reply.redirect(errorUrl);
      }

      const stateData: OAuthStateData = JSON.parse(stateDataStr);
      await redis.del(stateKey);

      // Exchange code for token
      const tokenResponse = await exchangeFacebookCode(code);

      // Get long-lived token
      const longLivedToken = await getLongLivedToken(tokenResponse.access_token);

      // Get Facebook Pages (and linked Instagram accounts)
      const pages = await getFacebookPages(longLivedToken.access_token);
      const instagramAccounts = extractInstagramAccounts(pages);

      // Store accounts temporarily in Redis for selection
      const selectionKey = `oauth:facebook:selection:${state}`;
      const selectionData = {
        stateData,
        userAccessToken: longLivedToken.access_token,
        pages,
        instagramAccounts,
      };

      await redis.set(selectionKey, JSON.stringify(selectionData), 'EX', 600);

      // Redirect to frontend selection page
      const selectUrl = `${appUrlConfig.frontendUrl}/oauth/select?session=${state}&platform=${stateData.platform}`;
      return reply.redirect(selectUrl);
    } catch (err) {
      logger.error({ error: err }, 'Facebook OAuth callback error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=callback_failed&message=${encodeURIComponent('Failed to complete OAuth flow')}`;
      return reply.redirect(errorUrl);
    }
  });

  // ============================================================================
  // GET /social-accounts/oauth/tiktok/authorize
  // Initiate TikTok OAuth flow
  // ============================================================================
  app.get('/social-accounts/oauth/tiktok/authorize', {
    preHandler: [requirePermission('studio:social_account.connect')],
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Initiate TikTok OAuth flow',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string' },
        },
        required: ['brandId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            redirectUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = request.query as { brandId: string };
    const { userId, workspaceId } = request.auth!;

    if (!workspaceId) {
      throw new BadRequestError('WORKSPACE_ID_REQUIRED', 'Workspace ID is required');
    }

    if (!isTikTokOAuthEnabled()) {
      throw new BadRequestError('TIKTOK_OAUTH_NOT_CONFIGURED', 'TikTok OAuth is not configured');
    }

    // Verify brand exists and belongs to workspace
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
    });

    if (!brand) {
      throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found');
    }

    // Generate state token
    const state = randomBytes(32).toString('hex');
    const stateData: OAuthStateData = {
      brandId,
      workspaceId,
      userId,
      platform: 'TIKTOK',
      createdAt: Date.now(),
    };

    // Store state in Redis (10 minute expiry)
    await redis.set(`oauth:tiktok:state:${state}`, JSON.stringify(stateData), 'EX', 600);

    // Generate auth URL
    const authUrl = generateTikTokAuthUrl(state);

    return reply.send({
      success: true,
      redirectUrl: authUrl,
    });
  });

  // ============================================================================
  // GET /social-accounts/oauth/tiktok/callback
  // Handle TikTok OAuth callback
  // ============================================================================
  app.get('/social-accounts/oauth/tiktok/callback', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Handle TikTok OAuth callback',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // Handle OAuth error
    if (error) {
      logger.warn({ error, error_description }, 'TikTok OAuth error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'OAuth failed')}`;
      return reply.redirect(errorUrl);
    }

    if (!code || !state) {
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=missing_params&message=${encodeURIComponent('Missing code or state parameter')}`;
      return reply.redirect(errorUrl);
    }

    try {
      // Validate state
      const stateKey = `oauth:tiktok:state:${state}`;
      const stateDataStr = await redis.get(stateKey);

      if (!stateDataStr) {
        const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=invalid_state&message=${encodeURIComponent('Invalid or expired state')}`;
        return reply.redirect(errorUrl);
      }

      const stateData: OAuthStateData = JSON.parse(stateDataStr);
      await redis.del(stateKey);

      // Exchange code for token
      const tokenResponse = await exchangeTikTokCode(code);

      // Get user info
      const userInfo = await getTikTokUserInfo(tokenResponse.access_token);

      // Store TikTok account data temporarily in Redis for selection/confirmation
      const selectionKey = `oauth:tiktok:selection:${state}`;
      const selectionData = {
        stateData,
        tokenResponse,
        userInfo,
      };

      await redis.set(selectionKey, JSON.stringify(selectionData), 'EX', 600);

      // Redirect to frontend selection page
      const selectUrl = `${appUrlConfig.frontendUrl}/oauth/select?session=${state}&platform=TIKTOK`;
      return reply.redirect(selectUrl);
    } catch (err) {
      logger.error({ error: err }, 'TikTok OAuth callback error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=callback_failed&message=${encodeURIComponent('Failed to complete OAuth flow')}`;
      return reply.redirect(errorUrl);
    }
  });

  // ============================================================================
  // GET /social-accounts/oauth/linkedin/authorize
  // Initiate LinkedIn OAuth flow
  // ============================================================================
  app.get('/social-accounts/oauth/linkedin/authorize', {
    preHandler: [requirePermission('studio:social_account.connect')],
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Initiate LinkedIn OAuth flow',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string' },
        },
        required: ['brandId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            redirectUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = request.query as { brandId: string };
    const { userId, workspaceId } = request.auth!;

    if (!workspaceId) {
      throw new BadRequestError('WORKSPACE_ID_REQUIRED', 'Workspace ID is required');
    }

    if (!isLinkedInOAuthEnabled()) {
      throw new BadRequestError('LINKEDIN_OAUTH_NOT_CONFIGURED', 'LinkedIn OAuth is not configured');
    }

    // Verify brand exists and belongs to workspace
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
    });

    if (!brand) {
      throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found');
    }

    // Generate state token
    const state = randomBytes(32).toString('hex');
    const stateData: OAuthStateData = {
      brandId,
      workspaceId,
      userId,
      platform: 'LINKEDIN',
      createdAt: Date.now(),
    };

    // Store state in Redis (10 minute expiry)
    await redis.set(`oauth:linkedin:state:${state}`, JSON.stringify(stateData), 'EX', 600);

    // Generate auth URL
    const authUrl = generateLinkedInAuthUrl(state);

    return reply.send({
      success: true,
      redirectUrl: authUrl,
    });
  });

  // ============================================================================
  // GET /social-accounts/oauth/linkedin/callback
  // Handle LinkedIn OAuth callback
  // ============================================================================
  app.get('/social-accounts/oauth/linkedin/callback', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Handle LinkedIn OAuth callback',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // Handle OAuth error
    if (error) {
      logger.warn({ error, error_description }, 'LinkedIn OAuth error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'OAuth failed')}`;
      return reply.redirect(errorUrl);
    }

    if (!code || !state) {
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=missing_params&message=${encodeURIComponent('Missing code or state parameter')}`;
      return reply.redirect(errorUrl);
    }

    try {
      // Validate state
      const stateKey = `oauth:linkedin:state:${state}`;
      const stateDataStr = await redis.get(stateKey);

      if (!stateDataStr) {
        const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=invalid_state&message=${encodeURIComponent('Invalid or expired state')}`;
        return reply.redirect(errorUrl);
      }

      const stateData: OAuthStateData = JSON.parse(stateDataStr);
      await redis.del(stateKey);

      // Exchange code for token
      const tokenResponse = await exchangeLinkedInCode(code);

      // Log token scopes to verify w_organization_social is included
      logger.info({ 
        scopes: tokenResponse.scope,
        hasOrganizationScope: tokenResponse.scope?.includes('w_organization_social') || false
      }, 'LinkedIn OAuth token received');

      // Get user info (personal profile)
      const userInfo = await getLinkedInUserInfo(tokenResponse.access_token);

      // Get organization ACLs and organizations
      let organizationAcls: LinkedInOrganizationAcl[] = [];
      let organizations: LinkedInOrganization[] = [];
      
      try {
        logger.debug('Fetching LinkedIn organization ACLs...');
        organizationAcls = await getLinkedInOrganizationAcls(tokenResponse.access_token);
        logger.info({ aclCount: organizationAcls.length }, 'LinkedIn organization ACLs fetched');
        
        if (organizationAcls.length > 0) {
          // Extract organization URNs from ACLs
          const organizationUrns = organizationAcls.map(acl => acl.organization);
          logger.debug({ orgUrns: organizationUrns }, 'Fetching LinkedIn organization details...');
          
          // Fetch organization details
          organizations = await getLinkedInOrganizations(tokenResponse.access_token, organizationUrns);
          logger.info({ orgCount: organizations.length }, 'LinkedIn organizations fetched');
        } else {
          logger.warn('No LinkedIn organization ACLs found - user may not have organization access or no organizations available');
        }
      } catch (err: any) {
        // Log detailed error but don't fail the OAuth flow - user might not have organization access
        logger.error({ 
          error: err,
          message: err?.message,
          status: err?.status,
          scopes: tokenResponse.scope
        }, 'Failed to fetch LinkedIn organizations, continuing with personal profile only');
      }

      // Store LinkedIn account data temporarily in Redis for selection/confirmation
      const selectionKey = `oauth:linkedin:selection:${state}`;
      const selectionData = {
        stateData,
        tokenResponse,
        userInfo,
        organizationAcls,
        organizations,
      };

      await redis.set(selectionKey, JSON.stringify(selectionData), 'EX', 600);

      // Redirect to frontend selection page
      const selectUrl = `${appUrlConfig.frontendUrl}/oauth/select?session=${state}&platform=LINKEDIN`;
      return reply.redirect(selectUrl);
    } catch (err) {
      logger.error({ error: err }, 'LinkedIn OAuth callback error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=callback_failed&message=${encodeURIComponent('Failed to complete OAuth flow')}`;
      return reply.redirect(errorUrl);
    }
  });

  // ============================================================================
  // GET /social-accounts/oauth/x/authorize
  // Initiate X (Twitter) OAuth flow with PKCE
  // ============================================================================
  app.get('/social-accounts/oauth/x/authorize', {
    preHandler: [requirePermission('studio:social_account.connect')],
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Initiate X OAuth flow',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string' },
        },
        required: ['brandId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            redirectUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = request.query as { brandId: string };
    const { userId, workspaceId } = request.auth!;

    if (!workspaceId) {
      throw new BadRequestError('WORKSPACE_ID_REQUIRED', 'Workspace ID is required');
    }

    if (!isXOAuthEnabled()) {
      throw new BadRequestError('X_OAUTH_NOT_CONFIGURED', 'X OAuth is not configured');
    }

    // Verify brand exists and belongs to workspace
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
    });

    if (!brand) {
      throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found');
    }

    // Generate PKCE challenge
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Generate state token
    const state = randomBytes(32).toString('hex');
    const stateData: OAuthStateData = {
      brandId,
      workspaceId,
      userId,
      platform: 'X',
      createdAt: Date.now(),
      codeVerifier, // Store for token exchange
    };

    // Store state in Redis (10 minute expiry)
    await redis.set(`oauth:x:state:${state}`, JSON.stringify(stateData), 'EX', 600);

    // Generate auth URL
    const authUrl = generateXAuthUrl(state, codeChallenge);

    return reply.send({
      success: true,
      redirectUrl: authUrl,
    });
  });

  // ============================================================================
  // GET /social-accounts/oauth/x/callback
  // Handle X OAuth callback
  // ============================================================================
  app.get('/social-accounts/oauth/x/callback', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Handle X OAuth callback',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // Handle OAuth error
    if (error) {
      logger.warn({ error, error_description }, 'X OAuth error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'OAuth failed')}`;
      return reply.redirect(errorUrl);
    }

    if (!code || !state) {
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=missing_params&message=${encodeURIComponent('Missing code or state parameter')}`;
      return reply.redirect(errorUrl);
    }

    try {
      // Validate state
      const stateKey = `oauth:x:state:${state}`;
      const stateDataStr = await redis.get(stateKey);

      if (!stateDataStr) {
        const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=invalid_state&message=${encodeURIComponent('Invalid or expired state')}`;
        return reply.redirect(errorUrl);
      }

      const stateData: OAuthStateData = JSON.parse(stateDataStr);
      await redis.del(stateKey);

      if (!stateData.codeVerifier) {
        throw new Error('Missing PKCE code verifier');
      }

      // Exchange code for token with PKCE
      const tokenResponse = await exchangeXCode(code, stateData.codeVerifier);

      // Get user info
      const userInfo = await getXUserInfo(tokenResponse.access_token);

      // Store X account data temporarily in Redis for selection/confirmation
      const selectionKey = `oauth:x:selection:${state}`;
      const selectionData = {
        stateData: { ...stateData, codeVerifier: undefined }, // Don't store code verifier in selection
        tokenResponse,
        userInfo,
      };

      await redis.set(selectionKey, JSON.stringify(selectionData), 'EX', 600);

      // Redirect to frontend selection page
      const selectUrl = `${appUrlConfig.frontendUrl}/oauth/select?session=${state}&platform=X`;
      return reply.redirect(selectUrl);
    } catch (err) {
      logger.error({ error: err }, 'X OAuth callback error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=callback_failed&message=${encodeURIComponent('Failed to complete OAuth flow')}`;
      return reply.redirect(errorUrl);
    }
  });

  // ============================================================================
  // GET /social-accounts/oauth/pinterest/authorize
  // Initiate Pinterest OAuth flow
  // ============================================================================
  app.get('/social-accounts/oauth/pinterest/authorize', {
    preHandler: [requirePermission('studio:social_account.connect')],
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Initiate Pinterest OAuth flow',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string' },
        },
        required: ['brandId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            redirectUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = request.query as { brandId: string };
    const { userId, workspaceId } = request.auth!;

    if (!workspaceId) {
      throw new BadRequestError('WORKSPACE_ID_REQUIRED', 'Workspace ID is required');
    }

    if (!isPinterestOAuthEnabled()) {
      throw new BadRequestError('PINTEREST_OAUTH_NOT_CONFIGURED', 'Pinterest OAuth is not configured');
    }

    // Verify brand exists and belongs to workspace
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
    });

    if (!brand) {
      throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found');
    }

    // Generate state token
    const state = randomBytes(32).toString('hex');
    const stateData: OAuthStateData = {
      brandId,
      workspaceId,
      userId,
      platform: 'PINTEREST',
      createdAt: Date.now(),
    };

    // Store state in Redis (10 minute expiry)
    await redis.set(`oauth:pinterest:state:${state}`, JSON.stringify(stateData), 'EX', 600);

    // Generate auth URL
    const authUrl = generatePinterestAuthUrl(state);

    return reply.send({
      success: true,
      redirectUrl: authUrl,
    });
  });

  // ============================================================================
  // GET /social-accounts/oauth/pinterest/callback
  // Handle Pinterest OAuth callback
  // ============================================================================
  app.get('/social-accounts/oauth/pinterest/callback', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Handle Pinterest OAuth callback',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // Handle OAuth error
    if (error) {
      logger.warn({ error, error_description }, 'Pinterest OAuth error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'OAuth failed')}`;
      return reply.redirect(errorUrl);
    }

    if (!code || !state) {
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=missing_params&message=${encodeURIComponent('Missing code or state parameter')}`;
      return reply.redirect(errorUrl);
    }

    try {
      // Validate state
      const stateKey = `oauth:pinterest:state:${state}`;
      const stateDataStr = await redis.get(stateKey);

      if (!stateDataStr) {
        const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=invalid_state&message=${encodeURIComponent('Invalid or expired state')}`;
        return reply.redirect(errorUrl);
      }

      const stateData: OAuthStateData = JSON.parse(stateDataStr);
      await redis.del(stateKey);

      // Exchange code for token
      const tokenResponse = await exchangePinterestCode(code);

      // Get user info
      const userInfo = await getPinterestUserInfo(tokenResponse.access_token);

      // Store Pinterest account data temporarily in Redis for selection/confirmation
      const selectionKey = `oauth:pinterest:selection:${state}`;
      const selectionData = {
        stateData,
        tokenResponse,
        userInfo,
      };

      await redis.set(selectionKey, JSON.stringify(selectionData), 'EX', 600);

      // Redirect to frontend selection page
      const selectUrl = `${appUrlConfig.frontendUrl}/oauth/select?session=${state}&platform=PINTEREST`;
      return reply.redirect(selectUrl);
    } catch (err) {
      logger.error({ error: err }, 'Pinterest OAuth callback error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=callback_failed&message=${encodeURIComponent('Failed to complete OAuth flow')}`;
      return reply.redirect(errorUrl);
    }
  });

  // ============================================================================
  // GET /social-accounts/oauth/youtube/authorize
  // Initiate YouTube OAuth flow
  // ============================================================================
  app.get('/social-accounts/oauth/youtube/authorize', {
    preHandler: [requirePermission('studio:social_account.connect')],
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Initiate YouTube OAuth flow',
      querystring: {
        type: 'object',
        properties: {
          brandId: { type: 'string' },
        },
        required: ['brandId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            redirectUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId } = request.query as { brandId: string };
    const { userId, workspaceId } = request.auth!;

    if (!workspaceId) {
      throw new BadRequestError('WORKSPACE_ID_REQUIRED', 'Workspace ID is required');
    }

    if (!isYouTubeOAuthEnabled()) {
      throw new BadRequestError('YOUTUBE_OAUTH_NOT_CONFIGURED', 'YouTube OAuth is not configured');
    }

    // Verify brand exists and belongs to workspace
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
    });

    if (!brand) {
      throw new NotFoundError('BRAND_NOT_FOUND', 'Brand not found');
    }

    // Generate state token
    const state = randomBytes(32).toString('hex');
    const stateData: OAuthStateData = {
      brandId,
      workspaceId,
      userId,
      platform: 'YOUTUBE',
      createdAt: Date.now(),
    };

    // Store state in Redis (10 minute expiry)
    await redis.set(`oauth:youtube:state:${state}`, JSON.stringify(stateData), 'EX', 600);

    // Generate auth URL
    const authUrl = generateYouTubeAuthUrl(state);

    return reply.send({
      success: true,
      redirectUrl: authUrl,
    });
  });

  // ============================================================================
  // GET /social-accounts/oauth/youtube/callback
  // Handle YouTube OAuth callback
  // ============================================================================
  app.get('/social-accounts/oauth/youtube/callback', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Handle YouTube OAuth callback',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // Handle OAuth error
    if (error) {
      logger.warn({ error, error_description }, 'YouTube OAuth error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'OAuth failed')}`;
      return reply.redirect(errorUrl);
    }

    if (!code || !state) {
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=missing_params&message=${encodeURIComponent('Missing code or state parameter')}`;
      return reply.redirect(errorUrl);
    }

    try {
      // Validate state
      const stateKey = `oauth:youtube:state:${state}`;
      const stateDataStr = await redis.get(stateKey);

      if (!stateDataStr) {
        const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=invalid_state&message=${encodeURIComponent('Invalid or expired state')}`;
        return reply.redirect(errorUrl);
      }

      const stateData: OAuthStateData = JSON.parse(stateDataStr);
      await redis.del(stateKey);

      // Exchange code for token
      const tokenResponse = await exchangeYouTubeCode(code);

      // Get user's YouTube channels
      const channels = await getYouTubeChannels(tokenResponse.access_token);

      // Store YouTube account data temporarily in Redis for selection/confirmation
      const selectionKey = `oauth:youtube:selection:${state}`;
      const selectionData = {
        stateData,
        tokenResponse,
        channels,
      };

      await redis.set(selectionKey, JSON.stringify(selectionData), 'EX', 600);

      // Redirect to frontend selection page
      const selectUrl = `${appUrlConfig.frontendUrl}/oauth/select?session=${state}&platform=YOUTUBE`;
      return reply.redirect(selectUrl);
    } catch (err) {
      logger.error({ error: err }, 'YouTube OAuth callback error');
      const errorUrl = `${appUrlConfig.frontendUrl}/oauth/error?error=callback_failed&message=${encodeURIComponent('Failed to complete OAuth flow')}`;
      return reply.redirect(errorUrl);
    }
  });

  // ============================================================================
  // GET /social-accounts/oauth/accounts
  // Get available accounts from OAuth session
  // Note: No auth required - session token in Redis acts as authentication
  // The session was created by an authenticated user and contains their userId/workspaceId
  // ============================================================================
  app.get('/social-accounts/oauth/accounts', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Get available accounts from OAuth session',
      querystring: {
        type: 'object',
        properties: {
          session: { type: 'string' },
        },
        required: ['session'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                brandId: { type: 'string' },
                platform: { type: 'string' },
                accounts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      id: { type: 'string' },
                      name: { type: 'string' },
                      username: { type: 'string' },
                      profilePictureUrl: { type: 'string' },
                      category: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { session } = request.query as { session: string };

    // Try Facebook/Instagram session first
    let selectionKey = `oauth:facebook:selection:${session}`;
    let selectionDataStr = await redis.get(selectionKey);

    // If not found, try TikTok session
    if (!selectionDataStr) {
      selectionKey = `oauth:tiktok:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
    }

    // If not found, try LinkedIn session
    if (!selectionDataStr) {
      selectionKey = `oauth:linkedin:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
    }

    // If not found, try X session
    if (!selectionDataStr) {
      selectionKey = `oauth:x:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
    }

    // If not found, try Pinterest session
    if (!selectionDataStr) {
      selectionKey = `oauth:pinterest:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
    }

    // If not found, try YouTube session
    if (!selectionDataStr) {
      selectionKey = `oauth:youtube:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
    }

    if (!selectionDataStr) {
      throw new BadRequestError('SESSION_EXPIRED', 'OAuth session expired. Please try again.');
    }

    const selectionData = JSON.parse(selectionDataStr);

    // Session is valid - the stateData contains the original authenticated user's info
    // No need to re-verify as the session token itself acts as authentication

    // Build selectable accounts list
    const accounts: SelectableAccount[] = [];
    const stateData = selectionData.stateData as OAuthStateData;

    // Add Facebook Pages
    if (stateData.platform === 'FACEBOOK') {
      const fbData = selectionData as {
        stateData: OAuthStateData;
        userAccessToken: string;
        pages: FacebookPage[];
        instagramAccounts: InstagramBusinessAccount[];
      };
      for (const page of fbData.pages) {
        accounts.push({
          type: 'facebook_page',
          id: page.id,
          name: page.name,
          profilePictureUrl: page.picture?.data?.url,
          category: page.category,
        });
      }
    }

    // Add Instagram Business Accounts
    if (stateData.platform === 'INSTAGRAM') {
      const fbData = selectionData as {
        stateData: OAuthStateData;
        userAccessToken: string;
        pages: FacebookPage[];
        instagramAccounts: InstagramBusinessAccount[];
      };
      for (const ig of fbData.instagramAccounts) {
        accounts.push({
          type: 'instagram_business',
          id: ig.id,
          name: ig.name || ig.username,
          username: ig.username,
          profilePictureUrl: ig.profile_picture_url,
          linkedPageId: ig.pageId,
          linkedPageName: ig.pageName,
        });
      }
    }

    // Add TikTok Business Account
    if (stateData.platform === 'TIKTOK') {
      const tiktokData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; refresh_token: string; open_id: string; expires_in: number };
        userInfo: TikTokUserInfo;
      };
      accounts.push({
        type: 'tiktok_business',
        id: tiktokData.userInfo.open_id,
        name: tiktokData.userInfo.display_name || 'TikTok User',
        username: tiktokData.userInfo.display_name,
        profilePictureUrl: tiktokData.userInfo.avatar_large_url || tiktokData.userInfo.avatar_url,
      });
    }

    // Add LinkedIn Pages (personal profile and organizations)
    if (stateData.platform === 'LINKEDIN') {
      const linkedinData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        userInfo: LinkedInUserInfo;
        organizationAcls?: LinkedInOrganizationAcl[];
        organizations?: LinkedInOrganization[];
      };
      
      // Add personal profile
      const memberId = extractMemberIdFromUrn(linkedinData.userInfo.sub);
      accounts.push({
        type: 'linkedin_page',
        id: memberId,
        name: linkedinData.userInfo.name || `${linkedinData.userInfo.given_name || ''} ${linkedinData.userInfo.family_name || ''}`.trim() || 'LinkedIn User',
        username: linkedinData.userInfo.email,
        profilePictureUrl: linkedinData.userInfo.picture,
      });

      // Add organization pages
      if (linkedinData.organizations && linkedinData.organizations.length > 0) {
        // Get access token for digital media asset API calls
        const accessToken = linkedinData.tokenResponse.access_token;
        
        for (const org of linkedinData.organizations) {
          const orgId = org.id.toString();
          // Get logo URL if available
          // Try multiple formats for logo URL
          let logoUrl: string | undefined;
          
          // Try cropped logo first (most common)
          if (org.logoV2?.['cropped~']?.elements?.[0]?.identifiers?.[0]?.identifier) {
            logoUrl = org.logoV2['cropped~'].elements[0].identifiers[0].identifier;
          }
          // Try original playableStreams
          else if (org.logoV2?.['original~']?.playableStreams?.[0]?.playableStream?.[0]?.downloadUrl) {
            logoUrl = org.logoV2['original~'].playableStreams[0].playableStream[0].downloadUrl;
          }
          // Try direct original field
          else if (org.logoV2?.original) {
            logoUrl = org.logoV2.original;
          }
          
          // If logoUrl is a URN, convert it to actual URL
          if (logoUrl && logoUrl.startsWith('urn:li:digitalmediaAsset:')) {
            logger.debug({ orgId, logoUrn: logoUrl }, 'Converting LinkedIn logo URN to URL');
            const actualUrl = await getLinkedInDigitalMediaAssetUrl(accessToken, logoUrl);
            if (actualUrl) {
              logoUrl = actualUrl;
              logger.debug({ orgId, logoUrl }, 'LinkedIn logo URN converted to URL');
            } else {
              logger.warn({ orgId, logoUrn: logoUrl }, 'Failed to convert LinkedIn logo URN to URL');
            }
          }
          
          logger.debug({ orgId, logoUrl, logoV2: org.logoV2 }, 'LinkedIn organization logo extraction');
          
          // Get organization name (prefer localized name)
          const orgName = org.name?.localized?.[`${org.name.preferredLocale.language}_${org.name.preferredLocale.country}`] 
            || org.name?.localized?.[Object.keys(org.name.localized)[0]]
            || `Organization ${orgId}`;

          accounts.push({
            type: 'linkedin_page',
            id: orgId,
            name: orgName,
            username: org.vanityName || orgId,
            profilePictureUrl: logoUrl,
            category: 'Organization',
          });
        }
      }
    }

    // Add X Account
    if (stateData.platform === 'X') {
      const xData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        userInfo: XUserInfo;
      };
      // Get higher resolution profile image (replace _normal with _400x400)
      const profileImageUrl = xData.userInfo.data.profile_image_url?.replace('_normal', '_400x400');
      accounts.push({
        type: 'x_account',
        id: xData.userInfo.data.id,
        name: xData.userInfo.data.name,
        username: xData.userInfo.data.username,
        profilePictureUrl: profileImageUrl,
      });
    }

    // Add Pinterest Profile
    if (stateData.platform === 'PINTEREST') {
      const pinterestData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        userInfo: PinterestUserInfo;
      };
      accounts.push({
        type: 'pinterest_profile',
        id: pinterestData.userInfo.username,
        name: pinterestData.userInfo.business_name || pinterestData.userInfo.username,
        username: pinterestData.userInfo.username,
        profilePictureUrl: pinterestData.userInfo.profile_image,
      });
    }

    // Add YouTube Channels
    if (stateData.platform === 'YOUTUBE') {
      const youtubeData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        channels: YouTubeChannel[];
      };
      for (const channel of youtubeData.channels) {
        const thumbnailUrl = channel.snippet.thumbnails.high?.url 
          || channel.snippet.thumbnails.medium?.url 
          || channel.snippet.thumbnails.default?.url;
        accounts.push({
          type: 'youtube_channel',
          id: channel.id,
          name: channel.snippet.title,
          username: channel.snippet.customUrl?.replace('@', ''),
          profilePictureUrl: thumbnailUrl,
        });
      }
    }

    return reply.send({
      success: true,
      data: {
        brandId: stateData.brandId,
        platform: stateData.platform,
        accounts,
      },
    });
  });

  // ============================================================================
  // POST /social-accounts/oauth/connect
  // Connect selected account to brand
  // Note: No auth required - session token in Redis contains the original user's credentials
  // ============================================================================
  app.post('/social-accounts/oauth/connect', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Connect selected social account to brand',
      body: {
        type: 'object',
        properties: {
          session: { type: 'string' },
          accountId: { type: 'string' },
          accountType: { type: 'string', enum: ['facebook_page', 'instagram_business', 'tiktok_business', 'linkedin_page', 'x_account', 'pinterest_profile', 'youtube_channel'] },
        },
        required: ['session', 'accountId', 'accountType'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                platform: { type: 'string' },
                externalId: { type: 'string' },
                displayName: { type: 'string' },
                username: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { session, accountId, accountType } = request.body as {
      session: string;
      accountId: string;
      accountType: 'facebook_page' | 'instagram_business' | 'tiktok_business' | 'linkedin_page' | 'x_account' | 'pinterest_profile' | 'youtube_channel';
    };

    // Try Facebook/Instagram session first
    let selectionKey = `oauth:facebook:selection:${session}`;
    let selectionDataStr = await redis.get(selectionKey);
    let isTikTokSession = false;
    let isLinkedInSession = false;

    // If not found, try TikTok session
    if (!selectionDataStr) {
      selectionKey = `oauth:tiktok:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
      isTikTokSession = true;
    }

    // If not found, try LinkedIn session
    if (!selectionDataStr) {
      selectionKey = `oauth:linkedin:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
      isLinkedInSession = true;
      isTikTokSession = false;
    }

    // If not found, try X session
    let isXSession = false;
    if (!selectionDataStr) {
      selectionKey = `oauth:x:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
      isXSession = true;
      isLinkedInSession = false;
    }

    // If not found, try Pinterest session
    let isPinterestSession = false;
    if (!selectionDataStr) {
      selectionKey = `oauth:pinterest:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
      isPinterestSession = true;
      isXSession = false;
    }

    // If not found, try YouTube session
    let isYouTubeSession = false;
    if (!selectionDataStr) {
      selectionKey = `oauth:youtube:selection:${session}`;
      selectionDataStr = await redis.get(selectionKey);
      isYouTubeSession = true;
      isPinterestSession = false;
    }

    if (!selectionDataStr) {
      throw new BadRequestError('SESSION_EXPIRED', 'OAuth session expired. Please try again.');
    }

    const selectionData = JSON.parse(selectionDataStr);

    // Extract user info from session state (already authenticated when OAuth was initiated)
    const { brandId, workspaceId, userId } = selectionData.stateData as OAuthStateData;

    let socialAccount;

    if (accountType === 'facebook_page') {
      // Cast to Facebook selection data
      const fbData = selectionData as {
        stateData: OAuthStateData;
        userAccessToken: string;
        pages: FacebookPage[];
        instagramAccounts: InstagramBusinessAccount[];
      };
      // Find the selected page
      const page = fbData.pages.find((p) => p.id === accountId);
      if (!page) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected Facebook page not found');
      }

      // Check if already exists (any status including REMOVED - unique constraint is on workspaceId+platform+externalId)
      const existing = await prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          platform: 'FACEBOOK_PAGE',
          externalId: page.id,
        },
      });

      // Encrypt credentials
      const credentialsEncrypted = encryptSocialCredentials({
        platform: 'FACEBOOK_PAGE',
        data: {
          accessToken: page.access_token, // Page access token (long-lived)
          pageId: page.id,
        },
      });

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ConflictError('ACCOUNT_ALREADY_CONNECTED', 'This Facebook page is already connected');
        }

        // Reactivate disconnected/removed account with new credentials
        socialAccount = await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            brandId, // Update brand in case it changed
            displayName: page.name,
            profileUrl: `https://facebook.com/${page.id}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              category: page.category,
              pictureUrl: page.picture?.data?.url,
            },
          },
        });
      } else {
        // Create new social account
        socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: workspaceId!,
            brandId,
            platform: 'FACEBOOK_PAGE',
            externalId: page.id,
            displayName: page.name,
            username: null,
            profileUrl: `https://facebook.com/${page.id}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              category: page.category,
              pictureUrl: page.picture?.data?.url,
            },
          },
        });
      }

      // Save avatar from Facebook (fire-and-forget, don't block response)
      if (page.picture?.data?.url) {
        void saveAvatarFromUrl({
          imageUrl: page.picture.data.url,
          workspaceId: workspaceId!,
          brandId,
          socialAccountId: socialAccount.id,
          platform: 'FACEBOOK_PAGE',
          accountName: page.name,
        });
      }

    } else if (accountType === 'instagram_business') {
      // Cast to Facebook selection data (Instagram uses Facebook OAuth)
      const fbData = selectionData as {
        stateData: OAuthStateData;
        userAccessToken: string;
        pages: FacebookPage[];
        instagramAccounts: InstagramBusinessAccount[];
      };
      // Find the selected Instagram account
      const igAccount = fbData.instagramAccounts.find((ig) => ig.id === accountId);
      if (!igAccount) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected Instagram account not found');
      }

      // Get more details about the Instagram account
      const igDetails = await getInstagramBusinessAccount(igAccount.id, igAccount.pageAccessToken);

      // Check if already exists (any status including REMOVED - unique constraint is on workspaceId+platform+externalId)
      const existing = await prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          platform: 'INSTAGRAM_BUSINESS',
          externalId: igAccount.id,
        },
      });

      // Encrypt credentials (Instagram uses parent Facebook Page's token)
      const credentialsEncrypted = encryptSocialCredentials({
        platform: 'INSTAGRAM_BUSINESS',
        data: {
          accessToken: igAccount.pageAccessToken, // Page access token (long-lived)
          igBusinessAccountId: igAccount.id,
        },
      });

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ConflictError('ACCOUNT_ALREADY_CONNECTED', 'This Instagram account is already connected');
        }

        // Reactivate disconnected/removed account with new credentials
        socialAccount = await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            brandId, // Update brand in case it changed
            displayName: igDetails.name || igDetails.username,
            username: igDetails.username,
            profileUrl: `https://instagram.com/${igDetails.username}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              linkedPageId: igAccount.pageId,
              linkedPageName: igAccount.pageName,
              profilePictureUrl: igDetails.profile_picture_url,
              followersCount: igDetails.followers_count,
              mediaCount: igDetails.media_count,
              biography: igDetails.biography,
              website: igDetails.website,
            },
          },
        });
      } else {
        // Create new social account
        socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: workspaceId!,
            brandId,
            platform: 'INSTAGRAM_BUSINESS',
            externalId: igAccount.id,
            displayName: igDetails.name || igDetails.username,
            username: igDetails.username,
            profileUrl: `https://instagram.com/${igDetails.username}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              linkedPageId: igAccount.pageId,
              linkedPageName: igAccount.pageName,
              profilePictureUrl: igDetails.profile_picture_url,
              followersCount: igDetails.followers_count,
              mediaCount: igDetails.media_count,
              biography: igDetails.biography,
              website: igDetails.website,
            },
          },
        });
      }

      // Save avatar from Instagram (fire-and-forget, don't block response)
      if (igDetails.profile_picture_url) {
        void saveAvatarFromUrl({
          imageUrl: igDetails.profile_picture_url,
          workspaceId: workspaceId!,
          brandId,
          socialAccountId: socialAccount.id,
          platform: 'INSTAGRAM_BUSINESS',
          accountName: igDetails.username || igDetails.name || 'instagram',
        });
      }
    } else if (accountType === 'tiktok_business') {
      // TikTok Business Account
      if (!isTikTokSession) {
        throw new BadRequestError('INVALID_SESSION', 'Invalid session for TikTok account');
      }

      const tiktokData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; refresh_token: string; open_id: string; expires_in: number };
        userInfo: TikTokUserInfo;
      };

      const { tokenResponse, userInfo } = tiktokData;

      // Verify account ID matches
      if (userInfo.open_id !== accountId) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected TikTok account not found');
      }

      // Check if already exists (any status including REMOVED)
      const existing = await prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          platform: 'TIKTOK_BUSINESS',
          externalId: userInfo.open_id,
        },
      });

      // Encrypt credentials
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
      const credentialsEncrypted = encryptSocialCredentials({
        platform: 'TIKTOK_BUSINESS',
        data: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
        },
      });

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ConflictError('ACCOUNT_ALREADY_CONNECTED', 'This TikTok account is already connected');
        }

        // Reactivate disconnected/removed account with new credentials
        socialAccount = await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            brandId,
            displayName: userInfo.display_name || 'TikTok User',
            username: userInfo.display_name,
            profileUrl: userInfo.profile_deep_link || `https://tiktok.com/@${userInfo.display_name}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              profilePictureUrl: userInfo.avatar_large_url || userInfo.avatar_url,
              isVerified: userInfo.is_verified,
              followerCount: userInfo.follower_count,
              followingCount: userInfo.following_count,
              likesCount: userInfo.likes_count,
              videoCount: userInfo.video_count,
              bio: userInfo.bio_description,
            },
          },
        });
      } else {
        // Create new social account
        socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: workspaceId!,
            brandId,
            platform: 'TIKTOK_BUSINESS',
            externalId: userInfo.open_id,
            displayName: userInfo.display_name || 'TikTok User',
            username: userInfo.display_name,
            profileUrl: userInfo.profile_deep_link || `https://tiktok.com/@${userInfo.display_name}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              profilePictureUrl: userInfo.avatar_large_url || userInfo.avatar_url,
              isVerified: userInfo.is_verified,
              followerCount: userInfo.follower_count,
              followingCount: userInfo.following_count,
              likesCount: userInfo.likes_count,
              videoCount: userInfo.video_count,
              bio: userInfo.bio_description,
            },
          },
        });
      }

      // Save avatar from TikTok (fire-and-forget, don't block response)
      const avatarUrl = userInfo.avatar_large_url || userInfo.avatar_url;
      if (avatarUrl) {
        void saveAvatarFromUrl({
          imageUrl: avatarUrl,
          workspaceId: workspaceId!,
          brandId,
          socialAccountId: socialAccount.id,
          platform: 'TIKTOK_BUSINESS',
          accountName: userInfo.display_name || 'tiktok',
        });
      }
    } else if (accountType === 'linkedin_page') {
      // LinkedIn Page (personal profile or organization)
      if (!isLinkedInSession) {
        throw new BadRequestError('INVALID_SESSION', 'Invalid session for LinkedIn account');
      }

      const linkedinData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        userInfo: LinkedInUserInfo;
        organizationAcls?: LinkedInOrganizationAcl[];
        organizations?: LinkedInOrganization[];
      };

      const { tokenResponse, userInfo } = linkedinData;
      const memberId = extractMemberIdFromUrn(userInfo.sub);

      // Check if accountId is personal profile or organization
      let isOrganization = false;
      let selectedOrg: LinkedInOrganization | undefined;
      
      if (linkedinData.organizations) {
        selectedOrg = linkedinData.organizations.find(org => org.id.toString() === accountId);
        if (selectedOrg) {
          isOrganization = true;
        }
      }

      // Verify account ID matches (either personal or organization)
      if (!isOrganization && memberId !== accountId) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected LinkedIn account not found');
      }
      if (isOrganization && !selectedOrg) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected LinkedIn organization not found');
      }

      // Determine external ID and display info
      const externalId = isOrganization ? selectedOrg!.id.toString() : memberId;
      let displayName: string;
      let username: string | null;
      let profileUrl: string;
      let profilePictureUrl: string | undefined;
      let platformData: Record<string, any>;

      if (isOrganization && selectedOrg) {
        // Organization account
        displayName = selectedOrg.name?.localized?.[`${selectedOrg.name.preferredLocale.language}_${selectedOrg.name.preferredLocale.country}`] 
          || selectedOrg.name?.localized?.[Object.keys(selectedOrg.name.localized)[0]]
          || `Organization ${externalId}`;
        username = selectedOrg.vanityName || externalId;
        profileUrl = selectedOrg.vanityName 
          ? `https://linkedin.com/company/${selectedOrg.vanityName}`
          : `https://linkedin.com/company/${externalId}`;
        
        // Get logo URL if available
        if (selectedOrg.logoV2?.['cropped~']?.elements?.[0]?.identifiers?.[0]?.identifier) {
          profilePictureUrl = selectedOrg.logoV2['cropped~'].elements[0].identifiers[0].identifier;
        } else if (selectedOrg.logoV2?.original) {
          profilePictureUrl = selectedOrg.logoV2.original;
        }

        platformData = {
          profilePictureUrl,
          website: selectedOrg.website?.url,
          isOrganization: true,
        };
      } else {
        // Personal profile
        displayName = userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || 'LinkedIn User';
        username = userInfo.email || null;
        profileUrl = `https://linkedin.com/in/${memberId}`;
        profilePictureUrl = userInfo.picture;
        platformData = {
          profilePictureUrl: userInfo.picture,
          email: userInfo.email,
          emailVerified: userInfo.email_verified,
          locale: userInfo.locale,
          isOrganization: false,
        };
      }

      // Check if already exists (any status including REMOVED)
      const existing = await prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          platform: 'LINKEDIN_PAGE',
          externalId,
        },
      });

      // Encrypt credentials
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
      const credentialsEncrypted = encryptSocialCredentials({
        platform: 'LINKEDIN_PAGE',
        data: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
          organizationId: isOrganization ? externalId : undefined,
        },
      });

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ConflictError('ACCOUNT_ALREADY_CONNECTED', 'This LinkedIn account is already connected');
        }

        // Reactivate disconnected/removed account with new credentials
        socialAccount = await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            brandId,
            displayName,
            username,
            profileUrl,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData,
          },
        });
      } else {
        // Create new social account
        socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: workspaceId!,
            brandId,
            platform: 'LINKEDIN_PAGE',
            externalId,
            displayName,
            username,
            profileUrl,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData,
          },
        });
      }

      // Save avatar from LinkedIn (fire-and-forget, don't block response)
      if (profilePictureUrl) {
        void saveAvatarFromUrl({
          imageUrl: profilePictureUrl,
          workspaceId: workspaceId!,
          brandId,
          socialAccountId: socialAccount.id,
          platform: 'LINKEDIN_PAGE',
          accountName: displayName,
        });
      }
    } else if (accountType === 'x_account') {
      // X Account
      if (!isXSession) {
        throw new BadRequestError('INVALID_SESSION', 'Invalid session for X account');
      }

      const xData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        userInfo: XUserInfo;
      };

      const { tokenResponse, userInfo } = xData;

      // Verify account ID matches
      if (userInfo.data.id !== accountId) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected X account not found');
      }

      // Check if already exists (any status including REMOVED)
      const existing = await prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          platform: 'X_ACCOUNT',
          externalId: userInfo.data.id,
        },
      });

      // Encrypt credentials
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
      const credentialsEncrypted = encryptSocialCredentials({
        platform: 'X_ACCOUNT',
        data: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
        },
      });

      // Get higher resolution profile image
      const profileImageUrl = userInfo.data.profile_image_url?.replace('_normal', '_400x400');

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ConflictError('ACCOUNT_ALREADY_CONNECTED', 'This X account is already connected');
        }

        // Reactivate disconnected/removed account with new credentials
        socialAccount = await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            brandId,
            displayName: userInfo.data.name,
            username: userInfo.data.username,
            profileUrl: `https://x.com/${userInfo.data.username}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              profileImageUrl,
              description: userInfo.data.description,
              verified: userInfo.data.verified,
              publicMetrics: userInfo.data.public_metrics,
            },
          },
        });
      } else {
        // Create new social account
        socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: workspaceId!,
            brandId,
            platform: 'X_ACCOUNT',
            externalId: userInfo.data.id,
            displayName: userInfo.data.name,
            username: userInfo.data.username,
            profileUrl: `https://x.com/${userInfo.data.username}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              profileImageUrl,
              description: userInfo.data.description,
              verified: userInfo.data.verified,
              publicMetrics: userInfo.data.public_metrics,
            },
          },
        });
      }

      // Save avatar from X (fire-and-forget, don't block response)
      if (profileImageUrl) {
        void saveAvatarFromUrl({
          imageUrl: profileImageUrl,
          workspaceId: workspaceId!,
          brandId,
          socialAccountId: socialAccount.id,
          platform: 'X_ACCOUNT',
          accountName: userInfo.data.username,
        });
      }
    } else if (accountType === 'pinterest_profile') {
      // Pinterest Profile
      if (!isPinterestSession) {
        throw new BadRequestError('INVALID_SESSION', 'Invalid session for Pinterest account');
      }

      const pinterestData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        userInfo: PinterestUserInfo;
      };

      const { tokenResponse, userInfo } = pinterestData;

      // Verify account ID matches (username)
      if (userInfo.username !== accountId) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected Pinterest account not found');
      }

      // Check if already exists (any status including REMOVED)
      const existing = await prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          platform: 'PINTEREST_PROFILE',
          externalId: userInfo.username,
        },
      });

      // Encrypt credentials
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
      const credentialsEncrypted = encryptSocialCredentials({
        platform: 'PINTEREST_PROFILE',
        data: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
        },
      });

      const displayName = userInfo.business_name || userInfo.username;

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ConflictError('ACCOUNT_ALREADY_CONNECTED', 'This Pinterest account is already connected');
        }

        // Reactivate disconnected/removed account with new credentials
        socialAccount = await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            brandId,
            displayName,
            username: userInfo.username,
            profileUrl: `https://pinterest.com/${userInfo.username}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              profileImageUrl: userInfo.profile_image,
              accountType: userInfo.account_type,
              websiteUrl: userInfo.website_url,
            },
          },
        });
      } else {
        // Create new social account
        socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: workspaceId!,
            brandId,
            platform: 'PINTEREST_PROFILE',
            externalId: userInfo.username,
            displayName,
            username: userInfo.username,
            profileUrl: `https://pinterest.com/${userInfo.username}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              profileImageUrl: userInfo.profile_image,
              accountType: userInfo.account_type,
              websiteUrl: userInfo.website_url,
            },
          },
        });
      }

      // Save avatar from Pinterest (fire-and-forget, don't block response)
      if (userInfo.profile_image) {
        void saveAvatarFromUrl({
          imageUrl: userInfo.profile_image,
          workspaceId: workspaceId!,
          brandId,
          socialAccountId: socialAccount.id,
          platform: 'PINTEREST_PROFILE',
          accountName: userInfo.username,
        });
      }
    } else if (accountType === 'youtube_channel') {
      // YouTube Channel
      if (!isYouTubeSession) {
        throw new BadRequestError('INVALID_SESSION', 'Invalid session for YouTube account');
      }

      const youtubeData = selectionData as {
        stateData: OAuthStateData;
        tokenResponse: { access_token: string; expires_in: number; refresh_token?: string };
        channels: YouTubeChannel[];
      };

      const { tokenResponse, channels } = youtubeData;

      // Find selected channel
      const channel = channels.find(c => c.id === accountId);
      if (!channel) {
        throw new NotFoundError('ACCOUNT_NOT_FOUND', 'Selected YouTube channel not found');
      }

      // Check if already exists (any status including REMOVED)
      const existing = await prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          platform: 'YOUTUBE_CHANNEL',
          externalId: channel.id,
        },
      });

      // Encrypt credentials
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
      const credentialsEncrypted = encryptSocialCredentials({
        platform: 'YOUTUBE_CHANNEL',
        data: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
        },
      });

      const thumbnailUrl = channel.snippet.thumbnails.high?.url 
        || channel.snippet.thumbnails.medium?.url 
        || channel.snippet.thumbnails.default?.url;

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ConflictError('ACCOUNT_ALREADY_CONNECTED', 'This YouTube channel is already connected');
        }

        // Reactivate disconnected/removed account with new credentials
        socialAccount = await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            brandId,
            displayName: channel.snippet.title,
            username: channel.snippet.customUrl?.replace('@', '') || null,
            profileUrl: channel.snippet.customUrl 
              ? `https://youtube.com/${channel.snippet.customUrl}` 
              : `https://youtube.com/channel/${channel.id}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              thumbnailUrl,
              description: channel.snippet.description,
              statistics: channel.statistics,
            },
          },
        });
      } else {
        // Create new social account
        socialAccount = await prisma.socialAccount.create({
          data: {
            workspaceId: workspaceId!,
            brandId,
            platform: 'YOUTUBE_CHANNEL',
            externalId: channel.id,
            displayName: channel.snippet.title,
            username: channel.snippet.customUrl?.replace('@', '') || null,
            profileUrl: channel.snippet.customUrl 
              ? `https://youtube.com/${channel.snippet.customUrl}` 
              : `https://youtube.com/channel/${channel.id}`,
            status: 'ACTIVE',
            credentialsEncrypted,
            platformData: {
              thumbnailUrl,
              description: channel.snippet.description,
              statistics: channel.statistics,
            },
          },
        });
      }

      // Save avatar from YouTube (fire-and-forget, don't block response)
      if (thumbnailUrl) {
        void saveAvatarFromUrl({
          imageUrl: thumbnailUrl,
          workspaceId: workspaceId!,
          brandId,
          socialAccountId: socialAccount.id,
          platform: 'YOUTUBE_CHANNEL',
          accountName: channel.snippet.title,
        });
      }
    } else {
      throw new BadRequestError('INVALID_ACCOUNT_TYPE', 'Invalid account type');
    }

    // Clear the OAuth session
    await redis.del(selectionKey);

    // Get brand for activity logging
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true },
    });

    // Log activity
    await logActivity({
      type: 'social_account.connected',
      workspaceId,
      userId,
      actorType: 'user',
      source: 'api',
      scopeType: 'social_account',
      scopeId: socialAccount.id,
      metadata: {
        platform: socialAccount.platform,
        externalId: socialAccount.externalId,
        displayName: socialAccount.displayName,
        username: socialAccount.username,
        brandId,
        brandName: brand?.name,
      },
      request,
    });

    // Also log brand-level event
    await logActivity({
      type: 'brand.social_account_connected',
      workspaceId,
      userId,
      actorType: 'user',
      source: 'api',
      scopeType: 'brand',
      scopeId: brandId,
      metadata: {
        name: brand?.name,
        provider: socialAccount.platform,
        handle: socialAccount.username || socialAccount.displayName,
      },
      request,
    });

    // Recalculate brand readiness
    await recalculateBrandSocialAccountReadiness(workspaceId, brandId);

    return reply.status(201).send({
      success: true,
      data: {
        id: socialAccount.id,
        platform: socialAccount.platform,
        externalId: socialAccount.externalId,
        displayName: socialAccount.displayName,
        username: socialAccount.username,
        status: socialAccount.status,
      },
    });
  });

  // ============================================================================
  // GET /social-accounts/oauth/platforms
  // Get available OAuth platforms
  // ============================================================================
  app.get('/social-accounts/oauth/platforms', {
    schema: {
      tags: ['Social Account OAuth'],
      summary: 'Get available OAuth platforms',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  enabled: { type: 'boolean' },
                  supportedAccountTypes: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const platforms = [
      {
        id: 'FACEBOOK',
        name: 'Facebook',
        enabled: isFacebookOAuthEnabled(),
        supportedAccountTypes: ['FACEBOOK_PAGE'],
      },
      {
        id: 'INSTAGRAM',
        name: 'Instagram',
        enabled: isFacebookOAuthEnabled(), // Instagram uses Facebook OAuth
        supportedAccountTypes: ['INSTAGRAM_BUSINESS'],
      },
      {
        id: 'YOUTUBE',
        name: 'YouTube',
        enabled: isYouTubeOAuthEnabled(),
        supportedAccountTypes: ['YOUTUBE_CHANNEL'],
      },
      {
        id: 'TIKTOK',
        name: 'TikTok',
        enabled: isTikTokOAuthEnabled(),
        supportedAccountTypes: ['TIKTOK_BUSINESS'],
      },
      {
        id: 'X',
        name: 'X (Twitter)',
        enabled: isXOAuthEnabled(),
        supportedAccountTypes: ['X_ACCOUNT'],
      },
      {
        id: 'LINKEDIN',
        name: 'LinkedIn',
        enabled: isLinkedInOAuthEnabled(),
        supportedAccountTypes: ['LINKEDIN_PAGE'],
      },
      {
        id: 'PINTEREST',
        name: 'Pinterest',
        enabled: isPinterestOAuthEnabled(),
        supportedAccountTypes: ['PINTEREST_PROFILE'],
      },
    ];

    return reply.send({
      success: true,
      data: platforms,
    });
  });
}

