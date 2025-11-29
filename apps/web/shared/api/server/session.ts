import { serverFetch } from "./server-fetch";
import type { AuthUser } from "@/features/auth/context/auth-context";
import type { Workspace } from "@/features/auth/api/auth-api";

export interface ServerSession {
  user: AuthUser & {
    username?: string | null;
    completedOnboarding: boolean;
    locale: string;
    timezone: string;
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
}

interface GetCurrentSessionResponse {
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
}

/**
 * Get current session from server-side
 * Returns null if user is not authenticated
 */
export async function getCurrentSession(): Promise<ServerSession | null> {
  try {
    const response = await serverFetch<GetCurrentSessionResponse>("/auth/me");

    if (!response.success) {
      return null;
    }

    const { user: userData, ownerWorkspaces, memberWorkspaces, invites } =
      response.data;

    return {
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name ?? undefined,
        username: userData.username,
        googleId: userData.googleId,
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
      ownerWorkspaces: ownerWorkspaces.map((ws) => ({
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        subscription: ws.subscription,
        permissions: ws.permissions,
        updatedAt: ws.updatedAt,
      })),
      memberWorkspaces: memberWorkspaces.map((ws) => ({
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        subscription: ws.subscription,
        permissions: ws.permissions,
        updatedAt: ws.updatedAt,
      })),
      invites,
    };
  } catch (error) {
    // If 401 or other auth errors, return null instead of throwing
    if (error instanceof Error && error.message.includes("401")) {
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

