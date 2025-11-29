/**
 * Facebook OAuth Service for Social Account Connection
 * 
 * Handles Facebook/Instagram OAuth flow for connecting pages and business accounts.
 * NOT for user authentication - only for social account integration.
 */

import { oauthConfig, appUrlConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  picture?: {
    data: {
      url: string;
    };
  };
  instagram_business_account?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
  };
}

export interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

export interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookUserResponse {
  id: string;
  name?: string;
  email?: string;
}

export interface InstagramBusinessAccount {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
  biography?: string;
  website?: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
}

// ============================================================================
// OAuth URL Generation
// ============================================================================

/**
 * Generate Facebook OAuth authorization URL
 */
export function generateFacebookAuthUrl(params: {
  brandId: string;
  workspaceId: string;
  state: string;
}): string {
  const { brandId, workspaceId, state } = params;

  // Redirect URI - backend callback endpoint
  const redirectUri = `${appUrlConfig.baseUrl}/v1/social-accounts/oauth/facebook/callback`;

  const urlParams = new URLSearchParams({
    client_id: oauthConfig.facebook.appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: oauthConfig.facebook.scopes.join(','),
    state,
  });

  return `${oauthConfig.facebook.authBaseUrl}?${urlParams.toString()}`;
}

// ============================================================================
// Token Exchange
// ============================================================================

/**
 * Exchange authorization code for access token
 */
export async function exchangeFacebookCode(code: string): Promise<FacebookTokenResponse> {
  const redirectUri = `${appUrlConfig.baseUrl}/v1/social-accounts/oauth/facebook/callback`;

  const params = new URLSearchParams({
    client_id: oauthConfig.facebook.appId,
    client_secret: oauthConfig.facebook.appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${oauthConfig.facebook.tokenUrl}?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'Facebook token exchange failed');
    throw new Error(`Facebook token exchange failed: ${response.status}`);
  }

  const data = await response.json() as FacebookTokenResponse;
  return data;
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<FacebookTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: oauthConfig.facebook.appId,
    client_secret: oauthConfig.facebook.appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(`${oauthConfig.facebook.tokenUrl}?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'Facebook long-lived token exchange failed');
    throw new Error(`Failed to get long-lived token: ${response.status}`);
  }

  return await response.json() as FacebookTokenResponse;
}

// ============================================================================
// Graph API Calls
// ============================================================================

/**
 * Get current user info
 */
export async function getFacebookUser(accessToken: string): Promise<FacebookUserResponse> {
  const response = await fetch(
    `${oauthConfig.facebook.graphApiUrl}/me?fields=id,name,email&access_token=${accessToken}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'Facebook user fetch failed');
    throw new Error(`Failed to get Facebook user: ${response.status}`);
  }

  return await response.json() as FacebookUserResponse;
}

/**
 * Get Facebook Pages the user manages
 * Also includes linked Instagram Business accounts
 */
export async function getFacebookPages(accessToken: string): Promise<FacebookPage[]> {
  const fields = [
    'id',
    'name',
    'access_token',
    'category',
    'picture',
    'instagram_business_account{id,username,name,profile_picture_url}',
  ].join(',');

  const response = await fetch(
    `${oauthConfig.facebook.graphApiUrl}/me/accounts?fields=${fields}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'Facebook pages fetch failed');
    throw new Error(`Failed to get Facebook pages: ${response.status}`);
  }

  const data = await response.json() as FacebookPagesResponse;
  return data.data || [];
}

/**
 * Get Instagram Business Account details
 */
export async function getInstagramBusinessAccount(
  instagramAccountId: string,
  pageAccessToken: string
): Promise<{
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
  biography?: string;
  website?: string;
}> {
  const fields = [
    'id',
    'username',
    'name',
    'profile_picture_url',
    'followers_count',
    'media_count',
    'biography',
    'website',
  ].join(',');

  const response = await fetch(
    `${oauthConfig.facebook.graphApiUrl}/${instagramAccountId}?fields=${fields}&access_token=${pageAccessToken}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'Instagram account fetch failed');
    throw new Error(`Failed to get Instagram account: ${response.status}`);
  }

  return await response.json();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract Instagram Business accounts from Facebook Pages
 */
export function extractInstagramAccounts(pages: FacebookPage[]): InstagramBusinessAccount[] {
  const instagramAccounts: InstagramBusinessAccount[] = [];

  for (const page of pages) {
    if (page.instagram_business_account) {
      instagramAccounts.push({
        id: page.instagram_business_account.id,
        username: page.instagram_business_account.username,
        name: page.instagram_business_account.name,
        profile_picture_url: page.instagram_business_account.profile_picture_url,
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
      });
    }
  }

  return instagramAccounts;
}

/**
 * Check if Facebook OAuth is configured
 */
export function isFacebookOAuthEnabled(): boolean {
  return oauthConfig.facebook.enabled;
}

