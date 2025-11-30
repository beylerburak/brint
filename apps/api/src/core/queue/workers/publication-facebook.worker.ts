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
  video_id?: string;
  upload_url?: string;
  error?: {
    message: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_msg?: string;
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

  if (isVideo) {
    // Video story - multi-step process
    return await publishFacebookVideoStory(pageId, mediaUrl, accessToken);
  } else {
    // Photo story - single step
    return await publishFacebookPhotoStory(pageId, mediaUrl, accessToken);
  }
}

/**
 * Publish a PHOTO STORY to Facebook Page
 */
async function publishFacebookPhotoStory(
  pageId: string,
  mediaUrl: string,
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  // Use the correct photo_stories endpoint for Facebook Stories
  const endpoint = `/${pageId}/photo_stories`;

  // First upload the photo as unpublished (required for stories)
  const uploadParams: Record<string, string | boolean> = {
    url: mediaUrl,
    published: false, // Must be unpublished for story creation
  };

  logger.debug({ endpoint, uploadParams }, "Facebook photo story upload request");

  const uploadResponse = await graphPost(
    `/${pageId}/photos`,
    uploadParams,
    accessToken
  );

  if (uploadResponse.error || !uploadResponse.id) {
    logger.error(
      {
        endpoint,
        uploadParams,
        response: uploadResponse,
      },
      "Facebook photo upload failed"
    );
    throw new Error(
      `Failed to upload photo for story: ${uploadResponse.error?.message || "Unknown error"}`
    );
  }

  const photoId = uploadResponse.id;

  // Now create the story using photo_stories endpoint
  const storyParams: Record<string, string | boolean> = {
    photo_id: photoId,
  };

  logger.debug({ endpoint, storyParams }, "Facebook photo story publish request");

  const storyResponse = await graphPost(
    endpoint,
    storyParams,
    accessToken
  );

  // Check for Facebook Story API specific response format
  // Facebook returns {"success":true,"post_id":"..."} for successful story creation
  if (storyResponse.error || (!storyResponse.id && !storyResponse.post_id && !(storyResponse as any).success)) {
    logger.error(
      {
        endpoint,
        storyParams,
        response: storyResponse,
        error: storyResponse.error,
      },
      "Facebook photo story publish failed"
    );

    let errorMessage = "Failed to create photo story";
    if (storyResponse.error) {
      const error = storyResponse.error;
      errorMessage = error.message ||
                    error.error_user_msg ||
                    `Facebook error (code: ${error.code}): ${JSON.stringify(error)}`;
    }

    throw new Error(`Failed to post FB photo story: ${errorMessage}`);
  }

  // Facebook Story API returns post_id directly for stories
  const storyId = storyResponse.id || (storyResponse as any).post_id;
  const postId = (storyResponse as any).post_id || storyId;

  return {
    postId,
    permalink: "", // Stories typically don't have permalinks
  };
}

/**
 * Publish a VIDEO STORY to Facebook Page
 * Uses Resumable Upload API for large files (>25MB) for better reliability
 */
async function publishFacebookVideoStory(
  pageId: string,
  mediaUrl: string,
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  // Get file info to determine upload method
  const fileInfo = await getFileInfo(mediaUrl);

  // Use Resumable Upload API for large files (>25MB)
  if (fileInfo.size > 25 * 1024 * 1024) {
    return await publishFacebookVideoStoryResumable(pageId, mediaUrl, fileInfo, accessToken);
  } else {
    return await publishFacebookVideoStoryStandard(pageId, mediaUrl, accessToken);
  }
}

/**
 * Get file information from URL
 */
async function getFileInfo(mediaUrl: string): Promise<{ size: number; type: string; name: string }> {
  try {
    const headResponse = await fetch(mediaUrl, { method: 'HEAD' });
    const contentLength = headResponse.headers.get('content-length');
    const contentType = headResponse.headers.get('content-type') || 'video/mp4';

    // Extract filename from URL
    const urlParts = mediaUrl.split('/');
    const filename = urlParts[urlParts.length - 1].split('?')[0];

    return {
      size: contentLength ? parseInt(contentLength) : 0,
      type: contentType,
      name: filename || 'video.mp4'
    };
  } catch (error) {
    logger.warn({ mediaUrl, error }, "Could not get file info, using defaults");
    return {
      size: 0,
      type: 'video/mp4',
      name: 'video.mp4'
    };
  }
}

/**
 * Publish video story using Resumable Upload API (for large files)
 */
