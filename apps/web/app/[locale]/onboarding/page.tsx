"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth, isLoggingOutState } from "@/features/auth/context/auth-context";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/features/auth/api/auth-api";
import { getAccessToken } from "@/shared/auth/token-storage";
import { logger } from "@/shared/utils/logger";

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useLocale();
  const { logout, isAuthenticated, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const hasChecked = useRef(false);

  useEffect(() => {
    const checkWorkspaces = async () => {
      // Prevent multiple checks
      if (hasChecked.current) {
        return;
      }

      // Wait for auth to finish loading
      if (loading) {
        return;
      }

      // Don't do anything during logout process
      if (isLoggingOutState()) {
        return;
      }

      const localePrefix = locale === "en" ? "" : `/${locale}`;

      // If not authenticated and no token, redirect to login
      // But don't redirect if we're in the middle of logging out
      if (!isAuthenticated && !getAccessToken()) {
        router.replace(`${localePrefix}/login`);
        return;
      }

      hasChecked.current = true;

      try {
        // Double-check we're not logging out before API call
        if (isLoggingOutState()) {
          return;
        }

        const session = await getCurrentSession();
        
        // If session is null, user is not authenticated
        // Don't redirect here - onUnauthenticated handler will handle it
        if (!session) {
          setChecking(false);
          return;
        }

        const { ownerWorkspaces, memberWorkspaces } = session;
        const allWorkspaces = [...ownerWorkspaces, ...memberWorkspaces].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        // If user has workspaces, redirect to most recent one
        if (allWorkspaces.length > 0) {
          const targetWorkspace = allWorkspaces[0];
          router.replace(`${localePrefix}/${targetWorkspace.slug}`);
          return;
        }

        // No workspaces - user can stay on onboarding
        setChecking(false);
      } catch (error) {
        logger.error("Error checking workspaces:", error);
        // Don't redirect on error - let auth handler deal with it
        setChecking(false);
      }
    };

    checkWorkspaces();
  }, [isAuthenticated, loading, router, locale]);

  const handleLogout = async () => {
    await logout();
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    router.push(`${localePrefix}/login`);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">Welcome!</h1>
        <p className="text-muted-foreground">
          You don&apos;t have a workspace yet. Please contact an administrator to get access to a workspace.
        </p>
        <div className="pt-4">
          <Button onClick={handleLogout} variant="outline">
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}

