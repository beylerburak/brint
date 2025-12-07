/**
 * LinkedIn OAuth Service
 * 
 * Handles LinkedIn OAuth flow and creates/updates SocialAccount records
 * for both LinkedIn member profiles and organization pages.
 */

import { logger } from '../../../lib/logger.js';
import { linkedinConfig } from '../../../config/linkedin.config.js';
import { encodeLinkedInState, decodeLinkedInState, type LinkedInOAuthState } from './linkedin-state.js';
import { createOrUpdateFromOAuth } from '../social-account.service.js';
import type { SocialPlatform } from '@prisma/client';

// ============================================================================
// OAuth Scopes
// ============================================================================

// LinkedIn OAuth Scopes
// Based on working implementation that successfully fetches organizations
// Note: These scopes work without Community Management API product
export const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social', // Create posts on member's behalf
  'r_organization_social', // Read organization posts and engagement
  'w_organization_social', // Create posts on organization's behalf
  'r_organization_admin', // Retrieve organization pages and reporting data
];

// ============================================================================
// Authorize URL Builder
// ============================================================================

/**
 * Build LinkedIn OAuth authorize URL
 */
export function buildLinkedInAuthorizeUrl(statePayload: LinkedInOAuthState): string {
  const state = encodeLinkedInState(statePayload);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: linkedinConfig.clientId,
    redirect_uri: linkedinConfig.redirectUri,
    state,
    scope: LINKEDIN_SCOPES.join(' '),
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

// ============================================================================
// Token Exchange
// ============================================================================

/**
 * Exchange OAuth code for access token
 */
export async function getLinkedInToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  logger.debug('Exchanging LinkedIn OAuth code for access token');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: linkedinConfig.redirectUri,
    client_id: linkedinConfig.clientId,
    client_secret: linkedinConfig.clientSecret,
  });

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error({ status: response.status, errorData }, 'LinkedIn token exchange failed');
    throw new Error(errorData.error_description || 'Failed to exchange OAuth code');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
  };
}

// ============================================================================
// Profile & Organizations Fetch
// ============================================================================

/**
 * Fetch LinkedIn user profile
 */
export async function fetchLinkedInProfile(accessToken: string): Promise<any> {
  logger.debug('Fetching LinkedIn user profile');

  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error({ status: response.status, errorData }, 'LinkedIn profile fetch failed');
    throw new Error('Failed to fetch LinkedIn profile');
  }

  return response.json();
}

/**
 * Fetch LinkedIn organizations user is admin of
 * 
 * Uses organizationAcls endpoint with projection to get all data in one call
 * Based on working implementation that doesn't require Community Management API
 */
