"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/use-toast";

export default function MagicLinkVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const { verifyMagicLinkToken } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const hasVerified = useRef(false);

  useEffect(() => {
    // Only verify once
    if (hasVerified.current) {
      return;
    }

    const token = searchParams.get("token");

    if (!token) {
      toast({
        title: "Invalid link",
        description: "No verification token found",
        variant: "destructive",
      });
      hasVerified.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setStatus("error");
      return;
    }

    hasVerified.current = true;
    let cancelled = false;

    const verify = async () => {
      try {
        const result = await verifyMagicLinkToken(token);
        
        if (cancelled) return;
        
        const localePrefix = locale === "en" ? "" : `/${locale}`;
        let redirectPath: string;

        const verifyData = result.verifyData;
        console.log("[Magic Link Verify] Result:", result);
        console.log("[Magic Link Verify] VerifyData:", verifyData);
        
        if (!verifyData) {
          // Fallback to old logic if verifyData not available
          redirectPath = result.workspaces.length > 0
            ? `${localePrefix}/${result.workspaces[0].slug}/dashboard`
            : `${localePrefix}/onboarding`;
          console.log("[Magic Link Verify] No verifyData, redirecting to:", redirectPath);
          router.replace(redirectPath);
          setStatus("success");
          return;
        }

        const { ownerWorkspaces, memberWorkspaces, workspace } = verifyData;
        console.log("[Magic Link Verify] Owner workspaces:", ownerWorkspaces);
        console.log("[Magic Link Verify] Member workspaces:", memberWorkspaces);

        // Rule 1 & 2: İlk defa geldiyse veya workspace'i yoksa -> /onboarding
        if (ownerWorkspaces.length === 0 && memberWorkspaces.length === 0) {
          // Rule 3: Workspace'i yok ama invite edildiyse ve daha katılmadıysa -> /invites
          // TODO: Check for pending invites (will be implemented later)
          // For now, go to onboarding
          redirectPath = `${localePrefix}/onboarding`;
          console.log("[Magic Link Verify] No workspaces, redirecting to onboarding");
        }
        // Rule 4-7: Workspace selection logic
        else {
          // Combine all workspaces (owner + member), sorted by updatedAt (most recent first)
          const allWorkspaces = [
            ...ownerWorkspaces.map((w) => ({ ...w, isOwner: true })),
            ...memberWorkspaces.map((w) => ({ ...w, isOwner: false })),
          ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          if (allWorkspaces.length > 0) {
            // Use the most recently updated workspace (Rule 4, 5, 6, 7)
            const targetWorkspace = allWorkspaces[0];
            redirectPath = `${localePrefix}/${targetWorkspace.slug}/dashboard`;
            console.log("[Magic Link Verify] Redirecting to workspace:", targetWorkspace.slug);
          } else {
            // Fallback to onboarding
            redirectPath = `${localePrefix}/onboarding`;
            console.log("[Magic Link Verify] Fallback to onboarding");
          }
        }

        console.log("[Magic Link Verify] Final redirect path:", redirectPath);
        
        // Use window.location for immediate redirect (more reliable than router)
        if (redirectPath) {
          window.location.href = redirectPath;
          return; // Don't set status, let redirect happen
        }
        
        // Fallback to router if no path
        router.replace(redirectPath || `${localePrefix}/login`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setStatus("success");
      } catch (error) {
        if (cancelled) return;
        
        toast({
          title: "Verification failed",
          description: error instanceof Error ? error.message : "Failed to verify magic link",
          variant: "destructive",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [searchParams, verifyMagicLinkToken, router, locale, toast]);

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

