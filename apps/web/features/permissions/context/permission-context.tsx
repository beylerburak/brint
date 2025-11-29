"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchPermissionsSnapshot } from "@/shared/api/permissions";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useAuth } from "@/features/auth/context/auth-context";
import { PermissionKey } from "../permission-keys";
import { logger } from "@/shared/utils/logger";

interface PermissionContextValue {
  permissions: PermissionKey[];
  setPermissions: (p: PermissionKey[]) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(
  undefined
);

const STORAGE_PREFIX = "permissions:v1";

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, workspaceReady } = useWorkspace();
  const { user, tokenReady } = useAuth();
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const storageKey = useMemo(() => {
    if (!workspace?.id || !user?.id) return null;
    return `${STORAGE_PREFIX}:${user.id}:${workspace.id}`;
  }, [workspace?.id, user?.id]);

  const readFromCache = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(storageKey);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? (parsed as PermissionKey[]) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const refresh = useCallback(async (retryCount = 0): Promise<void> => {
    // Wait for token and workspace to be ready
    // CRITICAL: workspaceReady must be true - this ensures workspace ID getter is set
    // No heuristics - workspace.id must be resolved (not a slug)
    if (!tokenReady || !workspaceReady || !workspace?.id || !user?.id) {
      setPermissions([]);
      return;
    }
    
    // Double-check: Verify workspace ID getter is actually set
    // This prevents requests when workspace is switching
    const { getWorkspaceId } = await import("@/shared/http/workspace-header");
    const currentWorkspaceId = getWorkspaceId();
    if (!currentWorkspaceId || currentWorkspaceId !== workspace.id) {
      // Workspace ID getter not ready yet, skip this request
      setPermissions([]);
      return;
    }

    setLoading(true);
    try {
      // First, try to get permissions from cache (set by /auth/me)
      const { apiCache } = await import("@/shared/api/cache");
      const permissionsCacheKey = `permissions:${user.id}:${workspace.id}`;
      const cached = apiCache.get<{ workspaceId: string; permissions: string[] }>(
        permissionsCacheKey,
        300000 // 5 minutes TTL
      );

      if (cached?.permissions) {
        setPermissions(cached.permissions as any);
        if (storageKey && typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(cached.permissions));
        }
        setLoading(false);
        return;
      }

      // If not in cache, try localStorage
      if (storageKey && typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem(permissionsCacheKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setPermissions(parsed as any);
              // Also set in memory cache
              apiCache.set(permissionsCacheKey, {
                workspaceId: workspace.id,
                permissions: parsed,
              });
              setLoading(false);
              return;
            }
          }
        } catch {
          // Ignore localStorage errors
        }
      }

      // Fallback to API call if not in cache
      const snapshot = await fetchPermissionsSnapshot();
      if (snapshot?.permissions) {
        setPermissions(snapshot.permissions);
        if (storageKey && typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(snapshot.permissions));
        }
        // Cache in memory
        apiCache.set(permissionsCacheKey, {
          workspaceId: workspace.id,
          permissions: snapshot.permissions,
        });
      } else {
        setPermissions([]);
      }
    } catch (error: any) {
      // Retry only on recoverable errors: AUTH_REQUIRED, WORKSPACE_ID_REQUIRED
      // Other 400/403 errors are not retried (they are permanent validation/permission errors)
      const errorCode = error?.details?.error?.code;
      const isRetryableError = 
        ((error?.status === 401 || error?.status === 400) &&
         (errorCode === "AUTH_REQUIRED" || errorCode === "WORKSPACE_ID_REQUIRED"));
      
      if (isRetryableError && retryCount < 1) {
        // Wait a bit before retry (exponential backoff: 200ms, 400ms)
        const delay = 200 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return refresh(retryCount + 1);
      }
      
      logger.warn("Failed to fetch permissions snapshot", error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, user?.id, workspaceReady, tokenReady, storageKey]);

  useEffect(() => {
    // Wait for both token and workspace to be ready
    // CRITICAL: workspaceReady must be true - this ensures workspace ID getter is set
    // No heuristics - workspace.id must be resolved (not a slug)
    if (!tokenReady || !workspaceReady || !workspace?.id || !user?.id) {
      setPermissions([]);
      return;
    }

    const cached = readFromCache();
    if (cached) {
      setPermissions(cached);
    } else {
      setPermissions([]);
    }

    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, user?.id, workspaceReady, tokenReady]);

  const value: PermissionContextValue = {
    permissions,
    setPermissions,
    loading,
    refresh,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error(
      "usePermissionContext must be used within a PermissionProvider"
    );
  }
  return context;
}
