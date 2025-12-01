/**
 * Facebook Publication Client
 * 
 * Handles all Facebook Graph API publishing operations.
 * Supports PHOTO, VIDEO, CAROUSEL, LINK, and STORY content types.
 * 
 * Architecture Note:
 * This client is responsible ONLY for Facebook Graph API interactions.
 * It does NOT handle:
 * - Database operations (workers handle DB updates)
 * - Activity logging (workers handle logging)
 * - Job orchestration (workers handle BullMQ)
 */

import type { FacebookPublicationPayload } from "@brint/core-validation";
import type { GraphApiResponse } from "../../../core/queue/workers/graph-api.utils.js";
import {
    graphPost,
    graphPostJson,
    graphGet,
    verifyFacebookPostPublished,
    extractGraphApiErrorMessage,
    isRetryableError,
    RetryablePublicationError,
    GRAPH_API_BASE,
} from "../../../core/queue/workers/graph-api.utils.js";
import { getMediaPublicUrl } from "./shared-media.util.js";
import { logger } from "../../../lib/logger.js";
import { env } from "../../../config/env.js";

// ====================
// Types
// ====================

export type FacebookPublishResult = {
    postId: string;
    permalink: string;
};

export type FacebookStoryPayload = {
    contentType: "STORY";
    storyType: "IMAGE" | "VIDEO";
    imageMediaId?: string;
    videoMediaId?: string;
};

// ====================
// Photo Publishing
// ====================

/**
 * Publish a PHOTO to Facebook Page
 */
async function publishPhoto(
    pageId: string,
    payload: FacebookPublicationPayload & { contentType: "PHOTO" },
    accessToken: string
): Promise<FacebookPublishResult> {
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
        const errorMessage = extractGraphApiErrorMessage(postResponse.error);
        const fullMessage = `Failed to post FB photo: ${errorMessage}`;

        // Check if this is a retryable error (e.g., media not ready, rate limiting)
        if (isRetryableError(postResponse.error)) {
            throw new RetryablePublicationError(fullMessage, postResponse.error);
        }

        throw new Error(fullMessage);
    }

    const photoId = postResponse.id;
    const postId = postResponse.post_id || photoId;

    // 3. Verify post was published and get permalink
    logger.info({ postId }, "Verifying Facebook photo was published");
    const verification = await verifyFacebookPostPublished(postId, accessToken);

    if (!verification.exists) {
        throw new Error("Facebook photo was not successfully published or is not accessible");
    }

    // Get permalink if not from verification
    let permalink = verification.permalink || "";
    if (!permalink) {
        try {
            const photoDetails = await graphGet(
                `/${photoId}`,
                { fields: "link,permalink_url" },
                accessToken
            );
            permalink = photoDetails.permalink_url || (photoDetails as any).link || "";
        } catch (error) {
            logger.warn({ photoId, error }, "Failed to get photo permalink");
        }
    }

    return {
        postId,
        permalink,
    };
}

// ====================
// Video Publishing
// ====================

/**
 * Publish a VIDEO to Facebook Page
 */
async function publishVideo(
    pageId: string,
    payload: FacebookPublicationPayload & { contentType: "VIDEO" },
    accessToken: string
): Promise<FacebookPublishResult> {
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
        const errorMessage = extractGraphApiErrorMessage(postResponse.error);
        const fullMessage = `Failed to post FB video: ${errorMessage}`;

        // Check if this is a retryable error (e.g., media not ready, rate limiting)
        if (isRetryableError(postResponse.error)) {
            throw new RetryablePublicationError(fullMessage, postResponse.error);
        }

        throw new Error(fullMessage);
    }

    const videoId = postResponse.id;

    // 3. Verify post was published and get permalink
    logger.info({ videoId }, "Verifying Facebook video was published");
    const verification = await verifyFacebookPostPublished(videoId, accessToken);

    if (!verification.exists) {
        throw new Error("Facebook video was not successfully published or is not accessible");
    }

    // Get permalink if not from verification
    let permalink = verification.permalink || "";
    if (!permalink) {
        try {
            const videoDetails = await graphGet(
                `/${videoId}`,
                { fields: "permalink_url" },
                accessToken
            );
            permalink = videoDetails.permalink_url || "";
        } catch (error) {
            logger.warn({ videoId, error }, "Failed to get video permalink");
        }
    }

    return {
        postId: videoId,
        permalink,
    };
}

