import { Job } from "bullmq";
import { createQueue, createWorker } from "./bullmq.js";
import {
  sendMagicLinkEmail,
  sendWorkspaceInviteEmail,
} from "../email/email.service.js";
import { logger } from "../../lib/logger.js";
import { captureException, isSentryInitialized } from "../observability/sentry.js";
import { logActivity } from "../../modules/activity/activity.service.js";

/**
 * Email job types
 */
export type EmailJobType = "magic-link" | "workspace-invite";

/**
 * Magic link email job data
 */
export type MagicLinkEmailJobData = {
  type: "magic-link";
  to: string;
  url: string;
  locale?: string | null;
  workspaceId?: string | null; // Workspace ID if available
  requestedByUserId?: string | null; // User ID who requested the magic link (if authenticated)
};

/**
 * Workspace invite email job data
 */
export type WorkspaceInviteEmailJobData = {
  type: "workspace-invite";
  to: string;
  workspaceName: string;
  inviteLink: string;
  invitedByName?: string | null;
  locale?: string | null;
  workspaceId: string; // Workspace ID (required for workspace invites)
  inviterUserId?: string | null; // User ID who sent the invite
  inviteId?: string | null; // Invite ID for reference
};

/**
 * Union type for all email job data
 */
export type EmailJobData = MagicLinkEmailJobData | WorkspaceInviteEmailJobData;

/**
 * Email queue name
 */
const EMAIL_QUEUE_NAME = "email";

/**
 * Email queue instance
 */
export const emailQueue = createQueue<EmailJobData>(EMAIL_QUEUE_NAME);

/**
 * Enqueue magic link email job
 */
export async function enqueueMagicLinkEmail(
  data: Omit<MagicLinkEmailJobData, "type">
) {
  return emailQueue.add(
    "magic-link",
    { type: "magic-link", ...data },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

/**
 * Enqueue workspace invite email job
 */
export async function enqueueWorkspaceInviteEmail(
  data: Omit<WorkspaceInviteEmailJobData, "type">
) {
  return emailQueue.add(
    "workspace-invite",
    { type: "workspace-invite", ...data },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

/**
 * Process email job
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { data } = job;

  logger.debug(
    {
      jobId: job.id,
      jobName: job.name,
      emailType: data.type,
      to: data.to,
    },
    "Processing email job"
  );

  try {
    switch (data.type) {
      case "magic-link": {
        await sendMagicLinkEmail(data.to, data.url);
        logger.info(
          {
            jobId: job.id,
            to: data.to,
            url: data.url.substring(0, 50) + "...",
          },
          "Magic link email sent successfully"
        );

        // Log activity event (fire-and-forget)
        void logActivity({
          type: "email.magic_link_sent",
          workspaceId: data.workspaceId ?? null,
          userId: data.requestedByUserId ?? null,
          actorType: "system",
          source: "worker",
          scopeType: "user",
          scopeId: data.requestedByUserId ?? null,
          metadata: {
            email: data.to,
            jobId: job.id?.toString(),
            queue: EMAIL_QUEUE_NAME,
          },
        });
        break;
      }

      case "workspace-invite": {
        await sendWorkspaceInviteEmail(data.to, data.inviteLink);
        logger.info(
          {
            jobId: job.id,
            to: data.to,
            workspaceName: data.workspaceName,
            inviteLink: data.inviteLink.substring(0, 80) + "...",
          },
          "Workspace invite email sent successfully"
        );

        // Log activity event (fire-and-forget)
        void logActivity({
          type: "email.workspace_invite_sent",
          workspaceId: data.workspaceId,
          userId: data.inviterUserId ?? null,
          actorType: "system",
          source: "worker",
          scopeType: "workspace",
          scopeId: data.workspaceId,
          metadata: {
            inviteId: data.inviteId ?? null,
            invitedEmail: data.to,
            jobId: job.id?.toString(),
            queue: EMAIL_QUEUE_NAME,
          },
        });
        break;
      }

      default: {
        const _exhaustive: never = data;
        throw new Error(`Unknown email job type: ${(_exhaustive as any).type}`);
      }
    }
  } catch (error) {
    logger.error(
      {
        jobId: job.id,
        jobName: job.name,
        emailType: data.type,
        to: data.to,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to process email job"
    );

    // Send to Sentry if initialized
    if (isSentryInitialized()) {
      captureException(error, {
        queue: EMAIL_QUEUE_NAME,
        jobId: job.id?.toString(),
        jobName: job.name,
        emailType: data.type,
        to: data.to,
      });
    }

    // Re-throw to let BullMQ handle retry logic
    throw error;
  }
}

/**
 * Create and start email worker
 * This is called automatically when the module is imported
 */
export const emailWorker = createWorker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    concurrency: 5,
  }
);

// Add email-specific failure handler for activity logging
emailWorker.on("failed", async (job, err) => {
  if (!job) return;

  try {
    const attempts = job.attemptsMade ?? 0;
    const maxAttempts = job.opts.attempts ?? 3;

    // Only log activity for final failure (all retries exhausted)
    if (attempts < maxAttempts) {
      return; // Still retrying, don't log yet
    }

    const data = job.data;

    // Log activity event based on job type
    if (data.type === "magic-link") {
      await logActivity({
        type: "email.magic_link_failed",
        workspaceId: data.workspaceId ?? null,
        userId: data.requestedByUserId ?? null,
        actorType: "system",
        source: "worker",
        scopeType: "user",
        scopeId: data.requestedByUserId ?? null,
        metadata: {
          email: data.to,
          jobId: job.id?.toString(),
          queue: EMAIL_QUEUE_NAME,
          errorMessage: err?.message ?? "Unknown error",
          attempts: attempts,
        },
      });
    } else if (data.type === "workspace-invite") {
      await logActivity({
        type: "email.workspace_invite_failed",
        workspaceId: data.workspaceId,
        userId: data.inviterUserId ?? null,
        actorType: "system",
        source: "worker",
        scopeType: "workspace",
        scopeId: data.workspaceId,
        metadata: {
          invitedEmail: data.to,
          inviteId: data.inviteId ?? null,
          jobId: job.id?.toString(),
          queue: EMAIL_QUEUE_NAME,
          errorMessage: err?.message ?? "Unknown error",
          attempts: attempts,
        },
      });
    }
  } catch (activityError) {
    // Activity log hatasını swallow et, worker akışını bozmadan sadece logla
    logger.error(
      { err: activityError, jobId: job.id },
      "Failed to log activity for email job failure"
    );
  }
});

