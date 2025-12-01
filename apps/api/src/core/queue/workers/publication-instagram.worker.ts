/**
 * Instagram Publication Worker
 * 
 * Processes Instagram publishing jobs from BullMQ queue.
 * Handles IMAGE, CAROUSEL, and REEL content types via Graph API.
 */

import type { Job } from "bullmq";
import { createWorker } from "../bullmq.js";
import { INSTAGRAM_PUBLISH_QUEUE } from "../publication.queue.js";
import { logger } from "../../../lib/logger.js";
import { logActivity } from "../../../modules/activity/activity.service.js";
import { publicationRepository } from "../../../modules/publication/publication.repository.js";
import { decryptSocialCredentials } from "../../../modules/social-account/social-account.types.js";
import { instagramPublicationClient, type InstagramStoryPayload, type InstagramPublishResult } from "../../../modules/publication/providers/instagram-publication.client.js";
import { captureException, isSentryInitialized } from "../../observability/sentry.js";
import type { PublishJobData, InstagramCredentials, InstagramPlatformData } from "../../../modules/publication/publication.types.js";
import type { InstagramPublicationPayload } from "@brint/core-validation";



/**
 * Process Instagram publish job
 */
export async function processInstagramPublishJob(job: Job<PublishJobData>): Promise<void> {
  const { publicationId, workspaceId } = job.data;

  logger.info(
    { jobId: job.id, publicationId, workspaceId },
    "Processing Instagram publish job"
  );

  // 1. Load publication with relations
  const publication = await publicationRepository.getPublicationWithRelations(publicationId);

  if (!publication) {
    logger.error({ publicationId }, "Publication not found");
    await logFailure(publicationId, workspaceId, "PUBLICATION_NOT_FOUND", "Publication not found");
    return;
  }

  // 2. Check if already processed
  if (publication.status === "published") {
    logger.info({ publicationId }, "Publication already published, skipping");
    return;
  }

  if (publication.status === "cancelled") {
    logger.info({ publicationId }, "Publication cancelled, skipping");
    return;
  }

  // 3. Get social account
  const socialAccount = publication.socialAccount;
  if (!socialAccount) {
    logger.error({ publicationId }, "Social account not found");
    await logFailure(publicationId, workspaceId, "SOCIAL_ACCOUNT_NOT_FOUND", "Social account not found");
    return;
  }

  // 4. Decrypt credentials
  let credentials: InstagramCredentials;
  try {
    const decrypted = decryptSocialCredentials(socialAccount.credentialsEncrypted);
    if (decrypted.platform !== "INSTAGRAM_BUSINESS" && decrypted.platform !== "INSTAGRAM_BASIC") {
      throw new Error(`Invalid platform: ${decrypted.platform}`);
    }
    credentials = decrypted.data as InstagramCredentials;
  } catch (err) {
    logger.error({ publicationId, err }, "Failed to decrypt credentials");
    await logFailure(publicationId, workspaceId, "CREDENTIALS_ERROR", "Failed to decrypt credentials");
    return;
  }

  // 5. Get platform data
  const platformData = socialAccount.platformData as InstagramPlatformData | null;
  const igUserId = platformData?.igBusinessAccountId || credentials.igBusinessAccountId;

  if (!igUserId) {
    logger.error({ publicationId }, "Missing Instagram Business Account ID");
    await logFailure(publicationId, workspaceId, "MISSING_IG_USER_ID", "Missing Instagram Business Account ID");
    return;
  }

  // 6. Update status to PUBLISHING
  await publicationRepository.updatePublicationStatus(publicationId, {
    status: "publishing",
    jobId: job.id?.toString() ?? null,
  });

  // 7. Execute publish based on content type
  const payload = publication.payloadJson as InstagramPublicationPayload;

  try {
    let result: InstagramPublishResult;

    switch (payload.contentType) {
      case "IMAGE":
        result = await instagramPublicationClient.publishImage(
          igUserId,
          payload as InstagramPublicationPayload & { contentType: "IMAGE" },
          credentials.accessToken
        );
        break;

      case "CAROUSEL":
        result = await instagramPublicationClient.publishCarousel(
          igUserId,
          payload as InstagramPublicationPayload & { contentType: "CAROUSEL" },
          credentials.accessToken
        );
        break;

      case "REEL":
        result = await instagramPublicationClient.publishReel(
          igUserId,
          payload as InstagramPublicationPayload & { contentType: "REEL" },
          credentials.accessToken
        );
        break;

      case "STORY":
        result = await instagramPublicationClient.publishStory(
          igUserId,
          payload as unknown as InstagramStoryPayload,
          credentials.accessToken
        );
        break;

      default:
        throw new Error(`Unknown content type: ${(payload as any).contentType}`);
    }

    // 8. Update publication with success
    await publicationRepository.updatePublicationStatus(publicationId, {
      status: "published",
      publishedAt: new Date(),
      externalPostId: result.mediaId,
      permalink: result.permalink,
      providerResponseJson: {
        containerId: result.containerId,
        mediaId: result.mediaId,
        permalink: result.permalink,
      },
    });

    // 9. Log success activity
    await logActivity({
      type: "publication.published",
      workspaceId,
      userId: null,
      actorType: "system",
      source: "worker",
      scopeType: "publication",
      scopeId: publicationId,
      metadata: {
        publicationId,
        platform: "instagram",
        contentType: payload.contentType,
        externalPostId: result.mediaId,
        permalink: result.permalink,
        brandName: publication.brand?.name,
      },
    });

    logger.info(
      { publicationId, mediaId: result.mediaId, permalink: result.permalink },
      "Instagram publication successful"
    );

  } catch (err) {
    // Handle publish failure
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    logger.error(
      { publicationId, error: errorMessage },
      "Instagram publish failed"
    );

    await publicationRepository.updatePublicationStatus(publicationId, {
      status: "failed",
      failedAt: new Date(),
      providerResponseJson: { error: errorMessage },
    });

    await logActivity({
      type: "publication.failed",
      workspaceId,
      userId: null,
      actorType: "system",
      source: "worker",
      scopeType: "publication",
      scopeId: publicationId,
      metadata: {
        publicationId,
        platform: "instagram",
        contentType: payload.contentType,
        error: errorMessage,
        brandName: publication.brand?.name,
      },
    });

    // Re-throw to trigger retry
    throw err;
  }
}

