import { prisma } from "../../lib/prisma.js";
import type { FastifyRequest } from "fastify";
import { getRequestId } from "../../core/http/request-id.js";
import { logger } from "../../lib/logger.js";

export type ActivityActorType = "user" | "system" | "integration";

export type ActivitySource = "api" | "worker" | "webhook" | "automation";

export type ActivityScopeType =
  | "workspace"
  | "brand"
  | "content"
  | "publication"
  | "user"
  | "billing";

export type ActivityEventType =
  | "auth.magic_link_requested"
  | "auth.magic_link_login_success"
  | "auth.google_oauth_login_success"
  | "auth.logout"
  | "workspace.member_invited"
  // Future event types will be added here:
  // | "snapshot.generated"
  // | "publication.completed"
  // | "workspace.member_role_changed"
  // | "content.created"
  // | "content.updated"
  // | etc.

export type LogActivityParams = {
  type: ActivityEventType;
  workspaceId?: string | null;
  userId?: string | null;
  actorType?: ActivityActorType;
  source?: ActivitySource;
  scopeType?: ActivityScopeType;
  scopeId?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
  request?: FastifyRequest; // if provided, requestId and userId can be extracted from it
};

/**
 * Log an activity event to the database
 * 
 * This is a fire-and-forget operation that should not block the main flow.
 * Errors are logged but do not throw.
 * 
 * @param params - Activity event parameters
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const {
    type,
    workspaceId = null,
    userId = null,
    actorType = "user",
    source = "api",
    scopeType = null,
    scopeId = null,
    metadata = {},
    requestId,
    request,
  } = params;

  logger.debug(
    {
      type,
      workspaceId,
      userId,
      actorType,
      source,
    },
    "logActivity called"
  );

  // Extract request ID from request if available, otherwise use provided or null
  const finalRequestId =
    requestId ??
    (request ? getRequestId(request) ?? request.headers["x-request-id"] as string | undefined : undefined) ??
    null;

  // Extract userId from request.auth if available and not explicitly provided
  const finalUserId =
    userId ??
    (request?.auth?.userId) ??
    null;

  try {
    const event = await prisma.activityEvent.create({
      data: {
        type,
        workspaceId: workspaceId ?? null,
        userId: finalUserId,
        actorType,
        source,
        scopeType,
        scopeId,
        requestId: finalRequestId,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });
    
    logger.debug(
      {
        eventId: event.id,
        type,
        workspaceId,
        userId: finalUserId,
      },
      "Activity event logged successfully"
    );
  } catch (error) {
    // Log error but don't throw - activity logging should not break main flow
    logger.error(
      {
        error,
        type,
        workspaceId,
        userId: finalUserId,
        actorType,
        source,
      },
      "Failed to log activity event"
    );
  }
}

