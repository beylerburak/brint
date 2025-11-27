/**
 * Utility to get workspace ID for API requests
 * This function should be called from client components that have access to workspace context
 */

let workspaceIdGetter: (() => string | null) | null = null;

/**
 * Sets the workspace ID getter function
 * Should be called from workspace context provider
 */
export function setWorkspaceIdGetter(getter: () => string | null): void {
  workspaceIdGetter = getter;
}

/**
 * Gets the current workspace ID
 * Returns null if no workspace is available
 */
export function getWorkspaceId(): string | null {
  if (!workspaceIdGetter) {
    return null;
  }
  return workspaceIdGetter();
}