/**
 * Log failure and update publication status
 */
async function logFailure(
  publicationId: string,
  workspaceId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await publicationRepository.updatePublicationStatus(publicationId, {
    status: "failed",
    failedAt: new Date(),
    providerResponseJson: { error: errorCode, message: errorMessage },
  });

  await logActivity({
    type: "publication.failed",
    workspaceId,
    userId: null,
    actorType: "system",
    source: "worker",
    scopeType: "publication",
    scopeId: publicationId,
    metadata: {
      publicationId,
      platform: "instagram",
      error: errorCode,
      message: errorMessage,
    },
  });
}

// ====================
// Worker Instance
// ====================

/**
 * Instagram publish worker
 * Processes jobs from the instagram-publish queue
 */
export const instagramPublishWorker = createWorker<PublishJobData>(
  INSTAGRAM_PUBLISH_QUEUE,
  processInstagramPublishJob,
  {
    concurrency: 3, // Process up to 3 jobs concurrently
  } as any
);

// Handle worker-level failures
instagramPublishWorker.on("failed", async (job, err) => {
  if (!job) return;

  const { publicationId, workspaceId } = job.data;
  const attempts = job.attemptsMade ?? 0;
  const maxAttempts = job.opts.attempts ?? 3;

  logger.error(
    {
      jobId: job.id,
      publicationId,
      attempts,
      maxAttempts,
      error: err.message,
    },
    "Instagram publish job failed"
  );

  // Only mark as permanently failed after all retries exhausted
  if (attempts >= maxAttempts) {
    try {
      await publicationRepository.updatePublicationStatus(publicationId, {
        status: "failed",
        failedAt: new Date(),
        providerResponseJson: {
          error: err.message,
          attempts,
          finalFailure: true,
        },
      });

      await logActivity({
        type: "publication.failed",
        workspaceId,
        userId: null,
        actorType: "system",
        source: "worker",
        scopeType: "publication",
        scopeId: publicationId,
        metadata: {
          publicationId,
          platform: "instagram",
          error: err.message,
          attempts,
          finalFailure: true,
        },
      });
    } catch (activityErr) {
      logger.error({ err: activityErr, publicationId }, "Failed to log failure activity");
    }

    if (isSentryInitialized()) {
      captureException(err, {
        queue: INSTAGRAM_PUBLISH_QUEUE,
        jobId: job.id?.toString(),
        publicationId,
        workspaceId,
      });
    }
  }
});

logger.info("Instagram publish worker initialized");

