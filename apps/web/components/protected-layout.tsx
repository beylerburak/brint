"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/auth-context";

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

  // Check if current route is public
  const publicRoutes = ["/login", "/signup"];
  const isPublicRoute = publicRoutes.some((route) => {
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    return pathname === `${localePrefix}${route}` || pathname.startsWith(`${localePrefix}${route}/`);
  });

  // Also allow auth routes (magic link verify, etc.)
  const isAuthRoute = pathname.includes("/auth/");
  const isPublic = isPublicRoute || isAuthRoute;

  useEffect(() => {
    // Don't redirect while loading
    if (loading) {
      return;
    }

    // Don't redirect if already authenticated
    if (isAuthenticated) {
      return;
    }

    // Don't redirect if already on public routes
    if (isPublic) {
      return;
    }

    // Redirect to login
    const loginPath = locale === "en" ? "/login" : `/${locale}/login`;
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

