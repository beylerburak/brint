"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceDashboardPage } from "@/features/workspace/pages/dashboard-page";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useAuth } from "@/features/auth/context/auth-context";

export default function WorkspacePage() {
  const router = useRouter();
  const { workspace, workspaceReady } = useWorkspace();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Check if workspace exists and redirect to not-found if it doesn't
  useEffect(() => {
    // Wait for workspace to be ready and auth to be loaded
    if (!workspaceReady || authLoading || !isAuthenticated) {
      return;
    }

    // If workspace is null, it means workspace doesn't exist
    if (!workspace) {
      router.replace("/not-found");
      return;
    }

    // Check if workspace ID is still a slug (not resolved to actual ID)
    // This means the workspace was not found in user's workspaces
    // If workspace ID matches the slug parameter, it means it wasn't resolved
    // Valid workspace IDs are CUIDs (26 chars starting with 'c') or custom IDs like "ws_beyler"
    // We check if ID is still a slug by comparing it to the slug and checking format
    const isUnresolvedSlug = workspace.id === workspace.slug &&
                             !workspace.id.startsWith('c') &&
                             !workspace.id.startsWith('ws_') &&
                             workspace.id.length < 26; // CUIDs are 26 chars

    if (isUnresolvedSlug) {
      // Workspace ID is still the same as the slug, meaning it wasn't resolved
      // This means workspace doesn't exist in user's workspaces
      router.replace("/not-found");
      return;
    }
  }, [workspace, workspaceReady, authLoading, isAuthenticated, router]);

  // Show nothing while checking or redirecting
  if (!workspaceReady || authLoading || !isAuthenticated) {
    return null;
  }

  if (!workspace) {
    return null; // Will redirect in useEffect
  }

  // Check if workspace is still a slug (not resolved)
  const isUnresolvedSlug = workspace.id === workspace.slug &&
                           !workspace.id.startsWith('c') &&
                           !workspace.id.startsWith('ws_') &&
                           workspace.id.length < 26;

  if (isUnresolvedSlug) {
    return null; // Will redirect in useEffect
  }

  return <WorkspaceDashboardPage workspace={workspace.slug} />;
}

