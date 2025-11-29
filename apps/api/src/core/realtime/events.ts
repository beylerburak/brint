/**
 * Realtime event types
 * These events are published via WebSocket to connected clients
 */

export type RealtimeEventType =
  | "notification.generic"
  | "publication.completed"
  | "publication.failed";

/**
 * Notification generic payload
 * Used for general workspace notifications
 */
export type NotificationGenericPayload = {
  workspaceId: string;
  message: string;
  level?: "info" | "success" | "error";
};

/**
 * Publication completed payload
 * Used when a content publication job completes successfully
 * (Reserved for future use)
 */
export type PublicationCompletedPayload = {
  workspaceId: string;
  brandId?: string | null;
  contentId: string;
  publicationId: string;
  title: string;
  platform: string;
};

/**
 * Publication failed payload
 * Used when a content publication job fails
 * (Reserved for future use)
 */
export type PublicationFailedPayload = {
  workspaceId: string;
  brandId?: string | null;
  contentId: string;
  publicationId: string;
  title: string;
  platform: string;
  reason: string;
};

/**
 * Union type for all realtime event payloads
 */
export type RealtimeEventPayloads = {
  "notification.generic": NotificationGenericPayload;
  "publication.completed": PublicationCompletedPayload;
  "publication.failed": PublicationFailedPayload;
};

/**
 * Realtime event structure
 */
export type RealtimeEvent<K extends RealtimeEventType = RealtimeEventType> = {
  type: K;
  payload: RealtimeEventPayloads[K];
};

