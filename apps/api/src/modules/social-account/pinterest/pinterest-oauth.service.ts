/**
 * Pinterest OAuth Service
 * 
 * Handles Pinterest OAuth 2.0 flow and creates/updates SocialAccount records
 * for Pinterest user accounts.
 */

import { logger } from '../../../lib/logger.js';
import { pinterestConfig } from '../../../config/pinterest.config.js';
import {
  encodePinterestState,
  decodePinterestState,
  type PinterestOAuthState,
} from './pinterest-state.js';
import { createOrUpdateFromOAuth } from '../social-account.service.js';

// ============================================================================
// OAuth Scopes
// ============================================================================

export const PINTEREST_SCOPES = [
  'user_accounts:read',
  'boards:read',
  'boards:write',
  'pins:read',
  'pins:write',
];

// ============================================================================
// Authorize URL Builder
// ============================================================================

/**
 * Build Pinterest OAuth authorize URL
 */
export function buildPinterestAuthorizeUrl(statePayload: PinterestOAuthState): string {
  const state = encodePinterestState(statePayload);

  // Ensure redirect_uri doesn't have query parameters
  const redirectUri = pinterestConfig.redirectUri.split('?')[0];

  const params = new URLSearchParams({
    client_id: pinterestConfig.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PINTEREST_SCOPES.join(','), // Pinterest uses comma-separated scopes
    state,
  });

  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

// ============================================================================
// Token Exchange
// ============================================================================

export interface PinterestTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope: string[];
  tokenType: string;
}

/**
 * Exchange OAuth code for access token
 */
export async function getPinterestToken(code: string): Promise<PinterestTokenResult> {
  logger.debug('Exchanging Pinterest OAuth code for access token');

  // Ensure redirect_uri doesn't have query parameters
  const redirectUri = pinterestConfig.redirectUri.split('?')[0];

  // Basic Auth: base64(app_id:app_secret)
  const basicAuth = Buffer.from(
    `${pinterestConfig.clientId}:${pinterestConfig.clientSecret}`
  ).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
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
    }, 'Pinterest token exchange failed');
    
    const errorMessage = errorData.error_description || errorData.error || errorData.raw || 'Failed to exchange OAuth code';
    throw new Error(`Pinterest token exchange failed: ${errorMessage}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    logger.error({ responseData: data }, 'Pinterest token response missing access_token');
    throw new Error('Invalid Pinterest token response: missing access_token');
  }
  
  logger.debug({ 
    hasAccessToken: !!data.access_token,
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope
  }, 'Pinterest token exchange successful');
  
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresIn: data.expires_in as number | undefined,
    scope: data.scope ? (data.scope as string).split(',') : [],
    tokenType: data.token_type as string || 'Bearer',
  };
}

// ============================================================================
// User Account Fetch
// ============================================================================

export interface PinterestUserAccount {
  id: string;
  username?: string;
  profile_image?: string;
  business_name?: string;
  // Other fields will be stored in rawProfile
}

/**
 * Fetch Pinterest user account information
 */
export async function fetchPinterestUserAccount(accessToken: string): Promise<PinterestUserAccount> {
  logger.debug('Fetching Pinterest user account');

  const response = await fetch('https://api.pinterest.com/v5/user_account', {
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
      hasAccessToken: !!accessToken
    }, 'Pinterest user account fetch failed');
    
    const errorMessage = errorData.message || errorData.error || errorData.raw || 'Failed to fetch Pinterest user account';
    throw new Error(`Pinterest user account fetch failed: ${errorMessage}`);
  }

  const data = await response.json();
  
  if (!data.id) {
    logger.error({ responseData: data }, 'Pinterest user account response missing id');
    throw new Error('Invalid Pinterest user account response: missing id');
  }
  
  logger.debug({ 
    userId: data.id,
    username: data.username,
    hasBusinessName: !!data.business_name
  }, 'Pinterest user account fetched');
  
  return data as PinterestUserAccount;
}

// ============================================================================
// Callback Handler
// ============================================================================

/**
 * Handle Pinterest OAuth callback
 * 
 * 1. Decode state to get brandId, workspaceId, userId
 * 2. Exchange code for access token
 * 3. Fetch user's Pinterest account
 * 4. Save as SocialAccount
 */
export async function handlePinterestCallback(
  code: string,
  state: string,
  workspaceId: string
): Promise<PinterestOAuthState> {
  logger.info('Pinterest callback - starting OAuth flow');

  // Step 1: Decode state
  const decoded = decodePinterestState(state);
  logger.info({ 
    brandId: decoded.brandId, 
    workspaceId: decoded.workspaceId,
    userId: decoded.userId,
    locale: decoded.locale
  }, 'Pinterest callback - decoded state');

  // Step 2: Exchange code for token
  logger.info('Pinterest callback - exchanging code for token');
  const tokenResult = await getPinterestToken(code);

  logger.info({ 
    expiresIn: tokenResult.expiresIn, 
    hasRefreshToken: !!tokenResult.refreshToken,
    scopes: tokenResult.scope
  }, 'Pinterest access token obtained');

  // Step 3: Fetch user account
  logger.info('Pinterest callback - fetching user account');
  const userAccount = await fetchPinterestUserAccount(tokenResult.accessToken);

  logger.info({ 
    userId: userAccount.id,
    username: userAccount.username,
    businessName: userAccount.business_name
  }, 'Fetched Pinterest user account');

  // Step 4: Save as SocialAccount
  logger.info({ brandId: decoded.brandId }, 'Pinterest callback - saving social account');
  
  const tokenExpiresAt = tokenResult.expiresIn
    ? new Date(Date.now() + tokenResult.expiresIn * 1000)
    : null;

  const displayName = userAccount.business_name || userAccount.username || 'Pinterest Account';

  try {
    await createOrUpdateFromOAuth(
      {
        brandId: decoded.brandId,
        platform: 'PINTEREST',
        platformAccountId: userAccount.id,
        displayName,
        username: userAccount.username || null,
        externalAvatarUrl: userAccount.profile_image || null,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || null,
        tokenExpiresAt,
        scopes: tokenResult.scope,
        rawProfile: {
          user: userAccount,
        },
        tokenData: {
          accountId: userAccount.id,
        },
        canPublish: true,
      },
      workspaceId
    );

    logger.debug({ userId: userAccount.id, displayName }, 'Pinterest account saved as social account');
  } catch (error) {
    logger.error({ error, userId: userAccount.id, displayName }, 'Failed to save Pinterest account as social account');
    throw error;
  }

  logger.info({ 
    brandId: decoded.brandId,
    userId: userAccount.id
  }, 'Pinterest callback - account processed successfully');

  return decoded;
}
