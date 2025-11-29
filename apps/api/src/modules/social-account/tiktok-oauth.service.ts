/**
 * TikTok OAuth Service
 * 
 * Handles TikTok OAuth 2.0 flow for connecting TikTok Business accounts.
 * 
 * TikTok API Documentation:
 * - Auth: https://developers.tiktok.com/doc/login-kit-web
 * - User Info: https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
 */

import { oauthConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: string;
}

export interface TikTokUserInfo {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  avatar_url_100?: string;
  avatar_large_url?: string;
  display_name?: string;
  bio_description?: string;
  profile_deep_link?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

export interface TikTokUserInfoResponse {
  data: {
    user: TikTokUserInfo;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if TikTok OAuth is configured
 */
export function isTikTokOAuthEnabled(): boolean {
  return oauthConfig.tiktok.enabled;
}

/**
 * Generate TikTok authorization URL
 */
export function generateTikTokAuthUrl(state: string): string {
  const { clientKey, authBaseUrl, scopes, redirectUri } = oauthConfig.tiktok;

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: scopes.join(','),
    redirect_uri: redirectUri,
    state,
  });

  return `${authBaseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeTikTokCode(code: string): Promise<TikTokTokenResponse> {
  const { clientKey, clientSecret, tokenUrl, redirectUri } = oauthConfig.tiktok;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'TikTok token exchange failed');
    throw new Error(`TikTok token exchange failed: ${error}`);
  }

  const data = await response.json();
  
  if (data.error && data.error.code !== 'ok') {
    logger.error({ error: data.error }, 'TikTok token exchange error');
    throw new Error(`TikTok token error: ${data.error.message}`);
  }

  return data as TikTokTokenResponse;
}

/**
 * Refresh TikTok access token
 */
export async function refreshTikTokToken(refreshToken: string): Promise<TikTokTokenResponse> {
  const { clientKey, clientSecret, tokenUrl } = oauthConfig.tiktok;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'TikTok token refresh failed');
    throw new Error(`TikTok token refresh failed: ${error}`);
  }

  const data = await response.json();

  if (data.error && data.error.code !== 'ok') {
    logger.error({ error: data.error }, 'TikTok token refresh error');
    throw new Error(`TikTok token error: ${data.error.message}`);
  }

  return data as TikTokTokenResponse;
}

/**
 * Get TikTok user info
 */
export async function getTikTokUserInfo(accessToken: string): Promise<TikTokUserInfo> {
  const { userInfoUrl } = oauthConfig.tiktok;

  // Request only basic fields (user.info.basic scope)
  // Additional fields require user.info.profile and user.info.stats scopes
  const fields = [
    'open_id',
    'avatar_url',
    'display_name',
  ].join(',');

  const url = `${userInfoUrl}?fields=${fields}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'TikTok user info request failed');
    throw new Error(`TikTok user info failed: ${error}`);
  }

  const data = (await response.json()) as TikTokUserInfoResponse;

  if (data.error && data.error.code !== 'ok') {
    logger.error({ error: data.error }, 'TikTok user info error');
    throw new Error(`TikTok user info error: ${data.error.message}`);
  }

  return data.data.user;
}

