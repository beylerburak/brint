/**
 * TikTok Publication Provider
 *
 * Publishes content to TikTok using TikTok API v2.
 * Supports VERTICAL_VIDEO form factor (video posts only).
 */

import axios, { AxiosInstance } from "axios";
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

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
// Try direct post first (for production), fallback to inbox if needed
const TIKTOK_VIDEO_INIT_DIRECT = `${TIKTOK_API_BASE}/post/publish/video/init/`;
const TIKTOK_VIDEO_INIT_INBOX = `${TIKTOK_API_BASE}/post/publish/inbox/video/init/`;
const TIKTOK_VIDEO_STATUS = `${TIKTOK_API_BASE}/post/publish/status/fetch/`;

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

export class TikTokPublicationProvider {
  private http: AxiosInstance;

  constructor(httpClient?: AxiosInstance) {
    this.http = httpClient ?? axios.create({
      timeout: 300000, // 5 minutes for video uploads
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
            "TikTok API Error Response"
          );
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Publish content to TikTok based on form factor
   */
  async publish(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content } = pub;

    // TikTok only supports VERTICAL_VIDEO (video posts)
    if (content.formFactor !== "VERTICAL_VIDEO") {
      throw new Error(
        `TikTok publication currently supports only VERTICAL_VIDEO form factor. Got: ${content.formFactor}`
      );
    }

    return this.publishVideo(pub);
  }

  /**
   * Publish video to TikTok
   * TikTok API v2 flow: INIT -> UPLOAD (chunked) -> STATUS (polling)
   */
  private async publishVideo(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;
    let accessToken = socialAccount.accessToken;

    // Validate required fields
    if (!accessToken) {
      throw new Error(
        `TikTok access token is missing for social account ${socialAccount.id}`
      );
    }

    // Clean token - remove "Bearer " prefix if present
    accessToken = accessToken.replace(/^Bearer\s+/i, "").trim();

    // Validate token format (TikTok tokens typically start with specific prefixes)
    if (!accessToken || accessToken.length < 10) {
      throw new Error(
        `TikTok access token appears to be invalid (too short or empty) for social account ${socialAccount.id}`
      );
    }

    // Check if token is expired
    if (socialAccount.tokenExpiresAt && new Date() > socialAccount.tokenExpiresAt) {
      throw new Error(
        `TikTok access token has expired for social account ${socialAccount.id}. Please reconnect the TikTok account. Token expired at: ${socialAccount.tokenExpiresAt.toISOString()}`
      );
    }

    logger.info(
      {
        contentId: content.id,
        formFactor: content.formFactor,
        socialAccountId: socialAccount.id,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        accessTokenPrefix: accessToken?.substring(0, 10) || "N/A", // First 10 chars for debugging
        platformAccountId: socialAccount.platformAccountId,
        scopes: socialAccount.scopes || [],
        tokenExpiresAt: socialAccount.tokenExpiresAt,
      },
      "Publishing to TikTok"
    );

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // Check if media is required for this platform/form factor
    const mediaRequired = requiresMedia("TIKTOK", content.formFactor as any);
    if (mediaRequired && !sortedMedia.length) {
      throw new Error(
        `TikTok ${content.formFactor} publish requires at least one media according to platform rules`
      );
    }

    // TikTok requires exactly one video
    if (sortedMedia.length === 0) {
      throw new Error("TikTok video publish requires at least one video media");
    }

    if (sortedMedia.length > 1) {
      logger.warn(
        {
          contentId: content.id,
          mediaCount: sortedMedia.length,
        },
        "TikTok supports only one video per post, using first media"
      );
    }

    const contentMedia = sortedMedia[0];
    const media = contentMedia.media;

    if (!media) {
      throw new Error(`Media not found for contentMedia ${contentMedia.id}`);
    }

    // Validate media is video
    const isVideo = media.mimeType?.startsWith("video/") ?? false;
    if (!isVideo) {
      throw new Error(
        `TikTok only supports video media. Got: ${media.mimeType}`
      );
    }

    const accountOptions = content.accountOptions.find(
      (opt) => opt.socialAccountId === socialAccount.id
    );
    const captionRaw = this.buildTikTokCaption(content, accountOptions);
    const caption = this.clampTikTokCaption(captionRaw);

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

    // Download video to get size
    logger.info(
      {
        mediaId: media.id,
        mediaUrl: mediaUrl.substring(0, 100),
        mimeType: media.mimeType,
      },
      "Downloading video for TikTok upload"
    );

    const mediaResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const videoBuffer = Buffer.from(mediaResponse.data);
    const videoSize = videoBuffer.length;

    logger.info(
      {
        mediaId: media.id,
        videoSize,
        mimeType: media.mimeType,
      },
      "Video downloaded, initializing TikTok upload"
    );

    // ========================================================================
    // STEP 1: INIT - Initialize video upload
    // ========================================================================
    // Şimdilik her zaman tek chunk ile çalışıyoruz
    // Bu, TikTok'un chunk size validasyon sorunlarını önler
    const CHUNK_SIZE = videoSize;
    const totalChunks = 1;

    const initPayload = {
      post_info: {
        title: caption || "Untitled",
        // In sandbox mode, TikTok only allows SELF_ONLY privacy level
        // For production/public videos, the app needs to pass TikTok's audit
        privacy_level: "SELF_ONLY", // SELF_ONLY, MUTUAL_FOLLOW_FRIENDS, PUBLIC_TO_EVERYONE
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000, // Cover frame at 1 second
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: CHUNK_SIZE,
        total_chunk_count: totalChunks,
      },
    };

    let initRes;
    // Track which endpoint we're using (for logging and response)
    let useInboxEndpoint = false;
    
    try {
      logger.info(
        {
          mediaId: media.id,
          videoSize,
          videoSizeMB: (videoSize / (1024 * 1024)).toFixed(2),
          totalChunks,
          chunkSize: CHUNK_SIZE,
          payload: initPayload,
        },
        "TikTok video upload - initializing"
      );

      // Try direct post first (for production/public videos)
      // If it fails with 403, fallback to inbox upload (for sandbox mode)
      let initEndpoint = TIKTOK_VIDEO_INIT_DIRECT;
      
      try {
        initRes = await this.http.post(
          initEndpoint,
          initPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=UTF-8",
            },
            timeout: 30000,
          }
        );
        logger.info(
          {
            mediaId: media.id,
            endpoint: "direct",
          },
          "TikTok direct post succeeded"
        );
      } catch (directPostError: any) {
        // If direct post fails with 403 (Forbidden), try inbox endpoint
        if (directPostError?.response?.status === 403) {
          logger.info(
            {
              mediaId: media.id,
              error: directPostError?.response?.data,
            },
            "Direct post failed (likely sandbox mode), trying inbox upload"
          );
          
          useInboxEndpoint = true;
          initEndpoint = TIKTOK_VIDEO_INIT_INBOX;
          
          // Retry with inbox endpoint
          initRes = await this.http.post(
            initEndpoint,
            initPayload,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
              },
              timeout: 30000,
            }
          );
          logger.info(
            {
              mediaId: media.id,
              endpoint: "inbox",
            },
            "TikTok inbox upload succeeded"
          );
        } else {
          // Re-throw if it's not a 403 error
          throw directPostError;
        }
      }
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.error?.description ||
        error?.response?.data?.message ||
        error?.message ||
        "Unknown error";

      logger.error(
        {
          error: error?.response?.data,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: useInboxEndpoint ? TIKTOK_VIDEO_INIT_INBOX : TIKTOK_VIDEO_INIT_DIRECT,
          payload: initPayload,
          hasAccessToken: !!accessToken,
          accessTokenLength: accessToken?.length || 0,
          accessTokenPrefix: accessToken?.substring(0, 10) || "N/A",
          requestHeaders: {
            Authorization: accessToken ? `Bearer ${accessToken.substring(0, 20)}...` : "missing",
            "Content-Type": "application/json; charset=UTF-8",
          },
        },
        "TikTok video upload INIT failed"
      );

      if (error?.response?.status === 401) {
        throw new Error(
          `Failed to initialize TikTok video upload: Unauthorized. The access token may be invalid or expired. Please reconnect the TikTok account. Error: ${errorMsg}`
        );
      }

      if (error?.response?.status === 403) {
        // TikTok 403 Forbidden can occur due to:
        // 1. Sandbox mode: privacy_level must be SELF_ONLY
        // 2. Missing scopes: video.upload or video.publish
        // 3. Content sharing guidelines violation
        // 4. Rate limits exceeded
        let detailedMsg = errorMsg;
        if (errorMsg.includes("content-sharing-guidelines") || errorMsg.includes("integration guidelines")) {
          detailedMsg = `${errorMsg} Note: In sandbox mode, privacy_level must be 'SELF_ONLY'. For public videos, your app needs to pass TikTok's audit.`;
        } else {
          detailedMsg = `${errorMsg} The access token may be missing the 'video.upload' or 'video.publish' scope, or the app may be in sandbox mode (requiring SELF_ONLY privacy). Please reconnect the TikTok account or check TikTok Developer Portal.`;
        }
        throw new Error(
          `Failed to initialize TikTok video upload: Forbidden. ${detailedMsg}`
        );
      }

      throw new Error(`Failed to initialize TikTok video upload: ${errorMsg}`);
    }

    // Extract publish_id and upload_url from response
    // TikTok API v2 INIT response format: { data: { publish_id: "...", upload_url: "..." } }
    const responseData = initRes.data?.data || initRes.data;
    const publishId = responseData?.publish_id;
    const uploadUrl = responseData?.upload_url;

    if (!publishId) {
      throw new Error(
        `TikTok video upload INIT failed: No publish_id in response. Response: ${JSON.stringify(initRes.data)}`
      );
    }

    if (!uploadUrl) {
      throw new Error(
        `TikTok video upload INIT failed: No upload_url in response. Response: ${JSON.stringify(initRes.data)}`
      );
    }

    logger.info(
      {
        publishId,
        uploadUrl: uploadUrl.substring(0, 100),
        totalChunks,
        response: responseData,
      },
      "TikTok video upload initialized successfully"
    );

    // ========================================================================
    // STEP 2: UPLOAD - Upload video chunks
    // ========================================================================
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoSize);
      const chunk = videoBuffer.slice(start, end);
      const chunkSize = chunk.length;

      // TikTok requires Content-Range header for chunked uploads
      const contentRange = `bytes ${start}-${end - 1}/${videoSize}`;

      try {
        logger.info(
          {
            publishId,
            chunkIndex: chunkIndex + 1,
            totalChunks,
            chunkSize,
            contentRange,
            start,
            end: end - 1,
            totalSize: videoSize,
          },
          "Uploading TikTok video chunk"
        );

        await this.http.put(
          uploadUrl,
          chunk,
          {
            headers: {
              "Content-Range": contentRange,
              "Content-Type": media.mimeType || "video/mp4",
            },
            timeout: 300000, // 5 minutes per chunk
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }
        );

        logger.info(
          {
            publishId,
            chunkIndex: chunkIndex + 1,
            totalChunks,
            chunkSize,
          },
          "TikTok video chunk uploaded successfully"
        );
      } catch (error: any) {
        const errorMsg =
          error?.response?.data?.error?.message ||
          error?.response?.data?.error?.description ||
          error?.response?.data?.message ||
          error?.message ||
          "Unknown error";

        logger.error(
          {
            error: error?.response?.data,
            status: error?.response?.status,
            publishId,
            chunkIndex,
            chunkSize,
            contentRange,
          },
          "TikTok video chunk upload failed"
        );

        throw new Error(
          `Failed to upload TikTok video chunk ${chunkIndex + 1}/${totalChunks}: ${errorMsg}`
        );
      }
    }

    logger.info(
      {
        publishId,
        totalChunks,
      },
      "All TikTok video chunks uploaded successfully"
    );

    // ========================================================================
    // STEP 3: STATUS CHECK - Poll for processing completion
    // ========================================================================
    const statusPayload = {
      publish_id: publishId,
    };

    let statusRes;
    let maxAttempts = 60; // 60 attempts = 5 minutes max (5 second intervals)
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        logger.info(
          {
            publishId,
            attempt: attempt + 1,
            maxAttempts,
          },
          "Checking TikTok video publish status"
        );

        statusRes = await this.http.post(
          TIKTOK_VIDEO_STATUS,
          statusPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=UTF-8",
            },
            timeout: 30000,
          }
        );

        // TikTok API v2 STATUS response format: { data: { status: "...", publish_id: "...", ... } }
        const statusData = statusRes.data?.data || statusRes.data;
        const status = statusData?.status;

        logger.info(
          {
            publishId,
            status,
            attempt: attempt + 1,
            response: statusData,
          },
          "TikTok video publish status check"
        );

        // SEND_TO_USER_INBOX means video was successfully uploaded to user's inbox (drafts)
        // This is a success state for inbox uploads
        if (status === "PUBLISHED" || status === "SEND_TO_USER_INBOX") {
          const videoId = statusData?.video_id || statusData?.item_id || publishId;
          logger.info(
            {
              publishId,
              videoId,
              status,
            },
            `TikTok video ${status === "PUBLISHED" ? "published" : "sent to inbox"} successfully`
          );

          return {
            platformPostId: videoId,
            publishedAt: new Date(),
            payloadSnapshot: {
              endpoint: useInboxEndpoint ? TIKTOK_VIDEO_INIT_INBOX : TIKTOK_VIDEO_INIT_DIRECT,
              method: "POST",
              request: {
                videoSize,
                totalChunks,
                caption: caption?.substring(0, 100),
              },
              response: {
                publishId,
                videoId,
                status,
                uploadMethod: useInboxEndpoint ? "inbox" : "direct",
              },
            },
          };
        }

        if (status === "FAILED" || status === "PROCESSING_FAILED") {
          const errorMessage =
            statusData?.fail_reason || statusData?.error?.message || "Unknown error";
          throw new Error(
            `TikTok video publish failed: ${errorMessage}`
          );
        }

        // Status is PROCESSING or other intermediate state, wait and retry
        if (status === "PROCESSING" || status === "PUBLISHING") {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
          attempt++;
          continue;
        }

        // SEND_TO_USER_INBOX is a success state, but if we reach here it means we already handled it above
        // For any other unknown status, log and continue polling
        logger.warn(
          {
            publishId,
            status,
            attempt: attempt + 1,
          },
          "TikTok video publish status unknown, continuing to poll"
        );

        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempt++;
      } catch (error: any) {
        // If it's a status check error (not a publish failure), log and retry
        if (error?.response?.status !== 200 && attempt < maxAttempts - 1) {
          logger.warn(
            {
              publishId,
              error: error?.response?.data || error?.message,
              attempt: attempt + 1,
            },
            "TikTok video status check failed, retrying"
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
          attempt++;
          continue;
        }

        // Final attempt failed or publish failed
        const errorMsg =
          error?.response?.data?.error?.message ||
          error?.response?.data?.error?.description ||
          error?.message ||
          "Unknown error";

        logger.error(
          {
            error: error?.response?.data,
            status: error?.response?.status,
            publishId,
            attempt: attempt + 1,
          },
          "TikTok video publish status check failed"
        );

        throw new Error(`Failed to check TikTok video publish status: ${errorMsg}`);
      }
    }

    // Max attempts reached
    throw new Error(
      `TikTok video publish status check timeout after ${maxAttempts} attempts. Publish ID: ${publishId}`
    );
  }

  /**
   * Build TikTok caption from content and account options
   */
  private buildTikTokCaption(
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
   * Clamp TikTok caption to platform limit
   */
  private clampTikTokCaption(caption: string | undefined): string | undefined {
    if (!caption) {
      return undefined;
    }

    const limit = getCaptionLimitFor("TIKTOK", "VERTICAL_VIDEO");
    if (caption.length <= limit) {
      return caption;
    }

    logger.warn(
      {
        originalLength: caption.length,
        limit,
        truncatedLength: limit,
      },
      "TikTok caption exceeds limit, truncating"
    );

    return caption.substring(0, limit);
  }
}
