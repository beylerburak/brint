import { httpClient } from "@/shared/http";

export interface SubscriptionSnapshot {
  workspaceId: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: "ACTIVE" | "CANCELED" | "PAST_DUE";
  renewsAt: string | null;
}

export async function fetchWorkspaceSubscription(): Promise<SubscriptionSnapshot | null> {
  const response = await httpClient.get<{
    success: boolean;
    data: SubscriptionSnapshot;
  }>("/workspace/subscription");

  if (!response.ok) {
    return null;
  }

  return response.data.data;
}
