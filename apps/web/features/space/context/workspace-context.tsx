"use client";

import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { locales } from "@/shared/i18n/locales";
import { setWorkspaceIdGetter } from "@/shared/http/workspace-header";
import { getCurrentSession } from "@/features/auth/api/auth-api";

export type Workspace = {
  id: string;
  slug: string;
  name?: string;
};

interface WorkspaceContextValue {
  workspace: Workspace | null;
  setWorkspace: (ws: Workspace | null) => void;
  workspaceReady: boolean;
  isOwner: boolean;
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
  const derivedWorkspace = useMemo(
    () => deriveWorkspace(params.workspace, pathname),
    [params.workspace, pathname]
  );
  const [workspaceOverride, setWorkspaceOverride] = useState<Workspace | null>(
    null
  );
  const [resolvedWorkspace, setResolvedWorkspace] = useState<Workspace | null>(
    derivedWorkspace
  );
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const workspace = resolvedWorkspace;
  const setWorkspace = (ws: Workspace | null) => setWorkspaceOverride(ws);

  // Set workspace ID getter for HTTP client
  // Only set if workspace ID is resolved (not a slug)
  useEffect(() => {
    if (!workspaceReady || !workspace?.id) {
      setWorkspaceIdGetter(() => null);
      return;
    }

    // Check if workspace.id is NOT a slug
    // Slug format: lowercase alphanumeric and hyphens, 3-64 chars
    // Valid workspace IDs: CUID (c + 25 base36 chars) or custom IDs like "ws_beyler"
    // Invalid (slug): short lowercase strings like "beyler", "demo-workspace"
    const isSlug = /^[a-z0-9-]{3,64}$/.test(workspace.id) && 
                   !workspace.id.startsWith('c') && 
                   !workspace.id.startsWith('ws_') &&
                   workspace.id.length < 20; // CUIDs are 26 chars, custom IDs might be longer
    
    if (isSlug) {
      // Workspace ID is still a slug, don't set getter yet
      setWorkspaceIdGetter(() => null);
      return;
    }

    // Workspace ID is resolved (CUID or custom ID like ws_beyler)
    setWorkspaceIdGetter(() => workspace.id ?? null);
    return () => {
      setWorkspaceIdGetter(() => null);
    };
  }, [workspace?.id, workspaceReady]);

  // Resolve workspace ID + name from session when slug changes
  useEffect(() => {
    let cancelled = false;
    const baseWorkspace = workspaceOverride ?? derivedWorkspace;

    // Reset workspaceReady and clear workspace ID getter when workspace changes
    setWorkspaceReady(false);
    setWorkspaceIdGetter(() => null);
    setIsOwner(false);

    if (!baseWorkspace) {
      setResolvedWorkspace(null);
      setWorkspaceReady(true);
      return;
    }

    const hydrate = async () => {
      try {
        const session = await getCurrentSession();
        const allWorkspaces = [
          ...(session?.ownerWorkspaces ?? []),
          ...(session?.memberWorkspaces ?? []),
        ];
        const match = allWorkspaces.find((ws) => ws.slug === baseWorkspace.slug);
        
        // Check if user is owner of this workspace
        const isOwnerWorkspace = session?.ownerWorkspaces?.some(
          (ws) => ws.slug === baseWorkspace.slug
        ) ?? false;

        if (!cancelled) {
          if (match) {
            setResolvedWorkspace({
              id: match.id,
              slug: match.slug,
              name: match.name,
            });
            // Set workspace tag in Sentry
            Sentry.setTag("workspaceId", match.id);
            Sentry.setTag("workspaceSlug", match.slug);
          } else {
            setResolvedWorkspace(baseWorkspace);
            if (baseWorkspace?.id) {
              Sentry.setTag("workspaceId", baseWorkspace.id);
            }
            if (baseWorkspace?.slug) {
              Sentry.setTag("workspaceSlug", baseWorkspace.slug);
            }
          }
          setIsOwner(isOwnerWorkspace);
          setWorkspaceReady(true);
        }
      } catch {
        if (!cancelled) {
          setResolvedWorkspace(baseWorkspace);
          setIsOwner(false);
          setWorkspaceReady(true);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [derivedWorkspace?.slug, workspaceOverride?.slug, workspaceOverride?.id]);

  const value: WorkspaceContextValue = {
    workspace,
    setWorkspace,
    workspaceReady,
    isOwner,
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
    "config-debug",
    "http-debug",
    "onboarding",
    "invites",
    "auth",
    "not-found",
    "404",
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
