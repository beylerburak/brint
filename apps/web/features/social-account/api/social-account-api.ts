/**
 * Social Account API Client
 * 
 * Wraps /v1/brands/:brandId/social-accounts endpoints with typed functions.
 * Uses shared HTTP client which automatically handles:
 * - Authorization header (Bearer token)
 * - X-Workspace-Id header
 * - Token refresh on 401
 * - API versioning (/v1 prefix)
 */

import { httpClient } from "@/shared/http";
import type {
  SocialAccount,
  SocialAccountStatus,
  ConnectSocialAccountRequest,
  PaginatedResponse,
  SingleResponse,
  ActionResponse,
} from "../types";

// ============================================================================
// List Social Accounts
// ============================================================================

export interface ListSocialAccountsParams {
  brandId: string;
  cursor?: string;
  limit?: number;
  status?: SocialAccountStatus;
  includeRemoved?: boolean;
}

export interface ListSocialAccountsResult {
  items: SocialAccount[];
  nextCursor: string | null;
}

/**
 * List social accounts for a brand
 */
export async function getSocialAccounts(
  params: ListSocialAccountsParams
): Promise<ListSocialAccountsResult> {
  const { brandId, cursor, limit, status, includeRemoved } = params;
  const searchParams = new URLSearchParams();

  if (cursor) {
    searchParams.set("cursor", cursor);
  }
  if (limit) {
    searchParams.set("limit", limit.toString());
  }
  if (status) {
    searchParams.set("status", status);
  }
  if (includeRemoved) {
    searchParams.set("includeRemoved", "true");
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `/brands/${brandId}/social-accounts?${queryString}`
    : `/brands/${brandId}/social-accounts`;

  const response = await httpClient.get<PaginatedResponse<SocialAccount>>(url);

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to list social accounts";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

// ============================================================================
// Connect Social Account
// ============================================================================

/**
 * Connect a new social account to a brand
 */
export async function connectSocialAccount(
  brandId: string,
  payload: ConnectSocialAccountRequest
): Promise<SocialAccount> {
  const response = await httpClient.post<SingleResponse<SocialAccount>>(
    `/brands/${brandId}/social-accounts`,
    payload
  );

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to connect social account";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

// ============================================================================
// Disconnect Social Account
// ============================================================================

/**
 * Disconnect a social account (wipes credentials, sets status to DISCONNECTED)
 */
export async function disconnectSocialAccount(
  brandId: string,
  socialAccountId: string
): Promise<ActionResponse["data"]> {
  const response = await httpClient.post<ActionResponse>(
    `/brands/${brandId}/social-accounts/${socialAccountId}/disconnect`
  );

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to disconnect social account";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

// ============================================================================
// Delete (Remove) Social Account
// ============================================================================

/**
 * Remove a social account (soft delete - sets status to REMOVED)
 */
export async function deleteSocialAccount(
  brandId: string,
  socialAccountId: string
): Promise<ActionResponse["data"]> {
  const response = await httpClient.delete<ActionResponse>(
    `/brands/${brandId}/social-accounts/${socialAccountId}`
  );

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to remove social account";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

// ============================================================================
// OAuth Flow
// ============================================================================

export interface OAuthPlatform {
  id: string;
  name: string;
  enabled: boolean;
  supportedAccountTypes: string[];
}

export interface OAuthPlatformsResponse {
  success: boolean;
  data: OAuthPlatform[];
}

/**
 * Get available OAuth platforms
 */
export async function getOAuthPlatforms(): Promise<OAuthPlatform[]> {
  const response = await httpClient.get<OAuthPlatformsResponse>(
    "/social-accounts/oauth/platforms"
  );

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to get OAuth platforms";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

export interface OAuthAuthorizeResponse {
  success: boolean;
  redirectUrl: string;
}

/**
 * Initiate OAuth flow for a platform
 */
export async function initiateOAuth(
  brandId: string,
  platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "LINKEDIN" | "X" | "PINTEREST" | "YOUTUBE"
): Promise<string> {
  // Each platform uses its own OAuth endpoint
  let endpoint: string;
  if (platform === "TIKTOK") {
    endpoint = `/social-accounts/oauth/tiktok/authorize?brandId=${brandId}`;
  } else if (platform === "LINKEDIN") {
    endpoint = `/social-accounts/oauth/linkedin/authorize?brandId=${brandId}`;
  } else if (platform === "X") {
    endpoint = `/social-accounts/oauth/x/authorize?brandId=${brandId}`;
  } else if (platform === "PINTEREST") {
    endpoint = `/social-accounts/oauth/pinterest/authorize?brandId=${brandId}`;
  } else if (platform === "YOUTUBE") {
    endpoint = `/social-accounts/oauth/youtube/authorize?brandId=${brandId}`;
  } else {
    endpoint = `/social-accounts/oauth/facebook/authorize?brandId=${brandId}&platform=${platform}`;
  }

  const response = await httpClient.get<OAuthAuthorizeResponse>(endpoint);

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to initiate OAuth";
    throw new Error(errorMessage);
  }

  return response.data.redirectUrl;
}

export interface SelectableAccount {
  type: "facebook_page" | "instagram_business" | "tiktok_business" | "linkedin_page" | "x_account" | "pinterest_profile" | "youtube_channel";
  id: string;
  name: string;
  username?: string;
  profilePictureUrl?: string;
  category?: string;
  linkedPageId?: string;
  linkedPageName?: string;
}

export interface OAuthAccountsResponse {
  success: boolean;
  data: {
    brandId: string;
    platform: string;
    accounts: SelectableAccount[];
  };
}

/**
 * Get available accounts from OAuth session
 */
export async function getOAuthAccounts(session: string): Promise<OAuthAccountsResponse["data"]> {
  const response = await httpClient.get<OAuthAccountsResponse>(
    `/social-accounts/oauth/accounts?session=${session}`
  );

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to get OAuth accounts";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

export interface OAuthConnectPayload {
  session: string;
  accountId: string;
  accountType: "facebook_page" | "instagram_business" | "tiktok_business" | "linkedin_page" | "x_account" | "pinterest_profile" | "youtube_channel";
}

/**
 * Connect selected OAuth account to brand
 */
export async function connectOAuthAccount(payload: OAuthConnectPayload): Promise<SocialAccount> {
  const response = await httpClient.post<SingleResponse<SocialAccount>>(
    "/social-accounts/oauth/connect",
    payload
  );

  if (!response.ok) {
    const errorMessage =
      (response.details as any)?.error?.message ||
      response.message ||
      "Failed to connect account";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

