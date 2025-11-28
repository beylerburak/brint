"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/features/auth/context/auth-context";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getCurrentSession } from "@/features/auth/api/auth-api";
import { clearAccessToken } from "@/shared/auth/token-storage";
import { apiCache } from "@/shared/api/cache";

interface WorkspaceGuardProps {
  children: React.ReactNode;
}

/**
 * WorkspaceGuard - Handles workspace redirect logic
 * 
 * - If user has no workspace in URL and is not on onboarding → redirect to onboarding
 * - If user has workspace but is on onboarding → redirect to workspace dashboard
 */
export function WorkspaceGuard({ children }: WorkspaceGuardProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    // Don't redirect while auth is loading
    if (authLoading) {
      return;
    }

    // Don't redirect if not authenticated (ProtectedLayout handles this)
    if (!isAuthenticated) {
      return;
    }

    // Verify session is still valid (security check)
    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          // Session invalid - clear auth state and redirect to login
          console.warn("WorkspaceGuard: Session invalid, logging out user");
          clearAccessToken();
          localStorage.removeItem("auth_user");
          apiCache.invalidate("session:current");
          apiCache.invalidate("user:profile");
          const localePrefix = locale === "en" ? "" : `/${locale}`;
          router.replace(`${localePrefix}/login`);
          return;
        }
      } catch (error) {
        // 401 or other auth error - logout and redirect to login
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("401") ||
          errorMessage.includes("Authentication") ||
          errorMessage.includes("UNAUTHORIZED") ||
          errorMessage.includes("Request failed with status 401")
        ) {
          console.warn("WorkspaceGuard: Session invalid (401), logging out user:", errorMessage);
          clearAccessToken();
          localStorage.removeItem("auth_user");
          apiCache.invalidate("session:current");
          apiCache.invalidate("user:profile");
          const localePrefix = locale === "en" ? "" : `/${locale}`;
          router.replace(`${localePrefix}/login`);
          return;
        }
        // Other errors - log but don't redirect (might be network issues)
        console.error("WorkspaceGuard: Error verifying session:", error);
      }
    })();

    // Don't redirect on public routes (login, signup, auth routes)
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    const publicRoutes = ["/login", "/signup", "/sign-up"];
    const isPublicRoute = publicRoutes.some((route) => {
      return pathname === `${localePrefix}${route}` || pathname.startsWith(`${localePrefix}${route}/`);
    });
    const isAuthRoute = pathname.includes("/auth/");
    const isInvitesRoute = pathname.startsWith(`${localePrefix}/invites`);
    if (isPublicRoute || isAuthRoute || isInvitesRoute) {
      return;
    }

    const onboardingPath = `${localePrefix}/onboarding`;
    const isBaseLocalePath = pathname === localePrefix || pathname === `${localePrefix}/`;
    const isOnOnboarding = pathname === onboardingPath;

    // Allow base locale path to resolve via route resolver elsewhere
    if (isBaseLocalePath && !workspace) {
      return;
    }

    const segments = pathname.split("/").filter(Boolean);
    const candidateWorkspace = segments.length >= 2 ? segments[1] : null;
    const reservedCandidates = ["login", "signup", "sign-up", "onboarding", "invites", "auth"];

    // If no workspace and not on onboarding/invites, but also no valid workspace in URL → redirect to onboarding
    const hasValidWorkspaceInUrl =
      candidateWorkspace !== null && !reservedCandidates.includes(candidateWorkspace);

    if (!workspace && !isOnOnboarding && !isInvitesRoute && !hasValidWorkspaceInUrl) {
      router.replace(onboardingPath);
      return;
    }

    // If workspace exists and on onboarding → redirect to workspace dashboard
    if (workspace && isOnOnboarding) {
      const dashboardPath = `${localePrefix}/${workspace.slug}`;
      router.replace(dashboardPath);
      return;
    }
  }, [workspace, isAuthenticated, authLoading, router, pathname, locale]);

  // Show nothing while redirecting
  if (authLoading) {
    return null;
  }

  return <>{children}</>;
}
