/**
 * YouTube OAuth Service
 * 
 * Handles Google OAuth 2.0 flow for connecting YouTube channels.
 * 
 * YouTube API Documentation:
 * - Auth: https://developers.google.com/identity/protocols/oauth2
 * - Channels: https://developers.google.com/youtube/v3/docs/channels
 */

import { oauthConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface YouTubeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    thumbnails: {
      default?: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      high?: { url: string; width: number; height: number };
    };
  };
  statistics?: {
    viewCount: string;
    subscriberCount: string;
    hiddenSubscriberCount: boolean;
    videoCount: string;
  };
}

export interface YouTubeChannelsResponse {
  kind: string;
  etag: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeChannel[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if YouTube OAuth is configured
 */
export function isYouTubeOAuthEnabled(): boolean {
  return oauthConfig.youtube.enabled;
}

/**
 * Generate YouTube/Google authorization URL
 */
export function generateYouTubeAuthUrl(state: string): string {
  const { clientId, authBaseUrl, scopes, redirectUri } = oauthConfig.youtube;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return `${authBaseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeYouTubeCode(code: string): Promise<YouTubeTokenResponse> {
  const { clientId, clientSecret, tokenUrl, redirectUri } = oauthConfig.youtube;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'YouTube token exchange failed');
    throw new Error(`YouTube token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data as YouTubeTokenResponse;
}

/**
 * Refresh YouTube access token
 */
export async function refreshYouTubeToken(refreshToken: string): Promise<YouTubeTokenResponse> {
  const { clientId, clientSecret, tokenUrl } = oauthConfig.youtube;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'YouTube token refresh failed');
    throw new Error(`YouTube token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data as YouTubeTokenResponse;
}

/**
 * Get YouTube channels for authenticated user
 */
export async function getYouTubeChannels(accessToken: string): Promise<YouTubeChannel[]> {
  const { channelsUrl } = oauthConfig.youtube;

  const params = new URLSearchParams({
    part: 'snippet,statistics',
    mine: 'true',
  });

  const response = await fetch(`${channelsUrl}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'YouTube channels request failed');
    throw new Error(`YouTube channels failed: ${error}`);
  }

  const data = await response.json() as YouTubeChannelsResponse;
  return data.items || [];
}

