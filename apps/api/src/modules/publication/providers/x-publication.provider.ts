/**
 * X (Twitter) Publication Provider
 *
 * Publishes content to X using Twitter API v2.
 * Supports Feed posts (text-only or with media).
 */

import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import {
  ContentFormFactor,
  Publication,
  SocialAccount,
  Content,
  ContentMedia,
  Media,
  ContentAccountOptions,
} from "@prisma/client";
import { getPublishableUrlForMedia } from "../../../core/media/media-url.helper";
import { logger } from "../../../lib/logger.js";
import { requiresMedia, getCaptionLimitFor } from "@brint/shared-config/platform-rules";

const X_API_BASE = "https://api.x.com";
const X_API_V2 = `${X_API_BASE}/2`;
// X API v2 media upload endpoints
const X_MEDIA_UPLOAD = `${X_API_V2}/media/upload`; // For simple image uploads
const X_MEDIA_INIT = `${X_API_V2}/media/upload/initialize`; // For video INIT
const X_MEDIA_APPEND = (mediaId: string) => `${X_API_V2}/media/upload/${mediaId}/append`; // For video APPEND (media_id in path)
const X_MEDIA_FINALIZE = (mediaId: string) => `${X_API_V2}/media/upload/${mediaId}/finalize`; // For video FINALIZE (media_id in path)
const X_MEDIA_STATUS = `${X_API_V2}/media/upload`; // For video STATUS check

type PublicationWithRelations = Publication & {
  content: Content & {
    contentMedia: (ContentMedia & { media: Media })[];
    accountOptions: ContentAccountOptions[];
  };
  socialAccount: SocialAccount;
};

export type PublicationResult = {
  platformPostId?: string;
  publishedAt?: Date;
  payloadSnapshot?: any;
};

export class XPublicationProvider {
  private http: AxiosInstance;

  constructor(httpClient?: AxiosInstance) {
    this.http = httpClient ?? axios.create({
      timeout: 120000, // 2 minutes for video uploads
    });

    // Add response interceptor for better error logging
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          logger.error(
            {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data,
              url: error.config?.url,
              method: error.config?.method,
            },
            "X API Error Response"
          );
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Publish content to X based on form factor
   */
  async publish(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content } = pub;

    // X supports FEED_POST and VERTICAL_VIDEO (both are published as tweets)
    // VERTICAL_VIDEO is treated as a regular tweet with video media
    if (content.formFactor !== "FEED_POST" && content.formFactor !== "VERTICAL_VIDEO") {
      throw new Error(
        `X publication currently supports only FEED_POST and VERTICAL_VIDEO form factors. Got: ${content.formFactor}`
      );
    }

    // Both FEED_POST and VERTICAL_VIDEO are published as tweets
    return this.publishTweet(pub);
  }

