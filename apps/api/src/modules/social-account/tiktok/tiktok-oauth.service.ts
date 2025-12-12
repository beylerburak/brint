/**
 * TikTok OAuth Service
 * 
 * Handles TikTok OAuth 2.0 flow and creates/updates SocialAccount records
 * for TikTok accounts.
 */

import { logger } from '../../../lib/logger.js';
import { tiktokConfig } from '../../../config/tiktok.config.js';
import {
  encodeTikTokState,
  decodeTikTokState,
  type TikTokOAuthState,
} from './tiktok-state.js';
import { createOrUpdateFromOAuth } from '../social-account.service.js';

// ============================================================================
// OAuth Scopes
// ============================================================================

export const TIKTOK_SCOPES = [
  'user.info.basic',
  'video.list',
  'video.upload',
  'video.publish', // Required for publishing videos
];

// ============================================================================
// Authorize URL Builder
// ============================================================================

/**
 * Build TikTok OAuth authorize URL
 */
export function buildTikTokAuthorizeUrl(statePayload: TikTokOAuthState): string {
  const state = encodeTikTokState(statePayload);

  // Ensure redirect_uri doesn't have query parameters (TikTok doesn't allow state in redirect_uri)
  const redirectUri = tiktokConfig.redirectUri.split('?')[0]; // Remove any existing query params

  const params = new URLSearchParams({
    client_key: tiktokConfig.clientKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: TIKTOK_SCOPES.join(','),
    state,
  });

  // TikTok OAuth v2 endpoint
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

// ============================================================================
// Token Exchange
// ============================================================================

export interface TikTokTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  openId: string;
  scope: string[];
}

/**
 * Exchange OAuth code for access token
 */
export async function getTikTokToken(code: string): Promise<TikTokTokenResult> {
  logger.debug('Exchanging TikTok OAuth code for access token');

  // TikTok OAuth v2 uses form-urlencoded, not JSON
  const params = new URLSearchParams({
    client_key: tiktokConfig.clientKey,
    client_secret: tiktokConfig.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: tiktokConfig.redirectUri.split('?')[0], // Remove any query params
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { raw: errorText };
    }
    
    logger.error({ 
      status: response.status, 
      statusText: response.statusText,
      errorData,
      hasCode: !!code
    }, 'TikTok token exchange failed');
    
    const errorMessage = errorData.message || errorData.error_description || errorData.raw || 'Failed to exchange OAuth code';
    throw new Error(`TikTok token exchange failed: ${errorMessage}`);
  }

  const data = await response.json();
  
  // TikTok API returns data in a nested structure
  const tokenData = data.data || data;
  
  if (!tokenData.access_token || !tokenData.open_id) {
    logger.error({ responseData: data }, 'TikTok token response missing required fields');
    throw new Error('Invalid TikTok token response: missing access_token or open_id');
  }
  
  logger.debug({ 
    hasAccessToken: !!tokenData.access_token,
    hasRefreshToken: !!tokenData.refresh_token,
    hasOpenId: !!tokenData.open_id,
    expiresIn: tokenData.expires_in,
    scope: tokenData.scope
  }, 'TikTok token exchange successful');
  
  return {
    accessToken: tokenData.access_token as string,
    refreshToken: tokenData.refresh_token as string | undefined,
    expiresIn: tokenData.expires_in as number | undefined,
    openId: tokenData.open_id as string,
    scope: tokenData.scope ? (tokenData.scope as string).split(',') : [],
  };
}

// ============================================================================
// Profile Fetch
// ============================================================================

/**
 * Fetch TikTok user profile
 */
