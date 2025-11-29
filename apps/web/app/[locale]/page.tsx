"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/features/auth/context/auth-context";
import { getCurrentSession } from "@/features/auth/api/auth-api";
import { getAccessToken } from "@/shared/auth/token-storage";
import { routeResolver } from "@/shared/routing/route-resolver";
import { logger } from "@/shared/utils/logger";

export default function HomePage() {
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const redirect = async () => {
      const localePrefix = locale === "en" ? "" : `/${locale}`;
      const hasToken = isAuthenticated || !!getAccessToken();

      try {
        // Get user workspaces
        const session = await getCurrentSession();
        const redirectPath = await routeResolver({
          locale,
          hasToken,
          ownerWorkspaces: session?.ownerWorkspaces,
          memberWorkspaces: session?.memberWorkspaces,
          invites: session?.invites,
          currentPath: "/",
          fallbackWorkspaceSlug: session?.ownerWorkspaces?.[0]?.slug ?? session?.memberWorkspaces?.[0]?.slug,
          useActivityBasedSelection: true, // Use activity-based workspace selection
        });
        router.replace(redirectPath);
      } catch (error) {
        logger.error("Error getting session:", error);
        router.replace(`${localePrefix}/login`);
      } finally {
        setChecking(false);
      }
    };

    redirect();
  }, [isAuthenticated, router, locale]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
