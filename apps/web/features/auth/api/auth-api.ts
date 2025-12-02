import { httpClient } from "@/shared/http";
import { apiCache } from "@/shared/api/cache";
import type { AuthUser } from "@/features/auth/context/auth-context";
import { logger } from "@/shared/utils/logger";

export interface LoginPayload {
  email: string;
  password?: string; // Not used for magic link, but kept for future email/password
}

export interface Workspace {
  id: string;
  slug: string;
  name?: string;
  subscription?: {
    plan: string;
    status: string;
    renewsAt: string | null;
  } | null;
  permissions?: string[];
}

export interface LoginResult {
  user: AuthUser;
  workspaces: Workspace[];
  accessToken: string;
  refreshToken?: string; // Not returned in body (cookie only), but kept for type consistency
}

export interface RefreshTokenResult {
  accessToken: string;
  expiresIn: number;
}

export interface MagicLinkRequestResult {
  success: boolean;
  message: string;
}

export interface MagicLinkVerifyResult {
  success: boolean;
  user: AuthUser;
  workspace: Workspace | null;
  ownerWorkspaces: Array<Workspace & { updatedAt: string }>;
  memberWorkspaces: Array<Workspace & { updatedAt: string }>;
  redirectTo: string | null;
  invites?: Array<{ id: string; updatedAt?: string | null }>;
}

export interface GoogleCallbackResult {
  user: { id: string; email: string; name?: string | null };
  redirectTo: string;
}

/**
 * Request a magic link email
 */
export async function requestMagicLink(
  email: string,
  redirectTo?: string
): Promise<MagicLinkRequestResult> {
  const response = await httpClient.post<{
    success: boolean;
    message: string;
  }>("/auth/magic-link", {
    email,
    redirectTo,
  });

  if (!response.ok) {
    throw new Error("Failed to request magic link");
  }

  return response.data;
}

/**
 * Get Google OAuth redirect URL
 */
export async function getGoogleOAuthUrl(): Promise<string> {
  const response = await httpClient.get<{
    success: boolean;
    redirectUrl: string;
  }>("/auth/google", {
    skipAuth: true,
  });

  if (!response.ok || !response.data?.redirectUrl) {
    throw new Error("Failed to get Google OAuth URL");
  }

  return response.data.redirectUrl;
}

/**
 * Complete Google OAuth flow after redirect
 */
export async function completeGoogleOAuth(code: string, state: string): Promise<GoogleCallbackResult> {
  const response = await httpClient.get<{
    success: boolean;
    user: { id: string; email: string; name?: string | null };
    redirectTo: string;
  }>(`/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
    skipAuth: true,
  });

  if (!response.ok || !response.data?.user) {
    throw new Error("Failed to complete Google login");
  }

  return response.data;
}

/**
 * Verify magic link token and login
 * This is typically called from a callback URL after user clicks the magic link
 * 
 * Note: Backend sets access token in HTTP-only cookie, but we need it in localStorage
 * for the Authorization header. After verify, we call refresh to get the access token.
 */
export async function verifyMagicLink(token: string): Promise<LoginResult & { verifyData: MagicLinkVerifyResult }> {
  // Step 1: Verify magic link (sets cookies)
  const verifyResponse = await httpClient.get<MagicLinkVerifyResult>(
    `/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
    {
      skipAuth: true, // No auth needed for verify
    }
  );

  if (!verifyResponse.ok) {
    throw new Error(verifyResponse.message || "Failed to verify magic link");
  }

  // Step 2: Get access token via refresh (cookies are now set)
  const refreshResponse = await refreshToken();

  // Combine owner and member workspaces, sorted by updatedAt (most recent first)
  const allWorkspaces = [
    ...verifyResponse.data.ownerWorkspaces,
    ...verifyResponse.data.memberWorkspaces,
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    user: {
      id: verifyResponse.data.user.id,
      email: verifyResponse.data.user.email,
      name: verifyResponse.data.user.name ?? undefined,
    },
    workspaces: allWorkspaces.map((w) => ({
      id: w.id,
      slug: w.slug,
      name: w.name,
    })),
    accessToken: refreshResponse.accessToken,
    verifyData: verifyResponse.data, // Include full verify response data
  };
}

/**
 * Refresh access token using refresh token from cookie
 */
