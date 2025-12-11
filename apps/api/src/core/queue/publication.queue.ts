/**
 * Publication Queue
 *
 * BullMQ queue for handling publication jobs.
 * Manages scheduled publishing of content to social media platforms.
 */

import { createQueue, DEFAULT_JOB_OPTIONS } from "./bullmq";
import { PUBLICATION_QUEUE_RULES } from "@brint/shared-config/queue-rules";

export const PUBLICATION_QUEUE_NAME = "publicationQueue";

export const publicationQueue = createQueue(PUBLICATION_QUEUE_NAME, {
  defaultJobOptions: {
    ...DEFAULT_JOB_OPTIONS,
  },
  limiter: {
    max: PUBLICATION_QUEUE_RULES.max,
    duration: PUBLICATION_QUEUE_RULES.durationMs,
  },
} as any);

export type PublicationJobData = {
  publicationId: string;
};

/**
 * Enqueue a publication job with delay based on scheduled time
 */
export async function enqueuePublicationJob(
  publicationId: string,
  scheduledAt: Date
) {
  const now = new Date();
  const delayMs = Math.max(0, scheduledAt.getTime() - now.getTime());

  const jobName = `publish:${publicationId}`;

  await publicationQueue.add(
    jobName,
    { publicationId } satisfies PublicationJobData,
    {
      ...DEFAULT_JOB_OPTIONS,
      delay: delayMs,
    }
  );
}

/**
 * Remove a publication job from queue (for rescheduling/cancellation)
 */
export async function removePublicationJob(publicationId: string) {
  const jobName = `publish:${publicationId}`;
  const job = await publicationQueue.getJob(jobName);

  if (job) {
    await job.remove();
  }
}