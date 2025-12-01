/**
 * Facebook Publication Worker
 * 
 * Processes Facebook publishing jobs from BullMQ queue.
 * Handles PHOTO, VIDEO, and LINK content types via Graph API.
 */

import type { Job } from "bullmq";
import { createWorker } from "../bullmq.js";
import { FACEBOOK_PUBLISH_QUEUE } from "../publication.queue.js";
import { logger } from "../../../lib/logger.js";
import { logActivity } from "../../../modules/activity/activity.service.js";
import { publicationRepository } from "../../../modules/publication/publication.repository.js";
import { decryptSocialCredentials } from "../../../modules/social-account/social-account.types.js";
import { facebookPublicationClient, type FacebookStoryPayload } from "../../../modules/publication/providers/facebook-publication.client.js";
import { captureException, isSentryInitialized } from "../../observability/sentry.js";
import type { PublishJobData, FacebookCredentials, FacebookPlatformData } from "../../../modules/publication/publication.types.js";
import type { FacebookPublicationPayload } from "@brint/core-validation";



// ====================
// Job Processor
// ====================

/**
 * Process Facebook publish job
 */
export async function processFacebookPublishJob(job: Job<PublishJobData>): Promise<void> {
  const { publicationId, workspaceId } = job.data;

  logger.info(
    { jobId: job.id, publicationId, workspaceId },
    "Processing Facebook publish job"
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
  let credentials: FacebookCredentials;
  try {
    const decrypted = decryptSocialCredentials(socialAccount.credentialsEncrypted);
    if (decrypted.platform !== "FACEBOOK_PAGE") {
      throw new Error(`Invalid platform: ${decrypted.platform}`);
    }
    credentials = decrypted.data as FacebookCredentials;
  } catch (err) {
    logger.error({ publicationId, err }, "Failed to decrypt credentials");
    await logFailure(publicationId, workspaceId, "CREDENTIALS_ERROR", "Failed to decrypt credentials");
    return;
  }

  // 5. Get platform data
  const platformData = socialAccount.platformData as FacebookPlatformData | null;
  const pageId = platformData?.pageId || credentials.pageId;

  if (!pageId) {
    logger.error({ publicationId }, "Missing Facebook Page ID");
    await logFailure(publicationId, workspaceId, "MISSING_PAGE_ID", "Missing Facebook Page ID");
    return;
  }

  // 6. Update status to PUBLISHING
  await publicationRepository.updatePublicationStatus(publicationId, {
    status: "publishing",
    jobId: job.id?.toString() ?? null,
  });

  // 7. Execute publish based on content type
  const payload = publication.payloadJson as FacebookPublicationPayload;

  logger.info(
    {
      publicationId,
      contentType: payload.contentType,
      payloadKeys: Object.keys(payload),
      fullPayload: JSON.stringify(payload, null, 2)
    },
    "Publication payload received"
  );

  try {
    let result: { postId: string; permalink: string };

    switch (payload.contentType) {
      case "PHOTO":
        result = await facebookPublicationClient.publishPhoto(
          pageId,
          payload as FacebookPublicationPayload & { contentType: "PHOTO" },
          credentials.accessToken
        );
        break;

      case "CAROUSEL":
        result = await facebookPublicationClient.publishCarousel(
          pageId,
          payload as FacebookPublicationPayload & { contentType: "CAROUSEL" },
          credentials.accessToken
        );
        break;

      case "VIDEO":
        result = await facebookPublicationClient.publishVideo(
          pageId,
          payload as FacebookPublicationPayload & { contentType: "VIDEO" },
          credentials.accessToken
        );
        break;

      case "LINK":
        result = await facebookPublicationClient.publishLink(
          pageId,
          payload as FacebookPublicationPayload & { contentType: "LINK" },
          credentials.accessToken
        );
        break;

      case "STORY":
        result = await facebookPublicationClient.publishStory(
          pageId,
          payload as unknown as FacebookStoryPayload,
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
      externalPostId: result.postId,
      permalink: result.permalink,
      providerResponseJson: {
        postId: result.postId,
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
        platform: "facebook",
        contentType: payload.contentType,
        externalPostId: result.postId,
        permalink: result.permalink,
        brandName: publication.brand?.name,
      },
    });

    logger.info(
      { publicationId, postId: result.postId, permalink: result.permalink },
      "Facebook publication successful"
    );

  } catch (err) {
    // Handle publish failure
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    logger.error(
      { publicationId, error: errorMessage },
      "Facebook publish failed"
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
        platform: "facebook",
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
      platform: "facebook",
      error: errorCode,
      message: errorMessage,
    },
  });
}

// ====================
// Worker Instance
// ====================

/**
 * Facebook publish worker
 * Processes jobs from the facebook-publish queue
 */
export const facebookPublishWorker = createWorker<PublishJobData>(
  FACEBOOK_PUBLISH_QUEUE,
  processFacebookPublishJob,
  {
    concurrency: 3,
  } as any
);

// Handle worker-level failures
facebookPublishWorker.on("failed", async (job, err) => {
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
    "Facebook publish job failed"
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
          platform: "facebook",
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
        queue: FACEBOOK_PUBLISH_QUEUE,
        jobId: job.id?.toString(),
        publicationId,
        workspaceId,
      });
    }
  }
});

logger.info("Facebook publish worker initialized");

