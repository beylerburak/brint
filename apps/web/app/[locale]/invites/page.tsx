"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { acceptWorkspaceInvite } from "@/features/space/api/accept-invite";
import { getInviteDetails, loginWithInviteToken } from "@/features/space/api/invites-api";
import { getCurrentSession } from "@/features/auth/api/auth-api";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/context/auth-context";
import { apiCache } from "@/shared/api/cache";
import { useToast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";

type InviteDetails = {
  id: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  invitedBy: string | null;
  invitedByName: string | null;
  status: string;
  expiresAt: string;
};

type Status = "loading" | "accept-invite" | "accepting" | "success" | "error";

// Email schema will be created inside component to use translations

export default function InvitesPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const { isAuthenticated, loading: authLoading, login } = useAuth();
  const { toast } = useToast();
  const t = useTranslations("common.invite");
  const loginAttemptedRef = useRef(false);

  // Load invite details
  useEffect(() => {
    if (!token) {
      setError(t("invalidInvite"));
      setStatus("error");
      return;
    }

    // Reset login attempted flag when token changes
    loginAttemptedRef.current = false;
    setStatus("loading");

    let cancelled = false;

    const loadInvite = async () => {
      try {
        const details = await getInviteDetails(token);
        if (!cancelled) {
          setInviteDetails(details);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : t("inviteDetailsError")
        );
        setStatus("error");
      }
    };

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  // Auto-login with invite token if not authenticated, or show accept UI if authenticated
  useEffect(() => {
    // Wait until invite details are loaded and auth is ready
    if (!inviteDetails || authLoading) {
      return;
    }

    // If authenticated, show accept invite UI
    if (isAuthenticated) {
      // Only update status if we're in loading state
      if (status === "loading") {
        setStatus("accept-invite");
      }
      return;
    }

    // If not authenticated and login not attempted yet, auto-login with invite token
    if (!isAuthenticated && !loginAttemptedRef.current && token) {
      loginAttemptedRef.current = true;
      let cancelled = false;

      const performLogin = async () => {
        try {
          const result = await loginWithInviteToken(token);
          if (!cancelled) {
            // Login with access token
            // Don't fetch session yet - workspace will be added after accepting invite
            await login({
              user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name ?? undefined,
              },
              workspaces: [], // Workspace will be added after accepting invite
              accessToken: result.accessToken,
            });
            
            // Status will be updated by the auth state change
          }
        } catch (err) {
          if (!cancelled) {
            loginAttemptedRef.current = false; // Reset on error so user can retry
            setStatus("error");
            setError(
              err instanceof Error
                ? err.message
                : t("inviteDetailsError")
            );
            toast({
              title: t("error"),
              description: err instanceof Error ? err.message : t("inviteDetailsError"),
              variant: "destructive",
            });
          }
        }
      };

      void performLogin();

      return () => {
        cancelled = true;
      };
    }
  }, [inviteDetails, isAuthenticated, authLoading, token, login, t, toast, status]);


  // Handle invite acceptance
  const handleAcceptInvite = async () => {
    if (!token || !inviteDetails) return;

    setStatus("accepting");
    setError(null);

    try {
      // Step 1: Accept the invite (adds user as workspace member)
      await acceptWorkspaceInvite(token);

      // Step 2: Invalidate session cache to force refresh with new workspace
      apiCache.invalidate("session:current");

      // Step 3: Wait a bit for backend to process the member addition
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Step 4: Use workspace slug from invite details (we already have it)
      // This is more reliable than waiting for session to refresh
      if (inviteDetails.workspaceSlug) {
        setStatus("success");
        router.replace(`${localePrefix}/${inviteDetails.workspaceSlug}/dashboard`);
        return;
      }

      // Fallback: Try to get workspace from session
      const session = await getCurrentSession();
      
      if (!session) {
        throw new Error(t("sessionError"));
      }

      // Find the workspace in the session
      const allWorkspaces = [
        ...(session.ownerWorkspaces ?? []),
        ...(session.memberWorkspaces ?? []),
      ];
      const workspace = allWorkspaces.find((ws) => ws.id === inviteDetails.workspaceId);

      if (!workspace) {
        // Workspace not found in session - might need to wait longer
        // Try one more time after a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        apiCache.invalidate("session:current");
        const retrySession = await getCurrentSession();
        if (retrySession) {
          const retryWorkspaces = [
            ...(retrySession.ownerWorkspaces ?? []),
            ...(retrySession.memberWorkspaces ?? []),
          ];
          const retryWorkspace = retryWorkspaces.find((ws) => ws.id === inviteDetails.workspaceId);
          if (retryWorkspace) {
            setStatus("success");
            router.replace(`${localePrefix}/${retryWorkspace.slug}/dashboard`);
            return;
          }
        }
        // If still not found, use invite details workspace slug as fallback
        if (inviteDetails.workspaceSlug) {
          setStatus("success");
          router.replace(`${localePrefix}/${inviteDetails.workspaceSlug}/dashboard`);
          return;
        }
        throw new Error("Workspace not found in session after accepting invite");
      }

      // Step 5: Redirect to workspace dashboard
      setStatus("success");
      router.replace(`${localePrefix}/${workspace.slug}/dashboard`);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : t("acceptError")
      );
    }
  };

  // Show loading only if we're still loading invite details OR auth is loading
  if ((status === "loading" && !inviteDetails) || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // Error states
  if (status === "error" || !inviteDetails) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">{t("error")}</h1>
          <p className="text-destructive">
            {error ?? t("inviteDetailsError")}
          </p>
          <Button variant="outline" onClick={() => router.replace(localePrefix || "/")}>
            {t("backToHome")}
          </Button>
        </div>
      </div>
    );
  }



  if (status === "accepting") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("accepting")}</p>
        </div>
      </div>
    );
  }

  if (status === "accept-invite") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("invitedToWorkspace")}</h1>
            <p className="text-muted-foreground">
              {inviteDetails.invitedByName
                ? t("invitedByMessage", { 
                    inviterName: inviteDetails.invitedByName,
                    workspaceName: inviteDetails.workspaceName 
                  })
                : t("invitedMessage", { workspaceName: inviteDetails.workspaceName })}
            </p>
          </div>

          <Button
            onClick={handleAcceptInvite}
            size="lg"
            className="w-full"
          >
            {t("continueToWorkspace", { workspaceName: inviteDetails.workspaceName })}
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">{t("accepted")}</h1>
          <p className="text-muted-foreground">{t("redirecting")}</p>
        </div>
      </div>
    );
  }

  return null;
}
