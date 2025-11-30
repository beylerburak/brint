/**
 * Publication Queue
 * 
 * BullMQ queue definitions for social media publishing.
 * Separate queues for Instagram and Facebook to allow independent scaling.
 */

import { createQueue } from "./bullmq.js";
import type { PublishJobData } from "../../modules/publication/publication.types.js";

// ====================
// Queue Names
// ====================

export const INSTAGRAM_PUBLISH_QUEUE = "instagram-publish";
export const FACEBOOK_PUBLISH_QUEUE = "facebook-publish";

// ====================
// Queue Instances
// ====================

/**
 * Instagram publishing queue
 */
export const instagramPublishQueue = createQueue<PublishJobData>(INSTAGRAM_PUBLISH_QUEUE);

/**
 * Facebook publishing queue
 */
export const facebookPublishQueue = createQueue<PublishJobData>(FACEBOOK_PUBLISH_QUEUE);

// ====================
// Enqueue Functions
// ====================

/**
 * Enqueue an Instagram publish job
 * 
 * @param data - Job data containing publicationId, workspaceId, brandId
 * @param delay - Optional delay in milliseconds for scheduled publishing
 */
export async function enqueueInstagramPublish(
  data: PublishJobData,
  delay: number = 0
) {
  return instagramPublishQueue.add(
    `instagram-${data.publicationId}`,
    data,
    {
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000, // 5s, 10s, 20s
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs for debugging
        age: 24 * 60 * 60, // Keep for 24 hours
      },
      removeOnFail: false, // Keep failed jobs for investigation
    }
  );
}

/**
 * Enqueue a Facebook publish job
 * 
 * @param data - Job data containing publicationId, workspaceId, brandId
 * @param delay - Optional delay in milliseconds for scheduled publishing
 */
export async function enqueueFacebookPublish(
  data: PublishJobData,
  delay: number = 0
) {
  return facebookPublishQueue.add(
    `facebook-${data.publicationId}`,
    data,
    {
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 60 * 60,
      },
      removeOnFail: false,
    }
  );
}