// ====================
// Carousel Publishing
// ====================

/**
 * Publish a CAROUSEL (multi-photo post) to Facebook Page
 * Facebook carousel posts use unpublished photos with attached_media parameter
 */
async function publishCarousel(
    pageId: string,
    payload: FacebookPublicationPayload & { contentType: "CAROUSEL" },
    accessToken: string
): Promise<FacebookPublishResult> {
    // Type assertion for carousel payload with items
    const carouselPayload = payload as FacebookPublicationPayload & {
        contentType: "CAROUSEL";
        items: Array<{ mediaId: string; type: "IMAGE" | "VIDEO"; altText?: string }>;
        message?: string;
    };

    logger.info(
        { pageId, itemCount: carouselPayload.items?.length, items: carouselPayload.items },
        "Starting Facebook carousel publish"
    );

    if (!carouselPayload.items || carouselPayload.items.length === 0) {
        throw new Error("Carousel payload must contain at least one item");
    }

    // 1. Upload each photo as unpublished (required for carousel)
    const photoIds: string[] = [];

    for (const item of carouselPayload.items) {
        // Only support IMAGE items for Facebook carousel (videos not supported in carousel)
        if (item.type !== "IMAGE") {
            logger.warn(
                { itemType: item.type, pageId },
                "Facebook carousel only supports IMAGE items, skipping non-image item"
            );
            continue;
        }

        const imageUrl = await getMediaPublicUrl(item.mediaId);
        if (!imageUrl) {
            throw new Error(`Cannot get public URL for carousel item: ${item.mediaId}`);
        }

        // Upload photo as unpublished (required for carousel)
        const uploadParams: Record<string, string | boolean> = {
            url: imageUrl,
            published: false, // Must be unpublished for carousel
        };

        logger.debug({ pageId, mediaId: item.mediaId }, "Uploading unpublished photo for carousel");

        const uploadResponse = await graphPost(
            `/${pageId}/photos`,
            uploadParams,
            accessToken
        );

        if (uploadResponse.error || !uploadResponse.id) {
            const errorMessage = extractGraphApiErrorMessage(uploadResponse.error);
            const fullMessage = `Failed to upload carousel photo: ${errorMessage}`;

            // Check if this is a retryable error (e.g., media not ready, rate limiting)
            if (isRetryableError(uploadResponse.error)) {
                throw new RetryablePublicationError(fullMessage, uploadResponse.error);
            }

            throw new Error(fullMessage);
        }

        photoIds.push(uploadResponse.id);
        logger.debug({ pageId, photoId: uploadResponse.id, totalUploaded: photoIds.length }, "Photo uploaded successfully for carousel");
    }

    logger.info({ pageId, totalPhotos: photoIds.length, photoIds }, "All photos uploaded for carousel");

    if (photoIds.length === 0) {
        throw new Error("No valid photos uploaded for carousel");
    }

    // Always use carousel format (even for single photo) - Facebook handles it correctly

    // 2. Create carousel post using /feed endpoint with attached_media
    // Use graphPost (x-www-form-urlencoded) but pass attached_media as a stringified array of objects
    // This is a common pattern that works better than indexed keys or pure JSON in some contexts
    const feedParams: Record<string, string | boolean> = {
        published: true, // Explicitly set published to true
    };

    if (carouselPayload.message) {
        feedParams.message = carouselPayload.message;
    }

    // Create array of objects and stringify the whole array
    const attachedMedia = photoIds.map(photoId => ({
        media_fbid: photoId
    }));

    // Pass as a single stringified JSON array
    feedParams.attached_media = JSON.stringify(attachedMedia);

    logger.info(
        {
            pageId,
            photoCount: photoIds.length,
            photoIds,
            feedParams,
        },
        "Creating Facebook carousel post via /feed with attached_media stringified array"
    );

    const feedResponse = await graphPost(
        `/${pageId}/feed`,
        feedParams,
        accessToken
    );

    if (feedResponse.error || !feedResponse.id) {
        const errorMessage = extractGraphApiErrorMessage(feedResponse.error);
        const fullMessage = `Failed to create FB carousel: ${errorMessage}`;

        // Check if this is a retryable error (e.g., rate limiting)
        if (isRetryableError(feedResponse.error)) {
            throw new RetryablePublicationError(fullMessage, feedResponse.error);
        }

        throw new Error(fullMessage);
    }

    const postId = feedResponse.id;

    // 3. Verify post was published and get permalink
    logger.info({ postId }, "Verifying Facebook carousel was published");
    const verification = await verifyFacebookPostPublished(postId, accessToken);

    if (!verification.exists) {
        throw new Error("Facebook carousel was not successfully published or is not accessible");
    }

    // Get permalink
    let permalink = verification.permalink || "";
    if (!permalink) {
        try {
            const postDetails = await graphGet(
                `/${postId}`,
                { fields: "permalink_url" },
                accessToken
            );
            permalink = postDetails.permalink_url || "";
        } catch (error) {
            logger.warn({ postId, error }, "Failed to get carousel permalink");
        }
    }

    return {
        postId,
        permalink,
    };
}

