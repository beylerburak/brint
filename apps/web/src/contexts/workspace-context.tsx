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
  const pathname = usePathname();
  const [workspace, setWorkspaceState] = useState<Workspace | null>(
    () => deriveWorkspace(params.workspace, pathname)
  );

  // Initialize from route params or pathname
  useEffect(() => {
    setWorkspaceState(deriveWorkspace(params.workspace, pathname));
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

function deriveWorkspace(paramSlug?: string, pathname?: string | null): Workspace | null {
  if (paramSlug) {
    return { id: paramSlug, slug: paramSlug };
  }

  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const workspaceSlug = segments[1];
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
      return { id: workspaceSlug, slug: workspaceSlug };
    }
  }

  return null;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
