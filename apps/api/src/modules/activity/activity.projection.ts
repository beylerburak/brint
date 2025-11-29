import type { ActivityEvent, User, Workspace } from "@prisma/client";
import type { AiActivityItem, ActivityActorType, ActivitySource, ActivityScopeType } from "./activity.types.js";

export type ActivityEventWithRelations = ActivityEvent & {
  user?: User | null;
  workspace?: Workspace | null;
};

/**
 * Projects a raw ActivityEvent (with relations) into an AI-friendly format
 * 
 * This function transforms database records into a human-readable format
 * suitable for AI processing, UI display, and activity feeds.
 * 
 * @param event - ActivityEvent with optional user and workspace relations
 * @returns AI-friendly activity item with title, summary, and normalized metadata
 */
export function projectActivityEventForAI(
  event: ActivityEventWithRelations
): AiActivityItem {
  const base: AiActivityItem = {
    id: event.id,
    timestamp: event.createdAt.toISOString(),
    type: event.type,
    actorType: event.actorType as ActivityActorType,
    source: event.source as ActivitySource,
    workspaceId: event.workspaceId,
    userId: event.userId,
    scopeType: (event.scopeType as ActivityScopeType | null) ?? null,
    scopeId: event.scopeId ?? null,
    title: "",
    summary: "",
    details: undefined,
    metadata: (event.metadata as Record<string, unknown>) ?? {},
  };

  // Event type bazlı mapping
  switch (event.type) {
    case "auth.magic_link_requested": {
      const email = (event.metadata as any)?.email ?? "unknown";
      base.title = "Magic link requested";
      base.summary = `A magic link login was requested for email ${email}.`;
      break;
    }

    case "auth.magic_link_login_success": {
      const email = (event.metadata as any)?.email ?? event.user?.email ?? "unknown";
      base.title = "Magic link login successful";
      base.summary = `User with email ${email} successfully logged in using a magic link.`;
      break;
    }

    case "auth.google_oauth_login_success": {
      const email = (event.metadata as any)?.email ?? event.user?.email ?? "unknown";
      base.title = "Google OAuth login successful";
      base.summary = `User with email ${email} successfully logged in using Google OAuth.`;
      break;
    }

    case "auth.logout": {
      const email = event.user?.email ?? "unknown";
      base.title = "User logged out";
      base.summary = `User with email ${email} logged out.`;
      break;
    }

    case "workspace.member_invited": {
      const invitedEmail = (event.metadata as any)?.invitedEmail ?? "unknown";
      const workspaceName =
        event.workspace?.name ??
        (event.metadata as any)?.workspaceName ??
        "workspace";
      const inviterEmail = event.user?.email ?? "unknown";
      base.title = "Workspace member invited";
      base.summary = `A member invite was sent to ${invitedEmail} for workspace "${workspaceName}" by ${inviterEmail}.`;
      break;
    }

    case "email.magic_link_sent": {
      const email = (event.metadata as any)?.email ?? "unknown";
      base.title = "Magic link email sent";
      base.summary = `A magic link login email was successfully sent to ${email}.`;
      break;
    }

    case "email.magic_link_failed": {
      const email = (event.metadata as any)?.email ?? "unknown";
      const errorMessage = (event.metadata as any)?.errorMessage ?? "Unknown error";
      base.title = "Magic link email failed";
      base.summary = `Sending a magic link login email to ${email} failed with error: ${errorMessage}.`;
      base.details = `Failed after ${(event.metadata as any)?.attempts ?? "unknown"} attempts.`;
      break;
    }

    case "email.workspace_invite_sent": {
      const invitedEmail = (event.metadata as any)?.invitedEmail ?? "unknown";
      const workspaceName =
        event.workspace?.name ??
        (event.metadata as any)?.workspaceName ??
        "workspace";
      base.title = "Workspace invite email sent";
      base.summary = `An invitation email was successfully sent to ${invitedEmail} for workspace "${workspaceName}".`;
      break;
    }

    case "email.workspace_invite_failed": {
      const invitedEmail = (event.metadata as any)?.invitedEmail ?? "unknown";
      const workspaceName =
        event.workspace?.name ??
        (event.metadata as any)?.workspaceName ??
        "workspace";
      const errorMessage = (event.metadata as any)?.errorMessage ?? "Unknown error";
      base.title = "Workspace invite email failed";
      base.summary = `Sending an invitation email to ${invitedEmail} for workspace "${workspaceName}" failed with error: ${errorMessage}.`;
      base.details = `Failed after ${(event.metadata as any)?.attempts ?? "unknown"} attempts.`;
      break;
    }

    default: {
      // Unknown event type - use generic format
      base.title = event.type;
      base.summary = `Activity event of type "${event.type}" occurred.`;
      if (event.actorType === "system") {
        base.details = "This is a system-generated event.";
      }
      break;
    }
  }

  return base;
}

