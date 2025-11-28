"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/workspace/components/sidebar/app-sidebar";
import { WorkspaceHeader } from "@/features/workspace/components/workspace-header";
import { ProfileCompletionDialog } from "@/features/workspace/components/profile-completion-dialog";
import { getUserProfile, type UserProfile } from "@/features/workspace/api/user-api";
import { useAuth } from "@/features/auth/context/auth-context";

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
  
  // Don't show workspace sidebar in studio routes (both /studio and /studio/[brand])
  const isStudioRoute = pathname?.includes("/studio");

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
        
        console.error("Failed to get user profile:", err);
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
    getUserProfile().then(setUserProfile).catch(console.error);
  };

  if (isStudioRoute) {
    // In studio routes, only render children (studio sidebar will be in studio layout)
    return <>{children}</>;
  }

  return (
    <>
      {showProfileDialog && userProfile && (
        <ProfileCompletionDialog user={userProfile} onComplete={handleProfileComplete} />
      )}
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <WorkspaceHeader workspace={workspace} />
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </>
  );
}

