import { getCurrentSession } from "./session";
import type { Workspace } from "@/features/auth/api/auth-api";

export interface WorkspaceDashboardData {
  workspace: Workspace & {
    updatedAt: string;
    isOwner: boolean;
  };
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

/**
 * Get workspace dashboard data for a given workspace slug
 * 
 * This function:
 * 1. Gets the current session (user + workspaces)
 * 2. Finds the workspace by slug in user's workspaces
 * 3. Returns workspace data with ownership info
 * 
 * @param params - Workspace slug
 * @returns Workspace dashboard data or null if workspace not found
 */
export async function getWorkspaceDashboardData(params: {
  workspaceSlug: string;
}): Promise<WorkspaceDashboardData | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  // Find workspace in user's workspaces
  const allWorkspaces = [
    ...session.ownerWorkspaces,
    ...session.memberWorkspaces,
  ];

  const workspace = allWorkspaces.find(
    (ws) => ws.slug === params.workspaceSlug
  );

  if (!workspace) {
    return null;
  }

  // Check if user is owner
  const isOwner = session.ownerWorkspaces.some(
    (ws) => ws.id === workspace.id
  );

  return {
    workspace: {
      ...workspace,
      isOwner,
    },
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  };
}

