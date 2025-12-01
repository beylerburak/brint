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
import { prisma } from "../../../lib/prisma.js";
import { logActivity } from "../../../modules/activity/activity.service.js";
import { publicationRepository } from "../../../modules/publication/publication.repository.js";
import { decryptSocialCredentials } from "../../../modules/social-account/social-account.types.js";
import { buildPublicUrl } from "../../../lib/storage/public-url.js";
import { S3StorageService } from "../../../lib/storage/s3.storage.service.js";
import { captureException, isSentryInitialized } from "../../observability/sentry.js";
import type { PublishJobData, InstagramCredentials, InstagramPlatformData } from "../../../modules/publication/publication.types.js";
import type { InstagramPublicationPayload } from "@brint/core-validation";
import {
  graphPost,
  graphGet,
  waitForStatus,
  verifyInstagramPostPublished,
  extractGraphApiErrorMessage,
  isRetryableError,
  RetryablePublicationError,
  type GraphApiResponse,
  type MediaResponse,
} from "./graph-api.utils.js";

// S3 storage service for presigned URLs
const s3Storage = new S3StorageService();

/**
 * Get public URL for a media item
 * Falls back to presigned S3 URL if CDN is not configured
 */
async function getMediaPublicUrl(mediaId: string): Promise<string | null> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { objectKey: true, variants: true },
  });

  if (!media) return null;

  // Try CDN URL first
  const publicUrl = buildPublicUrl(media.objectKey);
  if (publicUrl) return publicUrl;

  // Fall back to presigned S3 URL (valid for 1 hour)
  try {
    const presignedUrl = await s3Storage.getPresignedDownloadUrl(media.objectKey, {
      expiresInSeconds: 3600, // 1 hour
    });
    logger.info({ mediaId }, "Using presigned S3 URL for media");
    return presignedUrl;
  } catch (err) {
    logger.warn({ mediaId, err }, "Failed to generate presigned URL for media");
    return null;
  }
}

// ====================
// Instagram Publishing Functions
// ====================

/**
 * Publish an IMAGE to Instagram
 */
