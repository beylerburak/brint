/**
 * Prefetch subscriptions for all workspaces
 * Called after login or when session is loaded
 */

import { fetchWorkspaceSubscription } from "@/shared/api/subscription";
import { apiCache } from "@/shared/api/cache";
import { logger } from "@/shared/utils/logger";

export interface Workspace {
  id: string;
  slug: string;
  name?: string;
}

/**
 * Prefetch subscriptions for all accessible workspaces
 * This runs in the background and caches results for fast access
 */
export async function prefetchSubscriptionsForWorkspaces(
  workspaces: Workspace[]
): Promise<void> {
  if (!workspaces || workspaces.length === 0) {
    return;
  }

  logger.debug(`[Subscription] Prefetching subscriptions for ${workspaces.length} workspace(s)`);

  // Fetch all subscriptions in parallel
  // Use fetchWorkspaceSubscription directly with workspace ID to bypass workspace context dependency
  const promises = workspaces.map(async (workspace) => {
    try {
      // Fetch subscription directly with workspace ID
      const subscription = await fetchWorkspaceSubscription(workspace.id);
      
      // Manually cache the result so subscription context can use it immediately
      const cacheKey = `subscription:${workspace.id}`;
      apiCache.set(cacheKey, subscription);
      
      return { workspaceId: workspace.id, success: true, subscription };
    } catch (error) {
      // Silently fail for individual workspaces - some might not have subscriptions or permissions
      // This is expected for workspaces without subscription access
      const errorCode = (error as any)?.code;
      const errorStatus = (error as any)?.status;
      
      // Only log non-permission errors
      if (errorStatus !== 403 && errorCode !== "PERMISSION_DENIED") {
        logger.debug(`[Subscription] Failed to prefetch for workspace ${workspace.id}:`, error);
      }
      return { workspaceId: workspace.id, success: false };
    }
  });

  const results = await Promise.allSettled(promises);
  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  
  logger.debug(`[Subscription] Prefetch complete: ${successful}/${workspaces.length} successful`);
  
  // Emit custom event to notify components that subscriptions have been prefetched
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("subscriptions-prefetched", {
      detail: { workspaceIds: workspaces.map((ws) => ws.id) },
    }));
  }
}

