/**
 * LinkedIn OAuth Service
 * 
 * Handles LinkedIn OAuth 2.0 flow for connecting LinkedIn Pages.
 * 
 * LinkedIn API Documentation:
 * - Auth: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 * - User Info: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */

import { oauthConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
  token_type: string;
}

export interface LinkedInUserInfo {
  sub: string; // LinkedIn member ID (URN format)
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: {
    country: string;
    language: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if LinkedIn OAuth is configured
 */
export function isLinkedInOAuthEnabled(): boolean {
  return oauthConfig.linkedin.enabled;
}

/**
 * Generate LinkedIn authorization URL
 */
export function generateLinkedInAuthUrl(state: string): string {
  const { clientId, authBaseUrl, scopes, redirectUri } = oauthConfig.linkedin;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(' '),
  });

  return `${authBaseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret, tokenUrl, redirectUri } = oauthConfig.linkedin;

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
    logger.error({ status: response.status, error }, 'LinkedIn token exchange failed');
    throw new Error(`LinkedIn token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data as LinkedInTokenResponse;
}

/**
 * Refresh LinkedIn access token
 */
export async function refreshLinkedInToken(refreshToken: string): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret, tokenUrl } = oauthConfig.linkedin;

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
    logger.error({ status: response.status, error }, 'LinkedIn token refresh failed');
    throw new Error(`LinkedIn token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data as LinkedInTokenResponse;
}

/**
 * Get LinkedIn user info (OpenID Connect)
 */
export async function getLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const { userInfoUrl } = oauthConfig.linkedin;

  const response = await fetch(userInfoUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'LinkedIn user info request failed');
    throw new Error(`LinkedIn user info failed: ${error}`);
  }

  const data = await response.json();
  return data as LinkedInUserInfo;
}

/**
 * Extract member ID from LinkedIn URN
 * LinkedIn returns member ID in format: "urn:li:person:ABC123"
 */
export function extractMemberIdFromUrn(urn: string): string {
  const parts = urn.split(':');
  return parts[parts.length - 1];
}

