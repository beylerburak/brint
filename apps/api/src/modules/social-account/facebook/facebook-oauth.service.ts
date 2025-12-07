/**
 * Facebook/Instagram OAuth Service
 * 
 * Handles Facebook OAuth flow and creates/updates SocialAccount records
 * for both Facebook Pages and connected Instagram Business accounts.
 */

import { logger } from '../../../lib/logger.js';
import { facebookConfig } from '../../../config/facebook.config.js';
import { graphRequest, graphBaseUrl } from './facebook-client.js';
import { encodeFacebookState, decodeFacebookState, type FacebookOAuthState } from './facebook-state.js';
import { createOrUpdateFromOAuth } from '../social-account.service.js';
import type { SocialPlatform } from '@prisma/client';

// ============================================================================
// OAuth Scopes
// ============================================================================

export const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management', // For Instagram Business account access
];

// ============================================================================
// Authorize URL Builder
// ============================================================================

/**
 * Build Facebook OAuth authorize URL
 */
export function buildFacebookAuthorizeUrl(statePayload: FacebookOAuthState): string {
  const state = encodeFacebookState(statePayload);

  const params = new URLSearchParams({
    client_id: facebookConfig.appId,
    redirect_uri: facebookConfig.redirectUri,
    state,
    response_type: 'code',
    scope: META_SCOPES.join(','),
  });

  return `https://www.facebook.com/${facebookConfig.graphVersion}/dialog/oauth?${params.toString()}`;
}

// ============================================================================
// Callback Handler
// ============================================================================

/**
 * Handle Facebook OAuth callback
 * 
 * Flow:
 * 1. Exchange code for user access token
 * 2. Get user's Facebook Pages (with Instagram Business accounts)
 * 3. Create/update SocialAccount records for each Page and Instagram account
 */
export async function handleFacebookCallback(
  code: string,
  state: string,
  workspaceId: string
): Promise<FacebookOAuthState> {
  logger.info({ workspaceId }, 'Handling Facebook OAuth callback');

  // Decode state to get brandId, workspaceId, userId
  const decoded = decodeFacebookState(state);
  
  // Verify workspaceId matches
  if (decoded.workspaceId !== workspaceId) {
    throw new Error('Workspace ID mismatch in OAuth state');
  }

  try {
    // Step 1: Exchange code for user access token
    logger.debug('Exchanging OAuth code for access token');
    const tokenUrl = new URL(`${graphBaseUrl}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', facebookConfig.appId);
    tokenUrl.searchParams.set('client_secret', facebookConfig.appSecret);
    tokenUrl.searchParams.set('redirect_uri', facebookConfig.redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to exchange OAuth code');
    }

    const tokenData = await tokenResponse.json();
    const userAccessToken = tokenData.access_token as string;
    const expiresIn = tokenData.expires_in as number | undefined;
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : undefined;

    logger.info({ expiresIn, tokenExpiresAt }, 'User access token obtained');

    // Step 2: Get user's Facebook Pages with Instagram Business accounts
    logger.debug('Fetching user Facebook Pages');
    const pagesResponse = await graphRequest<{
      data: Array<{
        id: string;
        name: string;
        access_token: string;
        picture?: {
          data?: {
            url: string;
          };
        };
        instagram_business_account?: {
          id: string;
          username?: string;
          profile_picture_url?: string;
        };
      }>;
    }>('/me/accounts', userAccessToken, {
      fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}',
    });

    const pages = pagesResponse.data || [];
    logger.info({ pageCount: pages.length }, 'Fetched Facebook Pages');

    if (pages.length === 0) {
      logger.warn('No Facebook Pages found for user');
      return decoded;
    }

    // Step 3: Create/update SocialAccount records for each Page and Instagram account
    for (const page of pages) {
      const pageAccessToken = page.access_token;
      const pageId = page.id;
      const pageName = page.name;
      const pagePicture = page.picture?.data?.url;

      logger.info({ pageId, pageName }, 'Processing Facebook Page');

      // 3a) Create/update Facebook Page SocialAccount
      try {
        await createOrUpdateFromOAuth(
          {
            brandId: decoded.brandId,
            platform: 'FACEBOOK',
            platformAccountId: pageId,
            displayName: pageName,
            username: null,
            externalAvatarUrl: pagePicture || null,
            accessToken: pageAccessToken,
            refreshToken: null,
            tokenExpiresAt: tokenExpiresAt,
            scopes: META_SCOPES,
            tokenData: {
              userAccessToken,
              pageId,
            },
            rawProfile: page,
          },
          workspaceId,
          decoded.userId
        );

        logger.info({ pageId, platform: 'FACEBOOK' }, 'Facebook Page account created/updated');
      } catch (error) {
        logger.error({ error, pageId, platform: 'FACEBOOK' }, 'Failed to create/update Facebook Page account');
        // Continue with other pages even if one fails
      }

      // 3b) Create/update Instagram Business Account if connected
      const igAccount = page.instagram_business_account;
      if (igAccount?.id) {
        logger.info({ igAccountId: igAccount.id, pageId }, 'Processing Instagram Business account');

        try {
          await createOrUpdateFromOAuth(
            {
              brandId: decoded.brandId,
              platform: 'INSTAGRAM',
              platformAccountId: igAccount.id,
              displayName: pageName, // Use page name as display name
              username: igAccount.username || null,
              externalAvatarUrl: igAccount.profile_picture_url || null,
              accessToken: pageAccessToken, // Instagram uses page token for publishing
              refreshToken: null,
              tokenExpiresAt: tokenExpiresAt,
              scopes: META_SCOPES,
              tokenData: {
                userAccessToken,
                pageId, // Required for Instagram API calls
                instagramAccountId: igAccount.id,
              },
              rawProfile: {
                ...igAccount,
                connectedPageId: pageId,
                connectedPageName: pageName,
              },
            },
            workspaceId,
            decoded.userId
          );

          logger.info({ igAccountId: igAccount.id, platform: 'INSTAGRAM' }, 'Instagram Business account created/updated');
        } catch (error) {
          logger.error({ error, igAccountId: igAccount.id, platform: 'INSTAGRAM' }, 'Failed to create/update Instagram account');
          // Continue with other accounts even if one fails
        }
      } else {
        logger.debug({ pageId }, 'No Instagram Business account connected to this Page');
      }
    }

    logger.info(
      { brandId: decoded.brandId, workspaceId, pageCount: pages.length },
      'Facebook OAuth callback completed successfully'
    );

    return decoded;
  } catch (error) {
    logger.error({ error, workspaceId }, 'Facebook OAuth callback failed');
    throw error;
  }
}
