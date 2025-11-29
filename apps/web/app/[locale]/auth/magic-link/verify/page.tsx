"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/features/auth/context/auth-context";
import { useToast } from "@/components/ui/use-toast";
import { routeResolver } from "@/shared/routing/route-resolver";
import { logger } from "@/shared/utils/logger";

export default function MagicLinkVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const { verifyMagicLinkToken } = useAuth();
  const { toast } = useToast();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    () => (token ? "verifying" : "error")
  );
  const hasVerified = useRef(false);

  useEffect(() => {
    // Only verify once
    if (hasVerified.current) {
      return;
    }

    if (!token) {
      toast({
        title: "Invalid link",
        description: "No verification token found",
        variant: "destructive",
      });
      hasVerified.current = true;
      const localePrefix = locale === "en" ? "" : `/${locale}`;
      setTimeout(() => {
        router.replace(`${localePrefix}/login`);
      }, 1000);
      return;
    }

    hasVerified.current = true;
    let cancelled = false;

    const verify = async () => {
      try {
        const result = await verifyMagicLinkToken(token);
        
        if (cancelled) return;
        const verifyData = result.verifyData;
        logger.debug("[Magic Link Verify] Result:", result);
        logger.debug("[Magic Link Verify] VerifyData:", verifyData);

        const redirectTo = verifyData?.redirectTo ?? result.verifyData?.redirectTo ?? null;

        if (redirectTo) {
          const url = redirectTo.startsWith("http")
            ? redirectTo
            : new URL(redirectTo, window.location.origin).toString();
          window.location.href = url;
          return;
        }

        const redirectPath = routeResolver({
          locale,
          hasToken: true,
          ownerWorkspaces: verifyData?.ownerWorkspaces ?? result.workspaces,
          memberWorkspaces: verifyData?.memberWorkspaces ?? [],
          invites: verifyData?.invites ?? [],
          currentPath: searchParams.toString() ? `/auth/magic-link/verify?${searchParams.toString()}` : "/auth/magic-link/verify",
          fallbackWorkspaceSlug: verifyData?.workspace?.slug ?? result.workspaces?.[0]?.slug,
        });

        logger.debug("[Magic Link Verify] Final redirect path:", redirectPath);
        window.location.href = redirectPath;
      } catch (error) {
        if (cancelled) return;
        
        toast({
          title: "Verification failed",
          description: error instanceof Error ? error.message : "Failed to verify magic link",
          variant: "destructive",
        });
        setStatus("error");
        // Redirect to login after a delay
        const localePrefix = locale === "en" ? "" : `/${locale}`;
        setTimeout(() => {
          if (!cancelled) {
            router.replace(`${localePrefix}/login`);
          }
        }, 3000);
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [token, searchParams, verifyMagicLinkToken, router, locale, toast]);

  if (status === "verifying") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p>Verifying your magic link...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive">Verification failed</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
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