// ====================
// Link Publishing
// ====================

/**
 * Publish a LINK to Facebook Page
 */
async function publishLink(
    pageId: string,
    payload: FacebookPublicationPayload & { contentType: "LINK" },
    accessToken: string
): Promise<FacebookPublishResult> {
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
        const errorMessage = extractGraphApiErrorMessage(postResponse.error);
        const fullMessage = `Failed to post FB link: ${errorMessage}`;

        // Check if this is a retryable error (e.g., rate limiting)
        if (isRetryableError(postResponse.error)) {
            throw new RetryablePublicationError(fullMessage, postResponse.error);
        }

        throw new Error(fullMessage);
    }

    const postId = postResponse.id;

    // 2. Verify post was published and get permalink
    logger.info({ postId }, "Verifying Facebook link post was published");
    const verification = await verifyFacebookPostPublished(postId, accessToken);

    if (!verification.exists) {
        throw new Error("Facebook link post was not successfully published or is not accessible");
    }

    // Get permalink if not from verification
    let permalink = verification.permalink || "";
    if (!permalink) {
        try {
            const postDetails = await graphGet(
                `/${postId}`,
                { fields: "permalink_url" },
                accessToken
            );
            permalink = postDetails.permalink_url || "";
        } catch (error) {
            logger.warn({ postId, error }, "Failed to get link post permalink");
        }
    }

    return {
        postId,
        permalink,
    };
}

// ====================
// Story Publishing
// ====================

/**
 * Publish a STORY to Facebook Page
 * Facebook Page Stories use:
 * - /{page-id}/photo_stories for images
 * - /{page-id}/video_stories for videos
 */
async function publishStory(
    pageId: string,
    payload: FacebookStoryPayload,
    accessToken: string
): Promise<FacebookPublishResult> {
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
        return await publishVideoStory(pageId, mediaUrl, accessToken);
    } else {
        // Photo story - single step
        return await publishPhotoStory(pageId, mediaUrl, accessToken);
    }
}

/**
 * Publish a PHOTO STORY to Facebook Page
 */
