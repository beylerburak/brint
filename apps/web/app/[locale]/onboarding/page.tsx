"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/features/auth/context/auth-context";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/features/auth/api/auth-api";

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useLocale();
  const { logout, isAuthenticated } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkWorkspaces = async () => {
      if (!isAuthenticated) {
        const localePrefix = locale === "en" ? "" : `/${locale}`;
        router.replace(`${localePrefix}/login`);
        return;
      }

      try {
        const session = await getCurrentSession();
        
        if (session) {
          const { ownerWorkspaces, memberWorkspaces } = session;
          const allWorkspaces = [...ownerWorkspaces, ...memberWorkspaces].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

          // If user has workspaces, redirect to most recent one
          if (allWorkspaces.length > 0) {
            const localePrefix = locale === "en" ? "" : `/${locale}`;
            const targetWorkspace = allWorkspaces[0];
            router.replace(`${localePrefix}/${targetWorkspace.slug}`);
            return;
          }
        }

        // No workspaces - user can stay on onboarding
        setChecking(false);
      } catch (error) {
        console.error("Error checking workspaces:", error);
        setChecking(false);
      }
    };

    checkWorkspaces();
  }, [isAuthenticated, router, locale]);

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

