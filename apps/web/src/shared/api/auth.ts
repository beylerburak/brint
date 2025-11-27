import { httpClient } from "@/shared/http";
import type { AuthUser } from "@/contexts/auth-context";

export interface LoginPayload {
  email: string;
  password?: string; // Not used for magic link, but kept for future email/password
}

export interface Workspace {
  id: string;
  slug: string;
  name?: string;
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
}

/**
 * Request a magic link email
 */
export async function requestMagicLink(email: string): Promise<MagicLinkRequestResult> {
  const response = await httpClient.post<{
    success: boolean;
    message: string;
  }>("/auth/magic-link", {
    email,
  });

  if (!response.ok) {
    throw new Error(response.message || "Failed to request magic link");
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
    throw new Error(response.message || "Failed to refresh token");
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
 * Get current user session and workspaces
 */
export async function getCurrentSession(): Promise<{
  user: AuthUser;
  ownerWorkspaces: Array<Workspace & { updatedAt: string }>;
  memberWorkspaces: Array<Workspace & { updatedAt: string }>;
} | null> {
  try {
    const response = await httpClient.get<{
      success: boolean;
      data: {
        user: { id: string; email: string; name?: string | null };
        ownerWorkspaces: Array<{ id: string; slug: string; name: string; updatedAt: string }>;
        memberWorkspaces: Array<{ id: string; slug: string; name: string; updatedAt: string }>;
      };
    }>("/auth/me");

    if (!response.ok) {
      return null;
    }

    return {
      user: {
        id: response.data.data.user.id,
        email: response.data.data.user.email,
        name: response.data.data.user.name ?? undefined,
      },
      ownerWorkspaces: response.data.data.ownerWorkspaces,
      memberWorkspaces: response.data.data.memberWorkspaces,
    };
  } catch (error) {
    console.error("Error getting current session:", error);
    return null;
  }
}

