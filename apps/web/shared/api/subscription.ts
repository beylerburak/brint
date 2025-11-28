import { httpClient } from "@/shared/http";
import { getWorkspaceId } from "@/shared/http/workspace-header";

export interface SubscriptionSnapshot {
  workspaceId: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: "ACTIVE" | "CANCELED" | "PAST_DUE";
  renewsAt: string | null;
}

export async function fetchWorkspaceSubscription(workspaceId?: string): Promise<SubscriptionSnapshot | null> {
  const resolvedWorkspaceId = workspaceId ?? getWorkspaceId();
  if (!resolvedWorkspaceId) {
    throw new Error("Workspace ID is required to fetch subscription");
  }

  const response = await httpClient.get<{
    success: boolean;
    data: SubscriptionSnapshot;
  }>(`/workspaces/${resolvedWorkspaceId}/subscription`, {
    headers: { "X-Workspace-Id": resolvedWorkspaceId },
  });

  if (!response.ok) {
    // Log error details for debugging
    const errorCode = (response.details as any)?.error?.code;
    const errorMessage = (response.details as any)?.error?.message;
    
    // Create error object with status and details for proper handling
    const error = new Error(errorMessage || "Failed to fetch subscription") as Error & {
      status?: number;
      code?: string;
      details?: any;
    };
    
    error.status = response.status;
    error.code = errorCode;
    error.details = response.details;
    
    // Throw error so subscription context can handle it properly
    throw error;
  }

  return response.data.data;
}
