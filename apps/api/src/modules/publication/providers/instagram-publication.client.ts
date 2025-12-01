/**
 * Instagram Publication Client
 * 
 * Handles all Instagram Graph API publishing operations.
 * Supports IMAGE, CAROUSEL, REEL, and STORY content types.
 * 
 * Architecture Note:
 * This client is responsible ONLY for Instagram Graph API interactions.
 * It does NOT handle:
 * - Database operations (workers handle DB updates)
 * - Activity logging (workers handle logging)
 * - Job orchestration (workers handle BullMQ)
 */

import type { InstagramPublicationPayload } from "@brint/core-validation";
import {
    graphPost,
    graphGet,
    waitForStatus,
    verifyInstagramPostPublished,
    extractGraphApiErrorMessage,
    isRetryableError,
    RetryablePublicationError,
    type MediaResponse,
} from "../../../core/queue/workers/graph-api.utils.js";
import { getMediaPublicUrl } from "./shared-media.util.js";
import { logger } from "../../../lib/logger.js";

// ====================
// Types
// ====================

export type InstagramPublishResult = {
    containerId: string;
    mediaId: string;
    permalink: string;
};

export type InstagramStoryPayload = {
    contentType: "STORY";
    storyType: "IMAGE" | "VIDEO";
    imageMediaId?: string;
    videoMediaId?: string;
};

// ====================
// Image Publishing
// ====================

/**
 * Publish an IMAGE to Instagram
 */
async function publishImage(
    igUserId: string,
    payload: InstagramPublicationPayload & { contentType: "IMAGE" },
    accessToken: string
): Promise<InstagramPublishResult> {
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

// ====================
// Carousel Publishing
// ====================

/**
 * Publish a CAROUSEL to Instagram
 */
async function publishCarousel(
    igUserId: string,
    payload: InstagramPublicationPayload & { contentType: "CAROUSEL" },
    accessToken: string
): Promise<InstagramPublishResult> {
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

// ====================
// Reel Publishing
// ====================

/**
 * Publish a REEL to Instagram
 */
async function publishReel(
    igUserId: string,
    payload: InstagramPublicationPayload & { contentType: "REEL" },
    accessToken: string
): Promise<InstagramPublishResult> {
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

// ====================
// Story Publishing
// ====================

/**
 * Publish a STORY to Instagram
 * Stories use media_type=STORIES and disappear after 24 hours
 * Graph API: POST /{ig-user-id}/media with media_type=STORIES
 */
async function publishStory(
    igUserId: string,
    payload: InstagramStoryPayload,
    accessToken: string
): Promise<InstagramPublishResult> {
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
// Client Export
// ====================

export const instagramPublicationClient = {
    publishImage,
    publishCarousel,
    publishReel,
    publishStory,
};
