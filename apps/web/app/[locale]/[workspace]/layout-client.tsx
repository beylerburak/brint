"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/animate-ui/components/radix/sidebar";
import { SpaceSidebar } from "@/features/space/components/space-sidebar";
import { SpaceHeader } from "@/features/space/components/space-header";
import { ProfileCompletionDialog } from "@/features/space/components/profile-completion-dialog";
import { getUserProfile, type UserProfile } from "@/features/space/api/user-api";
import { useAuth } from "@/features/auth/context/auth-context";
import { NotificationsProvider } from "@/features/notifications";
import { logger } from "@/shared/utils/logger";

export function WorkspaceLayoutClient({
  children,
  workspace,
}: {
  children: React.ReactNode;
  workspace: string;
}) {
  const pathname = usePathname();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false);


  // Check if user profile needs completion
  useEffect(() => {
    if (authLoading || !isAuthenticated || hasCheckedProfile) {
      return;
    }

    let cancelled = false;

    const checkProfile = async () => {
      try {
        const profile = await getUserProfile();
        if (!cancelled) {
          setUserProfile(profile);
          setHasCheckedProfile(true);
          
          // Show dialog if name or username is missing
          if (!profile.name || !profile.username) {
            setShowProfileDialog(true);
          }
        }
      } catch (err) {
        // Ignore 401 errors (user not authenticated yet)
        // This can happen during initial load or if token is invalid
        // The error message from httpClient is "Request failed with status 401"
        if (
          err instanceof Error && 
          (err.message.includes("401") || err.message.includes("Authentication failed"))
        ) {
          // Silently ignore - user will be redirected by ProtectedLayout
          if (!cancelled) {
            setHasCheckedProfile(true);
          }
          return;
        }
        
        logger.error("Failed to get user profile:", err);
        if (!cancelled) {
          setHasCheckedProfile(true);
        }
      }
    };

    void checkProfile();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, hasCheckedProfile]);

  const handleProfileComplete = () => {
    setShowProfileDialog(false);
    // Refresh user profile
    getUserProfile().then(setUserProfile).catch((error) => logger.error("Failed to get user profile:", error));
  };

  // Show nothing while auth is loading
  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <NotificationsProvider>
      {showProfileDialog && userProfile && (
        <ProfileCompletionDialog user={userProfile} onComplete={handleProfileComplete} />
      )}
      <SidebarProvider>
        <SpaceSidebar />
        <SidebarInset>
          <SpaceHeader workspace={workspace} />
          <div className="flex flex-1 flex-col">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </NotificationsProvider>
  );
}

