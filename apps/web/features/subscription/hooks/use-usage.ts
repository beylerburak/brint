"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getUsage, type UsageResult } from "@/features/workspace/api/usage-api";
import { apiCache } from "@/shared/api/cache";
import type { LimitKey } from "../config/limits";

export interface UseUsageResult {
  data: UsageResult | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get current usage for a subscription limit
 * Automatically fetches from backend and caches the result
 */
export function useUsage(
  limitKey: LimitKey,
  brandId?: string
): UseUsageResult {
  const { workspace, workspaceReady } = useWorkspace();
  const [data, setData] = useState<UsageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsage = async () => {
    if (!workspaceReady || !workspace?.id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const cacheKey = `usage:${workspace.id}:${limitKey}${brandId ? `:${brandId}` : ""}`;
      
      const usage = await apiCache.getOrFetch(
        cacheKey,
        async () => {
          return await getUsage(workspace.id, { limitKey, brandId });
        },
        30000 // 30 seconds cache
      );

      setData(usage);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch usage");
      setError(error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [workspace?.id, workspaceReady, limitKey, brandId]);

  return {
    data,
    loading,
    error,
    refetch: fetchUsage,
  };
}
