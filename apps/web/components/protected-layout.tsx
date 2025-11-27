"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { getAccessToken } from "@/shared/auth/token-storage";
import { getCurrentSession } from "@/shared/api/auth";
import { routeResolver } from "@/shared/routing/route-resolver";
import { useRef } from "react";

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
  const locale = useLocale();
  const hasRedirectedFromPublic = useRef(false);

  // Check if current route is public
  const publicRoutes = ["/login", "/signup", "/sign-up"];
  const isPublicRoute = publicRoutes.some((route) => {
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    return pathname === `${localePrefix}${route}` || pathname.startsWith(`${localePrefix}${route}/`);
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
      // Prevent repeated redirects on the same public path
      if (hasRedirectedFromPublic.current) {
        return;
      }
      hasRedirectedFromPublic.current = true;

      // Authenticated users should not access login/signup - resolve destination
      void (async () => {
        try {
          const session = await getCurrentSession();
          const redirectPath = routeResolver({
            locale,
            hasToken: hasToken,
            ownerWorkspaces: session?.ownerWorkspaces,
            memberWorkspaces: session?.memberWorkspaces,
            invites: session?.invites,
            currentPath: pathname,
            fallbackWorkspaceSlug: session?.ownerWorkspaces?.[0]?.slug ?? session?.memberWorkspaces?.[0]?.slug,
          });
          if (redirectPath !== pathname) {
            router.replace(redirectPath);
          }
        } catch (error) {
          console.error("ProtectedLayout redirect error:", error);
          router.replace(`${localePrefix}/login`);
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
  }, [isAuthenticated, loading, router, pathname, locale, isPublic]);

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
