import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Request ID hook for Fastify
 * 
 * Generates or extracts request ID from X-Request-Id header
 * and attaches it to the request and response
 */
export function requestIdHook(app: FastifyInstance): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if request ID is already in header
    const headerRequestId = request.headers["x-request-id"];
    
    // Use existing header or generate new UUID
    const requestId = 
      typeof headerRequestId === "string" && headerRequestId.trim() !== ""
        ? headerRequestId.trim()
        : randomUUID();

    // Attach to request (Fastify's request.id is already used, so we use a custom property)
    (request as any).requestId = requestId;
    
    // Also set in headers for consistency
    request.headers["x-request-id"] = requestId;

    // Add to response header
    reply.header("x-request-id", requestId);

    // Create a child logger with requestId for this request
    // This allows request.log.info() to automatically include requestId
    request.log = request.log.child({ requestId });
  });
}

/**
 * Get request ID from Fastify request
 * Helper function to extract requestId from request object
 */
export function getRequestId(request: FastifyRequest): string | undefined {
  return (request as any).requestId;
}

