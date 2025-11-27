"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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

  const loadSubscription = async (retryCount = 0) => {
    setLoading(true);
    
    // Wait for token and workspace to be ready
    // CRITICAL: workspaceReady must be true - this ensures workspace ID getter is set
    // No heuristics - workspace.id must be resolved (not a slug)
    if (!tokenReady || !workspaceReady || !workspace?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    
    // Double-check: Verify workspace ID getter is actually set
    // This prevents requests when workspace is switching
    const { getWorkspaceId } = await import("@/shared/http/workspace-header");
    const currentWorkspaceId = getWorkspaceId();
    if (!currentWorkspaceId || currentWorkspaceId !== workspace.id) {
      // Workspace ID getter not ready yet, skip this request
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Skip subscription fetch if user doesn't have permission
    // This endpoint requires the subscription permission (workspace:settings.view)
    if (!hasSettingsPermission) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const sub = await apiCache.getOrFetch(
        `subscription:${workspace.id}`,
        async () => {
          const result = await getWorkspaceSubscription();
          return result;
        },
        60000 // 60 seconds cache
      );

      setSubscription(sub);
    } catch (error: any) {
      // Retry only on recoverable errors: AUTH_REQUIRED, WORKSPACE_ID_REQUIRED
      // Other 400/403 errors are not retried (they are permanent validation/permission errors)
      const isRetryableError = 
        (error?.status === 401 || error?.status === 400) &&
        (error?.details?.error?.code === "AUTH_REQUIRED" ||
         error?.details?.error?.code === "WORKSPACE_ID_REQUIRED");
      
      if (isRetryableError && retryCount < 1) {
        // Wait a bit before retry (exponential backoff: 200ms, 400ms)
        const delay = 200 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return loadSubscription(retryCount + 1);
      }
      
      // For 403, silently fail (user doesn't have permission)
      if (error?.status === 403 || error?.details?.error?.code === "PERMISSION_DENIED") {
        console.warn(`Subscription fetch denied - user lacks ${SUBSCRIPTION_PERMISSION} permission`);
        setSubscription(null);
      } else {
        console.warn("Failed to load subscription:", error);
        setSubscription(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for workspace ID to be resolved (not a slug)
    if (!workspace?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    
    loadSubscription();
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
