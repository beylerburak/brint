"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useAuth } from "@/features/auth/context/auth-context";
import { useHasPermission } from "@/permissions";
import { SUBSCRIPTION_PERMISSION } from "@/features/permissions/permission-keys";
import { getWorkspaceSubscription, type SubscriptionResult } from "@/features/workspace/api/subscription-api";
import { apiCache } from "@/shared/api/cache";
import type { SubscriptionPlan } from "../config/plans";

interface SubscriptionContextValue {
  subscription: SubscriptionResult | null;
  plan: SubscriptionPlan;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { workspace, workspaceReady } = useWorkspace();
  const { tokenReady } = useAuth();
  const hasSettingsPermission = useHasPermission(SUBSCRIPTION_PERMISSION);
  const [subscription, setSubscription] = useState<SubscriptionResult | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSubscription = async (retryCount = 0, previousWorkspaceId?: string) => {
    setLoading(true);
    
    // Wait for token and workspace to be ready
    // CRITICAL: workspaceReady must be true - this ensures workspace ID getter is set
    // No heuristics - workspace.id must be resolved (not a slug)
    if (!tokenReady || !workspaceReady || !workspace?.id) {
      console.debug("[Subscription] Skipping load - not ready:", {
        tokenReady,
        workspaceReady,
        workspaceId: workspace?.id,
      });
      setSubscription(null);
      setLoading(false);
      return;
    }
    
    // Double-check: Verify workspace ID getter is actually set
    // This prevents requests when workspace is switching
    const { getWorkspaceId } = await import("@/shared/http/workspace-header");
    const currentWorkspaceId = getWorkspaceId();
    if (!currentWorkspaceId || currentWorkspaceId !== workspace.id) {
      console.debug("[Subscription] Skipping load - workspace ID mismatch:", {
        getterWorkspaceId: currentWorkspaceId,
        contextWorkspaceId: workspace.id,
      });
      // Workspace ID getter not ready yet, skip this request
      setSubscription(null);
      setLoading(false);
      return;
    }
    
    // If workspace changed, invalidate old workspace cache and force fresh fetch
    const workspaceChanged = previousWorkspaceId && previousWorkspaceId !== workspace.id;
    if (workspaceChanged) {
      console.log("[Subscription] Workspace changed, invalidating caches:", {
        from: previousWorkspaceId,
        to: workspace.id,
      });
      apiCache.invalidate(`subscription:${previousWorkspaceId}`);
      apiCache.invalidate(`subscription:${workspace.id}`); // Force fresh fetch for new workspace
    }
    
    console.debug("[Subscription] Loading subscription for workspace:", workspace.id);

    // Skip subscription fetch if user doesn't have permission
    // This endpoint requires the subscription permission (workspace:settings.view)
    if (!hasSettingsPermission) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      // If workspace changed, bypass cache and fetch fresh data
      let sub: SubscriptionResult | null;
      if (workspaceChanged) {
        console.log("[Subscription] Fetching fresh subscription (workspace changed)");
        // Direct fetch without cache
        sub = await getWorkspaceSubscription();
        // Cache the fresh result manually for future use
        const cacheKey = `subscription:${workspace.id}`;
        const now = Date.now();
        // Store in cache (we'll access the internal cache structure)
        // For now, just use the data directly - next call will use cache
      } else {
        sub = await apiCache.getOrFetch(
          `subscription:${workspace.id}`,
          async () => {
            const result = await getWorkspaceSubscription();
            return result;
          },
          60000 // 60 seconds cache
        );
      }

      setSubscription(sub);
      
      // Emit event when subscription is loaded/updated
      if (typeof window !== "undefined" && workspace?.id) {
        window.dispatchEvent(new CustomEvent("subscription-updated", {
          detail: { workspaceId: workspace.id },
        }));
      }
    } catch (error: any) {
      // Extract error code from error object
      const errorCode = error?.code || error?.details?.error?.code;
      const errorStatus = error?.status;
      
      // Retry only on recoverable errors: AUTH_REQUIRED, WORKSPACE_ID_REQUIRED
      // Other 400/403 errors are not retried (they are permanent validation/permission errors)
      const isRetryableError = 
        (errorStatus === 401 || errorStatus === 400) &&
        (errorCode === "AUTH_REQUIRED" ||
         errorCode === "WORKSPACE_ID_REQUIRED");
      
      if (isRetryableError && retryCount < 1) {
        // Wait a bit before retry (exponential backoff: 200ms, 400ms)
        const delay = 200 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return loadSubscription(retryCount + 1);
      }
      
      // For 403, silently fail (user doesn't have permission)
      if (errorStatus === 403 || errorCode === "PERMISSION_DENIED") {
        console.warn(`Subscription fetch denied - user lacks ${SUBSCRIPTION_PERMISSION} permission`);
        setSubscription(null);
      } else if (errorCode === "WORKSPACE_MISMATCH") {
        console.warn("Subscription fetch failed: Workspace ID mismatch between path and header");
        setSubscription(null);
      } else {
        console.warn("Failed to load subscription:", {
          status: errorStatus,
          code: errorCode,
          message: error?.message,
        });
        setSubscription(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Track previous workspace ID to detect changes
  const previousWorkspaceIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Wait for workspace ID to be resolved (not a slug)
    if (!workspace?.id) {
      setSubscription(null);
      setLoading(false);
      previousWorkspaceIdRef.current = undefined;
      return;
    }
    
    const previousWorkspaceId = previousWorkspaceIdRef.current;
    const currentWorkspaceId = workspace.id;
    
    // Update ref for next render
    previousWorkspaceIdRef.current = currentWorkspaceId;
    
    // Load subscription with previous workspace ID to detect changes
    loadSubscription(0, previousWorkspaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, workspaceReady, tokenReady, hasSettingsPermission]);

  const plan: SubscriptionPlan = subscription?.plan ?? "FREE";

  const value: SubscriptionContextValue = {
    subscription,
    plan,
    loading,
    refresh: loadSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
