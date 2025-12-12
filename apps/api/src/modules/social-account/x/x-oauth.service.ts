/**
 * X OAuth Service
 * 
 * Handles X OAuth 2.0 PKCE flow and creates/updates SocialAccount records
 * for X (Twitter) accounts.
 */

import { logger } from '../../../lib/logger.js';
import { xConfig } from '../../../config/x.config.js';
import {
  encodeXState,
  decodeXState,
  generateCodeVerifier,
  generateCodeChallenge,
  type XOAuthState,
} from './x-state.js';
import { createOrUpdateFromOAuth } from '../social-account.service.js';

// ============================================================================
// OAuth Scopes
// ============================================================================

export const X_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'media.write', // Required for media uploads
  'offline.access', // For refresh token
];

// ============================================================================
// Authorize URL Builder
// ============================================================================

/**
 * Build X OAuth authorize URL with PKCE
 */
export function buildXAuthorizeUrl(statePayload: Omit<XOAuthState, 'codeVerifier'>): string {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  const state = encodeXState({
    ...statePayload,
    codeVerifier,
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: xConfig.clientId,
    redirect_uri: xConfig.redirectUri,
    scope: X_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

// ============================================================================
// Token Exchange
// ============================================================================

export interface XTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope: string[];
  tokenType: string;
}

/**
 * Exchange OAuth code for access token using PKCE
 */
export async function getXToken(code: string, codeVerifier: string): Promise<XTokenResult> {
  logger.debug('Exchanging X OAuth code for access token');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: xConfig.redirectUri,
    code_verifier: codeVerifier,
  });

  // X API requires Basic Auth with client_id:client_secret (base64 encoded)
  // Format: Basic base64(client_id:client_secret)
  const credentials = Buffer.from(`${xConfig.clientId}:${xConfig.clientSecret}`).toString('base64');

  logger.debug({ 
    hasClientId: !!xConfig.clientId,
    hasClientSecret: !!xConfig.clientSecret,
    redirectUri: xConfig.redirectUri,
    hasCode: !!code,
    hasCodeVerifier: !!codeVerifier
  }, 'X token exchange - request details');

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
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
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier
    }, 'X token exchange failed');
    
    const errorMessage = errorData.error_description || errorData.error || errorData.raw || 'Failed to exchange OAuth code';
    throw new Error(`X token exchange failed: ${errorMessage}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    logger.error({ responseData: data }, 'X token response missing access_token');
    throw new Error('Invalid X token response: missing access_token');
  }
  
  logger.debug({ 
    hasAccessToken: !!data.access_token,
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope
  }, 'X token exchange successful');
  
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresIn: data.expires_in as number | undefined,
    scope: (data.scope as string).split(' '),
    tokenType: data.token_type as string,
  };
}

// ============================================================================
// Profile Fetch
// ============================================================================

/**
 * Fetch X user profile
 */
export async function fetchXUserProfile(accessToken: string): Promise<any> {
  logger.debug('Fetching X user profile');

  const url = new URL('https://api.twitter.com/2/users/me');
  url.searchParams.set('user.fields', 'profile_image_url,username,name');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
    }, 'X profile fetch failed');
    
    const errorMessage = errorData.detail || errorData.title || errorData.raw || 'Failed to fetch X profile';
    throw new Error(`X profile fetch failed: ${errorMessage}`);
  }

  const data = await response.json();
  
  if (!data.data) {
    logger.error({ responseData: data }, 'X profile response missing data field');
    throw new Error('Invalid X profile response: missing data field');
  }
  
  if (!data.data.id) {
    logger.error({ profileData: data.data }, 'X profile response missing id field');
    throw new Error('Invalid X profile response: missing id field');
  }
  
  logger.debug({ 
    profileId: data.data.id,
    username: data.data.username,
    name: data.data.name,
    hasProfileImage: !!data.data.profile_image_url
  }, 'X profile data received');
  
  return data.data; // { id, name, username, profile_image_url }
}

// ============================================================================
// Callback Handler
// ============================================================================

/**
 * Handle X OAuth callback
 * 
 * Flow:
 * 1. Decode state to get brandId, workspaceId, userId, codeVerifier
 * 2. Exchange code for access token using PKCE
 * 3. Fetch user profile
 * 4. Save as SocialAccount (canPublish = true by default for X)
 */
export async function handleXCallback(
  code: string,
  state: string,
  workspaceId: string
): Promise<XOAuthState> {
  logger.info({ workspaceId }, 'Handling X OAuth callback');

  // Decode state to get brandId, workspaceId, userId, codeVerifier
  const decoded = decodeXState(state);
  
  // Verify workspaceId matches
  if (decoded.workspaceId !== workspaceId) {
    throw new Error('Workspace ID mismatch in OAuth state');
  }

  try {
    // Step 1: Exchange code for access token
    logger.info({ workspaceId, brandId: decoded.brandId }, 'X callback - starting token exchange');
    const tokenResult = await getXToken(code, decoded.codeVerifier);
    const tokenExpiresAt = tokenResult.expiresIn
      ? new Date(Date.now() + tokenResult.expiresIn * 1000)
      : undefined;

    logger.info({ 
      expiresIn: tokenResult.expiresIn, 
      tokenExpiresAt,
      hasRefreshToken: !!tokenResult.refreshToken,
      scopes: tokenResult.scope
    }, 'X access token obtained');

    // Step 2: Fetch user profile
    logger.info('X callback - fetching user profile');
    const profile = await fetchXUserProfile(tokenResult.accessToken);

    // Ensure profile.id is a string (X API may return it as a number)
    const profileId = String(profile.id);
    
    logger.info({ 
      profileId, 
      profileIdType: typeof profile.id,
      username: profile.username, 
      name: profile.name,
      hasProfileImage: !!profile.profile_image_url
    }, 'Fetched X profile');

    // Step 3: Save as SocialAccount (canPublish = true by default for X)
    logger.info({ brandId: decoded.brandId, profileId }, 'X callback - saving social account');
    const savedAccount = await createOrUpdateFromOAuth(
      {
        brandId: decoded.brandId,
        platform: 'X',
        platformAccountId: profileId,
        displayName: profile.name || null,
        username: profile.username || null, // X API already returns username with @ prefix if needed
        externalAvatarUrl: profile.profile_image_url || null,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || null,
        tokenExpiresAt,
        scopes: tokenResult.scope,
        tokenData: {
          tokenType: tokenResult.tokenType,
        },
        rawProfile: profile,
        canPublish: true, // Explicitly set to true for X
      },
      workspaceId,
      decoded.userId
    );

    logger.info(
      { 
        brandId: decoded.brandId, 
        workspaceId, 
        profileId,
        accountId: savedAccount.id,
        platform: savedAccount.platform,
        username: savedAccount.username,
        displayName: savedAccount.displayName,
        canPublish: savedAccount.canPublish,
        status: savedAccount.status,
      },
      'X OAuth callback completed successfully - account saved'
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
    }, 'X OAuth callback failed');
    
    throw error;
  }
}
