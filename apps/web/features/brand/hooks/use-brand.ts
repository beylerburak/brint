"use client";

/**
 * Brand Detail Hook
 * 
 * Provides single brand data with loading and error states.
 * Features:
 * - In-memory cache with TTL to avoid redundant fetches
 * - Request deduplication to prevent concurrent requests for same resource
 * - Automatic cache invalidation on refresh
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getWorkspaceId } from "@/shared/http/workspace-header";
import { getBrand, getBrandBySlug } from "../api/brand-api";
import type { BrandDetail } from "../types";
import { logger } from "@/shared/utils/logger";

export interface UseBrandReturn {
  brand: BrandDetail | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// ============================================================================
// In-memory Cache
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  workspaceId: string;
}

// Cache TTL: 5 minutes (brand data doesn't change frequently)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Global caches for brand data
const brandByIdCache = new Map<string, CacheEntry<BrandDetail>>();
const brandBySlugCache = new Map<string, CacheEntry<BrandDetail>>();

// In-flight request tracking for deduplication
const inFlightRequests = new Map<string, Promise<BrandDetail>>();

function getCacheKey(type: "id" | "slug", key: string, workspaceId: string): string {
  return `${type}:${workspaceId}:${key}`;
}

function getFromCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  workspaceId: string
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  // Check if cache is from same workspace
  if (entry.workspaceId !== workspaceId) {
    cache.delete(key);
    return null;
  }
  
  // Check if cache is still valid
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setInCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  data: T,
  workspaceId: string
): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    workspaceId,
  });
}

function invalidateCache(key: string): void {
  brandByIdCache.delete(key);
  brandBySlugCache.delete(key);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch a single brand by ID
 */
