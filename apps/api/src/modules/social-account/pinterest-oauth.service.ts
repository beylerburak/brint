/**
 * Pinterest OAuth Service
 * 
 * Handles Pinterest OAuth 2.0 flow for connecting Pinterest profiles.
 * 
 * Pinterest API Documentation:
 * - Auth: https://developers.pinterest.com/docs/getting-started/authentication/
 * - User Account: https://developers.pinterest.com/docs/api/v5/#tag/user_account
 */

import { oauthConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface PinterestTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export interface PinterestUserInfo {
  username: string;
  account_type: 'BUSINESS' | 'PINNER';
  profile_image?: string;
  website_url?: string;
  business_name?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if Pinterest OAuth is configured
 */
export function isPinterestOAuthEnabled(): boolean {
  return oauthConfig.pinterest.enabled;
}

/**
 * Generate Pinterest authorization URL
 */
export function generatePinterestAuthUrl(state: string): string {
  const { appId, authBaseUrl, scopes, redirectUri } = oauthConfig.pinterest;

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(','),
    state,
  });

  return `${authBaseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangePinterestCode(code: string): Promise<PinterestTokenResponse> {
  const { appId, appSecret, tokenUrl, redirectUri } = oauthConfig.pinterest;

  // Pinterest requires Basic auth
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');

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
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'Pinterest token exchange failed');
    throw new Error(`Pinterest token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data as PinterestTokenResponse;
}

/**
 * Refresh Pinterest access token
 */
export async function refreshPinterestToken(refreshToken: string): Promise<PinterestTokenResponse> {
  const { appId, appSecret, tokenUrl } = oauthConfig.pinterest;

  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');

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
    logger.error({ status: response.status, error }, 'Pinterest token refresh failed');
    throw new Error(`Pinterest token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data as PinterestTokenResponse;
}

/**
 * Get Pinterest user info
 */
export async function getPinterestUserInfo(accessToken: string): Promise<PinterestUserInfo> {
  const { userInfoUrl } = oauthConfig.pinterest;

  const response = await fetch(userInfoUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'Pinterest user info request failed');
    throw new Error(`Pinterest user info failed: ${error}`);
  }

  const data = await response.json();
  return data as PinterestUserInfo;
}