async function publishFacebookVideoStoryResumable(
  pageId: string,
  mediaUrl: string,
  fileInfo: { size: number; type: string; name: string },
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  logger.info({ pageId, fileSize: fileInfo.size, fileName: fileInfo.name }, "Using Resumable Upload API for large video story");

  // Get app ID from environment (needed for Resumable Upload API)
  const appId = env.FACEBOOK_APP_ID;
  if (!appId) {
    logger.warn("FACEBOOK_APP_ID not configured, falling back to standard upload");
    return await publishFacebookVideoStoryStandard(pageId, mediaUrl, accessToken);
  }

  try {
    // Step 1: Start upload session
    const startEndpoint = `/${appId}/uploads`;
    const startParams: Record<string, string | number> = {
      file_name: fileInfo.name,
      file_length: fileInfo.size,
      file_type: fileInfo.type,
    };

    logger.debug({ startEndpoint, startParams }, "Facebook resumable upload start");

    const startResponse = await graphPost(
      startEndpoint,
      startParams,
      accessToken
    );

    if (startResponse.error || !startResponse.id) {
      throw new Error(`Failed to start resumable upload: ${startResponse.error?.message}`);
    }

    const uploadSessionId = startResponse.id.replace('upload:', '');

    // Step 2: Upload file
    const uploadEndpoint = `/upload:${uploadSessionId}`;
    const fileResponse = await fetch(mediaUrl);
    const fileBuffer = await fileResponse.arrayBuffer();

    logger.debug({ uploadEndpoint, fileSize: fileBuffer.byteLength }, "Facebook resumable upload file");

    const uploadResponse = await fetch(`${GRAPH_API_BASE}${uploadEndpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${accessToken}`,
        'file_offset': '0',
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      throw new Error(`Resumable upload failed: HTTP ${uploadResponse.status} - ${errorData}`);
    }

    const uploadData = await uploadResponse.json();
    if (uploadData.error) {
      throw new Error(`Resumable upload error: ${uploadData.error.message}`);
    }

    const fileHandle = uploadData.h;
    if (!fileHandle) {
      throw new Error('No file handle received from resumable upload');
    }

    // Step 3: Create story using file handle
    const storyEndpoint = `/${pageId}/video_stories`;
    const storyParams: Record<string, string> = {
      upload_phase: 'finish',
      video_file_chunk: fileHandle, // Use file handle instead of video_id
    };

    logger.debug({ storyEndpoint, storyParams }, "Facebook video story create with file handle");

    const storyResponse = await graphPost(
      storyEndpoint,
      storyParams,
      accessToken
    );

    // Check for Facebook Video Story API specific response format
    if (storyResponse.error || (!storyResponse.id && !storyResponse.post_id && !(storyResponse as any).success)) {
      logger.error(
        {
          storyEndpoint,
          storyParams,
          response: storyResponse,
        },
        "Facebook video story with file handle failed"
      );
      throw new Error(
        `Failed to create video story with file handle: ${storyResponse.error?.message || "Unknown error"}`
      );
    }

    // Facebook Video Story API may return different response formats
    const storyId = storyResponse.id || (storyResponse as any).post_id;
    const postId = (storyResponse as any).post_id || storyId;

    logger.info({ postId, fileHandle }, "Facebook video story published with resumable upload");

    return {
      postId,
      permalink: "", // Stories typically don't have permalinks
    };

  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, "Resumable upload failed, falling back to standard method");
    return await publishFacebookVideoStoryStandard(pageId, mediaUrl, accessToken);
  }
}

/**
 * Publish video story using standard Pages API method (for smaller files)
 */
async function publishFacebookVideoStoryStandard(
  pageId: string,
  mediaUrl: string,
  accessToken: string
): Promise<{ postId: string; permalink: string }> {
  // Video stories require a multi-step process: start -> upload -> finish
  const endpoint = `/${pageId}/video_stories`;

  // Step 1: Start upload
  const startParams: Record<string, string> = {
    upload_phase: "start",
  };

  logger.debug({ endpoint, startParams }, "Facebook video story start upload");

  const startResponse = await graphPost(
    endpoint,
    startParams,
    accessToken
  );

  if (startResponse.error || !startResponse.video_id) {
    logger.error(
      {
        endpoint,
        startParams,
        response: startResponse,
      },
      "Facebook video story start failed"
    );
    throw new Error(
      `Failed to start video story upload: ${startResponse.error?.message || "Unknown error"}`
    );
  }

  const videoId = startResponse.video_id;
  const uploadUrl = startResponse.upload_url;

  if (!uploadUrl) {
    throw new Error("Facebook did not provide upload URL for video story");
  }

  // Step 2: Upload video to the provided URL
  // Add access token as query parameter (required by Facebook)
  const uploadUrlWithToken = `${uploadUrl}${uploadUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`;

  logger.debug({ uploadUrl: uploadUrlWithToken, videoId }, "Facebook video story upload to URL");

  const uploadResponse = await fetch(uploadUrlWithToken, {
    method: "POST",
    headers: {
      "file_url": mediaUrl,
    },
  });

  if (!uploadResponse.ok) {
    const uploadData = await uploadResponse.text();
    logger.error(
      {
        uploadUrl,
        videoId,
        status: uploadResponse.status,
        response: uploadData,
      },
      "Facebook video story upload failed"
    );
    throw new Error(`Failed to upload video to Facebook: HTTP ${uploadResponse.status}`);
  }

  // Step 3: Finish upload
  const finishParams: Record<string, string | boolean> = {
    upload_phase: "finish",
    video_id: videoId,
  };

  logger.debug({ endpoint, finishParams }, "Facebook video story finish upload");

  const finishResponse = await graphPost(
    endpoint,
    finishParams,
    accessToken
  );

  // Check for Facebook Video Story API specific response format
  if (finishResponse.error || (!finishResponse.id && !finishResponse.post_id && !(finishResponse as any).success)) {
    logger.error(
      {
        endpoint,
        finishParams,
        response: finishResponse,
      },
      "Facebook video story finish failed"
    );
    throw new Error(
      `Failed to finish video story: ${finishResponse.error?.message || "Unknown error"}`
    );
  }

  // Facebook Video Story API may return different response formats
  const storyId = finishResponse.id || (finishResponse as any).post_id;
  const postId = (finishResponse as any).post_id || storyId;

  return {
    postId,
    permalink: "", // Stories typically don't have permalinks
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