async function publishInstagramImage(
  igUserId: string,
  payload: InstagramPublicationPayload & { contentType: "IMAGE" },
  accessToken: string
): Promise<{ containerId: string; mediaId: string; permalink: string }> {
  // 1. Get image URL
  const imageUrl = await getMediaPublicUrl(payload.imageMediaId);
  if (!imageUrl) {
    throw new Error(`Cannot get public URL for image: ${payload.imageMediaId}`);
  }

  // 2. Create media container
  const createParams: Record<string, string | boolean | number> = {
    image_url: imageUrl,
  };

  if (payload.caption) {
    createParams.caption = payload.caption;
  }
  if (payload.locationId) {
    createParams.location_id = payload.locationId;
  }
  if (payload.userTags && payload.userTags.length > 0) {
    createParams.user_tags = JSON.stringify(payload.userTags.map((tag: { igUserId: string; x: number; y: number }) => ({
      username: tag.igUserId,
      x: tag.x,
      y: tag.y,
    })));
  }

  const containerResponse = await graphPost(
    `/${igUserId}/media`,
    createParams,
    accessToken
  );

  if (containerResponse.error || !containerResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(containerResponse.error);
    const fullMessage = `Failed to create IG media container: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(containerResponse.error)) {
      throw new RetryablePublicationError(fullMessage, containerResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const containerId = containerResponse.id;

  // 3. Publish container
  const publishResponse = await graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  if (publishResponse.error || !publishResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(publishResponse.error);
    const fullMessage = `Failed to publish IG media: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(publishResponse.error)) {
      throw new RetryablePublicationError(fullMessage, publishResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const mediaId = publishResponse.id;

  // 4. Get permalink and verify post was published
  let permalink = "";
  try {
    const mediaDetails = await graphGet(
      `/${mediaId}`,
      { fields: "permalink" },
      accessToken
    );
    permalink = mediaDetails.permalink || "";
  } catch (error) {
    logger.warn({ mediaId, error }, "Failed to get image permalink, will verify separately");
  }

  // 5. Verify post was actually published
  logger.info({ mediaId }, "Verifying Instagram image was published");
  const verification = await verifyInstagramPostPublished(mediaId, accessToken);
  
  if (!verification.exists) {
    throw new Error("Instagram image was not successfully published or is not accessible");
  }

  // Use verified permalink if available
  permalink = verification.permalink || permalink;

  return {
    containerId,
    mediaId,
    permalink,
  };
}

/**
 * Publish a CAROUSEL to Instagram
 */
async function publishInstagramCarousel(
  igUserId: string,
  payload: InstagramPublicationPayload & { contentType: "CAROUSEL" },
  accessToken: string
): Promise<{ containerId: string; mediaId: string; permalink: string }> {
  // 1. Create child containers for each item
  const childIds: string[] = [];

  for (const item of payload.items) {
    const mediaUrl = await getMediaPublicUrl(item.mediaId);
    if (!mediaUrl) {
      throw new Error(`Cannot get public URL for carousel item: ${item.mediaId}`);
    }

    const childParams: Record<string, string | boolean> = {
      is_carousel_item: true,
    };

    if (item.type === "IMAGE") {
      childParams.image_url = mediaUrl;
    } else {
      childParams.video_url = mediaUrl;
      childParams.media_type = "VIDEO";
    }

    const childResponse = await graphPost(
      `/${igUserId}/media`,
      childParams,
      accessToken
    );

    if (childResponse.error || !childResponse.id) {
      const errorMessage = extractGraphApiErrorMessage(childResponse.error);
      const fullMessage = `Failed to create carousel child: ${errorMessage}`;
      
      // Check if this is a retryable error (e.g., media not ready)
      if (isRetryableError(childResponse.error)) {
        throw new RetryablePublicationError(fullMessage, childResponse.error);
      }
      
      throw new Error(fullMessage);
    }

    childIds.push(childResponse.id);
  }

  // 2. Create parent carousel container
  const carouselParams: Record<string, string> = {
    media_type: "CAROUSEL",
    children: childIds.join(","),
  };

  if (payload.caption) {
    carouselParams.caption = payload.caption;
  }
  if (payload.locationId) {
    carouselParams.location_id = payload.locationId;
  }

  const containerResponse = await graphPost(
    `/${igUserId}/media`,
    carouselParams,
    accessToken
  );

  if (containerResponse.error || !containerResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(containerResponse.error);
    const fullMessage = `Failed to create carousel container: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(containerResponse.error)) {
      throw new RetryablePublicationError(fullMessage, containerResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const containerId = containerResponse.id;

  // 3. Publish container
  const publishResponse = await graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  if (publishResponse.error || !publishResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(publishResponse.error);
    const fullMessage = `Failed to publish carousel: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(publishResponse.error)) {
      throw new RetryablePublicationError(fullMessage, publishResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const mediaId = publishResponse.id;

  // 4. Get permalink and verify post was published
  let permalink = "";
  try {
    const mediaDetails = await graphGet(
      `/${mediaId}`,
      { fields: "permalink" },
      accessToken
    );
    permalink = mediaDetails.permalink || "";
  } catch (error) {
    logger.warn({ mediaId, error }, "Failed to get carousel permalink, will verify separately");
  }

  // 5. Verify post was actually published
  logger.info({ mediaId }, "Verifying Instagram carousel was published");
  const verification = await verifyInstagramPostPublished(mediaId, accessToken);
  
  if (!verification.exists) {
    throw new Error("Instagram carousel was not successfully published or is not accessible");
  }

  // Use verified permalink if available
  permalink = verification.permalink || permalink;

  return {
    containerId,
    mediaId,
    permalink,
  };
}

/**
 * Publish a REEL to Instagram
 */
async function publishInstagramReel(
  igUserId: string,
  payload: InstagramPublicationPayload & { contentType: "REEL" },
  accessToken: string
): Promise<{ containerId: string; mediaId: string; permalink: string }> {
  // 1. Get video URL
  const videoUrl = await getMediaPublicUrl(payload.videoMediaId);
  if (!videoUrl) {
    throw new Error(`Cannot get public URL for reel video: ${payload.videoMediaId}`);
  }

  // 2. Create reel container
  const reelParams: Record<string, string | boolean | number> = {
    media_type: "REELS",
    video_url: videoUrl,
    share_to_feed: payload.shareToFeed ?? true,
  };

  if (payload.caption) {
    reelParams.caption = payload.caption;
  }
  if (payload.thumbOffsetSeconds !== undefined) {
    reelParams.thumb_offset = payload.thumbOffsetSeconds * 1000; // Convert to ms
  }
  if (payload.coverMediaId) {
    const coverUrl = await getMediaPublicUrl(payload.coverMediaId);
    if (coverUrl) {
      reelParams.cover_url = coverUrl;
    }
  }

  const containerResponse = await graphPost(
    `/${igUserId}/media`,
    reelParams,
    accessToken
  );

  if (containerResponse.error || !containerResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(containerResponse.error);
    const fullMessage = `Failed to create reel container: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(containerResponse.error)) {
      throw new RetryablePublicationError(fullMessage, containerResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const containerId = containerResponse.id;

  // 3. Wait for container processing (reels need significant time to process)
  logger.info({ containerId }, "Waiting for Instagram reel container processing (this may take several minutes)");

  try {
    await waitForStatus(
      containerId,
      async () => {
        const statusResponse = await graphGet(
          `/${containerId}`,
          { fields: "status_code,status" },
          accessToken
        );
        return {
          status_code: statusResponse.status_code,
          status: statusResponse.status,
          error: statusResponse.error,
        };
      },
      ["FINISHED", "PUBLISHED", "FINISHED_PROCESSING"],
      ["ERROR", "FAILED", "EXPIRED"],
      {
        maxAttempts: 60,
        initialWaitMs: 3000,
        maxWaitMs: 15000,
        context: { contentType: "REEL", stage: "container" },
      }
    );
  } catch (error) {
    throw new Error(`Instagram reel container processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 4. Publish container
  const publishResponse = await graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  if (publishResponse.error || !publishResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(publishResponse.error);
    const fullMessage = `Failed to publish reel: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(publishResponse.error)) {
      throw new RetryablePublicationError(fullMessage, publishResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const mediaId = publishResponse.id;

  // 5. Get permalink and verify post was published
  let mediaDetails: MediaResponse;
  try {
    mediaDetails = await graphGet(
      `/${mediaId}`,
      { fields: "permalink,status_code" },
      accessToken
    );
  } catch (error) {
    logger.warn({ mediaId, error }, "Failed to get reel details, will verify separately");
    mediaDetails = {} as MediaResponse;
  }

  // 6. Verify post was actually published
  logger.info({ mediaId }, "Verifying Instagram reel was published");
  const verification = await verifyInstagramPostPublished(mediaId, accessToken);
  
  if (!verification.exists) {
    throw new Error("Instagram reel was not successfully published or is not accessible");
  }

  // Use verified permalink if available
  const permalink = verification.permalink || mediaDetails.permalink || "";

  return {
    containerId,
    mediaId,
    permalink,
  };
}

/**
 * Instagram STORY payload type
 * Can be either IMAGE story or VIDEO story
 */
type InstagramStoryPayload = {
  contentType: "STORY";
  storyType: "IMAGE" | "VIDEO";
  imageMediaId?: string;
  videoMediaId?: string;
};

/**
 * Publish a STORY to Instagram
 * Stories use media_type=STORIES and disappear after 24 hours
 * Graph API: POST /{ig-user-id}/media with media_type=STORIES
 */
async function publishInstagramStory(
  igUserId: string,
  payload: InstagramStoryPayload,
  accessToken: string
): Promise<{ containerId: string; mediaId: string; permalink: string }> {
  // 1. Get media URL (either image or video)
  const isVideo = payload.storyType === "VIDEO";
  const mediaId = isVideo ? payload.videoMediaId : payload.imageMediaId;
  
  if (!mediaId) {
    throw new Error(`Story requires ${isVideo ? 'videoMediaId' : 'imageMediaId'} for ${payload.storyType} story`);
  }

  const mediaUrl = await getMediaPublicUrl(mediaId);
  if (!mediaUrl) {
    throw new Error(`Cannot get public URL for story media: ${mediaId}`);
  }

  // 2. Create story container
  const storyParams: Record<string, string | boolean> = {
    media_type: "STORIES",
  };

  if (isVideo) {
    storyParams.video_url = mediaUrl;
  } else {
    storyParams.image_url = mediaUrl;
  }

  const containerResponse = await graphPost(
    `/${igUserId}/media`,
    storyParams,
    accessToken
  );

  if (containerResponse.error || !containerResponse.id) {
    const errorMessage = extractGraphApiErrorMessage(containerResponse.error);
    const fullMessage = `Failed to create story container: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(containerResponse.error)) {
      throw new RetryablePublicationError(fullMessage, containerResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const containerId = containerResponse.id;

  // 3. Wait for processing and check status (for both images and videos)
  // Instagram needs time for media processing - wait until status is FINISHED
  const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
  logger.info({ containerId, mediaType }, "Waiting for story media processing (this may take several minutes)");

  try {
    await waitForStatus(
      containerId,
      async () => {
        const statusResponse = await graphGet(
          `/${containerId}`,
          { fields: "status_code,status" },
          accessToken
        );
        return {
          status_code: statusResponse.status_code,
          status: statusResponse.status,
          error: statusResponse.error,
        };
      },
      ["FINISHED", "PUBLISHED"],
      ["ERROR", "FAILED"],
      {
        maxAttempts: isVideo ? 60 : 40,
        initialWaitMs: 3000,
        maxWaitMs: 15000,
        context: { contentType: "STORY", mediaType },
      }
    );
  } catch (error) {
    logger.warn(
      { containerId, error: error instanceof Error ? error.message : String(error), mediaType },
      "Story processing did not complete within timeout, proceeding anyway"
    );
    // Continue - stories can sometimes succeed even if status check times out
  }

  // 4. Publish the story container (following the working approach from the old code)
  logger.info({ containerId }, "Publishing Instagram story");

  const publishResponse = await graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  logger.debug({ publishResponse }, "Instagram story publish response");

  if (publishResponse.error || !publishResponse.id) {
    logger.error({
      containerId,
      publishResponse,
      error: publishResponse.error,
    }, "Instagram story publish failed");

    const errorMessage = extractGraphApiErrorMessage(publishResponse.error);
    const fullMessage = `Failed to publish story: ${errorMessage}`;
    
    // Check if this is a retryable error (e.g., media not ready)
    if (isRetryableError(publishResponse.error)) {
      throw new RetryablePublicationError(fullMessage, publishResponse.error);
    }
    
    throw new Error(fullMessage);
  }

  const storyMediaId = publishResponse.id;
  logger.info({ storyMediaId, containerId }, "Instagram story published successfully");

  // 5. Stories cannot be verified via Graph API GET requests
  // Instagram Stories are temporary content (24h) and Graph API doesn't support
  // querying them directly. We trust the publish response which already confirmed success.
  // If publish_response.id exists, the story was successfully published.
  
  logger.info(
    { storyMediaId, containerId },
    "Instagram story published (verification skipped - Stories cannot be queried via Graph API)"
  );

  return {
    containerId,
    mediaId: storyMediaId,
    permalink: "", // Stories typically don't have permalinks
  };
}

// ====================
// Job Processor
// ====================

/**
 * Process Instagram publish job
 */
async function processInstagramPublishJob(job: Job<PublishJobData>): Promise<void> {
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
    let result: { containerId: string; mediaId: string; permalink: string };

    switch (payload.contentType) {
      case "IMAGE":
        result = await publishInstagramImage(
          igUserId,
          payload as InstagramPublicationPayload & { contentType: "IMAGE" },
          credentials.accessToken
        );
        break;

      case "CAROUSEL":
        result = await publishInstagramCarousel(
          igUserId,
          payload as InstagramPublicationPayload & { contentType: "CAROUSEL" },
          credentials.accessToken
        );
        break;

      case "REEL":
        result = await publishInstagramReel(
          igUserId,
          payload as InstagramPublicationPayload & { contentType: "REEL" },
          credentials.accessToken
        );
        break;

      case "STORY":
        result = await publishInstagramStory(
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

