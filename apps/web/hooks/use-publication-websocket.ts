"use client"

import { useEffect, useRef, useCallback } from "react"

export type PublicationWebSocketEvent = 
  | { type: "publication.status.changed"; data: { id: string; contentId: string; status: string; platform: string; platformPostId?: string; errorCode?: string; errorMessage?: string } }
  | { type: "content.status.changed"; data: { id: string; status: string; publications: Array<{ id: string; status: string; platform: string }> } }
  | { type: "connected"; data: { workspaceId: string; brandId?: string } }

export interface UsePublicationWebSocketOptions {
  workspaceId: string
  brandId?: string
  onEvent?: (event: PublicationWebSocketEvent) => void
  enabled?: boolean
}

export function usePublicationWebSocket({ 
  workspaceId, 
  brandId,
  onEvent,
  enabled = true 
}: UsePublicationWebSocketOptions) {
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
    const url = `${wsUrl}/ws/publications?${params.toString()}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onEvent?.(data as PublicationWebSocketEvent)
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
