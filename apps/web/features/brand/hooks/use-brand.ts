"use client";

/**
 * Brand Detail Hook
 * 
 * Provides single brand data with loading and error states.
 */

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getBrand, getBrandBySlug } from "../api/brand-api";
import type { BrandDetail } from "../types";
import { logger } from "@/shared/utils/logger";

export interface UseBrandReturn {
  brand: BrandDetail | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch a single brand by ID
 */
export function useBrand(brandId: string | null | undefined): UseBrandReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { tokenReady } = useAuth();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBrand = useCallback(async () => {
    // Wait for both workspace and auth to be ready
    if (!workspaceReady || !workspace?.id || !brandId || !tokenReady) {
      // Only set loading to false if we have all the data but can't proceed
      // Keep loading true if we're still waiting for auth/workspace
      if (workspaceReady && tokenReady && (!workspace?.id || !brandId)) {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getBrand(brandId);
      setBrand(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch brand");
      setError(error);
      setBrand(null);
      logger.error("Failed to fetch brand:", error);
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, brandId, tokenReady]);

  // Fetch on mount and when brandId changes
  useEffect(() => {
    if (workspaceReady && workspace?.id && brandId && tokenReady) {
      fetchBrand();
    }
  }, [workspaceReady, workspace?.id, brandId, tokenReady, fetchBrand]);

  const refresh = useCallback(async () => {
    await fetchBrand();
  }, [fetchBrand]);

  return {
    brand,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook to fetch a single brand by slug
 */
export function useBrandBySlug(slug: string | null | undefined): UseBrandReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { tokenReady } = useAuth();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBrand = useCallback(async () => {
    // Wait for both workspace and auth to be ready
    if (!workspaceReady || !workspace?.id || !slug || !tokenReady) {
      // Only set loading to false if we have all the data but can't proceed
      // Keep loading true if we're still waiting for auth/workspace
      if (workspaceReady && tokenReady && (!workspace?.id || !slug)) {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getBrandBySlug(slug);
      setBrand(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch brand");
      setError(error);
      setBrand(null);
      logger.error("Failed to fetch brand by slug:", error);
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, slug, tokenReady]);

  // Fetch on mount and when slug changes
  useEffect(() => {
    if (workspaceReady && workspace?.id && slug && tokenReady) {
      fetchBrand();
    }
  }, [workspaceReady, workspace?.id, slug, tokenReady, fetchBrand]);

  const refresh = useCallback(async () => {
    await fetchBrand();
  }, [fetchBrand]);

  return {
    brand,
    loading,
    error,
    refresh,
  };
}

