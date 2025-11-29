"use client";

import { ReactNode, useEffect } from "react";
import { getRealtimeClient } from "@/shared/realtime/realtime-client";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { logger } from "@/shared/utils/logger";

/**
 * NotificationsProvider
 * 
 * Connects to realtime WebSocket and displays notifications as toasts
 * Only active when workspace is available
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { workspace, workspaceReady } = useWorkspace();

  useEffect(() => {
    console.log("[NotificationsProvider] Effect triggered", {
      workspaceReady,
      workspaceId: workspace?.id,
      workspace: workspace,
    });

    // Only connect when workspace is ready
    if (!workspaceReady || !workspace?.id) {
      console.log("[NotificationsProvider] Skipping connection - workspace not ready");
      return;
    }

    const client = getRealtimeClient();
    
    // Connect with workspace ID
    console.log("[NotificationsProvider] Connecting to WebSocket with workspace:", workspace.id);
    client.connect(workspace.id);
    console.log("[NotificationsProvider] Connection status after connect:", client.isConnected());

    // Subscribe to realtime events
    const unsubscribe = client.subscribe((event) => {
      if (event.type === "notification.generic") {
        const payload = event.payload as {
          workspaceId: string;
          message: string;
          level?: "info" | "success" | "error";
        };

        // Only show notifications for current workspace
        if (payload.workspaceId !== workspace.id) {
          return;
        }

        // Map level to toast variant
        const variant =
          payload.level === "error"
            ? "destructive"
            : payload.level === "success"
            ? "default"
            : "default";

        toast({
          description: payload.message,
          variant,
        });

        logger.debug(
          { workspaceId: payload.workspaceId, level: payload.level },
          "Realtime notification received"
        );
      }
    });

    // Cleanup on unmount or workspace change
    // Note: We don't disconnect the singleton client here because:
    // 1. React StrictMode runs effects twice in dev mode
    // 2. Other components (like RealtimeStatusBadge) might be using it
    // The client will auto-reconnect if needed
    return () => {
      unsubscribe();
    };
  }, [workspaceReady, workspace?.id, toast]);

  return <>{children}</>;
}

