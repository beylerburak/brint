"use client";

/**
 * Brand Mutation Hooks
 * 
 * Provides hooks for creating, updating, and archiving brands.
 */

import { useState, useCallback } from "react";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useToast } from "@/components/ui/use-toast";
import {
  createBrand as createBrandApi,
  updateBrand as updateBrandApi,
  archiveBrand as archiveBrandApi,
} from "../api/brand-api";
import type { CreateBrandRequest, UpdateBrandRequest, BrandDetail } from "../types";
import { logger } from "@/shared/utils/logger";

// ============================================================================
// Create Brand Hook
// ============================================================================

export interface UseCreateBrandReturn {
  createBrand: (data: CreateBrandRequest) => Promise<BrandDetail | null>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for creating a new brand
 */
export function useCreateBrand(): UseCreateBrandReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createBrand = useCallback(async (data: CreateBrandRequest): Promise<BrandDetail | null> => {
    if (!workspaceReady || !workspace?.id) {
      const err = new Error("Workspace not ready");
      setError(err);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await createBrandApi(data);

      toast({
        title: "Brand created",
        description: `${result.name} has been created successfully.`,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create brand");
      setError(error);
      logger.error("Failed to create brand:", error);

      toast({
        title: "Failed to create brand",
        description: error.message,
        variant: "destructive",
      });

      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, toast]);

  return {
    createBrand,
    loading,
    error,
  };
}

// ============================================================================
// Update Brand Hook
// ============================================================================

export interface UseUpdateBrandReturn {
  updateBrand: (data: UpdateBrandRequest) => Promise<BrandDetail | null>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for updating a brand
 */
export function useUpdateBrand(brandId: string): UseUpdateBrandReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateBrand = useCallback(async (data: UpdateBrandRequest): Promise<BrandDetail | null> => {
    if (!workspaceReady || !workspace?.id) {
      const err = new Error("Workspace not ready");
      setError(err);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await updateBrandApi(brandId, data);

      toast({
        title: "Brand updated",
        description: "Changes have been saved successfully.",
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to update brand");
      setError(error);
      logger.error("Failed to update brand:", error);

      toast({
        title: "Failed to update brand",
        description: error.message,
        variant: "destructive",
      });

      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, brandId, toast]);

  return {
    updateBrand,
    loading,
    error,
  };
}

// ============================================================================
// Archive Brand Hook
// ============================================================================

export interface UseArchiveBrandReturn {
  archiveBrand: () => Promise<boolean>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for archiving (soft deleting) a brand
 */
export function useArchiveBrand(brandId: string | null): UseArchiveBrandReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const archiveBrand = useCallback(async (): Promise<boolean> => {
    if (!workspaceReady || !workspace?.id || !brandId) {
      const err = new Error("Workspace or brand not ready");
      setError(err);
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      await archiveBrandApi(brandId);

      toast({
        title: "Brand archived",
        description: "The brand has been archived successfully.",
      });

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to archive brand");
      setError(error);
      logger.error("Failed to archive brand:", error);

      toast({
        title: "Failed to archive brand",
        description: error.message,
        variant: "destructive",
      });

      return false;
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, brandId, toast]);

  return {
    archiveBrand,
    loading,
    error,
  };
}