export function useBrand(brandId: string | null | undefined): UseBrandReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { tokenReady } = useAuth();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Track if this is the initial mount to use cache
  const hasFetchedRef = useRef(false);

  const fetchBrand = useCallback(async (skipCache = false) => {
    // Wait for both workspace and auth to be ready
    // Also verify getWorkspaceId() returns a value (workspace ID getter is set)
    const httpWorkspaceId = getWorkspaceId();
    if (!workspaceReady || !workspace?.id || !brandId || !tokenReady || !httpWorkspaceId) {
      // Only set loading to false if we have all the data but can't proceed
      // Keep loading true if we're still waiting for auth/workspace
      if (workspaceReady && tokenReady && (!workspace?.id || !brandId)) {
        setLoading(false);
      }
      return;
    }

    const cacheKey = getCacheKey("id", brandId, workspace.id);

    // Check cache first (unless skipCache is true - for refresh)
    if (!skipCache) {
      const cached = getFromCache(brandByIdCache, cacheKey, workspace.id);
      if (cached) {
        setBrand(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    // Check for in-flight request to deduplicate
    const existingRequest = inFlightRequests.get(cacheKey);
    if (existingRequest) {
      try {
        setLoading(true);
        const result = await existingRequest;
        setBrand(result);
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to fetch brand");
        setError(error);
        setBrand(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create and track the request
      const requestPromise = getBrand(brandId);
      inFlightRequests.set(cacheKey, requestPromise);

      const result = await requestPromise;
      
      // Store in cache
      setInCache(brandByIdCache, cacheKey, result, workspace.id);
      
      setBrand(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch brand");
      setError(error);
      setBrand(null);
      logger.error("Failed to fetch brand:", error);
    } finally {
      setLoading(false);
      inFlightRequests.delete(cacheKey);
    }
  }, [workspaceReady, workspace?.id, brandId, tokenReady]);

  // Fetch on mount and when brandId changes
  // Uses a small polling mechanism to wait for workspace ID getter to be ready
  useEffect(() => {
    if (!workspaceReady || !workspace?.id || !brandId || !tokenReady) {
      return;
    }

    // Only fetch if we haven't already
    if (hasFetchedRef.current) {
      return;
    }

    // Check if workspace ID getter is ready
    const httpWorkspaceId = getWorkspaceId();
    if (httpWorkspaceId) {
      // Ready - fetch immediately
      hasFetchedRef.current = true;
      fetchBrand();
      return;
    }

    // Not ready yet - poll every 50ms for up to 500ms
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      const id = getWorkspaceId();
      if (id) {
        clearInterval(interval);
        if (!hasFetchedRef.current) {
          hasFetchedRef.current = true;
          fetchBrand();
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        // Give up and try anyway - HTTP client will retry
        if (!hasFetchedRef.current) {
          hasFetchedRef.current = true;
          fetchBrand();
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [workspaceReady, workspace?.id, brandId, tokenReady, fetchBrand]);

  // Reset fetched flag when brandId changes
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [brandId]);

  const refresh = useCallback(async () => {
    if (brandId && workspace?.id) {
      invalidateCache(getCacheKey("id", brandId, workspace.id));
    }
    await fetchBrand(true);
  }, [fetchBrand, brandId, workspace?.id]);

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
  
  // Track if this is the initial mount to use cache
  const hasFetchedRef = useRef(false);

  const fetchBrand = useCallback(async (skipCache = false) => {
    // Wait for both workspace and auth to be ready
    // Also verify getWorkspaceId() returns a value (workspace ID getter is set)
    const httpWorkspaceId = getWorkspaceId();
    if (!workspaceReady || !workspace?.id || !slug || !tokenReady || !httpWorkspaceId) {
      // Only set loading to false if we have all the data but can't proceed
      // Keep loading true if we're still waiting for auth/workspace
      if (workspaceReady && tokenReady && (!workspace?.id || !slug)) {
        setLoading(false);
      }
      return;
    }

    const cacheKey = getCacheKey("slug", slug, workspace.id);

    // Check cache first (unless skipCache is true - for refresh)
    if (!skipCache) {
      const cached = getFromCache(brandBySlugCache, cacheKey, workspace.id);
      if (cached) {
        setBrand(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    // Check for in-flight request to deduplicate
    const existingRequest = inFlightRequests.get(cacheKey);
    if (existingRequest) {
      try {
        setLoading(true);
        const result = await existingRequest;
        setBrand(result);
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to fetch brand");
        setError(error);
        setBrand(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create and track the request
      const requestPromise = getBrandBySlug(slug);
      inFlightRequests.set(cacheKey, requestPromise);

      const result = await requestPromise;
      
      // Store in cache
      setInCache(brandBySlugCache, cacheKey, result, workspace.id);
      
      setBrand(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch brand");
      setError(error);
      setBrand(null);
      logger.error("Failed to fetch brand by slug:", error);
    } finally {
      setLoading(false);
      inFlightRequests.delete(cacheKey);
    }
  }, [workspaceReady, workspace?.id, slug, tokenReady]);

  // Fetch on mount and when slug changes
  // Uses a small polling mechanism to wait for workspace ID getter to be ready
  useEffect(() => {
    if (!workspaceReady || !workspace?.id || !slug || !tokenReady) {
      return;
    }

    // Only fetch if we haven't already
    if (hasFetchedRef.current) {
      return;
    }

    // Check if workspace ID getter is ready
    const httpWorkspaceId = getWorkspaceId();
    if (httpWorkspaceId) {
      // Ready - fetch immediately
      hasFetchedRef.current = true;
      fetchBrand();
      return;
    }

    // Not ready yet - poll every 50ms for up to 500ms
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      const id = getWorkspaceId();
      if (id) {
        clearInterval(interval);
        if (!hasFetchedRef.current) {
          hasFetchedRef.current = true;
          fetchBrand();
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        // Give up and try anyway - HTTP client will retry
        if (!hasFetchedRef.current) {
          hasFetchedRef.current = true;
          fetchBrand();
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [workspaceReady, workspace?.id, slug, tokenReady, fetchBrand]);

  // Reset fetched flag when slug changes
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [slug]);

  const refresh = useCallback(async () => {
    if (slug && workspace?.id) {
      invalidateCache(getCacheKey("slug", slug, workspace.id));
    }
    await fetchBrand(true);
  }, [fetchBrand, slug, workspace?.id]);

  return {
    brand,
    loading,
    error,
    refresh,
  };
}

