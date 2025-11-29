import { Job } from "bullmq";
import { createQueue, createWorker } from "./bullmq.js";
import {
  sendMagicLinkEmail,
  sendWorkspaceInviteEmail,
} from "../email/email.service.js";
import { logger } from "../../lib/logger.js";

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

