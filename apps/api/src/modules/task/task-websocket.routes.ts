/**
 * Task WebSocket Routes
 * 
 * WebSocket endpoints for real-time task updates
 */

import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { getWorkspaceIdFromRequest } from '../../core/auth/workspace-context.js';

// Store active WebSocket connections per workspace/brand
const connections = new Map<string, Set<any>>();

function getConnectionKey(workspaceId: string, brandId?: string): string {
  return brandId ? `${workspaceId}:${brandId}` : workspaceId;
}

export function broadcastTaskEvent(
  workspaceId: string,
  event: { type: string; data: any },
  brandId?: string
): void {
  const key = getConnectionKey(workspaceId, brandId);
  const workspaceConnections = connections.get(key);
  
  console.log(`[WebSocket] Broadcasting event: ${event.type} to ${key}`, {
    connections: workspaceConnections?.size || 0,
    taskId: event.data?.id,
  });
  
  if (workspaceConnections) {
    const message = JSON.stringify(event);
    let sentCount = 0;
    workspaceConnections.forEach((socket) => {
      if (socket.readyState === 1) { // WebSocket.OPEN
        try {
          socket.send(message);
          sentCount++;
        } catch (error) {
          console.error('[WebSocket] Failed to send message:', error);
        }
      }
    });
    console.log(`[WebSocket] Sent to ${sentCount}/${workspaceConnections.size} connections`);
  } else {
    console.log(`[WebSocket] No connections found for key: ${key}`);
  }
}

export async function registerTaskWebSocketRoutes(app: FastifyInstance): Promise<void> {
  // Register WebSocket plugin
  await app.register(websocket);

  // WebSocket endpoint for task updates
  // Note: In @fastify/websocket v10.x, the handler receives the WebSocket directly (not connection.socket)
  app.get('/ws/tasks', { websocket: true }, (socket, request) => {
    try {
      // Get workspaceId from query params (WebSocket doesn't support headers the same way)
      const query = request.query as { workspaceId?: string; brandId?: string };
      let workspaceId: string | undefined;
      
      try {
        workspaceId = query.workspaceId || getWorkspaceIdFromRequest(request);
      } catch {
        workspaceId = query.workspaceId;
      }
      
      if (!workspaceId) {
        console.error('[WebSocket] No workspaceId provided');
        socket.close(1008, 'Missing workspaceId');
        return;
      }

      const brandId = query.brandId;
      const key = getConnectionKey(workspaceId, brandId || '');

      // Add socket to the set
      if (!connections.has(key)) {
        connections.set(key, new Set());
      }
      connections.get(key)!.add(socket);

      console.log(`[WebSocket] Client connected: ${key} (total: ${connections.get(key)!.size})`);

      // Handle connection close
      socket.on('close', () => {
        const connSet = connections.get(key);
        if (connSet) {
          connSet.delete(socket);
          if (connSet.size === 0) {
            connections.delete(key);
          }
          console.log(`[WebSocket] Client disconnected: ${key} (remaining: ${connSet.size})`);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`[WebSocket] Error for ${key}:`, error);
        const connSet = connections.get(key);
        if (connSet) {
          connSet.delete(socket);
          if (connSet.size === 0) {
            connections.delete(key);
          }
        }
      });

      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connected',
        data: { workspaceId, brandId },
      }));
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      try {
        socket.close(1011, 'Internal server error');
      } catch {}
    }
  });
}