export async function fetchLinkedInOrganizations(accessToken: string): Promise<any[]> {
  logger.debug('Fetching LinkedIn organizations');

  try {
    // Use organizationAcls with projection to get organization details in one call
    // This approach works without Community Management API product
    const apiUrl = `https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(roleAssignee,organization~(id,localizedName,vanityName,logoV2~(original,cropped)),role,state))`;

    logger.debug({ apiUrl }, 'Fetching organizations with projection');

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202311',
      },
    });

    const data = await response.json();
    logger.debug({ status: response.status, elementCount: data.elements?.length }, 'Organization ACLs response');

    if (!response.ok) {
      const errorMsg = data.message || data.error?.message || JSON.stringify(data);
      logger.warn(
        { 
          status: response.status, 
          statusText: response.statusText,
          error: errorMsg
        }, 
        'LinkedIn organization ACLs fetch failed'
      );

      // If 403 or 401, it might be scope-related
      if (response.status === 403 || response.status === 401) {
        logger.warn('This error may be due to missing organization scopes');
      }

      return [];
    }

    if (data.error) {
      logger.warn({ error: data.error }, 'Organizations API returned error');
      return [];
    }

    if (!data.elements || data.elements.length === 0) {
      logger.info('No LinkedIn organizations found for user');
      return [];
    }

    // Filter: Only ADMINISTRATOR or DIRECT_SPONSORED_CONTENT_POSTER roles with APPROVED state
    const filteredOrgs = data.elements
      .filter((element: any) => {
        const role = element.role;
        const state = element.state;
        return (
          (role === 'ADMINISTRATOR' || role === 'DIRECT_SPONSORED_CONTENT_POSTER') &&
          state === 'APPROVED'
        );
      })
      .map((element: any) => {
        const org = element['organization~'];
        if (!org || !org.id) {
          logger.warn({ element }, 'Organization info missing in element');
          return null;
        }

        const orgId = org.id.toString();

        return {
          id: orgId,
          localizedName: org.localizedName || org.name || 'Unnamed Organization',
          vanityName: org.vanityName || null,
          logoV2: org.logoV2 || null,
          role: element.role,
          state: element.state,
        };
      })
      .filter((org: any) => org !== null);

    logger.debug({ count: filteredOrgs.length }, 'Filtered organizations');

    // Process logo URLs for each organization
    const organizations = await Promise.all(
      filteredOrgs.map(async (org: any) => {
        let logoUrl: string | null = null;

        // Try to get logo URL from logoV2
        if (org.logoV2) {
          try {
            let logoUrn: string | null = null;

            // Try original first, then cropped
            if (org.logoV2.original) {
              if (typeof org.logoV2.original === 'string') {
                logoUrn = org.logoV2.original;
              } else if (org.logoV2.original.id) {
                logoUrn = org.logoV2.original.id;
              } else if (org.logoV2.original.urn) {
                logoUrn = org.logoV2.original.urn;
              }
            } else if (org.logoV2.cropped) {
              if (typeof org.logoV2.cropped === 'string') {
                logoUrn = org.logoV2.cropped;
              } else if (org.logoV2.cropped.id) {
                logoUrn = org.logoV2.cropped.id;
              } else if (org.logoV2.cropped.urn) {
                logoUrn = org.logoV2.cropped.urn;
              }
            }

            if (logoUrn) {
              // Get download URL from images endpoint
              const logoImageUrl = `https://api.linkedin.com/rest/images/${encodeURIComponent(logoUrn)}?fields=downloadUrl`;

              const logoImageResponse = await fetch(logoImageUrl, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'LinkedIn-Version': '202311',
                },
              });

              if (logoImageResponse.ok) {
                const logoImage = await logoImageResponse.json();
                if (logoImage.downloadUrl) {
                  logoUrl = logoImage.downloadUrl;
                  logger.debug({ orgId: org.id, logoUrl }, 'Logo URL fetched');
                }
              } else {
                logger.debug({ orgId: org.id, status: logoImageResponse.status }, 'Failed to fetch logo image');
              }
            }
          } catch (error) {
            logger.warn({ error, orgId: org.id }, 'Error extracting logo URL');
          }
        }

        return {
          id: org.id,
          localizedName: org.localizedName,
          vanityName: org.vanityName,
          logoUrl,
        };
      })
    );

    logger.info({ count: organizations.length }, 'Successfully fetched LinkedIn organizations');
    return organizations;
  } catch (error) {
    logger.error(
      { error, errorMessage: error instanceof Error ? error.message : 'Unknown error' },
      'Failed to fetch LinkedIn organizations'
    );
    return [];
  }
}

// ============================================================================
// Save Accounts
// ============================================================================

/**
 * Save LinkedIn member profile as SocialAccount
 */
export async function saveLinkedInMemberProfile(
  brandId: string,
  workspaceId: string,
  userId: string,
  profile: any,
  accessToken: string,
  expiresIn: number
): Promise<void> {
  const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : undefined;

  await createOrUpdateFromOAuth(
    {
      brandId,
      platform: 'LINKEDIN',
      platformAccountId: profile.sub || profile.id || String(profile.id),
      displayName: profile.name || null,
      username: profile.preferred_username || null,
      externalAvatarUrl: profile.picture || null,
      accessToken,
      refreshToken: null,
      tokenExpiresAt,
      scopes: LINKEDIN_SCOPES,
      tokenData: {
        kind: 'member',
      },
      rawProfile: profile,
    },
    workspaceId,
    userId
  );

  logger.info({ brandId, platformAccountId: profile.sub }, 'LinkedIn member profile saved');
}

/**
 * Save LinkedIn organizations as SocialAccount records
 */
