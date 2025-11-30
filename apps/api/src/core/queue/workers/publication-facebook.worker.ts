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
import { prisma } from "../../../lib/prisma.js";
import { logActivity } from "../../../modules/activity/activity.service.js";
import { publicationRepository } from "../../../modules/publication/publication.repository.js";
import { decryptSocialCredentials } from "../../../modules/social-account/social-account.types.js";
import { buildPublicUrl } from "../../../lib/storage/public-url.js";
import { S3StorageService } from "../../../lib/storage/s3.storage.service.js";
import { captureException, isSentryInitialized } from "../../observability/sentry.js";
import type { PublishJobData, FacebookCredentials, FacebookPlatformData } from "../../../modules/publication/publication.types.js";
import type { FacebookPublicationPayload } from "@brint/core-validation";
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
  post_id?: string;
  error?: {
    message: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface PostResponse extends GraphApiResponse {
  permalink_url?: string;
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

  const data = await response.json();

  // Check for HTTP errors - Facebook returns errors as JSON with error field
  if (!response.ok) {
    logger.warn(
      { endpoint, status: response.status, response: data },
      "Facebook Graph API HTTP error"
    );
  }

  return data;
}

/**
 * Make a GET request to Graph API
 */
async function graphGet(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<PostResponse> {
  const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
  url.searchParams.append("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  // Check for HTTP errors
  if (!response.ok) {
    logger.warn(
      { endpoint, status: response.status, response: data },
      "Facebook Graph API GET HTTP error"
    );
  }

  return data;
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
// Facebook Publishing Functions
// ====================

/**
 * Publish a PHOTO to Facebook Page
 */
async function publishFacebookPhoto(
  pageId: string,
  payload: FacebookPublicationPayload & { contentType: "PHOTO" },
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  // 1. Get image URL
  const imageUrl = await getMediaPublicUrl(payload.imageMediaId);
  if (!imageUrl) {
    throw new Error(`Cannot get public URL for image: ${payload.imageMediaId}`);
  }

  // 2. Post photo
  const postParams: Record<string, string | boolean> = {
    url: imageUrl,
    published: true,
  };

  if (payload.message) {
    postParams.caption = payload.message;
  }

  const postResponse = await graphPost(
    `/${pageId}/photos`,
    postParams,
    accessToken
  );

  if (postResponse.error || !postResponse.id) {
    throw new Error(
      `Failed to post FB photo: ${postResponse.error?.message || "Unknown error"}`
    );
  }

  const photoId = postResponse.id;
  const postId = postResponse.post_id || photoId;

  // 3. Get permalink
  const photoDetails = await graphGet(
    `/${photoId}`,
    { fields: "link" },
    accessToken
  );

  return {
    postId,
    permalink: photoDetails.permalink_url || (photoDetails as any).link || "",
  };
}

/**
 * Publish a VIDEO to Facebook Page
 */
async function publishFacebookVideo(
  pageId: string,
  payload: FacebookPublicationPayload & { contentType: "VIDEO" },
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  // 1. Get video URL
  const videoUrl = await getMediaPublicUrl(payload.videoMediaId);
  if (!videoUrl) {
    throw new Error(`Cannot get public URL for video: ${payload.videoMediaId}`);
  }

  // 2. Post video
  const postParams: Record<string, string | boolean> = {
    file_url: videoUrl,
    published: true,
  };

  if (payload.message) {
    postParams.description = payload.message;
  }
  if (payload.title) {
    postParams.title = payload.title;
  }

  // Add thumbnail if provided
  if (payload.thumbMediaId) {
    const thumbUrl = await getMediaPublicUrl(payload.thumbMediaId);
    if (thumbUrl) {
      postParams.thumb = thumbUrl;
    }
  }

  const postResponse = await graphPost(
    `/${pageId}/videos`,
    postParams,
    accessToken
  );

  if (postResponse.error || !postResponse.id) {
    throw new Error(
      `Failed to post FB video: ${postResponse.error?.message || "Unknown error"}`
    );
  }

  const videoId = postResponse.id;

  // 3. Get permalink
  const videoDetails = await graphGet(
    `/${videoId}`,
    { fields: "permalink_url" },
    accessToken
  );

  return {
    postId: videoId,
    permalink: videoDetails.permalink_url || "",
  };
}

/**
 * Publish a LINK to Facebook Page
 */
async function publishFacebookLink(
  pageId: string,
  payload: FacebookPublicationPayload & { contentType: "LINK" },
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  // 1. Post link
  const postParams: Record<string, string> = {
    link: payload.linkUrl,
  };

  if (payload.message) {
    postParams.message = payload.message;
  }

  const postResponse = await graphPost(
    `/${pageId}/feed`,
    postParams,
    accessToken
  );

  if (postResponse.error || !postResponse.id) {
    throw new Error(
      `Failed to post FB link: ${postResponse.error?.message || "Unknown error"}`
    );
  }

  const postId = postResponse.id;

  // 2. Get permalink
  const postDetails = await graphGet(
    `/${postId}`,
    { fields: "permalink_url" },
    accessToken
  );

  return {
    postId,
    permalink: postDetails.permalink_url || "",
  };
}

/**
 * Facebook STORY payload type
 * Can be either IMAGE story or VIDEO story
 */
type FacebookStoryPayload = {
  contentType: "STORY";
  storyType: "IMAGE" | "VIDEO";
  imageMediaId?: string;
  videoMediaId?: string;
};

/**
 * Publish a STORY to Facebook Page
 * Facebook Page Stories use:
 * - /{page-id}/photo_stories for images
 * - /{page-id}/video_stories for videos
 */
async function publishFacebookStory(
  pageId: string,
  payload: FacebookStoryPayload,
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  const isVideo = payload.storyType === "VIDEO";
  const mediaId = isVideo ? payload.videoMediaId : payload.imageMediaId;
  
  if (!mediaId) {
    throw new Error(`Story requires ${isVideo ? 'videoMediaId' : 'imageMediaId'} for ${payload.storyType} story`);
  }

  // 1. Get media URL
  const mediaUrl = await getMediaPublicUrl(mediaId);
  if (!mediaUrl) {
    logger.error({ mediaId, storyType: payload.storyType }, "Cannot get public URL for story media");
    throw new Error(`Cannot get public URL for story media: ${mediaId}`);
  }

  // 2. Validate media URL is accessible (Facebook requires HTTPS URLs)
  if (!mediaUrl.startsWith('https://')) {
    logger.error({ mediaUrl, mediaId }, "Media URL must be HTTPS for Facebook Stories");
    throw new Error(`Media URL must be HTTPS for Facebook Stories: ${mediaUrl}`);
  }

  logger.info(
    { pageId, storyType: payload.storyType, mediaId, mediaUrl },
    "Publishing Facebook story"
  );

  // 2. Post story
  // Facebook Stories API - use photos endpoint with published=false for stories
  // Note: Requires pages_manage_posts permission
  const endpoint = `/${pageId}/photos`;

  // Facebook Stories API parameters - published=false creates a story
  const storyParams: Record<string, string | boolean> = {
    url: mediaUrl,
    published: false, // This creates a story instead of a regular post
  };

  logger.debug({ endpoint, storyParams }, "Facebook story API request");

  const postResponse = await graphPost(
    endpoint,
    storyParams,
    accessToken
  );

  if (postResponse.error || !postResponse.id) {
    // Log full response for debugging
    logger.error(
      {
        endpoint,
        storyParams,
        response: postResponse,
        error: postResponse.error,
        responseKeys: Object.keys(postResponse),
        errorKeys: postResponse.error ? Object.keys(postResponse.error) : null,
        hasError: !!postResponse.error,
        hasId: !!postResponse.id,
      },
      "Facebook story publish failed - full response analysis"
    );

    let errorMessage = "An unknown error has occurred";

    if (postResponse.error) {
      const error = postResponse.error;

      // Handle specific Facebook error codes
      if (error.code === 1) {
        errorMessage = "Facebook authentication or permission error. Please check that the Page has 'pages_manage_posts' permission and the token is valid.";
      } else if (error.code === 200) {
        errorMessage = "Facebook permissions error. The Page token needs 'pages_manage_posts' permission for story publishing.";
      } else if (error.code === 10) {
        errorMessage = "Facebook application request limit reached.";
      } else if (error.code === 100) {
        errorMessage = "Facebook parameter error. Please check media URL and page ID.";
      } else {
        // Use Facebook's error message if available
        errorMessage = error.message ||
                       error.error_user_msg ||
                       error.error_msg ||
                       error.error_description ||
                       `Facebook error (code: ${error.code}): ${JSON.stringify(error)}`;
      }

      // Add fbtrace_id for debugging if available
      if (error.fbtrace_id) {
        errorMessage += ` (Trace ID: ${error.fbtrace_id})`;
      }
    } else if (!postResponse.id) {
      errorMessage = "Facebook API did not return an ID for the story post. This may indicate a permissions or parameter issue.";
    } else {
      errorMessage = `Unexpected response structure: ${JSON.stringify(postResponse)}`;
    }

    throw new Error(`Failed to post FB story: ${errorMessage}`);
  }

  const storyId = postResponse.id;
  const postId = (postResponse as any).post_id || storyId;

  // 3. Try to get permalink (stories may not have one)
  let permalink = "";
  try {
    const storyDetails = await graphGet(
      `/${storyId}`,
      { fields: "permalink_url" },
      accessToken
    );
    permalink = storyDetails.permalink_url || "";
  } catch {
    // Stories may not have permalink
    logger.debug({ storyId }, "Could not get permalink for Facebook story");
  }

  return {
    postId,
    permalink,
  };
}

// ====================
// Job Processor
// ====================

/**
 * Process Facebook publish job
 */
async function processFacebookPublishJob(job: Job<PublishJobData>): Promise<void> {
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

  try {
    let result: { postId: string; permalink: string };

    switch (payload.contentType) {
      case "PHOTO":
        result = await publishFacebookPhoto(
          pageId,
          payload as FacebookPublicationPayload & { contentType: "PHOTO" },
          credentials.accessToken
        );
        break;

      case "VIDEO":
        result = await publishFacebookVideo(
          pageId,
          payload as FacebookPublicationPayload & { contentType: "VIDEO" },
          credentials.accessToken
        );
        break;

      case "LINK":
        result = await publishFacebookLink(
          pageId,
          payload as FacebookPublicationPayload & { contentType: "LINK" },
          credentials.accessToken
        );
        break;

      case "STORY":
        result = await publishFacebookStory(
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
  }
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

