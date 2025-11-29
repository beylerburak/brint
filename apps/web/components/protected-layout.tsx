"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth, isLoggingOutState } from "@/features/auth/context/auth-context";
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
  const isRedirecting = useRef(false);

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

    // Don't do anything if we're in the middle of logging out
    // This prevents redirect loops when token expires
    if (isLoggingOutState()) {
      return;
    }

    // Prevent multiple concurrent redirects
    if (isRedirecting.current) {
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
      isRedirecting.current = true;

      // Authenticated users should not access login/signup - resolve destination
      void (async () => {
        try {
          // Double-check we're not logging out before making API call
          if (isLoggingOutState()) {
            isRedirecting.current = false;
            return;
          }

          const session = await getCurrentSession();
          
          // If session is null after API call, user is no longer authenticated
          // Don't redirect - the onUnauthenticated handler will take care of it
          if (!session) {
            isRedirecting.current = false;
            hasRedirectedFromPublic.current = false;
            return;
          }

          const redirectPath = await routeResolver({
            locale,
            hasToken: hasToken,
            ownerWorkspaces: session.ownerWorkspaces,
            memberWorkspaces: session.memberWorkspaces,
            invites: session.invites,
            currentPath: pathname,
            fallbackWorkspaceSlug: session.ownerWorkspaces?.[0]?.slug ?? session.memberWorkspaces?.[0]?.slug,
            useActivityBasedSelection: true, // Use activity-based workspace selection
          });
          if (redirectPath !== pathname) {
            router.replace(redirectPath);
          }
        } catch (error) {
          logger.error("ProtectedLayout redirect error:", error);
          // Don't redirect to login on error - let onUnauthenticated handle auth errors
          // Only redirect on truly unexpected errors if we have no token
          if (!getAccessToken()) {
            router.replace(`${localePrefix}/login`);
          }
        } finally {
          isRedirecting.current = false;
        }
      })();
      return;
    }

    // For protected routes, verify session with backend
    if (isAuthenticated && !isPublic) {
      isRedirecting.current = true;
      void (async () => {
        try {
          // Double-check we're not logging out before making API call
          if (isLoggingOutState()) {
            isRedirecting.current = false;
            return;
          }

          // Verify session is still valid by calling /auth/me
          // Returns null if session is invalid (401 or other error)
          const session = await getCurrentSession();
          if (!session) {
            // Session invalid - the onUnauthenticated handler should have been triggered
            // If not, manually clear state (this is a fallback)
            if (!isLoggingOutState()) {
              logger.warn("Session invalid, clearing auth state");
              clearAccessToken();
              localStorage.removeItem("auth_user");
              apiCache.invalidate("session:current");
              apiCache.invalidate("user:profile");
              router.replace(`${localePrefix}/login`);
            }
            return;
          }
        } catch (error) {
          // Unexpected error (network issues, etc.) - log but don't redirect
          logger.error("ProtectedLayout session verification error:", error);
        } finally {
          isRedirecting.current = false;
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
