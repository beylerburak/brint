type WorkspaceLike = { slug: string; id?: string; updatedAt?: string | null };
type InviteLike = { updatedAt?: string | null };

export interface RouteResolverInput {
  locale: string;
  hasToken: boolean;
  ownerWorkspaces?: WorkspaceLike[];
  memberWorkspaces?: WorkspaceLike[];
  invites?: InviteLike[];
  currentPath?: string; // e.g. "/en/login"
  fallbackWorkspaceSlug?: string | null;
  useActivityBasedSelection?: boolean; // If true, use activity-based workspace selection
}

/**
 * Resolves the correct post-auth route based on workspace/invite state.
 * Implements the shared redirect rules for onboarding/invites/workspace home.
 * 
 * If useActivityBasedSelection is true, will try to select workspace based on
 * user's most recent activity. Falls back to most recently updated workspace if
 * activity data is unavailable.
 */
export async function routeResolver(input: RouteResolverInput): Promise<string> {
  const {
    locale,
    hasToken,
    ownerWorkspaces = [],
    memberWorkspaces = [],
    invites = [],
    currentPath,
    fallbackWorkspaceSlug,
    useActivityBasedSelection = false,
  } = input;

  const localePrefix = locale === "en" ? "" : `/${locale}`;

  // If no token, always send to login
  if (!hasToken) {
    return `${localePrefix}/login`;
  }

  const normalizedPath = normalizePath(currentPath, locale);
  const isAuthPage = normalizedPath === "/login";

  const allWorkspaces = [...ownerWorkspaces, ...memberWorkspaces].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });

  // If user is on login while authenticated, send to workspace selection logic
  if (isAuthPage) {
    const target = await selectWorkspace(
      allWorkspaces,
      fallbackWorkspaceSlug,
      useActivityBasedSelection
    );
    if (target) return `${localePrefix}/${target}/dashboard`;
  }

  // No workspaces -> check invites then onboarding
  if (allWorkspaces.length === 0) {
    if (invites.length > 0) {
      return `${localePrefix}/invites`;
    }
    return `${localePrefix}/onboarding`;
  }

  // Workspaces exist -> pick workspace (activity-based or most recently updated)
  const workspaceSlug = await selectWorkspace(
    allWorkspaces,
    fallbackWorkspaceSlug,
    useActivityBasedSelection
  );
  if (!workspaceSlug) {
    return `${localePrefix}/onboarding`;
  }

  return `${localePrefix}/${workspaceSlug}/dashboard`;
}

function normalizePath(pathname: string | undefined, locale: string): string | undefined {
  if (!pathname) return undefined;
  const prefix = locale === "en" ? "" : `/${locale}`;
  if (prefix && pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length) || "/";
  }
  return pathname;
}

async function selectWorkspace(
  workspaces: WorkspaceLike[],
  fallbackSlug?: string | null,
  useActivityBasedSelection = false
): Promise<string> {
  if (workspaces.length === 0) {
    return fallbackSlug ?? "";
  }

  // If activity-based selection is enabled, try to find workspace with most recent activity
  if (useActivityBasedSelection) {
    try {
      // Import dynamically to avoid circular dependencies
      const { getUserMostRecentActivityWorkspaceId } = await import("../api/activity");

      // Get workspace IDs (filter out workspaces without IDs)
      const workspaceIds = workspaces
        .map((ws) => ws.id)
        .filter((id): id is string => !!id);

      if (workspaceIds.length > 0) {
        const mostRecentActivityWorkspaceId =
          await getUserMostRecentActivityWorkspaceId(workspaceIds);

        if (mostRecentActivityWorkspaceId) {
          // Find workspace with matching ID
          const workspace = workspaces.find(
            (ws) => ws.id === mostRecentActivityWorkspaceId
          );
          if (workspace) {
            return workspace.slug;
          }
        }
      }
    } catch (error) {
      // If activity fetch fails, fall back to default behavior (most recently updated)
      // Silently continue to default selection
    }
  }

  // Default: return most recently updated workspace (first in sorted array)
  return workspaces[0].slug;
}

/**
 * Resolves the workspace-aware path when switching workspaces.
 * Preserves the current route template (settings, dashboard) in the new workspace.
 */
export function resolveWorkspacePath(locale: string, newWorkspace: string, pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);

  const last = segments[segments.length - 1];

  if (last === "settings") return `/${locale}/${newWorkspace}/settings`;

  // default → workspace homepage (dashboard)
  return `/${locale}/${newWorkspace}`;
}
