import { httpClient } from "@/shared/http";

export interface SubscriptionResult {
  id: string;
  workspaceId: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: "ACTIVE" | "CANCELED" | "PAST_DUE";
  periodStart?: string | null;
  periodEnd?: string | null;
  cancelAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getWorkspaceSubscription(workspaceId: string): Promise<SubscriptionResult | null> {
  const response = await httpClient.get<{ success: boolean; data: SubscriptionResult | null }>(
    `/workspaces/${workspaceId}/subscription`
  );

  if (!response.ok) {
    return null;
  }

  return response.data.data;
}
