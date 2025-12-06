"use client"

import { useEffect, useRef, useCallback } from "react"

export type WebSocketEvent = 
  | { type: "task.created"; data: any }
  | { type: "task.updated"; data: any }
  | { type: "task.deleted"; data: { id: string } }
  | { type: "task.status.changed"; data: { id: string; statusId: string } }

export interface UseWebSocketOptions {
  workspaceId: string
  brandId?: string
  onEvent?: (event: WebSocketEvent) => void
  enabled?: boolean
}

export function useWebSocket({ 
  workspaceId, 
  brandId,
  onEvent,
  enabled = true 
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 1000 // Start with 1 second

  const connect = useCallback(() => {
    if (!enabled || !workspaceId) return

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
    const wsUrl = apiUrl.replace(/^http/, "ws")
    const params = new URLSearchParams({
      workspaceId,
      ...(brandId && { brandId }),
    })
    // Note: WebSocket connections automatically include cookies from the same origin
    const url = `${wsUrl}/ws/tasks?${params.toString()}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onEvent?.(data as WebSocketEvent)
        } catch (error) {
          // Silently ignore parse errors
        }
      }

      ws.onerror = () => {
        // Errors are handled in onclose
      }

      ws.onclose = () => {
        wsRef.current = null

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
          reconnectAttemptsRef.current++
          const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }
    } catch (error) {
      // Silently ignore connection errors
    }
  }, [workspaceId, brandId, onEvent, enabled])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    reconnectAttemptsRef.current = 0
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    connected: wsRef.current?.readyState === WebSocket.OPEN,
    disconnect,
    reconnect: connect,
  }
}
