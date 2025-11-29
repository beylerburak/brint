import { httpClient } from "../http/http-client";

export interface ActivityItem {
  id: string;
  timestamp: string;
  type: string;
  actorType: string;
  source: string;
  workspaceId: string | null;
  userId: string | null;
  scopeType: string | null;
  scopeId: string | null;
  title: string;
  summary: string;
  details?: string;
  metadata: Record<string, unknown>;
}

export interface GetWorkspaceActivityResponse {
  success: boolean;
  data: {
    items: ActivityItem[];
    nextCursor: string | null;
  };
}

/**
 * Get user's most recent activity across all workspaces
 * Returns the workspace ID of the most recent activity, or null if no activity found
 */
export async function getUserMostRecentActivityWorkspaceId(
  workspaceIds: string[]
): Promise<string | null> {
  if (workspaceIds.length === 0) {
    return null;
  }

  try {
    // Fetch recent activity from each workspace (limit 1, most recent)
    const activityPromises = workspaceIds.map(async (workspaceId) => {
      try {
        const response = await httpClient.get<GetWorkspaceActivityResponse>(
          `/workspaces/${workspaceId}/activity?limit=1`,
          {
            headers: {
              "X-Workspace-Id": workspaceId,
            },
            skipAuth: false,
          }
        );

        if (response.ok && response.data?.success && response.data.data.items.length > 0) {
          const mostRecent = response.data.data.items[0];
          return {
            workspaceId,
            timestamp: mostRecent.timestamp,
          };
        }
      } catch (error) {
        // Silently fail for individual workspace queries
        // If one workspace fails, we'll use others
      }
      return null;
    });

    const results = await Promise.all(activityPromises);
    const validResults = results.filter(
      (r): r is { workspaceId: string; timestamp: string } => r !== null
    );

    if (validResults.length === 0) {
      return null;
    }

    // Sort by timestamp (most recent first)
    validResults.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return validResults[0].workspaceId;
  } catch (error) {
    // If activity fetch fails, return null (fallback to default behavior)
    return null;
  }
}

