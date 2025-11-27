"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { appConfig } from "@/shared/config/app";
import { refreshToken, getCurrentSession } from "@/features/auth/api/auth-api";
import { setAccessToken } from "@/shared/auth/token-storage";
import { routeResolver } from "@/shared/routing/route-resolver";

type Status = "verifying" | "success" | "error";

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const { toast } = useToast();
  const { loginWithSession } = useAuth();
  const [status, setStatus] = useState<Status>("verifying");
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const complete = searchParams.get("complete");
    const localePrefix = locale === "en" ? "" : `/${locale}`;

    // Step 1: If we have code/state but not marked complete, redirect browser directly to the API callback.
    // This ensures cookies are set via a top-level navigation (more reliable for refresh token).
    if (!complete) {
      if (!code || !state) {
        toast({
          title: "Google login failed",
          description: "Missing code or state parameter",
          variant: "destructive",
        });
        setStatus("error");
        setTimeout(() => router.replace(`${localePrefix}/login`), 2500);
        return;
      }

      const redirectBack = `${window.location.origin}${localePrefix}/auth/google/callback?complete=1`;
      const apiUrl = `${appConfig.apiBaseUrl}/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent(redirectBack)}`;
      window.location.replace(apiUrl);
      return;
    }

    // Step 2: After the API redirected back (complete=1), we expect cookies to exist.
    // Now finish login locally: refresh token, get session, set auth, and redirect.
    let cancelled = false;

    const handleGoogleCallback = async () => {
      try {
        // Access token via refresh endpoint (cookies should be set by API redirect step)
        const tokenResult = await refreshToken();
        setAccessToken(tokenResult.accessToken);

        // Fetch session details to hydrate auth context
        const session = await getCurrentSession();
        if (!session) {
          throw new Error("Failed to load session after Google login");
        }

        await loginWithSession({
          user: session.user,
          workspaces: [
            ...session.ownerWorkspaces,
            ...session.memberWorkspaces,
          ].map((workspace) => ({
            id: workspace.id,
            slug: workspace.slug,
            name: workspace.name,
          })),
          accessToken: tokenResult.accessToken,
        });

        const redirectPath = routeResolver({
          locale,
          hasToken: true,
          ownerWorkspaces: session.ownerWorkspaces,
          memberWorkspaces: session.memberWorkspaces,
          invites: session.invites ?? [],
          currentPath: `${localePrefix}/auth/google/callback`,
          fallbackWorkspaceSlug:
            session.ownerWorkspaces[0]?.slug ??
            session.memberWorkspaces[0]?.slug ??
            null,
        });

        setStatus("success");
        window.location.href = redirectPath;
      } catch (error) {
        if (cancelled) return;
        toast({
          title: "Google login failed",
          description:
            error instanceof Error
              ? error.message
              : "Unable to complete Google login",
          variant: "destructive",
        });
        setStatus("error");
        const localePrefix = locale === "en" ? "" : `/${locale}`;
        setTimeout(() => {
          if (!cancelled) {
            router.replace(`${localePrefix}/login`);
          }
        }, 3000);
      }
    };

    handleGoogleCallback();

    return () => {
      cancelled = true;
    };
  }, [searchParams, toast, locale, router, loginWithSession]);

  if (status === "verifying") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p>Completing Google login...</p>
          <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">Google login failed</p>
          <p className="text-sm text-muted-foreground">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <p>Login successful! Redirecting...</p>
      </div>
    </div>
  );
}
