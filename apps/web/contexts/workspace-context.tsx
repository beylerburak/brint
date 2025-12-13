"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { apiClient, ApiError, type UserProfile, type WorkspaceSummary, type WorkspaceDetails } from '@/lib/api-client';
import { buildWorkspaceUrl, buildOnboardingUrl, buildLoginUrl, getLocaleFromPathnameOrParams } from '@/lib/locale-path';

type WorkspaceStatus = "LOADING" | "READY" | "EMPTY" | "NO_ACCESS" | "ERROR";

type WorkspaceContextValue = {
  // User data
  user: UserProfile | null;
  workspaces: WorkspaceSummary[];
  
  // Current workspace (from URL)
  currentWorkspace: WorkspaceDetails | null;
  currentWorkspaceSlug: string | null;
  
  // Status and error
  status: WorkspaceStatus;
  error: { message: string; code?: string } | null;
  
  // Loading states (kept for backward compatibility, but status is source of truth)
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
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const workspaceSlug = params?.workspace as string | undefined;
  const currentLocale = getLocaleFromPathnameOrParams(pathname, params as { locale?: string }) || locale;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceDetails | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>("LOADING");
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  // Load user data on mount
  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ref to track last loaded workspace ID to prevent duplicate requests
  const lastLoadedWorkspaceIdRef = React.useRef<string | null>(null);
  const lastWorkspaceSlugRef = React.useRef<string | null>(null);
  const isLoadingWorkspaceRef = React.useRef<boolean>(false);

  // Load workspace data when slug changes
  useEffect(() => {
    // Only load if we have workspace slug, workspaces loaded, and user data loaded
    if (!workspaceSlug || workspaces.length === 0 || isLoadingUser) {
      return;
    }

    // Check if we already have the correct workspace loaded
    const targetWorkspace = workspaces.find((w) => w.slug === workspaceSlug);
    if (!targetWorkspace) {
      console.warn(`[WorkspaceContext] Target workspace not found for slug: ${workspaceSlug}`);
      return;
    }

    // Skip if current workspace is already the target
    if (currentWorkspace?.id === targetWorkspace.id) {
      lastLoadedWorkspaceIdRef.current = targetWorkspace.id;
      lastWorkspaceSlugRef.current = workspaceSlug;
      // Ensure status is READY
      if (status !== "READY") {
        setStatus("READY");
      }
      return;
    }

    // Skip if we already loaded this workspace (by ID) AND currentWorkspace is set
    if (lastLoadedWorkspaceIdRef.current === targetWorkspace.id && currentWorkspace?.id === targetWorkspace.id) {
      // Also update slug ref to prevent unnecessary re-checks
      if (lastWorkspaceSlugRef.current !== workspaceSlug) {
        lastWorkspaceSlugRef.current = workspaceSlug;
      }
      // Ensure status is READY
      if (status !== "READY") {
        setStatus("READY");
      }
      return;
    }

    // If ref says we loaded it but currentWorkspace is null, reload it
    if (lastLoadedWorkspaceIdRef.current === targetWorkspace.id && !currentWorkspace) {
      // Clear ref to allow reload
      lastLoadedWorkspaceIdRef.current = null;
      lastWorkspaceSlugRef.current = null;
    }

    // Skip if we're already processing this exact slug (use ref to avoid loop)
    if (lastWorkspaceSlugRef.current === workspaceSlug && isLoadingWorkspaceRef.current) {
      return;
    }

    // Mark this slug as being processed (only if not already set)
    if (lastWorkspaceSlugRef.current !== workspaceSlug) {
      lastWorkspaceSlugRef.current = workspaceSlug;
    }
    
    // Load workspace details
    setCurrentWorkspaceFromSummary(workspaceSlug);
    // Don't redirect here - let page/layout handle EMPTY state to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, workspaces, isLoadingUser]);

  const loadUserData = async (skipCache = false) => {
    try {
      setIsLoadingUser(true);
      setStatus("LOADING");
      setError(null);
      
      const response = await apiClient.getMe({ skipCache });
      setUser(response.user);
      setWorkspaces(response.workspaces);
      
      // Determine status based on workspaces
      if (response.workspaces.length === 0) {
        setStatus("EMPTY");
      } else {
        // Keep LOADING status until workspace details are loaded
        // Status will be set to READY in setCurrentWorkspaceFromSummary
        setStatus("LOADING");
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      
      // Handle different error types
      if (err instanceof ApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          setStatus("NO_ACCESS");
          setError({ message: err.message, code: err.code });
          // Don't redirect here - let page/layout handle it to avoid loops
        } else {
          setStatus("ERROR");
          setError({ message: err.message, code: err.code });
        }
      } else {
        setStatus("ERROR");
        setError({ message: 'Failed to load workspace data', code: 'UNKNOWN_ERROR' });
      }
      
      // Don't set user/workspaces on error - they remain null/empty
      setUser(null);
      setWorkspaces([]);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const setCurrentWorkspaceFromSummary = async (slug: string) => {
    // Find workspace from /me response (workspace summary)
    const workspace = workspaces.find((w) => w.slug === slug);
    
    if (!workspace) {
      console.warn(`[WorkspaceContext] Workspace not found for slug: ${slug}`);
      // Workspace slug not in user's workspace list - this is ERROR (not NO_ACCESS)
      // NO_ACCESS is for auth issues (401/403), this is invalid slug/not found
      setStatus("ERROR");
      setError({ message: `Workspace "${slug}" not found or invalid`, code: 'WORKSPACE_NOT_FOUND' });
      setCurrentWorkspace(null);
      // Don't redirect here - let page/layout handle it
      return;
    }

    // Check if we already have this workspace loaded (avoid duplicate requests)
    if (currentWorkspace?.id === workspace.id) {
      // Ensure status is READY if workspace is already loaded
      if (status !== "READY") {
        setStatus("READY");
      }
      return; // Already set
    }

    // Prevent duplicate concurrent requests
    if (isLoadingWorkspace) {
      console.log(`[WorkspaceContext] Already loading workspace, skipping duplicate request for ${slug}`);
      return;
    }

    console.log(`[WorkspaceContext] Loading workspace details for ${slug} (id: ${workspace.id})`);

    // Fetch full workspace details from API (not just summary)
    // Cache will prevent duplicate requests if called multiple times
    try {
      setIsLoadingWorkspace(true);
      isLoadingWorkspaceRef.current = true;
      setError(null);
      const response = await apiClient.getWorkspace(workspace.id);
      setCurrentWorkspace(response.workspace);
      lastLoadedWorkspaceIdRef.current = workspace.id;
      lastWorkspaceSlugRef.current = slug;
      setStatus("READY");
    } catch (err) {
      console.error('Failed to load workspace details:', err);
      
      // Clear refs on error so we can retry
      lastLoadedWorkspaceIdRef.current = null;
      lastWorkspaceSlugRef.current = null;
      
      if (err instanceof ApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          // Auth issue - user lost access
          setStatus("NO_ACCESS");
          setError({ message: err.message, code: err.code });
          // Don't redirect here - proxy or page will handle
        } else if (err.statusCode === 404) {
          // Workspace was deleted or doesn't exist - ERROR (not NO_ACCESS)
          // This is different from auth failure
          setStatus("ERROR");
          setError({ message: 'Workspace not found', code: 'NOT_FOUND' });
        } else {
          setStatus("ERROR");
          setError({ message: err.message, code: err.code });
        }
      } else {
        setStatus("ERROR");
        setError({ message: 'Failed to load workspace', code: 'UNKNOWN_ERROR' });
      }
      
      setCurrentWorkspace(null);
      // Refs already cleared in catch block
    } finally {
      setIsLoadingWorkspace(false);
      isLoadingWorkspaceRef.current = false;
    }
  };

  const refreshUser = async () => {
    // Force refresh bypasses cache
    await loadUserData(true);
  };

  const refreshWorkspace = async (workspaceId: string) => {
    // Fetch detailed workspace info from API
    try {
      setIsLoadingWorkspace(true);
      isLoadingWorkspaceRef.current = true;
      setError(null);
      const response = await apiClient.getWorkspace(workspaceId);
      setCurrentWorkspace(response.workspace);
      lastLoadedWorkspaceIdRef.current = workspaceId;
      setStatus("READY");
    } catch (err) {
      console.error('Failed to refresh workspace:', err);
      
      if (err instanceof ApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          setStatus("NO_ACCESS");
          setError({ message: err.message, code: err.code });
          // Don't redirect - let page handle it
        } else if (err.statusCode === 404) {
          // Workspace deleted/not found - ERROR (not NO_ACCESS)
          setStatus("ERROR");
          setError({ message: 'Workspace not found', code: 'NOT_FOUND' });
        } else {
          setStatus("ERROR");
          setError({ message: err.message, code: err.code });
        }
      } else {
        setStatus("ERROR");
        setError({ message: 'Failed to refresh workspace', code: 'UNKNOWN_ERROR' });
      }
      
      setCurrentWorkspace(null);
      lastLoadedWorkspaceIdRef.current = null;
    } finally {
      setIsLoadingWorkspace(false);
      isLoadingWorkspaceRef.current = false;
    }
  };

  const switchWorkspace = (slug: string) => {
    // Navigation will be handled by Next.js router
    // This is just a placeholder for any cleanup logic
    setCurrentWorkspace(null);
    lastLoadedWorkspaceIdRef.current = null;
    lastWorkspaceSlugRef.current = null;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        workspaces,
        currentWorkspace,
        currentWorkspaceSlug: workspaceSlug || null,
        status,
        error,
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

