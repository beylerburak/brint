import { prisma } from "../../lib/prisma.js";
import type { FastifyRequest } from "fastify";
import { getRequestId } from "../../core/http/request-id.js";
import { logger } from "../../lib/logger.js";
import type {
  ActivityActorType,
  ActivitySource,
  ActivityScopeType,
  ActivityEventType,
} from "./activity.types.js";
import type { ActivityEventWithRelations } from "./activity.projection.js";

// Re-export types for backward compatibility
export type {
  ActivityActorType,
  ActivitySource,
  ActivityScopeType,
  ActivityEventType,
} from "./activity.types.js";

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

export type GetWorkspaceActivityParams = {
  workspaceId: string;
  limit?: number; // default 50, max 100
  cursor?: string | null; // pagination için event.id
  since?: Date | null; // belli bir tarihten sonrasını getir
  includeSystemEvents?: boolean; // default: true
};

/**
 * Get activity events for a workspace
 * 
 * Returns paginated activity events with user and workspace relations.
 * Supports filtering by date, excluding system events, and cursor-based pagination.
 * 
 * @param params - Query parameters
 * @returns Paginated activity events with relations
 */
export async function getWorkspaceActivity(
  params: GetWorkspaceActivityParams
): Promise<{
  items: ActivityEventWithRelations[];
  nextCursor: string | null;
}> {
  const {
    workspaceId,
    limit = 50,
    cursor = null,
    since = null,
    includeSystemEvents = true,
  } = params;

  const take = Math.min(limit, 100);

  const where: any = {
    workspaceId,
  };

  if (!includeSystemEvents) {
    where.actorType = { not: "system" };
  }

  if (since) {
    where.createdAt = { gte: since };
  }

  if (cursor) {
    // Cursor-based pagination: get events created before the cursor event
    // We need to find the cursor event's createdAt to compare
    const cursorEvent = await prisma.activityEvent.findUnique({
      where: { id: cursor },
      select: { createdAt: true },
    });

    if (cursorEvent) {
      // Combine with existing createdAt filter if any
      if (where.createdAt) {
        where.createdAt = {
          ...where.createdAt,
          lt: cursorEvent.createdAt,
        };
      } else {
        where.createdAt = {
          lt: cursorEvent.createdAt,
        };
      }
    } else {
      // Cursor not found, return empty
      return { items: [], nextCursor: null };
    }
  }

  const events = await prisma.activityEvent.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: take + 1, // Fetch one extra to check if there's a next page
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  let nextCursor: string | null = null;

  // If we fetched more than requested, there's a next page
  if (events.length > take) {
    const nextItem = events[events.length - 1];
    nextCursor = nextItem.id;
    events.pop(); // Remove the extra item
  }

  return {
    items: events as ActivityEventWithRelations[],
    nextCursor,
  };
}

