/**
 * YouTube OAuth Service
 * 
 * Handles YouTube OAuth 2.0 flow and creates/updates SocialAccount records
 * for YouTube channels.
 */

import { logger } from '../../../lib/logger.js';
import { youtubeConfig } from '../../../config/youtube.config.js';
import {
  encodeYouTubeState,
  decodeYouTubeState,
  type YouTubeOAuthState,
} from './youtube-state.js';
import { createOrUpdateFromOAuth } from '../social-account.service.js';

// ============================================================================
// OAuth Scopes
// ============================================================================

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
];

// ============================================================================
// Authorize URL Builder
// ============================================================================

/**
 * Build YouTube OAuth authorize URL
 */
export function buildYouTubeAuthorizeUrl(statePayload: YouTubeOAuthState): string {
  const state = encodeYouTubeState(statePayload);

  // Ensure redirect_uri doesn't have query parameters
  const redirectUri = youtubeConfig.redirectUri.split('?')[0];

  const params = new URLSearchParams({
    client_id: youtubeConfig.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline', // Required for refresh token
    include_granted_scopes: 'true',
    prompt: 'consent', // Force consent screen to get refresh token
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ============================================================================
// Token Exchange
// ============================================================================

export interface YouTubeTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope: string[];
  tokenType: string;
}

/**
 * Exchange OAuth code for access token
 */
export async function getYouTubeToken(code: string): Promise<YouTubeTokenResult> {
  logger.debug('Exchanging YouTube OAuth code for access token');

  // Ensure redirect_uri doesn't have query parameters
  const redirectUri = youtubeConfig.redirectUri.split('?')[0];

  const params = new URLSearchParams({
    code,
    client_id: youtubeConfig.clientId,
    client_secret: youtubeConfig.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
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
    }, 'YouTube token exchange failed');
    
    const errorMessage = errorData.error_description || errorData.error || errorData.raw || 'Failed to exchange OAuth code';
    throw new Error(`YouTube token exchange failed: ${errorMessage}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    logger.error({ responseData: data }, 'YouTube token response missing access_token');
    throw new Error('Invalid YouTube token response: missing access_token');
  }
  
  logger.debug({ 
    hasAccessToken: !!data.access_token,
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope
  }, 'YouTube token exchange successful');
  
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresIn: data.expires_in as number | undefined,
    scope: data.scope ? (data.scope as string).split(' ') : [],
    tokenType: data.token_type as string || 'Bearer',
  };
}

// ============================================================================
// Channel Fetch
// ============================================================================

/**
 * Fetch YouTube channels for the authenticated user
 */
export async function fetchYouTubeChannels(accessToken: string): Promise<any[]> {
  logger.debug('Fetching YouTube channels');

  const url = new URL('https://youtube.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,contentDetails,statistics');
  url.searchParams.set('mine', 'true');

  const response = await fetch(url.toString(), {
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
    }, 'YouTube channels fetch failed');
    
    const errorMessage = errorData.error?.message || errorData.message || errorData.raw || 'Failed to fetch YouTube channels';
    throw new Error(`YouTube channels fetch failed: ${errorMessage}`);
  }

  const data = await response.json();
  
  logger.debug({ 
    channelCount: data.items?.length || 0
  }, 'YouTube channels fetched');
  
  return data.items || [];
}

// ============================================================================
// Callback Handler
// ============================================================================

/**
 * Handle YouTube OAuth callback
 * 
 * 1. Decode state to get brandId, workspaceId, userId
 * 2. Exchange code for access token
 * 3. Fetch user's YouTube channels
 * 4. Save each channel as a SocialAccount
 */
export async function handleYouTubeCallback(
  code: string,
  state: string,
  workspaceId: string
): Promise<YouTubeOAuthState> {
  logger.info('YouTube callback - starting OAuth flow');

  // Step 1: Decode state
  const decoded = decodeYouTubeState(state);
  logger.info({ 
    brandId: decoded.brandId, 
    workspaceId: decoded.workspaceId,
    userId: decoded.userId,
    locale: decoded.locale
  }, 'YouTube callback - decoded state');

  // Step 2: Exchange code for token
  logger.info('YouTube callback - exchanging code for token');
  const tokenResult = await getYouTubeToken(code);

  logger.info({ 
    expiresIn: tokenResult.expiresIn, 
    hasRefreshToken: !!tokenResult.refreshToken,
    scopes: tokenResult.scope
  }, 'YouTube access token obtained');

  // Step 3: Fetch channels
  logger.info('YouTube callback - fetching channels');
  const channels = await fetchYouTubeChannels(tokenResult.accessToken);

  if (channels.length === 0) {
    logger.warn('No YouTube channels found for user');
    // Still return decoded state so redirect can happen
    return decoded;
  }

  logger.info({ 
    channelCount: channels.length,
    channelIds: channels.map(c => c.id)
  }, 'Fetched YouTube channels');

  // Step 4: Save each channel as SocialAccount
  logger.info({ brandId: decoded.brandId, channelCount: channels.length }, 'YouTube callback - saving social accounts');
  
  const tokenExpiresAt = tokenResult.expiresIn
    ? new Date(Date.now() + tokenResult.expiresIn * 1000)
    : null;

  for (const channel of channels) {
    const channelId = channel.id as string;
    const snippet = channel.snippet || {};
    const title = snippet.title as string | undefined;
    const customUrl = snippet.customUrl as string | undefined;
    // Remove @ prefix if present (YouTube customUrl may include it)
    const username = customUrl ? customUrl.startsWith('@') ? customUrl.slice(1) : customUrl : null;
    const thumbnails = snippet.thumbnails || {};
    const thumbnailUrl = 
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      null;

    try {
      await createOrUpdateFromOAuth(
        {
          brandId: decoded.brandId,
          platform: 'YOUTUBE',
          platformAccountId: channelId,
          displayName: title || 'YouTube Channel',
          username,
          externalAvatarUrl: thumbnailUrl,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken || null,
          tokenExpiresAt,
          scopes: tokenResult.scope,
          rawProfile: channel,
          tokenData: {
            channelId,
          },
          canPublish: true,
        },
        workspaceId
      );

      logger.debug({ channelId, title }, 'YouTube channel saved as social account');
    } catch (error) {
      logger.error({ error, channelId, title }, 'Failed to save YouTube channel as social account');
      // Continue with other channels even if one fails
    }
  }

  logger.info({ 
    brandId: decoded.brandId,
    savedChannels: channels.length
  }, 'YouTube callback - all channels processed');

  return decoded;
}
