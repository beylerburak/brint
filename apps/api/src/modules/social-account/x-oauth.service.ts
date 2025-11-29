/**
 * X (Twitter) OAuth Service
 * 
 * Handles X OAuth 2.0 with PKCE flow for connecting X accounts.
 * 
 * X API Documentation:
 * - Auth: https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
 * - User lookup: https://developer.twitter.com/en/docs/twitter-api/users/lookup/api-reference/get-users-me
 */

import { randomBytes, createHash } from 'node:crypto';
import { oauthConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface XTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface XUserInfo {
  data: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
    description?: string;
    verified?: boolean;
    public_metrics?: {
      followers_count: number;
      following_count: number;
      tweet_count: number;
      listed_count: number;
    };
  };
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if X OAuth is configured
 */
export function isXOAuthEnabled(): boolean {
  return oauthConfig.x.enabled;
}

/**
 * Generate PKCE code verifier and challenge
 * X requires PKCE for OAuth 2.0
 */
export function generatePKCE(): PKCEChallenge {
  // Generate a random code verifier (43-128 characters)
  const codeVerifier = randomBytes(32)
    .toString('base64url')
    .slice(0, 64);

  // Create code challenge using SHA256
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Generate X authorization URL
 */
export function generateXAuthUrl(state: string, codeChallenge: string): string {
  const { clientId, authBaseUrl, scopes, redirectUri } = oauthConfig.x;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${authBaseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeXCode(code: string, codeVerifier: string): Promise<XTokenResponse> {
  const { clientId, clientSecret, tokenUrl, redirectUri } = oauthConfig.x;

  // X requires Basic auth for confidential clients
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'X token exchange failed');
    throw new Error(`X token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data as XTokenResponse;
}

/**
 * Refresh X access token
 */
export async function refreshXToken(refreshToken: string): Promise<XTokenResponse> {
  const { clientId, clientSecret, tokenUrl } = oauthConfig.x;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'X token refresh failed');
    throw new Error(`X token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data as XTokenResponse;
}

/**
 * Get X user info
 */
export async function getXUserInfo(accessToken: string): Promise<XUserInfo> {
  const { userInfoUrl } = oauthConfig.x;

  const response = await fetch(`${userInfoUrl}?user.fields=id,name,username,profile_image_url,description,verified,public_metrics`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'X user info request failed');
    throw new Error(`X user info failed: ${error}`);
  }

  const data = await response.json();
  return data as XUserInfo;
}