  /**
   * Publish tweet (supports text-only or with media)
   * Handles both FEED_POST and VERTICAL_VIDEO form factors as tweets
   */
  private async publishTweet(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;
    let accessToken = socialAccount.accessToken;

    // Validate required fields
    if (!accessToken) {
      throw new Error(
        `X access token is missing for social account ${socialAccount.id}`
      );
    }

    // Clean token - remove "Bearer " prefix if present
    accessToken = accessToken.replace(/^Bearer\s+/i, "").trim();

    // Log token info for debugging (without exposing full token)
    logger.info(
      {
        socialAccountId: socialAccount.id,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        accessTokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : null,
        platformAccountId: socialAccount.platformAccountId,
        scopes: socialAccount.scopes || [],
      },
      "X publication - token validation"
    );

    logger.info(
      {
        contentId: content.id,
        formFactor: content.formFactor,
        note: content.formFactor === "VERTICAL_VIDEO" 
          ? "VERTICAL_VIDEO will be published as a regular X tweet" 
          : "Publishing as X tweet",
      },
      "Publishing to X"
    );

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // Check if media is required for this platform/form factor
    const mediaRequired = requiresMedia("X", content.formFactor as any);
    if (mediaRequired && !sortedMedia.length) {
      throw new Error(
        `X ${content.formFactor} publish requires at least one media according to platform rules`
      );
    }

    const accountOptions = content.accountOptions.find(
      (opt) => opt.socialAccountId === socialAccount.id
    );
    const captionRaw = this.buildXCaption(content, accountOptions);
    const caption = this.clampXCaption(captionRaw);

    // Handle media upload if present
    const mediaIds: string[] = [];
    if (sortedMedia.length > 0) {
      logger.info(
        {
          mediaCount: sortedMedia.length,
        },
        "Uploading media to X"
      );

      for (const cm of sortedMedia) {
        const media = cm.media;

        if (!media) {
          throw new Error(`Media not found for contentMedia ${cm.id}`);
        }

        // Get publishable URL
        let mediaUrl: string;
        try {
          mediaUrl = await getPublishableUrlForMedia(media, {
            expiresInSeconds: 60 * 60, // 1 hour
          });
        } catch (urlError: any) {
          throw new Error(
            `Failed to generate publishable URL for media ${media.id}: ${urlError.message}`
          );
        }

        if (!mediaUrl || !mediaUrl.startsWith("http")) {
          throw new Error(`Invalid media URL for media ${media.id}: ${mediaUrl}`);
        }

        try {
          // Upload media to X Media API
          const mediaId = await this.uploadMediaToX(
            accessToken,
            mediaUrl,
            media
          );
          mediaIds.push(mediaId);
        } catch (uploadError: any) {
          const errorMsg =
            uploadError?.response?.data?.errors?.[0]?.message ||
            uploadError?.response?.data?.detail ||
            uploadError?.message ||
            "Unknown error uploading media";
          throw new Error(
            `Failed to upload media ${media.id} to X: ${errorMsg}`
          );
        }
      }
    }

    // Create tweet
    let tweetRes;
    try {
      logger.info(
        {
          hasCaption: !!caption,
          captionLength: caption?.length || 0,
          mediaCount: mediaIds.length,
        },
        "Creating X tweet"
      );

      const tweetPayload: any = {
        text: caption || "",
      };

      // Add media if present
      // X API v2 requires media_ids as array of strings
      if (mediaIds.length > 0) {
        tweetPayload.media = {
          media_ids: mediaIds.map(id => id.toString()),
        };
      }

      // Log full payload for debugging
      logger.info(
        {
          payload: JSON.stringify(tweetPayload, null, 2),
        },
        "X tweet payload (full)"
      );

      tweetRes = await this.http.post(
        `${X_API_V2}/tweets`,
        tweetPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      if (!tweetRes.data?.data?.id) {
        throw new Error(
          `X API returned no tweet ID. Response: ${JSON.stringify(tweetRes.data)}`
        );
      }

      const tweetId = tweetRes.data.data.id;
      const tweetText = tweetRes.data.data.text;

      logger.info(
        {
          tweetId,
          tweetText: tweetText?.substring(0, 100),
        },
        "X tweet created successfully"
      );

      return {
        platformPostId: tweetId,
        publishedAt: new Date(),
        payloadSnapshot: {
          endpoint: `${X_API_V2}/tweets`,
          method: "POST",
          request: {
            text: caption?.substring(0, 100),
            mediaCount: mediaIds.length,
          },
          response: {
            tweetId,
            text: tweetText?.substring(0, 100),
          },
        },
      };
    } catch (tweetError: any) {
      const xError = tweetError?.response?.data;
      const errorMsg =
        xError?.errors?.[0]?.message ||
        xError?.detail ||
        tweetError?.message ||
        "Unknown error creating X tweet";

      const errorContext = {
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        mediaCount: mediaIds.length,
        mediaIds,
        captionLength: caption?.length || 0,
        captionPreview: caption ? caption.substring(0, 100) : null,
        apiResponse: xError,
        apiStatus: tweetError?.response?.status,
        apiStatusText: tweetError?.response?.statusText,
        requestUrl: `${X_API_V2}/tweets`,
        requestMethod: "post",
      };

      logger.error(
        {
          ...errorContext,
          error: tweetError,
        },
        "Failed to create X tweet"
      );

      throw new Error(
        `Failed to create X tweet: ${errorMsg}. Full context: ${JSON.stringify(errorContext)}`
      );
    }
  }

  /**
   * Upload media to X Media API v2
   * Returns the media_id for use in tweet creation
   * 
   * X API v2 Media Upload flow:
   * 1. For images: Direct upload to /2/media/upload (multipart/form-data)
   * 2. For videos: Chunked upload using dedicated v2 endpoints:
   *    - INIT: POST /2/media/upload/initialize
   *    - APPEND: POST /2/media/upload/{media_id}/append (per chunk)
   *    - FINALIZE: POST /2/media/upload/finalize
   *    - STATUS: GET /2/media/upload?media_id=XXX (polling if needed)
   */
  private async uploadMediaToX(
    accessToken: string,
    mediaUrl: string,
    media: Media
  ): Promise<string> {
    const isVideo = media.mimeType?.startsWith("video/") ?? false;
    const isImage = media.mimeType?.startsWith("image/") ?? false;

    if (!isVideo && !isImage) {
      throw new Error(
        `Unsupported media type for X: ${media.mimeType}. Only images and videos are supported.`
      );
    }

    // Step 1: Download media from URL
    logger.info(
      {
        mediaId: media.id,
        mediaUrl: mediaUrl.substring(0, 100),
        mimeType: media.mimeType,
        isVideo,
        isImage,
      },
      "Downloading media for X upload"
    );

    const mediaResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const mediaBuffer = Buffer.from(mediaResponse.data);
    const mediaSize = mediaBuffer.length;

    logger.info(
      {
        mediaId: media.id,
        mediaSize,
        mimeType: media.mimeType,
      },
      "Media downloaded, uploading to X"
    );

    if (isImage) {
      // Images: Simple upload
      return this.uploadImage(accessToken, mediaBuffer, media);
    } else {
      // Videos: Chunked upload
      return this.uploadVideo(accessToken, mediaBuffer, media);
    }
  }

  /**
   * Upload image to X using v2 API (simple upload)
   */
  private async uploadImage(
    accessToken: string,
    mediaBuffer: Buffer,
    media: Media
  ): Promise<string> {
    const form = new FormData();
    
    // X API v2 requires media_category and media_type parameters
    form.append("media", mediaBuffer, {
      filename: media.originalFilename || "image.jpg",
      contentType: media.mimeType || "image/jpeg",
    });
    form.append("media_category", "tweet_image");
    form.append("media_type", media.mimeType || "image/jpeg");

    try {
      // X API v2 media upload endpoint
      const uploadRes = await this.http.post(
        X_MEDIA_UPLOAD,
        form,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...form.getHeaders(),
          },
          timeout: 60000,
        }
      );

      // X API v2 returns response in format: { data: { id: "...", media_key: "...", ... } }
      // The id field is the media_id to use in tweets
      const mediaId = uploadRes.data?.data?.id || uploadRes.data?.id || uploadRes.data?.media_id || uploadRes.data?.media_id_string;
      if (!mediaId) {
        throw new Error(
          `X image upload failed. Response: ${JSON.stringify(uploadRes.data)}`
        );
      }

      logger.info(
        {
          mediaId,
          mediaKey: uploadRes.data?.data?.media_key || uploadRes.data?.media_key,
          response: uploadRes.data,
        },
        "Image uploaded to X successfully"
      );

      // X API v2 returns media_id as string, use it directly
      return mediaId.toString();
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.errors?.[0]?.message ||
        error?.response?.data?.detail ||
        error?.response?.data?.title ||
        error?.message ||
        "Unknown error uploading image";
      
      logger.error(
        {
          error: error?.response?.data,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: X_MEDIA_UPLOAD,
          hasAccessToken: !!accessToken,
          accessTokenLength: accessToken?.length || 0,
          accessTokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : null,
          mediaSize: mediaBuffer.length,
          mediaType: media.mimeType,
          requestHeaders: {
            contentType: form.getHeaders()["content-type"],
            hasAuthorization: true,
          },
        },
        "X image upload error"
      );
      
      // Provide more helpful error messages for authentication/authorization errors
      if (error?.response?.status === 401) {
        throw new Error(
          `Failed to upload image to X: Unauthorized. The access token may be missing the 'media.write' scope or may be invalid. Please ensure the X account is connected with OAuth 2.0 and has the 'media.write' scope. Error: ${errorMsg}`
        );
      }
      
      if (error?.response?.status === 403) {
        throw new Error(
          `Failed to upload image to X: Forbidden. The access token does not have the required 'media.write' scope. Please reconnect the X account with OAuth 2.0 and ensure 'media.write' scope is requested during authorization. Error: ${errorMsg}`
        );
      }
      
      throw new Error(`Failed to upload image to X: ${errorMsg}`);
    }
  }

  /**
   * Upload video to X using v2 API (chunked upload)
   * 
   * X API v2 video upload flow:
   * 1. INIT: POST /2/media/upload/initialize (JSON)
   * 2. APPEND: POST /2/media/upload/{media_id}/append (multipart/form-data, per chunk)
   * 3. FINALIZE: POST /2/media/upload/finalize (JSON)
   * 4. STATUS: GET /2/media/upload?media_id=XXX (polling if needed)
   */
  private async uploadVideo(
    accessToken: string,
    mediaBuffer: Buffer,
    media: Media
  ): Promise<string> {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
    const totalChunks = Math.ceil(mediaBuffer.length / CHUNK_SIZE);

    logger.info(
      {
        mediaId: media.id,
        totalSize: mediaBuffer.length,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        mimeType: media.mimeType,
      },
      "Starting X API v2 chunked video upload"
    );

    // ========================================================================
    // STEP 1: INIT - Initialize upload session
    // ========================================================================
    const initPayload = {
      media_type: media.mimeType || "video/mp4",
      media_category: "tweet_video",
      total_bytes: mediaBuffer.length,
    };

    let initRes;
    try {
      logger.info(
        {
          mediaId: media.id,
          payload: initPayload,
        },
        "X video upload - initializing"
      );

      initRes = await this.http.post(
        X_MEDIA_INIT,
        initPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.errors?.[0]?.message ||
        error?.response?.data?.detail ||
        error?.response?.data?.title ||
        error?.message ||
        "Unknown error";

      logger.error(
        {
          error: error?.response?.data,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: X_MEDIA_INIT,
          payload: initPayload,
        },
        "X video upload INIT failed"
      );

      if (error?.response?.status === 401) {
        throw new Error(
          `Failed to initialize X video upload: Unauthorized. The access token may be missing the 'media.write' scope or may be invalid. Please ensure the X account is connected with OAuth 2.0 and has the 'media.write' scope. Error: ${errorMsg}`
        );
      }

      if (error?.response?.status === 403) {
        throw new Error(
          `Failed to initialize X video upload: Forbidden. The access token does not have the required 'media.write' scope. Please reconnect the X account with OAuth 2.0 and ensure 'media.write' scope is requested during authorization. Error: ${errorMsg}`
        );
      }

      throw new Error(`Failed to initialize X video upload: ${errorMsg}`);
    }

    // Extract media_id from response
    // X API v2 INIT response format: { data: { id: "...", media_key: "...", ... } }
    // The "id" field is the media_id to use
    const mediaId = initRes.data?.data?.id || initRes.data?.id || initRes.data?.media_id;
    if (!mediaId) {
      throw new Error(
        `X video upload INIT failed: No media_id (id) in response. Response: ${JSON.stringify(initRes.data)}`
      );
    }

    logger.info(
      {
        mediaId,
        mediaKey: initRes.data?.media_key || initRes.data?.data?.media_key,
        totalChunks,
        response: initRes.data,
      },
      "X video upload initialized successfully"
    );

    // ========================================================================
    // STEP 2: APPEND - Upload chunks
    // ========================================================================
    for (let segmentIndex = 0; segmentIndex < totalChunks; segmentIndex++) {
      const start = segmentIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, mediaBuffer.length);
      const chunk = mediaBuffer.slice(start, end);

      const form = new FormData();
      // X API v2 APPEND: segment_index and media fields (media_id is in the URL path)
      form.append("segment_index", segmentIndex.toString());
      form.append("media", chunk, {
        filename: `chunk_${segmentIndex}`,
        contentType: media.mimeType || "video/mp4",
      });

      try {
        await this.http.post(
          X_MEDIA_APPEND(mediaId.toString()),
          form,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              ...form.getHeaders(),
            },
            timeout: 120000, // 2 minutes per chunk
          }
        );

        logger.info(
          {
            mediaId,
            segmentIndex: segmentIndex + 1,
            totalChunks,
            chunkSize: chunk.length,
          },
          "X video chunk uploaded"
        );
      } catch (error: any) {
        const errorMsg =
          error?.response?.data?.errors?.[0]?.message ||
          error?.response?.data?.detail ||
          error?.message ||
          "Unknown error";

        logger.error(
          {
            error: error?.response?.data,
            status: error?.response?.status,
            mediaId,
            segmentIndex,
            chunkSize: chunk.length,
          },
          "X video chunk upload failed"
        );

        throw new Error(
          `Failed to upload X video chunk ${segmentIndex + 1}/${totalChunks}: ${errorMsg}`
        );
      }
    }

    logger.info(
      {
        mediaId,
        totalChunks,
      },
      "All X video chunks uploaded successfully"
    );

    // ========================================================================
    // STEP 3: FINALIZE - Finalize upload
    // ========================================================================
    let finalizeRes;
    try {
      logger.info(
        {
          mediaId,
        },
        "X video upload - finalizing"
      );

      // X API v2 FINALIZE: media_id is in the URL path, no body needed
      finalizeRes = await this.http.post(
        X_MEDIA_FINALIZE(mediaId.toString()),
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.errors?.[0]?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        "Unknown error";

      logger.error(
        {
          error: error?.response?.data,
          status: error?.response?.status,
          mediaId,
        },
        "X video upload FINALIZE failed"
      );

      throw new Error(`Failed to finalize X video upload: ${errorMsg}`);
    }

    logger.info(
      {
        mediaId,
        processingInfo: finalizeRes.data?.data?.processing_info || finalizeRes.data?.processing_info,
        response: finalizeRes.data,
      },
      "X video upload finalized"
    );

    // ========================================================================
    // STEP 4: STATUS CHECK - Poll for processing completion (if needed)
    // ========================================================================
    // X API v2 FINALIZE response format: { data: { processing_info: {...}, ... } }
    const processingInfo = finalizeRes.data?.data?.processing_info || finalizeRes.data?.processing_info;
    if (processingInfo) {
      const state = processingInfo.state;

      if (state === "pending" || state === "in_progress") {
        const checkInterval = (processingInfo.check_after_secs || 5) * 1000;
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes max
        const startTime = Date.now();

        logger.info(
          {
            mediaId,
            state,
            checkInterval,
            maxWaitTime,
          },
          "X video processing started, polling for completion"
        );

        while (Date.now() - startTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));

          try {
            const statusRes = await this.http.get(
              X_MEDIA_STATUS,
              {
                params: {
                  media_id: mediaId.toString(),
                },
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
                timeout: 10000,
              }
            );

            // X API v2 STATUS response format: { data: { processing_info: {...}, ... } }
            const processingInfo = statusRes.data?.data?.processing_info || statusRes.data?.processing_info;
            const status = processingInfo?.state;
            const progress = processingInfo?.progress_percent;

            if (status === "succeeded") {
              logger.info(
                {
                  mediaId,
                  status,
                  progress,
                },
                "X video processing completed successfully"
              );
              break;
            }

            if (status === "failed") {
              const errorMessage =
                processingInfo?.error?.message || "Unknown error";
              throw new Error(
                `X video processing failed: ${errorMessage}`
              );
            }

            logger.info(
              {
                mediaId,
                status,
                progress,
                elapsed: Date.now() - startTime,
              },
              "X video still processing, waiting..."
            );
          } catch (statusError: any) {
            // If status check fails, log but don't fail the upload
            // The video might still be processing
            logger.warn(
              {
                mediaId,
                error: statusError?.response?.data || statusError?.message,
              },
              "X video status check failed, continuing anyway"
            );
          }
        }

        // Final status check after max wait time
        try {
          const finalStatusRes = await this.http.get(
            X_MEDIA_STATUS,
            {
              params: {
                media_id: mediaId.toString(),
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              timeout: 10000,
            }
          );

          // X API v2 STATUS response format: { data: { processing_info: {...}, ... } }
          const finalProcessingInfo = finalStatusRes.data?.data?.processing_info || finalStatusRes.data?.processing_info;
          const finalStatus = finalProcessingInfo?.state;
          if (finalStatus !== "succeeded") {
            logger.warn(
              {
                mediaId,
                finalStatus,
                note: "Video may still be processing, but proceeding with upload",
              },
              "X video processing status check after max wait time"
            );
          }
        } catch (finalStatusError: any) {
          logger.warn(
            {
              mediaId,
              error: finalStatusError?.response?.data || finalStatusError?.message,
            },
            "Final X video status check failed, proceeding anyway"
          );
        }
      } else if (state === "succeeded") {
        logger.info(
          {
            mediaId,
          },
          "X video processing already completed"
        );
      } else if (state === "failed") {
        const errorMessage = processingInfo?.error?.message || "Unknown error";
        throw new Error(`X video processing failed: ${errorMessage}`);
      }
    }

    return mediaId.toString();
  }

  /**
   * Build X caption from content and account options
   */
  private buildXCaption(
    content: Content,
    accountOptions?: ContentAccountOptions | null
  ): string | undefined {
    let caption: string | undefined;

    // 1) Account-specific override
    if (accountOptions?.captionOverride) {
      caption = accountOptions.captionOverride;
    }
    // 2) Base caption from content
    else if (content.baseCaption) {
      caption = content.baseCaption;
    }

    return caption;
  }

  /**
   * Clamp X caption to platform limit
   */
  private clampXCaption(caption: string | undefined): string | undefined {
    if (!caption) {
      return undefined;
    }

    const limit = getCaptionLimitFor("X", "FEED_POST");
    if (caption.length <= limit) {
      return caption;
    }

    logger.warn(
      {
        originalLength: caption.length,
        limit,
        truncatedLength: limit,
      },
      "X caption exceeds limit, truncating"
    );

    return caption.substring(0, limit);
  }
}
