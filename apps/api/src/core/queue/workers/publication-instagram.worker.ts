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
import { env } from "../../../config/env.js";

// ====================
// Graph API Configuration
// ====================

const GRAPH_API_VERSION = env.GRAPH_API_VERSION || "v24.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ====================
// Types
// ====================

interface GraphApiResponse {
  id?: string;
  error?: {
    message: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface MediaResponse extends GraphApiResponse {
  permalink?: string;
}

// ====================
// Graph API Helpers
// ====================

/**
 * Make a POST request to Graph API
 */
async function graphPost(
  endpoint: string,
  params: Record<string, string | boolean | number>,
  accessToken: string
): Promise<GraphApiResponse> {
  const url = `${GRAPH_API_BASE}${endpoint}`;
  
  const body = new URLSearchParams();
  body.append("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    body.append(key, String(value));
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  return response.json() as Promise<GraphApiResponse>;
}

/**
 * Make a GET request to Graph API
 */
async function graphGet(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<MediaResponse> {
  const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
  url.searchParams.append("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString());
  return response.json() as Promise<MediaResponse>;
}

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
    throw new Error(
      `Failed to create IG media container: ${containerResponse.error?.message || "Unknown error"}`
    );
  }

  const containerId = containerResponse.id;

  // 3. Publish container
  const publishResponse = await graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  if (publishResponse.error || !publishResponse.id) {
    throw new Error(
      `Failed to publish IG media: ${publishResponse.error?.message || "Unknown error"}`
    );
  }

  const mediaId = publishResponse.id;

  // 4. Get permalink
  const mediaDetails = await graphGet(
    `/${mediaId}`,
    { fields: "permalink" },
    accessToken
  );

  return {
    containerId,
    mediaId,
    permalink: mediaDetails.permalink || "",
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
      throw new Error(
        `Failed to create carousel child: ${childResponse.error?.message || "Unknown error"}`
      );
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
    throw new Error(
      `Failed to create carousel container: ${containerResponse.error?.message || "Unknown error"}`
    );
  }

  const containerId = containerResponse.id;

  // 3. Publish container
  const publishResponse = await graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  if (publishResponse.error || !publishResponse.id) {
    throw new Error(
      `Failed to publish carousel: ${publishResponse.error?.message || "Unknown error"}`
    );
  }

  const mediaId = publishResponse.id;

  // 4. Get permalink
  const mediaDetails = await graphGet(
    `/${mediaId}`,
    { fields: "permalink" },
    accessToken
  );

  return {
    containerId,
    mediaId,
    permalink: mediaDetails.permalink || "",
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
    throw new Error(
      `Failed to create reel container: ${containerResponse.error?.message || "Unknown error"}`
    );
  }

  const containerId = containerResponse.id;

  // 3. Wait for video processing (reels need time to process)
  // In production, you might want to poll the container status
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 4. Publish container
  const publishResponse = await graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  if (publishResponse.error || !publishResponse.id) {
    throw new Error(
      `Failed to publish reel: ${publishResponse.error?.message || "Unknown error"}`
    );
  }

  const mediaId = publishResponse.id;

  // 5. Get permalink
  const mediaDetails = await graphGet(
    `/${mediaId}`,
    { fields: "permalink" },
    accessToken
  );

  return {
    containerId,
    mediaId,
    permalink: mediaDetails.permalink || "",
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
    throw new Error(
      `Failed to create story container: ${containerResponse.error?.message || "Unknown error"}`
    );
  }

  const containerId = containerResponse.id;

  // 3. Wait for processing and check status (for both images and videos)
  // Instagram needs time for media processing - wait until status is FINISHED
  logger.info({ containerId, mediaType: isVideo ? 'VIDEO' : 'IMAGE' }, "Waiting for story media processing (this may take several minutes)");

  let containerAttempts = 0;
  const maxContainerAttempts = isVideo ? 60 : 40; // Videos: 60 attempts (~5 min), Images: 40 attempts (~2 min)
  let lastStatus = "UNKNOWN";

  while (containerAttempts < maxContainerAttempts) {
    try {
      const statusResponse = await graphGet(
        `/${containerId}?fields=status_code,status`,
        {},
        accessToken
      );

      lastStatus = statusResponse.status_code || statusResponse.status || "UNKNOWN";
      logger.debug({ containerId, status: lastStatus, attempt: containerAttempts + 1, maxContainerAttempts, mediaType: isVideo ? 'VIDEO' : 'IMAGE' }, "Story processing status check");

      // Check if processing is complete
      if (lastStatus === "FINISHED" || lastStatus === "PUBLISHED") {
        logger.info({ containerId, attempts: containerAttempts + 1, mediaType: isVideo ? 'VIDEO' : 'IMAGE' }, "Story processing completed");
        break;
      }

      // Check for error states
      if (lastStatus === "ERROR" || lastStatus === "FAILED") {
        throw new Error(`${isVideo ? 'Video' : 'Image'} processing failed with status: ${lastStatus}`);
      }

      // Still processing - wait before next check
      if (lastStatus === "IN_PROGRESS" || lastStatus === "PROCESSING" || lastStatus === "PENDING" || lastStatus === "UNKNOWN") {
        const waitTime = containerAttempts < 5 ? 3000 : containerAttempts < 15 ? 5000 : containerAttempts < 30 ? 10000 : 15000; // Progressive wait times
        logger.debug({ containerId, status: lastStatus, waitTime, mediaType: isVideo ? 'VIDEO' : 'IMAGE' }, "Media still processing, waiting...");
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

    } catch (statusError) {
      logger.warn({ containerId, statusError: statusError.message, attempts: containerAttempts + 1, mediaType: isVideo ? 'VIDEO' : 'IMAGE' }, "Status check failed, continuing to wait");
      // Continue waiting even if status check fails
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    containerAttempts++;
  }

  if (lastStatus !== "FINISHED" && lastStatus !== "PUBLISHED") {
    logger.warn({ containerId, lastStatus, containerAttempts, mediaType: isVideo ? 'VIDEO' : 'IMAGE' }, "Media processing did not complete within timeout, proceeding anyway");
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

    throw new Error(
      `Failed to publish story: ${publishResponse.error?.message || "Unknown error"}`
    );
  }

  const storyMediaId = publishResponse.id;
  logger.info({ storyMediaId, containerId }, "Instagram story published successfully");

  // 5. Try to get permalink (may not be available for stories)
  let permalink = "";
  try {
    const mediaDetails = await graphGet(
      `/${storyMediaId}?fields=permalink`,
      {},
      accessToken
    );
    permalink = mediaDetails.permalink || "";
  } catch (permalinkError) {
    logger.debug({ storyMediaId, permalinkError: permalinkError.message }, "Could not get story permalink");
  }

  return {
    containerId,
    mediaId: storyMediaId,
    permalink,
  };

  // 5. Wait for media processing and check status
  logger.info({ storyMediaId }, "Waiting for Instagram story media processing");

  let mediaDetails;
  let mediaAttempts = 0;
  const maxMediaAttempts = 10; // Max 10 attempts (50 seconds total)

  while (mediaAttempts < maxMediaAttempts) {
    try {
      mediaDetails = await graphGet(
        `/${storyMediaId}`,
        { fields: "status_code,permalink" },
        accessToken
      );

      // Check if media is ready
      if (mediaDetails.status_code === "FINISHED") {
        logger.info({ storyMediaId, mediaAttempts }, "Instagram story media ready");
        break;
      } else if (mediaDetails.status_code === "ERROR") {
        throw new Error(`Instagram media processing failed: ${mediaDetails.status_code}`);
      } else {
        logger.debug({ storyMediaId, status: mediaDetails.status_code, mediaAttempts }, "Instagram story media still processing");
      }
    } catch (error) {
      logger.warn({ storyMediaId, mediaAttempts, error: error.message }, "Failed to check Instagram story media status");
    }

    // Wait 5 seconds before next attempt
    await new Promise((resolve) => setTimeout(resolve, 5000));
    mediaAttempts++;
  }

  if (!mediaDetails || mediaDetails.status_code !== "FINISHED") {
    throw new Error(`Instagram story media processing did not complete within ${maxMediaAttempts * 5} seconds`);
  }

  return {
    containerId,
    mediaId: storyMediaId,
    permalink: mediaDetails.permalink || "",
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
  }
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

