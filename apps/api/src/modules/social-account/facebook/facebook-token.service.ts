/**
 * Facebook Token Service
 *
 * Handles Facebook access token validation, refresh, and expiration checks.
 * Automatically refreshes tokens when needed without user interaction.
 */

import { PrismaClient, SocialAccount } from "@prisma/client";
import { logger } from "../../../lib/logger.js";
import { facebookConfig } from "../../../config/facebook.config.js";
import { graphRequest, graphBaseUrl } from "./facebook-client.js";
import axios from "axios";

const prisma = new PrismaClient();

/**
 * Check if token is expired or will expire soon (within 7 days)
 */
export function isTokenExpiredOrExpiringSoon(socialAccount: SocialAccount): boolean {
  if (!socialAccount.tokenExpiresAt) {
    // No expiration date - assume it's valid (long-lived token)
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(socialAccount.tokenExpiresAt);
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  // Token is expired or will expire within 7 days
  return daysUntilExpiry <= 7;
}

/**
 * Validate Facebook access token by making a test API call
 */
export async function validateFacebookToken(
  accessToken: string,
  pageId?: string
): Promise<{ valid: boolean; error?: string; expiresAt?: Date }> {
  try {
    // Test token by fetching page info or user info
    const endpoint = pageId ? `/${pageId}` : "/me";
    const response = await axios.get(`${graphBaseUrl}${endpoint}`, {
      params: {
        fields: "id,name",
        access_token: accessToken,
      },
      timeout: 10000,
    });

    if (response.data?.error) {
      return {
        valid: false,
        error: response.data.error.message || "Token validation failed",
      };
    }

    // Token is valid
    return { valid: true };
  } catch (error: any) {
    const fbError = error?.response?.data?.error;
    return {
      valid: false,
      error: fbError?.message || error?.message || "Token validation failed",
    };
  }
}

/**
 * Exchange short-lived token for long-lived token
 * Facebook long-lived tokens last 60 days
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  try {
    const response = await axios.get(`${graphBaseUrl}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: facebookConfig.appId,
        client_secret: facebookConfig.appSecret,
        fb_exchange_token: shortLivedToken,
      },
      timeout: 10000,
    });

    if (response.data?.error) {
      throw new Error(response.data.error.message || "Failed to exchange token");
    }

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in || 5184000, // 60 days default
    };
  } catch (error: any) {
    const fbError = error?.response?.data?.error;
    throw new Error(
      fbError?.message || error?.message || "Failed to exchange token for long-lived token"
    );
  }
}

/**
 * Refresh page access token using user access token
 * This gets a fresh page token from the user's token
 */
export async function refreshPageAccessToken(
  userAccessToken: string,
  pageId: string
): Promise<{ accessToken: string; expiresAt?: Date }> {
  try {
    // Get page access token from user token
    const response = await axios.get(`${graphBaseUrl}/${pageId}`, {
      params: {
        fields: "access_token",
        access_token: userAccessToken,
      },
      timeout: 10000,
    });

    if (response.data?.error) {
      throw new Error(response.data.error.message || "Failed to refresh page token");
    }

    const pageAccessToken = response.data.access_token;
    if (!pageAccessToken) {
      throw new Error("No access token returned from Facebook");
    }

    // Exchange for long-lived token if possible
    try {
      const longLived = await exchangeForLongLivedToken(pageAccessToken);
      const expiresAt = new Date(Date.now() + longLived.expiresIn * 1000);

      return {
        accessToken: longLived.accessToken,
        expiresAt,
      };
    } catch (exchangeError) {
      // If exchange fails, use the page token as-is (might already be long-lived)
      logger.warn({ pageId, error: exchangeError }, "Failed to exchange for long-lived token, using page token as-is");
      return {
        accessToken: pageAccessToken,
        // No expiration date - assume it's long-lived
      };
    }
  } catch (error: any) {
    const fbError = error?.response?.data?.error;
    throw new Error(
      fbError?.message || error?.message || "Failed to refresh page access token"
    );
  }
}

/**
 * Ensure Facebook access token is valid and refresh if needed
 * This is the main function to call before using a token
 */
export async function ensureValidFacebookToken(
  socialAccountId: string
): Promise<{ token: string; wasRefreshed: boolean }> {
  const socialAccount = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId },
  });

  if (!socialAccount) {
    throw new Error(`Social account not found: ${socialAccountId}`);
  }

  if (socialAccount.platform !== "FACEBOOK") {
    throw new Error(`This service is only for Facebook accounts`);
  }

  // Check if token is expired or expiring soon
  const needsRefresh = isTokenExpiredOrExpiringSoon(socialAccount);

  if (!needsRefresh) {
    // Try to validate current token, but don't fail if validation fails
    // Sometimes validation can fail due to network issues, but token might still work
    try {
      const validation = await validateFacebookToken(
        socialAccount.accessToken,
        socialAccount.platformAccountId
      );

      if (validation.valid) {
        // Token is valid, return it
        return {
          token: socialAccount.accessToken,
          wasRefreshed: false,
        };
      }

      // Token validation failed, but if it's not expired, try to use it anyway
      // (might be a temporary network issue)
      logger.warn(
        { socialAccountId, error: validation.error },
        "Facebook token validation failed, but token not expired. Will attempt refresh if possible, otherwise use existing token."
      );
    } catch (validationError) {
      // Validation itself failed (network error, etc.)
      // If token is not expired, use it anyway
      logger.warn(
        { socialAccountId, error: validationError },
        "Facebook token validation error, but token not expired. Will use existing token."
      );
      
      if (!needsRefresh) {
        // Token not expired, use it even if validation failed
        return {
          token: socialAccount.accessToken,
          wasRefreshed: false,
        };
      }
    }
  }

  // Token needs refresh or validation failed
  logger.info({ socialAccountId, needsRefresh }, "Attempting to refresh Facebook access token");

  try {
    // Get user access token from tokenData
    const tokenData = socialAccount.tokenData as any;
    const userAccessToken = tokenData?.userAccessToken || tokenData?.user_access_token;

    if (!userAccessToken) {
      // No user token to refresh with, but if current token is not expired, use it
      if (!needsRefresh) {
        logger.warn(
          { socialAccountId },
          "No user access token for refresh, but current token not expired. Using existing token."
        );
        return {
          token: socialAccount.accessToken,
          wasRefreshed: false,
        };
      }
      
      // Token is expired and no user token - must re-authenticate
      throw new Error(
        "User access token not found in tokenData. Cannot refresh page token. User needs to re-authenticate."
      );
    }

    // Refresh page access token
    const refreshed = await refreshPageAccessToken(
      userAccessToken,
      socialAccount.platformAccountId
    );

    // Update social account with new token
    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        accessToken: refreshed.accessToken,
        tokenExpiresAt: refreshed.expiresAt,
        lastSyncedAt: new Date(),
        lastErrorCode: null,
        status: "ACTIVE",
      },
    });

    logger.info(
      { socialAccountId, expiresAt: refreshed.expiresAt },
      "Facebook access token refreshed successfully"
    );

    return {
      token: refreshed.accessToken,
      wasRefreshed: true,
    };
  } catch (error: any) {
    logger.error({ error, socialAccountId }, "Failed to refresh Facebook token");

    // If token is not expired, use it anyway (refresh might have failed due to network, etc.)
    if (!needsRefresh) {
      logger.warn(
        { socialAccountId, error: error.message },
        "Token refresh failed but token not expired. Using existing token."
      );
      
      return {
        token: socialAccount.accessToken,
        wasRefreshed: false,
      };
    }

    // Token is expired and refresh failed - mark as expired but don't throw
    // Let the publication attempt proceed with the old token (might still work)
    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        lastErrorCode: error?.response?.data?.error?.code?.toString() || "REFRESH_FAILED",
        status: "EXPIRED",
      },
    });

    logger.warn(
      { socialAccountId, error: error.message },
      "Token expired and refresh failed. Will attempt publication with existing token."
    );

    // Return existing token anyway - let the actual API call determine if it works
    return {
      token: socialAccount.accessToken,
      wasRefreshed: false,
    };
  }
}
