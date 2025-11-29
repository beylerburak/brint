import { httpClient } from "@/shared/http";

export interface UsageResult {
  limitKey: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  current: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
}

export interface UsageQuery {
  limitKey: string;
  brandId?: string;
}

export async function getUsage(
  workspaceId: string,
  query: UsageQuery
): Promise<UsageResult> {
  const params = new URLSearchParams({
    limitKey: query.limitKey,
  });
  
  if (query.brandId) {
    params.append("brandId", query.brandId);
  }

  const response = await httpClient.get<{ success: boolean; data: UsageResult }>(
    `/workspaces/${workspaceId}/usage?${params.toString()}`,
    {
      headers: { "X-Workspace-Id": workspaceId },
    }
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to get usage");
  }

  return response.data.data;
}
