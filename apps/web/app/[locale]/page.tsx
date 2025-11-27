"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentSession } from "@/shared/api/auth";

export default function HomePage() {
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const redirect = async () => {
      const localePrefix = locale === "en" ? "" : `/${locale}`;

      if (!isAuthenticated) {
        // Not authenticated - redirect to login
        router.replace(`${localePrefix}/login`);
        return;
      }

      try {
        // Get user workspaces
        const session = await getCurrentSession();
        
        if (session) {
          const { ownerWorkspaces, memberWorkspaces } = session;
          const allWorkspaces = [...ownerWorkspaces, ...memberWorkspaces].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

          if (allWorkspaces.length > 0) {
            // User has workspaces - redirect to most recent one
            const targetWorkspace = allWorkspaces[0];
            router.replace(`${localePrefix}/${targetWorkspace.slug}/dashboard`);
            return;
          } else {
            // No workspaces - redirect to onboarding
            router.replace(`${localePrefix}/onboarding`);
            return;
          }
        } else {
          // Could not get session - redirect to login
          router.replace(`${localePrefix}/login`);
        }
      } catch (error) {
        console.error("Error getting session:", error);
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