export async function saveLinkedInOrganizations(
  brandId: string,
  workspaceId: string,
  userId: string,
  organizations: any[],
  accessToken: string,
  expiresIn: number
): Promise<void> {
  const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : undefined;

  logger.info({ orgCount: organizations.length, brandId, workspaceId }, 'Saving LinkedIn organizations');

  for (const org of organizations) {
    const orgId = String(org.id);
    const name = org.localizedName || null;
    const vanityName = org.vanityName || null;
    const logoUrl = org.logoUrl || null;

    try {
      logger.info({ orgId, name, brandId, workspaceId }, 'Creating/updating LinkedIn organization account');
      
      await createOrUpdateFromOAuth(
        {
          brandId,
          platform: 'LINKEDIN',
          platformAccountId: orgId,
          displayName: name,
          username: vanityName,
          externalAvatarUrl: logoUrl,
          accessToken,
          refreshToken: null,
          tokenExpiresAt,
          scopes: LINKEDIN_SCOPES,
          tokenData: {
            kind: 'organization',
          },
          rawProfile: org,
        },
        workspaceId,
        userId
      );

      logger.info({ brandId, orgId, name }, 'LinkedIn organization saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error({ 
        error, 
        orgId, 
        name,
        brandId,
        workspaceId,
        errorMessage,
        errorStack,
        orgData: {
          id: org.id,
          localizedName: org.localizedName,
          vanityName: org.vanityName,
          logoUrl: org.logoUrl
        }
      }, 'Failed to save LinkedIn organization');
      
      // Re-throw with more context
      throw new Error(`Failed to save LinkedIn organization "${name || orgId}" (ID: ${orgId}): ${errorMessage}`);
    }
  }
}

// ============================================================================
// Callback Handler
// ============================================================================

/**
 * Handle LinkedIn OAuth callback
 * 
 * Flow:
 * 1. Exchange code for access token
 * 2. Fetch user profile and organizations in parallel
 * 3. Save member profile as SocialAccount (canPublish = false)
 * 4. Save organizations as SocialAccount records (canPublish = false)
 */
export async function handleLinkedInCallback(
  code: string,
  state: string,
  workspaceId: string
): Promise<LinkedInOAuthState> {
  logger.info({ workspaceId }, 'Handling LinkedIn OAuth callback');

  // Decode state to get brandId, workspaceId, userId
  const decoded = decodeLinkedInState(state);
  
  // Verify workspaceId matches
  if (decoded.workspaceId !== workspaceId) {
    throw new Error('Workspace ID mismatch in OAuth state');
  }

  try {
    // Step 1: Exchange code for access token
    logger.debug('Exchanging OAuth code for access token');
    const { accessToken, expiresIn } = await getLinkedInToken(code);
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

    logger.info({ expiresIn, tokenExpiresAt }, 'LinkedIn access token obtained');

    // Step 2: Fetch profile (always fetch)
    logger.debug('Fetching LinkedIn profile');
    const profile = await fetchLinkedInProfile(accessToken);

    logger.info({ profileId: profile.sub }, 'Fetched LinkedIn profile');

    // Step 2.5: Fetch organizations (optional, but store in tokenData for later use)
    let organizations: any[] = [];
    try {
      organizations = await fetchLinkedInOrganizations(accessToken);
      logger.info({ orgCount: organizations.length }, 'Fetched LinkedIn organizations');
    } catch (orgError) {
      logger.warn({ error: orgError }, 'Failed to fetch organizations during callback (will retry during selection)');
      // Don't fail the callback if orgs fail - user can still select member profile
    }

    // Step 3: Save token temporarily as a pending account (for user selection)
    // We'll save it with a special platformAccountId so we can identify it later
    // tokenExpiresAt is already defined above (line 399)
    
    // Save token as a temporary "pending" account that will be used to fetch accounts for selection
    await createOrUpdateFromOAuth(
      {
        brandId: decoded.brandId,
        platform: 'LINKEDIN',
        platformAccountId: `pending_${decoded.userId}_${Date.now()}`, // Temporary ID
        displayName: 'LinkedIn (Pending Selection)',
        username: null,
        externalAvatarUrl: null,
        accessToken,
        refreshToken: null,
        tokenExpiresAt,
        scopes: LINKEDIN_SCOPES,
        tokenData: {
          kind: 'pending',
          profile: profile, // Store profile data temporarily
          organizations: organizations, // Store organizations for later use
        },
        rawProfile: profile,
        canPublish: false, // Will be set after user selection
      },
      workspaceId,
      decoded.userId
    );

    logger.info(
      { brandId: decoded.brandId, workspaceId },
      'LinkedIn OAuth callback completed - token saved for user selection'
    );

    return decoded;
  } catch (error) {
    logger.error({ error, workspaceId }, 'LinkedIn OAuth callback failed');
    throw error;
  }
}
