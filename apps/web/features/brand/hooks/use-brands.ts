"use client";

/**
 * Brand List Hook
 * 
 * Provides brand list data with cursor-based pagination support.
 */

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { listBrands, type ListBrandsParams, type ListBrandsResult } from "../api/brand-api";
import type { BrandSummary } from "../types";
import { logger } from "@/shared/utils/logger";

export interface UseBrandListOptions {
  limit?: number;
  includeArchived?: boolean;
}

export interface UseBrandListReturn {
  brands: BrandSummary[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and manage brand list
 */
export function useBrandList(options?: UseBrandListOptions): UseBrandListReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const limit = options?.limit ?? 20;
  const includeArchived = options?.includeArchived ?? false;

  const fetchBrands = useCallback(async (cursor?: string, append = false) => {
    if (!workspaceReady || !workspace?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params: ListBrandsParams = {
        limit,
        includeArchived,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const result = await listBrands(params);

      if (append) {
        setBrands((prev) => [...prev, ...result.items]);
      } else {
        setBrands(result.items);
      }

      setNextCursor(result.nextCursor);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch brands");
      setError(error);
      logger.error("Failed to fetch brands:", error);
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, limit, includeArchived]);

  // Initial fetch
  useEffect(() => {
    if (workspaceReady && workspace?.id) {
      fetchBrands();
    }
  }, [workspaceReady, workspace?.id, fetchBrands]);

  const loadMore = useCallback(async () => {
    if (nextCursor && !loading) {
      await fetchBrands(nextCursor, true);
    }
  }, [nextCursor, loading, fetchBrands]);

  const refresh = useCallback(async () => {
    setBrands([]);
    setNextCursor(null);
    await fetchBrands();
  }, [fetchBrands]);

  return {
    brands,
    loading,
    error,
    hasMore: nextCursor !== null,
    loadMore,
    refresh,
  };
}