async function publishPhotoStory(
    pageId: string,
    mediaUrl: string,
    accessToken: string
): Promise<FacebookPublishResult> {
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

        const errorMessage = extractGraphApiErrorMessage(uploadResponse.error);
        const fullMessage = `Failed to upload photo for story: ${errorMessage}`;

        // Check if this is a retryable error (e.g., media not ready, rate limiting)
        if (isRetryableError(uploadResponse.error)) {
            throw new RetryablePublicationError(fullMessage, uploadResponse.error);
        }

        throw new Error(fullMessage);
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

        const fullMessage = `Failed to post FB photo story: ${errorMessage}`;

        // Check if this is a retryable error (e.g., media not ready, rate limiting)
        if (isRetryableError(storyResponse.error)) {
            throw new RetryablePublicationError(fullMessage, storyResponse.error);
        }

        throw new Error(fullMessage);
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
async function publishVideoStory(
    pageId: string,
    mediaUrl: string,
    accessToken: string
): Promise<FacebookPublishResult> {
    // Get file info to determine upload method
    const fileInfo = await getFileInfo(mediaUrl);

    // Use Resumable Upload API for large files (>25MB)
    if (fileInfo.size > 25 * 1024 * 1024) {
        return await publishVideoStoryResumable(pageId, mediaUrl, fileInfo, accessToken);
    } else {
        return await publishVideoStoryStandard(pageId, mediaUrl, accessToken);
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
async function publishVideoStoryResumable(
    pageId: string,
    mediaUrl: string,
    fileInfo: { size: number; type: string; name: string },
    accessToken: string
): Promise<FacebookPublishResult> {
    logger.info({ pageId, fileSize: fileInfo.size, fileName: fileInfo.name }, "Using Resumable Upload API for large video story");

    // Get app ID from environment (needed for Resumable Upload API)
    const appId = env.FACEBOOK_APP_ID;
    if (!appId) {
        logger.warn("FACEBOOK_APP_ID not configured, falling back to standard upload");
        return await publishVideoStoryStandard(pageId, mediaUrl, accessToken);
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
            const errorMessage = extractGraphApiErrorMessage(startResponse.error);
            const fullMessage = `Failed to start resumable upload: ${errorMessage}`;

            // Check if this is a retryable error (e.g., rate limiting)
            if (isRetryableError(startResponse.error)) {
                throw new RetryablePublicationError(fullMessage, startResponse.error);
            }

            throw new Error(fullMessage);
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

            const errorMessage = extractGraphApiErrorMessage(storyResponse.error);
            const fullMessage = `Failed to create video story with file handle: ${errorMessage}`;

            // Check if this is a retryable error (e.g., media not ready, rate limiting)
            if (isRetryableError(storyResponse.error)) {
                throw new RetryablePublicationError(fullMessage, storyResponse.error);
            }

            throw new Error(fullMessage);
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
        return await publishVideoStoryStandard(pageId, mediaUrl, accessToken);
    }
}

/**
 * Publish video story using standard Pages API method (for smaller files)
 */
async function publishVideoStoryStandard(
    pageId: string,
    mediaUrl: string,
    accessToken: string
): Promise<FacebookPublishResult> {
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

        const errorMessage = extractGraphApiErrorMessage(startResponse.error);
        const fullMessage = `Failed to start video story upload: ${errorMessage}`;

        // Check if this is a retryable error (e.g., rate limiting)
        if (isRetryableError(startResponse.error)) {
            throw new RetryablePublicationError(fullMessage, startResponse.error);
        }

        throw new Error(fullMessage);
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

        const errorMessage = extractGraphApiErrorMessage(finishResponse.error);
        const fullMessage = `Failed to finish video story: ${errorMessage}`;

        // Check if this is a retryable error (e.g., media not ready, rate limiting)
        if (isRetryableError(finishResponse.error)) {
            throw new RetryablePublicationError(fullMessage, finishResponse.error);
        }

        throw new Error(fullMessage);
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
// Client Export
// ====================

export const facebookPublicationClient = {
    publishPhoto,
    publishVideo,
    publishCarousel,
    publishLink,
    publishStory,
};
