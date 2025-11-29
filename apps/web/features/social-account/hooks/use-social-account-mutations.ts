"use client";

/**
 * Social Account Mutation Hooks
 * 
 * Provides hooks for connecting, disconnecting, and deleting social accounts.
 */

import { useState, useCallback } from "react";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useToast } from "@/components/ui/use-toast";
import {
  connectSocialAccount as connectSocialAccountApi,
  disconnectSocialAccount as disconnectSocialAccountApi,
  deleteSocialAccount as deleteSocialAccountApi,
} from "../api/social-account-api";
import type { ConnectSocialAccountRequest, SocialAccount } from "../types";
import { PLATFORM_INFO } from "../types";
import { logger } from "@/shared/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface UseSocialAccountMutationsReturn {
  // Connect
  connectSocialAccount: (data: ConnectSocialAccountRequest) => Promise<SocialAccount | null>;
  connectLoading: boolean;
  connectError: Error | null;
  // Disconnect
  disconnectSocialAccount: (socialAccountId: string) => Promise<boolean>;
  disconnectLoading: boolean;
  disconnectError: Error | null;
  // Delete
  deleteSocialAccount: (socialAccountId: string) => Promise<boolean>;
  deleteLoading: boolean;
  deleteError: Error | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for social account mutations (connect, disconnect, delete)
 * 
 * @param brandId - The brand ID to operate on
 * @param callbacks - Optional callbacks for refresh after mutations
 */
export function useSocialAccountMutations(
  brandId: string,
  callbacks?: {
    onSuccess?: () => void;
    onBrandRefresh?: () => void;
  }
): UseSocialAccountMutationsReturn {
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();

  // Connect state
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<Error | null>(null);

  // Disconnect state
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [disconnectError, setDisconnectError] = useState<Error | null>(null);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<Error | null>(null);

  // ============================================================================
  // Connect
  // ============================================================================

  const connectSocialAccount = useCallback(
    async (data: ConnectSocialAccountRequest): Promise<SocialAccount | null> => {
      if (!workspaceReady || !workspace?.id) {
        const err = new Error("Workspace not ready");
        setConnectError(err);
        return null;
      }

      try {
        setConnectLoading(true);
        setConnectError(null);

        const result = await connectSocialAccountApi(brandId, data);
        const platformName = PLATFORM_INFO[data.platform]?.name || data.platform;

        toast({
          title: "Social account connected",
          description: `${result.displayName || result.username || platformName} has been connected successfully.`,
        });

        // Trigger callbacks
        callbacks?.onSuccess?.();
        callbacks?.onBrandRefresh?.();

        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to connect social account");
        setConnectError(error);
        logger.error("Failed to connect social account:", error);

        toast({
          title: "Failed to connect social account",
          description: error.message,
          variant: "destructive",
        });

        return null;
      } finally {
        setConnectLoading(false);
      }
    },
    [workspaceReady, workspace?.id, brandId, toast, callbacks]
  );

  // ============================================================================
  // Disconnect
  // ============================================================================

  const disconnectSocialAccount = useCallback(
    async (socialAccountId: string): Promise<boolean> => {
      if (!workspaceReady || !workspace?.id) {
        const err = new Error("Workspace not ready");
        setDisconnectError(err);
        return false;
      }

      try {
        setDisconnectLoading(true);
        setDisconnectError(null);

        await disconnectSocialAccountApi(brandId, socialAccountId);

        toast({
          title: "Social account disconnected",
          description: "The social account has been disconnected. Credentials have been removed.",
        });

        // Trigger callbacks
        callbacks?.onSuccess?.();
        callbacks?.onBrandRefresh?.();

        return true;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to disconnect social account");
        setDisconnectError(error);
        logger.error("Failed to disconnect social account:", error);

        toast({
          title: "Failed to disconnect social account",
          description: error.message,
          variant: "destructive",
        });

        return false;
      } finally {
        setDisconnectLoading(false);
      }
    },
    [workspaceReady, workspace?.id, brandId, toast, callbacks]
  );

  // ============================================================================
  // Delete
  // ============================================================================

  const deleteSocialAccount = useCallback(
    async (socialAccountId: string): Promise<boolean> => {
      if (!workspaceReady || !workspace?.id) {
        const err = new Error("Workspace not ready");
        setDeleteError(err);
        return false;
      }

      try {
        setDeleteLoading(true);
        setDeleteError(null);

        await deleteSocialAccountApi(brandId, socialAccountId);

        toast({
          title: "Social account removed",
          description: "The social account has been removed from this brand.",
        });

        // Trigger callbacks
        callbacks?.onSuccess?.();
        callbacks?.onBrandRefresh?.();

        return true;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to remove social account");
        setDeleteError(error);
        logger.error("Failed to remove social account:", error);

        toast({
          title: "Failed to remove social account",
          description: error.message,
          variant: "destructive",
        });

        return false;
      } finally {
        setDeleteLoading(false);
      }
    },
    [workspaceReady, workspace?.id, brandId, toast, callbacks]
  );

  return {
    // Connect
    connectSocialAccount,
    connectLoading,
    connectError,
    // Disconnect
    disconnectSocialAccount,
    disconnectLoading,
    disconnectError,
    // Delete
    deleteSocialAccount,
    deleteLoading,
    deleteError,
  };
}

