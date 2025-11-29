"use client";

/**
 * Hashtag Preset Hooks
 * 
 * Provides hooks for managing brand hashtag presets.
 */

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useToast } from "@/components/ui/use-toast";
import {
  listHashtagPresets as listHashtagPresetsApi,
  createHashtagPreset as createHashtagPresetApi,
  updateHashtagPreset as updateHashtagPresetApi,
  deleteHashtagPreset as deleteHashtagPresetApi,
} from "../api/brand-api";
import type {
  BrandHashtagPreset,
  CreateHashtagPresetRequest,
  UpdateHashtagPresetRequest,
} from "../types";
import { logger } from "@/shared/utils/logger";

// ============================================================================
// List Hashtag Presets Hook
// ============================================================================

export interface UseHashtagPresetsReturn {
  presets: BrandHashtagPreset[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch hashtag presets for a brand
 */
export function useHashtagPresets(brandId: string | null | undefined): UseHashtagPresetsReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const [presets, setPresets] = useState<BrandHashtagPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPresets = useCallback(async () => {
    if (!workspaceReady || !workspace?.id || !brandId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await listHashtagPresetsApi(brandId);
      // Ensure result is always an array
      setPresets(Array.isArray(result) ? result : []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch hashtag presets");
      setError(error);
      logger.error("Failed to fetch hashtag presets:", error);
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, brandId]);

  // Fetch on mount and when brandId changes
  useEffect(() => {
    if (workspaceReady && workspace?.id && brandId) {
      fetchPresets();
    }
  }, [workspaceReady, workspace?.id, brandId, fetchPresets]);

  const refresh = useCallback(async () => {
    await fetchPresets();
  }, [fetchPresets]);

  return {
    presets,
    loading,
    error,
    refresh,
  };
}

// ============================================================================
// Create Hashtag Preset Hook
// ============================================================================

export interface UseCreateHashtagPresetReturn {
  createPreset: (data: CreateHashtagPresetRequest) => Promise<BrandHashtagPreset | null>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for creating a new hashtag preset
 */
export function useCreateHashtagPreset(brandId: string): UseCreateHashtagPresetReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPreset = useCallback(async (data: CreateHashtagPresetRequest): Promise<BrandHashtagPreset | null> => {
    if (!workspaceReady || !workspace?.id) {
      const err = new Error("Workspace not ready");
      setError(err);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await createHashtagPresetApi(brandId, data);

      toast({
        title: "Preset created",
        description: `${result.name} has been created successfully.`,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create preset");
      setError(error);
      logger.error("Failed to create hashtag preset:", error);

      toast({
        title: "Failed to create preset",
        description: error.message,
        variant: "destructive",
      });

      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, brandId, toast]);

  return {
    createPreset,
    loading,
    error,
  };
}

// ============================================================================
// Update Hashtag Preset Hook
// ============================================================================

export interface UseUpdateHashtagPresetReturn {
  updatePreset: (data: UpdateHashtagPresetRequest) => Promise<BrandHashtagPreset | null>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for updating a hashtag preset
 */
export function useUpdateHashtagPreset(brandId: string, presetId: string): UseUpdateHashtagPresetReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updatePreset = useCallback(async (data: UpdateHashtagPresetRequest): Promise<BrandHashtagPreset | null> => {
    if (!workspaceReady || !workspace?.id) {
      const err = new Error("Workspace not ready");
      setError(err);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await updateHashtagPresetApi(brandId, presetId, data);

      toast({
        title: "Preset updated",
        description: "Changes have been saved successfully.",
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to update preset");
      setError(error);
      logger.error("Failed to update hashtag preset:", error);

      toast({
        title: "Failed to update preset",
        description: error.message,
        variant: "destructive",
      });

      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, brandId, presetId, toast]);

  return {
    updatePreset,
    loading,
    error,
  };
}

// ============================================================================
// Delete Hashtag Preset Hook
// ============================================================================

export interface UseDeleteHashtagPresetReturn {
  deletePreset: () => Promise<boolean>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for deleting a hashtag preset
 */
export function useDeleteHashtagPreset(brandId: string, presetId: string): UseDeleteHashtagPresetReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deletePreset = useCallback(async (): Promise<boolean> => {
    if (!workspaceReady || !workspace?.id) {
      const err = new Error("Workspace not ready");
      setError(err);
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      await deleteHashtagPresetApi(brandId, presetId);

      toast({
        title: "Preset deleted",
        description: "The preset has been deleted successfully.",
      });

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to delete preset");
      setError(error);
      logger.error("Failed to delete hashtag preset:", error);

      toast({
        title: "Failed to delete preset",
        description: error.message,
        variant: "destructive",
      });

      return false;
    } finally {
      setLoading(false);
    }
  }, [workspaceReady, workspace?.id, brandId, presetId, toast]);

  return {
    deletePreset,
    loading,
    error,
  };
}

