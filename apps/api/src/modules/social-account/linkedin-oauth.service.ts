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

export interface LinkedInOrganizationAcl {
  organization: string; // URN format: "urn:li:organization:123456"
  role: 'ADMINISTRATOR' | 'ADMIN' | 'CONTENT_ADMIN' | 'SPONSORED_CONTENT_ADMIN';
  state: 'APPROVED' | 'PENDING';
}

export interface LinkedInOrganizationAclsResponse {
  elements: LinkedInOrganizationAcl[];
}

export interface LinkedInOrganization {
  id: number;
  name: {
    localized: {
      [key: string]: string;
    };
    preferredLocale: {
      country: string;
      language: string;
    };
  };
  vanityName?: string;
  logoV2?: {
    original?: string;
    'original~'?: {
      playableStreams?: Array<{
        playableStream?: Array<{
          downloadUrl?: string;
        }>;
      }>;
    };
    'cropped~'?: {
      elements?: Array<{
        identifiers?: Array<{
          identifier?: string;
        }>;
      }>;
    };
  };
  website?: {
    url: string;
  };
}

export interface LinkedInOrganizationsResponse {
  elements: LinkedInOrganization[];
}

export interface LinkedInDigitalMediaAsset {
  id: string;
  downloadUrl?: string;
  downloadUrlExpiresAt?: number;
  status?: string;
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

/**
 * Extract organization ID from LinkedIn URN
 * LinkedIn returns organization ID in format: "urn:li:organization:123456"
 */
export function extractOrganizationIdFromUrn(urn: string): string {
  const parts = urn.split(':');
  return parts[parts.length - 1];
}

/**
 * Get organization ACLs (Access Control Lists) for the authenticated user
 * Returns organizations the user has access to
 * 
 * LinkedIn API Documentation:
 * https://learn.microsoft.com/en-us/linkedin/compliance/integrations/organizations/organization-access-control
 * 
 * Required query parameters:
 * - q=roleAssignee: Filter by role assignee (the authenticated user)
 * - role=ADMINISTRATOR: Filter by role (optional, but recommended)
 * - state=APPROVED: Filter by approval state (optional, but recommended)
 */
export async function getLinkedInOrganizationAcls(accessToken: string): Promise<LinkedInOrganizationAcl[]> {
  const { organizationsUrl } = oauthConfig.linkedin;

  // LinkedIn RESTli API format - MUST use q=roleAssignee query parameter
  // Format: /v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED
  const url = `${organizationsUrl}?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization,role,state))`;

  logger.debug({ url }, 'Fetching LinkedIn organization ACLs');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ 
      status: response.status, 
      statusText: response.statusText,
      error: errorText,
      url 
    }, 'LinkedIn organization ACLs request failed');
    
    // If user doesn't have organization access, return empty array instead of throwing
    if (response.status === 403 || response.status === 401 || response.status === 404) {
      logger.warn({ 
        status: response.status,
        error: errorText 
      }, 'LinkedIn organization ACLs not accessible - user may not have organization permissions, w_organization_social scope, or Marketing Developer Platform product enabled');
      return [];
    }
    throw new Error(`LinkedIn organization ACLs failed: ${errorText}`);
  }

  const data = await response.json() as LinkedInOrganizationAclsResponse;
  logger.debug({ count: data.elements?.length || 0 }, 'LinkedIn organization ACLs fetched');
  
  // Filter is already done by query params, but double-check
  const approvedAcls = data.elements?.filter(acl => 
    acl.state === 'APPROVED' && 
    (acl.role === 'ADMINISTRATOR' || acl.role === 'ADMIN' || acl.role === 'CONTENT_ADMIN' || acl.role === 'SPONSORED_CONTENT_ADMIN')
  ) || [];
  logger.debug({ approvedCount: approvedAcls.length }, 'LinkedIn approved organization ACLs');
  
  return approvedAcls;
}

/**
 * Get download URL from LinkedIn digital media asset URN
 */
