type WorkspaceLike = { slug: string; updatedAt?: string | null };
type InviteLike = { updatedAt?: string | null };

export interface RouteResolverInput {
  locale: string;
  hasToken: boolean;
  ownerWorkspaces?: WorkspaceLike[];
  memberWorkspaces?: WorkspaceLike[];
  invites?: InviteLike[];
  currentPath?: string; // e.g. "/en/login"
  fallbackWorkspaceSlug?: string | null;
}

/**
 * Resolves the correct post-auth route based on workspace/invite state.
 * Implements the shared redirect rules for onboarding/invites/workspace home.
 */
export function routeResolver(input: RouteResolverInput): string {
  const {
    locale,
    hasToken,
    ownerWorkspaces = [],
    memberWorkspaces = [],
    invites = [],
    currentPath,
    fallbackWorkspaceSlug,
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
    const target = selectWorkspace(allWorkspaces, fallbackWorkspaceSlug);
    if (target) return `${localePrefix}/${target}/dashboard`;
  }

  // No workspaces -> check invites then onboarding
  if (allWorkspaces.length === 0) {
    if (invites.length > 0) {
      return `${localePrefix}/invites`;
    }
    return `${localePrefix}/onboarding`;
  }

  // Workspaces exist -> pick most recently updated (owner/member agnostic)
  const workspaceSlug = selectWorkspace(allWorkspaces, fallbackWorkspaceSlug);
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

function selectWorkspace(workspaces: WorkspaceLike[], fallbackSlug?: string | null): string {
  if (workspaces.length > 0) {
    return workspaces[0].slug;
  }
  return fallbackSlug ?? "";
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
