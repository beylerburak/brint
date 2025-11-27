"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

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
      const dashboardPath = `${localePrefix}/${workspace.slug}/dashboard`;
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
