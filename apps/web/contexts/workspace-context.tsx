"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient, type UserProfile, type WorkspaceSummary, type WorkspaceDetails } from '@/lib/api-client';

type WorkspaceContextValue = {
  // User data
  user: UserProfile | null;
  workspaces: WorkspaceSummary[];
  
  // Current workspace (from URL)
  currentWorkspace: WorkspaceDetails | null;
  currentWorkspaceSlug: string | null;
  
  // Loading states
  isLoadingUser: boolean;
  isLoadingWorkspace: boolean;
  
  // Methods
  refreshUser: () => Promise<void>;
  refreshWorkspace: (workspaceId: string) => Promise<void>;
  switchWorkspace: (slug: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const workspaceSlug = params?.workspace as string | undefined;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceDetails | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  // Load user data on mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Load workspace data when slug changes
  useEffect(() => {
    if (workspaceSlug && workspaces.length > 0) {
      setCurrentWorkspaceFromSummary(workspaceSlug);
    }
  }, [workspaceSlug, workspaces]);

  const loadUserData = async (skipCache = false) => {
    try {
      setIsLoadingUser(true);
      const response = await apiClient.getMe({ skipCache });
      setUser(response.user);
      setWorkspaces(response.workspaces);
    } catch (error) {
      console.error('Failed to load user data:', error);
      // Don't set user/workspaces on error - they remain null/empty
    } finally {
      setIsLoadingUser(false);
    }
  };

  const setCurrentWorkspaceFromSummary = (slug: string) => {
    // Find workspace from /me response (workspace summary)
    const workspace = workspaces.find((w) => w.slug === slug);
    
    if (!workspace) {
      console.warn(`Workspace not found for slug: ${slug}`);
      // User is not a member of this workspace - redirect to first workspace or onboarding
      if (workspaces.length > 0) {
        window.location.href = `/${workspaces[0].slug}/home`;
      } else {
        window.location.href = '/onboarding';
      }
      return;
    }

    // Check if we already have this workspace cached
    if (currentWorkspace?.id === workspace.id) {
      return; // Already set
    }

    // Use workspace summary from /me response
    // No need to call /workspaces/:id unless we need detailed info (like memberCount)
    setCurrentWorkspace({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      ownerUserId: '', // Not available in summary, only in details
      avatarUrl: workspace.avatarUrl,
      timezone: workspace.timezone,
      locale: workspace.locale,
      baseCurrency: workspace.baseCurrency,
      plan: workspace.plan,
      settings: null, // Not available in summary
      createdAt: '', // Not available in summary
      updatedAt: '', // Not available in summary
      memberCount: 0, // Not available in summary
      userRole: workspace.role,
    });
  };

  const refreshUser = async () => {
    // Force refresh bypasses cache
    await loadUserData(true);
  };

  const refreshWorkspace = async (workspaceId: string) => {
    // Fetch detailed workspace info from API
    try {
      setIsLoadingWorkspace(true);
      const response = await apiClient.getWorkspace(workspaceId);
      setCurrentWorkspace(response.workspace);
    } catch (error) {
      console.error('Failed to refresh workspace:', error);
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  const switchWorkspace = (slug: string) => {
    // Navigation will be handled by Next.js router
    // This is just a placeholder for any cleanup logic
    setCurrentWorkspace(null);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        workspaces,
        currentWorkspace,
        currentWorkspaceSlug: workspaceSlug || null,
        isLoadingUser,
        isLoadingWorkspace,
        refreshUser,
        refreshWorkspace,
        switchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

