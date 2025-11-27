"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export type Workspace = {
  id: string;
  slug: string;
  name?: string;
};

interface WorkspaceContextValue {
  workspace: Workspace | null;
  setWorkspace: (ws: Workspace | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
);

export function WorkspaceProvider({
  params,
  children,
}: {
  params: { workspace?: string; locale: string };
  children: React.ReactNode;
}) {
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const pathname = usePathname();

  // Initialize from route params or pathname
  useEffect(() => {
    // First try to use params.workspace if provided
    if (params.workspace) {
      setWorkspaceState({
        id: params.workspace,
        slug: params.workspace,
      });
      return;
    }

    // Otherwise, extract from pathname
    // Pathname format: /[locale]/[workspace]/... or /[locale]/...
    if (pathname) {
      const segments = pathname.split("/").filter(Boolean);
      // segments[0] = locale, segments[1] = workspace (if exists)
      if (segments.length >= 2) {
        const workspaceSlug = segments[1];
        // Check if it's a valid workspace (not a reserved route like 'login', 'signup', etc.)
        const reservedRoutes = [
          "login",
          "signup",
          "sign-up",
          "debug-context",
          "config-debug",
          "http-debug",
          "onboarding",
          "invites",
          "auth",
        ];
        if (!reservedRoutes.includes(workspaceSlug)) {
          setWorkspaceState({
            id: workspaceSlug,
            slug: workspaceSlug,
          });
          return;
        }
      }
    }

    // No workspace found
    setWorkspaceState(null);
  }, [params.workspace, pathname]);

  const setWorkspace = (ws: Workspace | null) => {
    setWorkspaceState(ws);
  };

  const value: WorkspaceContextValue = {
    workspace,
    setWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
