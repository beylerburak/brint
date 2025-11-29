import type { RealtimeEvent, RealtimeEventType } from "./events.js";
import { logger } from "../../lib/logger.js";
import type { WebSocket } from "ws";

/**
 * Client metadata
 */
type ClientMeta = {
  userId: string;
  workspaceId?: string | null;
};

/**
 * Client connection
 */
type ClientConnection = {
  socket: WebSocket;
  meta: ClientMeta;
};

/**
 * In-memory client registry
 * Stores all active WebSocket connections
 */
const clients = new Set<ClientConnection>();

/**
 * Register a new client connection
 * @param connection Client connection with socket and metadata
 */
export function registerClient(connection: ClientConnection): void {
  clients.add(connection);

  connection.socket.on("close", () => {
    clients.delete(connection);
    logger.info(
      {
        userId: connection.meta.userId,
        workspaceId: connection.meta.workspaceId,
      },
      "Client disconnected from realtime hub"
    );
  });

  connection.socket.on("error", (err: Error) => {
    logger.error(
      {
        userId: connection.meta.userId,
        workspaceId: connection.meta.workspaceId,
        error: err instanceof Error ? err.message : String(err),
      },
      "WebSocket error"
    );
    clients.delete(connection);
  });

  logger.info(
    {
      userId: connection.meta.userId,
      workspaceId: connection.meta.workspaceId,
      totalClients: clients.size,
    },
    "Client connected to realtime hub"
  );
}

/**
 * Publish event to connected clients
 * Filters by workspaceId if provided in payload
 * @param event Realtime event to publish
 */
export function publishEvent<K extends RealtimeEventType>(
  event: RealtimeEvent<K>
): void {
  const payload = JSON.stringify(event);
  const workspaceId = (event.payload as any).workspaceId ?? null;

  let sentCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    // Filter by workspaceId if provided
    if (workspaceId && client.meta.workspaceId !== workspaceId) {
      continue;
    }

    try {
      if (client.socket.readyState === 1) {
        // WebSocket.OPEN = 1
        client.socket.send(payload);
        sentCount++;
      } else {
        // Connection is closing or closed, remove it
        clients.delete(client);
      }
    } catch (error) {
      errorCount++;
      logger.error(
        {
          userId: client.meta.userId,
          workspaceId: client.meta.workspaceId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to send realtime event"
      );
      // Remove failed client
      clients.delete(client);
    }
  }

  logger.info(
    {
      eventType: event.type,
      workspaceId,
      sentCount,
      errorCount,
      totalClients: clients.size,
    },
    "Published realtime event"
  );
}

/**
 * Get connected clients count (for debugging)
 */
export function getConnectedClientsCount(): number {
  return clients.size;
}

