"use client";

import { appConfig } from "@/shared/config/app";
import { getAccessToken } from "@/shared/auth/token-storage";
import { logger } from "@/shared/utils/logger";

/**
 * Realtime event structure
 */
type RealtimeEvent = {
  type: string;
  payload: any;
};

/**
 * Event listener function
 */
type Listener = (event: RealtimeEvent) => void;

/**
 * Connection status listener function
 */
type ConnectionStatusListener = (isConnected: boolean) => void;

/**
 * Realtime WebSocket client
 * Manages connection to backend /realtime endpoint
 */
class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private connectionStatusListeners = new Set<ConnectionStatusListener>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private workspaceId: string | null = null;
  private isConnecting = false;
  private connectionStatus: boolean = false;

  constructor() {
    if (typeof window === "undefined") return;
  }

  /**
   * Get WebSocket URL with auth token and workspaceId
   */
  private getWebSocketUrl(workspaceId?: string | null): string {
    const apiUrl = new URL(appConfig.apiBaseUrl);
    const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    const token = getAccessToken();
    
    const url = new URL(`${protocol}//${apiUrl.host}/realtime`);
    
    if (token) {
      url.searchParams.set("token", token);
    }
    
    if (workspaceId) {
      url.searchParams.set("workspaceId", workspaceId);
      this.workspaceId = workspaceId;
    }

    return url.toString();
  }

  /**
   * Connect to WebSocket server
   */
  public connect(workspaceId?: string | null): void {
    if (typeof window === "undefined") return;
    
    // Already connecting
    if (this.isConnecting) {
      logger.debug({ workspaceId }, "Already connecting, skipping");
      return;
    }
    
    // Already connected
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      logger.debug({ workspaceId }, "Already connected");
      this.setConnectionStatus(true);
      return;
    }
    
    // Socket is connecting (readyState === 0)
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      logger.debug({ workspaceId }, "Socket is connecting, waiting");
      return;
    }

    this.isConnecting = true;
    const url = this.getWebSocketUrl(workspaceId);

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.setConnectionStatus(true);
        console.log("[WebSocket] Connected successfully", { workspaceId });
      };

      this.socket.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          for (const listener of this.listeners) {
            listener(data);
          }
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to parse WebSocket message"
          );
        }
      };

      this.socket.onclose = (event) => {
        this.isConnecting = false;
        this.setConnectionStatus(false);
        console.log("[WebSocket] Closed", { code: event.code, reason: event.reason, wasClean: event.wasClean });
        // Only reconnect if not manually closed (code 1000) and not auth error (1008)
        if (event.code !== 1000 && event.code !== 1008) {
          this.scheduleReconnect(workspaceId);
        } else {
          console.log("[WebSocket] Not reconnecting - code:", event.code);
        }
      };

      this.socket.onerror = (event) => {
        this.isConnecting = false;
        this.setConnectionStatus(false);
        console.log("[WebSocket] Error occurred", { workspaceId });
        // Don't reconnect on error immediately - let onclose handle it
      };
    } catch (error) {
      this.isConnecting = false;
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to create WebSocket connection"
      );
      this.scheduleReconnect(workspaceId);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(workspaceId?: string | null): void {
    if (this.reconnectTimeout) {
      logger.debug({ workspaceId }, "Reconnect already scheduled");
      return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn({ workspaceId }, "Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff, max 30s

    logger.debug({ workspaceId, attempt: this.reconnectAttempts, delay }, "Scheduling reconnect");
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      logger.debug({ workspaceId, attempt: this.reconnectAttempts }, "Reconnecting WebSocket");
      this.connect(workspaceId);
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to realtime events
   * @param listener Event listener function
   * @returns Unsubscribe function
   */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if client is connected
   */
  public isConnected(): boolean {
    // Also check actual socket state
    if (this.socket) {
      return this.socket.readyState === WebSocket.OPEN;
    }
    return this.connectionStatus;
  }

  /**
   * Set connection status and notify listeners
   */
  private setConnectionStatus(isConnected: boolean): void {
    if (this.connectionStatus === isConnected) return;
    this.connectionStatus = isConnected;
    // Notify all listeners
    for (const listener of this.connectionStatusListeners) {
      try {
        listener(isConnected);
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Error in connection status listener"
        );
      }
    }
  }

  /**
   * Subscribe to connection status changes
   * @param listener Connection status listener function
   * @returns Unsubscribe function
   */
  public onConnectionStatusChange(listener: ConnectionStatusListener): () => void {
    this.connectionStatusListeners.add(listener);
    // Immediately call with current status
    listener(this.connectionStatus);
    return () => {
      this.connectionStatusListeners.delete(listener);
    };
  }
}

// Singleton instance
let client: RealtimeClient | null = null;

/**
 * Get or create realtime client instance
 */
export function getRealtimeClient(): RealtimeClient {
  if (typeof window === "undefined") {
    throw new Error("RealtimeClient can only be used in browser environment");
  }

  if (!client) {
    client = new RealtimeClient();
  }

  return client;
}