export async function fetchTikTokUserProfile(accessToken: string, openId: string): Promise<any> {
  logger.debug('Fetching TikTok user profile');

  // TikTok OAuth v2 user info endpoint uses GET with query parameters
  // Note: username requires user.info.profile scope, so we only request basic fields
  const url = new URL('https://open.tiktokapis.com/v2/user/info/');
  url.searchParams.set('fields', 'open_id,union_id,display_name,avatar_url');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { raw: errorText };
    }
    
    logger.error({ 
      status: response.status, 
      statusText: response.statusText,
      errorData,
      hasAccessToken: !!accessToken,
      openId,
      url: url.toString(),
      requestHeaders: {
        Authorization: accessToken ? 'Bearer ***' : 'missing'
      }
    }, 'TikTok profile fetch failed');
    
    // Extract error message from TikTok API response
    const errorMessage = errorData.error?.message || 
                        errorData.message || 
                        errorData.error_description || 
                        errorData.raw || 
                        `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`TikTok profile fetch failed: ${errorMessage}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (parseError) {
    logger.error({ 
      parseError,
      status: response.status,
      statusText: response.statusText
    }, 'Failed to parse TikTok profile response as JSON');
    throw new Error('TikTok profile fetch failed: Invalid JSON response');
  }
  
  logger.debug({ responseData: data }, 'TikTok profile API response received');
  
  // Check for error in response
  if (data.error && data.error.code !== 'ok') {
    logger.error({ 
      errorCode: data.error.code,
      errorMessage: data.error.message,
      logId: data.error.log_id,
      responseData: data 
    }, 'TikTok profile API returned error');
    throw new Error(`TikTok profile API error: ${data.error.message || data.error.code}`);
  }
  
  // TikTok OAuth v2 returns data in { data: { user: {...} } } structure
  const userData = data.data?.user || data.data || data;
  
  if (!userData) {
    logger.error({ responseData: data }, 'TikTok profile response missing user data');
    throw new Error('Invalid TikTok profile response: missing user data');
  }
  
  if (!userData.open_id) {
    logger.error({ 
      responseData: data,
      userData,
      hasOpenId: !!userData.open_id,
      availableFields: Object.keys(userData)
    }, 'TikTok profile response missing open_id field');
    throw new Error('Invalid TikTok profile response: missing open_id field');
  }
  
  logger.debug({ 
    openId: userData.open_id,
    displayName: userData.display_name,
    hasAvatarUrl: !!userData.avatar_url,
    unionId: userData.union_id
  }, 'TikTok profile data received');
  
  return userData;
}

// ============================================================================
// Callback Handler
// ============================================================================

/**
 * Handle TikTok OAuth callback
 * 
 * Flow:
 * 1. Decode state to get brandId, workspaceId, userId
 * 2. Exchange code for access token
 * 3. Fetch user profile
 * 4. Save as SocialAccount (canPublish = true by default for TikTok)
 */
export async function handleTikTokCallback(
  code: string,
  state: string,
  workspaceId: string
): Promise<TikTokOAuthState> {
  logger.info({ workspaceId }, 'Handling TikTok OAuth callback');

  // Decode state to get brandId, workspaceId, userId
  const decoded = decodeTikTokState(state);
  
  // Verify workspaceId matches
  if (decoded.workspaceId !== workspaceId) {
    throw new Error('Workspace ID mismatch in OAuth state');
  }

  try {
    // Step 1: Exchange code for access token
    logger.info({ workspaceId, brandId: decoded.brandId }, 'TikTok callback - starting token exchange');
    const tokenResult = await getTikTokToken(code);
    const tokenExpiresAt = tokenResult.expiresIn
      ? new Date(Date.now() + tokenResult.expiresIn * 1000)
      : undefined;

    logger.info({ 
      expiresIn: tokenResult.expiresIn, 
      tokenExpiresAt,
      hasRefreshToken: !!tokenResult.refreshToken,
      openId: tokenResult.openId,
      scopes: tokenResult.scope
    }, 'TikTok access token obtained');

    // Step 2: Fetch user profile
    logger.info('TikTok callback - fetching user profile');
    const profile = await fetchTikTokUserProfile(tokenResult.accessToken, tokenResult.openId);

    logger.info({ 
      openId: profile.open_id,
      displayName: profile.display_name,
      hasAvatarUrl: !!profile.avatar_url
    }, 'Fetched TikTok profile');

    // Step 3: Save as SocialAccount (canPublish = true by default for TikTok)
    logger.info({ brandId: decoded.brandId, openId: tokenResult.openId }, 'TikTok callback - saving social account');
    const savedAccount = await createOrUpdateFromOAuth(
      {
        brandId: decoded.brandId,
        platform: 'TIKTOK',
        platformAccountId: tokenResult.openId,
        displayName: profile.display_name || null,
        username: null, // TikTok username requires user.info.profile scope
        externalAvatarUrl: profile.avatar_url || null,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || null,
        tokenExpiresAt,
        scopes: tokenResult.scope,
        tokenData: {
          openId: tokenResult.openId,
        },
        rawProfile: {
          profile,
          token: {
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            expiresIn: tokenResult.expiresIn,
            openId: tokenResult.openId,
          },
        },
        canPublish: true, // Explicitly set to true for TikTok
      },
      workspaceId,
      decoded.userId
    );

    logger.info(
      { 
        brandId: decoded.brandId, 
        workspaceId, 
        openId: tokenResult.openId,
        accountId: savedAccount.id,
        platform: savedAccount.platform,
        displayName: savedAccount.displayName,
        canPublish: savedAccount.canPublish,
        status: savedAccount.status,
      },
      'TikTok OAuth callback completed successfully - account saved'
    );

    return decoded;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error({ 
      error, 
      errorMessage,
      errorStack,
      workspaceId,
      brandId: decoded.brandId,
      hasCode: !!code,
      hasState: !!state
    }, 'TikTok OAuth callback failed');
    
    throw error;
  }
}
