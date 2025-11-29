import { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { tokenService } from "../auth/token.service.js";
import { registerClient } from "./hub.js";
import { logger } from "../../lib/logger.js";

/**
 * Register realtime WebSocket routes
 */
export async function registerRealtimeRoutes(
  app: FastifyInstance
): Promise<void> {
  // Register WebSocket plugin
  await app.register(websocket);

  // WebSocket endpoint for realtime events
  // Note: In @fastify/websocket v10, the handler receives (socket, request) directly
  app.get(
    "/realtime",
    { websocket: true },
    async (socket, request) => {
      logger.info({ url: request.url, ip: request.ip }, "WebSocket connection attempt");
      
      // Extract token from query parameter or Authorization header
      const token =
        (request.query as { token?: string })?.token ??
        request.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        logger.warn({ ip: request.ip }, "WebSocket connection rejected: no token");
        socket.close(1008, "Authentication required");
        return;
      }

      // Verify token
      let userId: string;
      try {
        const payload = tokenService.verifyAccessToken(token);
        userId = payload.sub;
        logger.info({ userId }, "WebSocket token verified");
      } catch (error) {
        logger.warn(
          { ip: request.ip, error: error instanceof Error ? error.message : String(error) },
          "WebSocket connection rejected: invalid token"
        );
        socket.close(1008, "Invalid or expired token");
        return;
      }

      // Get workspaceId from query parameter
      const workspaceId =
        (request.query as { workspaceId?: string })?.workspaceId ?? null;

      // Register client with the WebSocket directly
      registerClient({
        socket,
        meta: {
          userId,
          workspaceId,
        },
      });

      // Handle incoming messages (for future subscribe/unsubscribe)
      socket.on("message", (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          // Future: handle subscribe/unsubscribe messages
          logger.info({ userId, workspaceId, data }, "WebSocket message received");
        } catch (error) {
          logger.warn(
            { userId, workspaceId, error: error instanceof Error ? error.message : String(error) },
            "Invalid WebSocket message"
          );
        }
      });

      logger.info(
        { userId, workspaceId },
        "WebSocket connection established"
      );
    }
  );
}

