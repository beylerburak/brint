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

    // Brand events
    case "brand.created": {
      const brandName = (event.metadata as any)?.name ?? "unknown";
      const brandSlug = (event.metadata as any)?.slug ?? "unknown";
      base.title = "Brand created";
      base.summary = `A new brand "${brandName}" (${brandSlug}) was created.`;
      break;
    }

    case "brand.updated": {
      const brandName = (event.metadata as any)?.name ?? "unknown";
      const changes = (event.metadata as any)?.changes ?? {};
      const changedFields = Object.keys(changes).join(", ");
      base.title = "Brand updated";
      base.summary = `Brand "${brandName}" was updated.`;
      if (changedFields) {
        base.details = `Changed fields: ${changedFields}`;
      }
      break;
    }

    case "brand.deleted": {
      const brandName = (event.metadata as any)?.name ?? "unknown";
      const softDeleted = (event.metadata as any)?.softDeleted ?? false;
      base.title = softDeleted ? "Brand archived" : "Brand deleted";
      base.summary = softDeleted
        ? `Brand "${brandName}" was archived.`
        : `Brand "${brandName}" was permanently deleted.`;
      break;
    }

    case "brand.profile_completed": {
      const brandName = (event.metadata as any)?.name ?? "unknown";
      const previousScore = (event.metadata as any)?.previousScore ?? 0;
      const newScore = (event.metadata as any)?.newScore ?? 0;
      base.title = "Brand profile completed";
      base.summary = `Brand "${brandName}" profile was completed.`;
      base.details = `Readiness score increased from ${previousScore} to ${newScore}.`;
      break;
    }

    case "brand.social_account_connected": {
      const brandName = (event.metadata as any)?.name ?? "unknown";
      const provider = (event.metadata as any)?.provider ?? "unknown";
      const handle = (event.metadata as any)?.handle ?? "unknown";
      base.title = "Social account connected";
      base.summary = `Social account @${handle} (${provider}) was connected to brand "${brandName}".`;
      break;
    }

    case "brand.social_account_disconnected": {
      const brandName = (event.metadata as any)?.name ?? "unknown";
      const provider = (event.metadata as any)?.provider ?? "unknown";
      const handle = (event.metadata as any)?.handle ?? "unknown";
      base.title = "Social account disconnected";
      base.summary = `Social account @${handle} (${provider}) was disconnected from brand "${brandName}".`;
      break;
    }

    case "brand.publishing_defaults_updated": {
      const brandName = (event.metadata as any)?.name ?? "unknown";
      base.title = "Publishing defaults updated";
      base.summary = `Publishing defaults for brand "${brandName}" were updated.`;
      break;
    }

    // Content events
    case "content.created": {
      const title = (event.metadata as any)?.title ?? "unknown";
      const brandName = (event.metadata as any)?.brandName ?? "unknown";
      base.title = "Content created";
      base.summary = `New content "${title}" was created for brand "${brandName}".`;
      break;
    }

    case "content.updated": {
      const title = (event.metadata as any)?.title ?? "unknown";
      const changes = (event.metadata as any)?.changes ?? {};
      const changedFields = Object.keys(changes).join(", ");
      base.title = "Content updated";
      base.summary = `Content "${title}" was updated.`;
      if (changedFields) {
        base.details = `Changed fields: ${changedFields}`;
      }
      break;
    }

    case "content.deleted": {
      const title = (event.metadata as any)?.title ?? "unknown";
      base.title = "Content deleted";
      base.summary = `Content "${title}" was deleted.`;
      break;
    }

    // Publication events
    case "publication.scheduled": {
      const contentTitle = (event.metadata as any)?.contentTitle ?? "unknown";
      const platform = (event.metadata as any)?.platform ?? "unknown";
      const scheduledAt = (event.metadata as any)?.scheduledAt ?? "unknown";
      base.title = "Publication scheduled";
      base.summary = `Content "${contentTitle}" was scheduled for publication on ${platform} at ${scheduledAt}.`;
      break;
    }

    case "publication.updated": {
      const contentTitle = (event.metadata as any)?.contentTitle ?? "unknown";
      const platform = (event.metadata as any)?.platform ?? "unknown";
      base.title = "Publication updated";
      base.summary = `Publication of "${contentTitle}" on ${platform} was updated.`;
      break;
    }

    case "publication.cancelled": {
      const contentTitle = (event.metadata as any)?.contentTitle ?? "unknown";
      const platform = (event.metadata as any)?.platform ?? "unknown";
      base.title = "Publication cancelled";
      base.summary = `Publication of "${contentTitle}" on ${platform} was cancelled.`;
      break;
    }

    case "publication.published": {
      const contentTitle = (event.metadata as any)?.contentTitle ?? "unknown";
      const platform = (event.metadata as any)?.platform ?? "unknown";
      const externalId = (event.metadata as any)?.externalPostId ?? null;
      base.title = "Publication completed";
      base.summary = `Content "${contentTitle}" was successfully published on ${platform}.`;
      if (externalId) {
        base.details = `External post ID: ${externalId}`;
      }
      break;
    }

    case "publication.failed": {
      const contentTitle = (event.metadata as any)?.contentTitle ?? "unknown";
      const platform = (event.metadata as any)?.platform ?? "unknown";
      const errorMessage = (event.metadata as any)?.error ?? "Unknown error";
      base.title = "Publication failed";
      base.summary = `Publication of "${contentTitle}" on ${platform} failed.`;
      base.details = `Error: ${errorMessage}`;
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

