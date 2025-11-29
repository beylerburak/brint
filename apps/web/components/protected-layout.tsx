"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/features/auth/context/auth-context";
import { getAccessToken, clearAccessToken } from "@/shared/auth/token-storage";
import { getCurrentSession } from "@/features/auth/api/auth-api";
import { routeResolver } from "@/shared/routing/route-resolver";
import { apiCache } from "@/shared/api/cache";
import { logger } from "@/shared/utils/logger";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

/**
 * ProtectedLayout - Redirects unauthenticated users to login
 * 
 * This component should wrap protected routes to ensure only authenticated
 * users can access them.
 */
export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const hasRedirectedFromPublic = useRef(false);

  // Check if current route is public
  const publicRoutes = ["/login", "/signup", "/sign-up", "/invites"];
  const isPublicRoute = publicRoutes.some((route) => {
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    return (
      pathname === `${localePrefix}${route}` ||
      pathname.startsWith(`${localePrefix}${route}/`) ||
      // For default-locale paths when localePrefix is "as-needed"
      (localePrefix === "" && (pathname === route || pathname.startsWith(`${route}/`)))
    );
  });

  // Also allow auth routes (magic link verify, etc.)
  const isAuthRoute = pathname.includes("/auth/");
  const isPublic = isPublicRoute || isAuthRoute;

  // Reset public redirect guard when leaving public routes
  useEffect(() => {
    if (!isPublic) {
      hasRedirectedFromPublic.current = false;
    }
  }, [isPublic]);

  useEffect(() => {
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    const hasToken = isAuthenticated || !!getAccessToken();

    // Don't redirect while loading
    if (loading) {
      return;
    }

    // Don't redirect if already authenticated
    if (isAuthenticated && isPublic) {
      // If on invites page with token, don't redirect - let user accept invite
      if (pathname.includes("/invites") && searchParams.get("token")) {
        return;
      }

      // Prevent repeated redirects on the same public path
      if (hasRedirectedFromPublic.current) {
        return;
      }
      hasRedirectedFromPublic.current = true;

      // Authenticated users should not access login/signup - resolve destination
      void (async () => {
        try {
          const session = await getCurrentSession();
          const redirectPath = await routeResolver({
            locale,
            hasToken: hasToken,
            ownerWorkspaces: session?.ownerWorkspaces,
            memberWorkspaces: session?.memberWorkspaces,
            invites: session?.invites,
            currentPath: pathname,
            fallbackWorkspaceSlug: session?.ownerWorkspaces?.[0]?.slug ?? session?.memberWorkspaces?.[0]?.slug,
            useActivityBasedSelection: true, // Use activity-based workspace selection
          });
          if (redirectPath !== pathname) {
            router.replace(redirectPath);
          }
        } catch (error) {
          logger.error("ProtectedLayout redirect error:", error);
          router.replace(`${localePrefix}/login`);
        }
      })();
      return;
    }

    // For protected routes, verify session with backend
    if (isAuthenticated && !isPublic) {
      void (async () => {
        try {
          // Verify session is still valid by calling /auth/me
          // Returns null if session is invalid (401 or other error)
          const session = await getCurrentSession();
          if (!session) {
            // Session invalid - clear auth state and redirect to login
            logger.warn("Session invalid, logging out user");
            clearAccessToken();
            localStorage.removeItem("auth_user");
            apiCache.invalidate("session:current");
            apiCache.invalidate("user:profile");
            router.replace(`${localePrefix}/login`);
            return;
          }
        } catch (error) {
          // Unexpected error (network issues, etc.) - log but don't redirect
          logger.error("ProtectedLayout session verification error:", error);
        }
      })();
      return;
    }

    if (isAuthenticated) {
      return;
    }

    // Don't redirect if already on public routes
    if (isPublic) {
      return;
    }

    // Redirect to login
    const loginPath = localePrefix ? `${localePrefix}/login` : "/login";
    router.replace(loginPath);
  }, [isAuthenticated, loading, router, pathname, locale, isPublic, searchParams]);

  // For public routes, always show children (even if not authenticated)
  if (isPublic) {
    return <>{children}</>;
  }

  // For protected routes, show nothing while loading or if not authenticated
  if (loading || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
