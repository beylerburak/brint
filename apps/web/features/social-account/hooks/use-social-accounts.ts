"use client";

/**
 * Social Accounts List Hook
 * 
 * Provides social accounts data with loading and error states.
 */

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSocialAccounts } from "../api/social-account-api";
import type { SocialAccount, SocialAccountStatus } from "../types";
import { logger } from "@/shared/utils/logger";

export interface UseSocialAccountsParams {
  brandId: string | null | undefined;
  status?: SocialAccountStatus;
  includeRemoved?: boolean;
  limit?: number;
}

export interface UseSocialAccountsReturn {
  accounts: SocialAccount[];
  loading: boolean;
  error: Error | null;
  nextCursor: string | null;
  refresh: () => Promise<void>;
  fetchMore: () => Promise<void>;
  hasMore: boolean;
}

/**
 * Hook to fetch social accounts for a brand
 */
export function useSocialAccounts(
  params: UseSocialAccountsParams
): UseSocialAccountsReturn {
  const { brandId, status, includeRemoved = false, limit = 50 } = params;
  const { workspace, workspaceReady } = useWorkspace();
  const { tokenReady } = useAuth();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchAccounts = useCallback(
    async (cursor?: string) => {
      // Wait for both workspace and auth to be ready
      if (!workspaceReady || !workspace?.id || !brandId || !tokenReady) {
        if (workspaceReady && tokenReady && (!workspace?.id || !brandId)) {
          setLoading(false);
        }
        return;
      }

      try {
        if (!cursor) {
          setLoading(true);
        }
        setError(null);

        const result = await getSocialAccounts({
          brandId,
          cursor,
          limit,
          status,
          includeRemoved,
        });

        if (cursor) {
          // Append to existing
          setAccounts((prev) => [...prev, ...result.items]);
        } else {
          // Replace
          setAccounts(result.items);
        }
        setNextCursor(result.nextCursor);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to fetch social accounts");
        setError(error);
        logger.error("Failed to fetch social accounts:", error);
      } finally {
        setLoading(false);
      }
    },
    [workspaceReady, workspace?.id, brandId, tokenReady, limit, status, includeRemoved]
  );

  // Initial fetch
  useEffect(() => {
    if (workspaceReady && workspace?.id && brandId && tokenReady) {
      fetchAccounts();
    }
  }, [workspaceReady, workspace?.id, brandId, tokenReady, fetchAccounts]);

  const refresh = useCallback(async () => {
    setNextCursor(null);
    await fetchAccounts();
  }, [fetchAccounts]);

  const fetchMore = useCallback(async () => {
    if (nextCursor) {
      await fetchAccounts(nextCursor);
    }
  }, [nextCursor, fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    nextCursor,
    refresh,
    fetchMore,
    hasMore: nextCursor !== null,
  };
}

