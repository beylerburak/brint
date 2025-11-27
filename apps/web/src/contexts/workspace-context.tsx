"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { locales, defaultLocale } from "@/lib/i18n/locales";

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
  if (segments.length === 0) return null;

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

  // Determine locale prefix
  const first = segments[0];
  const firstIsLocale = (locales as readonly string[]).includes(first);

  const workspaceSlug = firstIsLocale ? segments[1] : first;

  if (!workspaceSlug) return null;
  if (reservedRoutes.includes(workspaceSlug)) return null;

  return { id: workspaceSlug, slug: workspaceSlug };
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