export async function refreshToken(): Promise<RefreshTokenResult> {
  const response = await httpClient.post<{
    success: boolean;
    accessToken: string;
    expiresIn: number;
  }>("/auth/refresh", undefined, {
    // Include credentials to send cookies
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  return {
    accessToken: response.data.accessToken,
    expiresIn: response.data.expiresIn,
  };
}

/**
 * Logout user and revoke session
 */
export async function logout(): Promise<void> {
  await httpClient.post("/auth/logout", undefined, {
    credentials: "include",
  });
}

/**
 * Get current user session and workspaces with profile and subscription info
 * Uses global cache to prevent duplicate requests
 * This endpoint now returns full user profile and workspace subscriptions in a single call
 */
export async function getCurrentSession(): Promise<{
  user: AuthUser & {
    username?: string | null;
    completedOnboarding: boolean;
    locale: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    phone?: string | null;
    avatarMediaId?: string | null;
    avatarUrl?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  ownerWorkspaces: Array<Workspace & { updatedAt: string }>;
  memberWorkspaces: Array<Workspace & { updatedAt: string }>;
  invites?: Array<{ id: string; updatedAt?: string | null }>;
} | null> {
  return apiCache.getOrFetch(
    "session:current",
    async () => {
      try {
        const response = await httpClient.get<{
          success: boolean;
          data: {
            user: {
              id: string;
              email: string;
              name?: string | null;
              username?: string | null;
              googleId?: string | null;
              completedOnboarding: boolean;
              locale: string;
              timezone: string;
              dateFormat: string;
              timeFormat: string;
              phone?: string | null;
              avatarMediaId?: string | null;
              avatarUrl?: string | null;
              status: string;
              createdAt: string;
              updatedAt: string;
            };
            ownerWorkspaces: Array<{
              id: string;
              slug: string;
              name: string;
              updatedAt: string;
              subscription?: {
                plan: string;
                status: string;
                renewsAt: string | null;
              } | null;
              permissions: string[];
            }>;
            memberWorkspaces: Array<{
              id: string;
              slug: string;
              name: string;
              updatedAt: string;
              subscription?: {
                plan: string;
                status: string;
                renewsAt: string | null;
              } | null;
              permissions: string[];
            }>;
            invites?: Array<{ id: string; updatedAt?: string | null }>;
          };
        }>("/auth/me");

        if (!response.ok) {
          // If 401, invalidate cache and return null (don't throw - let callers handle it)
          if (response.status === 401) {
            apiCache.invalidate("session:current");
            apiCache.invalidate("user:profile");
            return null;
          }
          return null;
        }

        const { user: userData, ownerWorkspaces, memberWorkspaces, invites } = response.data.data;

        // Cache user profile data separately for backward compatibility
        apiCache.set("user:profile", {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          username: userData.username,
          firstOnboardedAt: null,
          completedOnboarding: userData.completedOnboarding,
          lastLoginAt: null,
          locale: userData.locale,
          timezone: userData.timezone,
          dateFormat: userData.dateFormat,
          timeFormat: userData.timeFormat,
          phone: userData.phone,
          avatarMediaId: userData.avatarMediaId,
          avatarUrl: userData.avatarUrl,
          googleId: userData.googleId,
          status: userData.status,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        });

        // Cache subscriptions and permissions for each workspace
        const allWorkspaces = [...ownerWorkspaces, ...memberWorkspaces];
        for (const workspace of allWorkspaces) {
          if (workspace.subscription) {
            apiCache.set(`subscription:${workspace.id}`, {
              workspaceId: workspace.id,
              plan: workspace.subscription.plan,
              status: workspace.subscription.status,
              renewsAt: workspace.subscription.renewsAt,
            });
          }
          // Cache permissions for each workspace
          if (workspace.permissions) {
            const permissionsCacheKey = `permissions:${userData.id}:${workspace.id}`;
            apiCache.set(permissionsCacheKey, {
              workspaceId: workspace.id,
              permissions: workspace.permissions,
            });
            // Also store in localStorage for offline access
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(permissionsCacheKey, JSON.stringify(workspace.permissions));
              } catch (error) {
                // Ignore localStorage errors (quota exceeded, etc.)
                logger.warn('Failed to cache permissions in localStorage:', error);
              }
            }
          }
        }

        return {
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.name ?? undefined,
            googleId: userData.googleId ?? null,
            username: userData.username,
            completedOnboarding: userData.completedOnboarding,
            locale: userData.locale,
            timezone: userData.timezone,
            phone: userData.phone,
            avatarMediaId: userData.avatarMediaId,
            avatarUrl: userData.avatarUrl,
            status: userData.status,
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
          },
          ownerWorkspaces,
          memberWorkspaces,
          invites,
        };
      } catch (error) {
        // Re-throw 401 errors so ProtectedLayout can handle them
        if (error instanceof Error && error.message.includes("401")) {
          throw error;
        }
        logger.error("Error getting current session:", error);
        return null;
      }
    },
    30000 // 30 seconds cache
  );
}