async function getLinkedInDigitalMediaAssetUrl(
  accessToken: string,
  assetUrn: string
): Promise<string | null> {
  if (!assetUrn.startsWith('urn:li:digitalmediaAsset:')) {
    return null;
  }

  try {
    // Extract asset ID from URN
    const assetId = assetUrn.replace('urn:li:digitalmediaAsset:', '');
    const digitalMediaAssetsUrl = 'https://api.linkedin.com/v2/digitalMediaAssets';
    const assetUrl = `${digitalMediaAssetsUrl}/${assetId}?projection=(downloadUrl)`;
    
    logger.debug({ assetId, assetUrl }, 'Fetching LinkedIn digital media asset URL');

    const assetResponse = await fetch(assetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!assetResponse.ok) {
      const errorText = await assetResponse.text();
      logger.warn({ 
        status: assetResponse.status, 
        error: errorText,
        assetId 
      }, 'Failed to fetch LinkedIn digital media asset URL');
      return null;
    }

    const assetData = await assetResponse.json() as LinkedInDigitalMediaAsset;
    if (assetData.downloadUrl) {
      logger.debug({ assetId, downloadUrl: assetData.downloadUrl }, 'LinkedIn digital media asset URL fetched');
      return assetData.downloadUrl;
    }
    
    return null;
  } catch (err) {
    logger.warn({ error: err, assetUrn }, 'Error fetching LinkedIn digital media asset URL');
    return null;
  }
}

/**
 * Get organization details by organization URNs
 * 
 * LinkedIn RESTli API doesn't support List in path parameters
 * We need to fetch each organization individually
 * Format: /v2/organizations/{id}
 */
export async function getLinkedInOrganizations(
  accessToken: string,
  organizationUrns: string[]
): Promise<LinkedInOrganization[]> {
  if (organizationUrns.length === 0) {
    return [];
  }

  const { organizationDetailsUrl } = oauthConfig.linkedin;

  // Extract numeric IDs from URNs
  // URN format: "urn:li:organization:123456" -> extract "123456"
  const organizationIds = organizationUrns.map(urn => extractOrganizationIdFromUrn(urn));
  
  // Fetch each organization individually
  // LinkedIn RESTli API doesn't support batch requests in path parameters
  // Use proper projection format for logo - LinkedIn RESTli requires specific format
  const organizationPromises = organizationIds.map(async (orgId) => {
    // Projection format for LinkedIn RESTli API
    // logoV2 with both original and cropped variants
    // Format: logoV2(original~:playableStreams,cropped~:elements(identifiers~:elements(identifier)))
    const url = `${organizationDetailsUrl}/${orgId}?projection=(id,name,vanityName,logoV2(original~:playableStreams,cropped~:elements(identifiers~:elements(identifier))),website)`;
    
    logger.debug({ url, orgId }, 'Fetching individual LinkedIn organization');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn({ 
        status: response.status, 
        statusText: response.statusText,
        error: errorText,
        url,
        orgId 
      }, 'Failed to fetch individual LinkedIn organization');
      return null;
    }

    const data = await response.json() as LinkedInOrganization;
    logger.debug({ orgId, hasLogo: !!data.logoV2, logoData: data.logoV2 }, 'LinkedIn organization fetched');
    
    // If logoV2 contains a URN (digitalmediaAsset), fetch the actual URL
    if (data.logoV2) {
      // Check if we have a URN in cropped or original
      let logoUrn: string | undefined;
      
      // Try to get URN from cropped logo
      if (data.logoV2['cropped~']?.elements?.[0]?.identifiers?.[0]?.identifier) {
        logoUrn = data.logoV2['cropped~'].elements[0].identifiers[0].identifier;
      }
      // Try original playableStreams
      else if (data.logoV2['original~']?.playableStreams?.[0]?.playableStream?.[0]?.downloadUrl) {
        logoUrn = data.logoV2['original~'].playableStreams[0].playableStream[0].downloadUrl;
      }
      // Try direct original field
      else if (data.logoV2.original) {
        logoUrn = data.logoV2.original;
      }
      
      // If we have a URN, fetch the actual download URL
      if (logoUrn && logoUrn.startsWith('urn:li:digitalmediaAsset:')) {
        const downloadUrl = await getLinkedInDigitalMediaAssetUrl(accessToken, logoUrn);
        if (downloadUrl) {
          // Replace URN with actual URL in the data structure
          if (data.logoV2['cropped~']?.elements?.[0]?.identifiers?.[0]) {
            data.logoV2['cropped~'].elements[0].identifiers[0].identifier = downloadUrl;
          } else if (data.logoV2.original) {
            data.logoV2.original = downloadUrl;
          }
        }
      }
    }
    
    return data;
  });

  // Wait for all requests to complete
  const results = await Promise.all(organizationPromises);
  
  // Filter out null results (failed requests)
  const organizations = results.filter((org): org is LinkedInOrganization => org !== null);
  
  logger.debug({ 
    requested: organizationIds.length, 
    fetched: organizations.length 
  }, 'LinkedIn organizations fetched');
  
  return organizations;
}

