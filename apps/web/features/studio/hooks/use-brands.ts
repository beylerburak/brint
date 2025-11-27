"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getBrands, type Brand } from "@/features/studio/api/brand-api";
import { apiCache } from "@/shared/api/cache";

export function useBrands() {
  const { workspace, workspaceReady } = useWorkspace();
  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!workspaceReady || !workspace?.id) {
      setBrands([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadBrands = async () => {
      try {
        setLoading(true);
        setError(null);
        const brandsList = await apiCache.getOrFetch(
          `brands:${workspace.id}`,
          () => getBrands(workspace.id),
          60000 // 60 seconds cache
        );

        if (!cancelled) {
          setBrands(brandsList);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to load brands");
        console.warn("Failed to load brands:", error);
        if (!cancelled) {
          setBrands([]);
          setError(error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadBrands();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id, workspaceReady]);

  return { brands, loading, error };
}
