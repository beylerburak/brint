"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";

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
    const publicRoutes = ["/login", "/signup"];
    const isPublicRoute = publicRoutes.some((route) => {
      return pathname === `${localePrefix}${route}` || pathname.startsWith(`${localePrefix}${route}/`);
    });
    const isAuthRoute = pathname.includes("/auth/");
    if (isPublicRoute || isAuthRoute) {
      return;
    }

    const onboardingPath = `${localePrefix}/onboarding`;
    const isOnOnboarding = pathname === onboardingPath;

    // If no workspace and not on onboarding → redirect to onboarding
    if (!workspace && !isOnOnboarding) {
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

