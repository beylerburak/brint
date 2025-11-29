/**
 * Notification types matching backend realtime events
 */

export type NotificationLevel = "info" | "success" | "error";

/**
 * Notification generic event
 * Matches backend notification.generic event type
 */
export type NotificationGenericEvent = {
  type: "notification.generic";
  payload: {
    workspaceId: string;
    message: string;
    level?: NotificationLevel;
  };
};

