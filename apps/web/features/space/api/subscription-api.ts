import { fetchWorkspaceSubscription, type SubscriptionSnapshot } from "@/shared/api/subscription";

export type SubscriptionResult = SubscriptionSnapshot;

export async function getWorkspaceSubscription(): Promise<SubscriptionResult | null> {
  return fetchWorkspaceSubscription();
}
