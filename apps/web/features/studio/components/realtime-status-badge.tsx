"use client";

import { useEffect, useState } from "react";
import { getRealtimeClient } from "@/shared/realtime/realtime-client";

/**
 * RealtimeStatusBadge
 * 
 * Shows a live indicator badge when WebSocket connection is active
 */
export function RealtimeStatusBadge() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const client = getRealtimeClient();
      
      // Set initial status
      const initialStatus = client.isConnected();
      setIsConnected(initialStatus);
      
      // Subscribe to status changes
      const unsubscribe = client.onConnectionStatusChange((connected) => {
        setIsConnected(connected);
      });

      // Also check periodically in case we missed an update
      const interval = setInterval(() => {
        const currentStatus = client.isConnected();
        setIsConnected((prev) => {
          if (prev !== currentStatus) {
            return currentStatus;
          }
          return prev;
        });
      }, 1000);

      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    } catch {
      // Client not available (SSR)
      return;
    }
  }, []);

  if (!isConnected) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
      <div className="relative flex items-center justify-center">
        {/* Pulsing ring */}
        <div className="absolute h-2 w-2 rounded-full bg-green-500 animate-ping opacity-75" />
        {/* Solid dot */}
        <div className="relative h-2 w-2 rounded-full bg-green-500" />
      </div>
      <span className="text-xs font-medium text-green-600 dark:text-green-400">Live</span>
    </div>
  );
}

