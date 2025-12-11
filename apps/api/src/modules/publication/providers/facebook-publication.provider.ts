/**
 * Facebook Publication Provider
 *
 * Publishes content to Facebook using Graph API v24.0.
 * Supports Feed posts (single/carousel), Stories, and Reels.
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
import { requiresMedia } from "@brint/shared-config/platform-rules";

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION ?? "v24.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const GRAPH_VIDEO_BASE = `https://graph-video.facebook.com/${GRAPH_API_VERSION}`;

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

export class FacebookPublicationProvider {
  private http: AxiosInstance;

  constructor(httpClient?: AxiosInstance) {
    this.http = httpClient ?? axios.create({
      timeout: 30000, // 30 seconds
    });

    // Add response interceptor for better error logging
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        // Log full error response for debugging
        if (error.response) {
          logger.error({
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: error.config?.url,
            method: error.config?.method,
          }, 'Facebook API Error Response');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate media uploads before publishing
   * Uploads photos to Facebook and validates they're accessible
   * This is called before actual publish to catch media issues early
   */
  static async validateMediaUploads(pub: PublicationWithRelations): Promise<{ photoIds: string[] }> {
    const provider = new FacebookPublicationProvider();
    return provider.validateMediaUploadsInstance(pub);
  }

  /**
   * Instance method for validateMediaUploads
   */
  private async validateMediaUploadsInstance(pub: PublicationWithRelations): Promise<{ photoIds: string[] }> {
    const { content, socialAccount } = pub;
    const pageId = socialAccount.platformAccountId;
    const accessToken = socialAccount.accessToken;

    if (!pageId || !accessToken) {
      throw new Error(`Missing page ID or access token for social account ${socialAccount.id}`);
    }

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // If no media, return empty array (text-only post is valid)
    if (!sortedMedia.length) {
      return { photoIds: [] };
    }

    const photoIds: string[] = [];

    // Upload and validate each photo
    for (const cm of sortedMedia) {
      const media = cm.media;
      
      if (!media) {
        throw new Error(`Media not found for contentMedia ${cm.id}`);
      }

      // Get publishable URL
      let mediaUrl: string;
      try {
        mediaUrl = await getPublishableUrlForMedia(media);
      } catch (urlError: any) {
        throw new Error(`Failed to generate publishable URL for media ${media.id}: ${urlError.message}`);
      }

      if (!mediaUrl || !mediaUrl.startsWith('http')) {
        throw new Error(`Invalid media URL for media ${media.id}: ${mediaUrl}`);
      }

      // Upload photo to Facebook
      try {
        const photoRes = await this.http.post(
          `${GRAPH_BASE}/${pageId}/photos`,
          null,
          {
            params: {
              published: false,
              url: mediaUrl,
              access_token: accessToken,
            },
            timeout: 60000,
          }
        );

        if (!photoRes.data?.id) {
          throw new Error(`Facebook API returned no photo ID. Response: ${JSON.stringify(photoRes.data)}`);
        }

        const photoId = photoRes.data.id as string;
        photoIds.push(photoId);

        // Validate photo is accessible by fetching it
        try {
          const photoCheck = await this.http.get(
            `${GRAPH_BASE}/${photoId}`,
            {
              params: {
                fields: "id",
                access_token: accessToken,
              },
              timeout: 10000,
            }
          );

          if (!photoCheck.data?.id) {
            throw new Error(`Photo ${photoId} is not accessible after upload`);
          }
        } catch (checkError: any) {
          throw new Error(
            `Photo ${photoId} uploaded but not accessible: ${checkError.message}. ` +
            `This may indicate a permission or token issue.`
          );
        }
      } catch (photoError: any) {
        const fbError = photoError?.response?.data?.error;
        const errorMsg = fbError?.message || photoError?.message || "Unknown error uploading photo";
        const errorCode = fbError?.code || photoError?.code || 'unknown';
        
        throw new Error(
          `Failed to upload/validate photo for media ${media.id}: ${errorMsg}. ` +
          `Error code: ${errorCode}. ` +
          `Media URL: ${mediaUrl.substring(0, 100)}...`
        );
      }
    }

    return { photoIds };
  }

  /**
   * Publish content to Facebook based on form factor
   */
  async publish(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content } = pub;

    switch (content.formFactor as ContentFormFactor) {
      case "FEED_POST":
        return this.publishFeed(pub);
      case "STORY":
        return this.publishStory(pub);
      case "VERTICAL_VIDEO":
        return this.publishReel(pub);
      default:
        throw new Error(`Facebook: unsupported formFactor ${content.formFactor}`);
    }
  }

  /**
   * Publish feed post (supports single image/video or image carousel)
   */
  private async publishFeed(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;
    const pageId = socialAccount.platformAccountId;
    const accessToken = socialAccount.accessToken;

    // Validate required fields
    if (!pageId) {
      throw new Error(`Facebook page ID is missing for social account ${socialAccount.id}`);
    }
    if (!accessToken) {
      throw new Error(`Facebook access token is missing for social account ${socialAccount.id}`);
    }

    // Validate page access token by checking page info
    // Note: We can't check permissions with page token, only with user token
    // So we just verify the token can access the page
    // If validation fails, we'll still attempt publication (token might work for publishing)
    try {
      const pageInfo = await this.http.get(
        `${GRAPH_BASE}/${pageId}`,
        {
          params: {
            fields: 'id,name',
            access_token: accessToken,
          },
          timeout: 10000,
        }
      );

      if (!pageInfo.data?.id) {
        // Page info check failed, but continue anyway - token might still work for publishing
        logger.warn({ pageId }, "Could not fetch page info, but will attempt publication anyway");
      }

      // Page token is valid if we can fetch page info
      // Permissions are checked during OAuth flow, not here
    } catch (pageCheckError: any) {
      const fbError = pageCheckError?.response?.data?.error;
      if (fbError) {
        // Page validation failed, but don't throw - token might still work for publishing
        // Log warning and continue
        logger.warn(
          { pageId, error: fbError.message, code: fbError.code },
          "Page validation failed, will attempt publication anyway"
        );
      } else {
        // Network error or other issue - log but continue
        logger.warn(
          { pageId, error: pageCheckError.message },
          "Page validation error, will attempt publication anyway"
        );
      }
      // Don't throw - let the actual publish attempt determine if token works
    }

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // Check if media is required for this platform/form factor
    const mediaRequired = requiresMedia("FACEBOOK", content.formFactor as any);
    if (mediaRequired && !sortedMedia.length) {
      throw new Error(
        `Facebook ${content.formFactor} publish requires at least one media according to platform rules`
      );
    }

    const accountOptions = content.accountOptions.find(
      (opt) => opt.socialAccountId === socialAccount.id
    );
    const captionRaw = buildFacebookCaption(content, accountOptions);
    const caption = clampFacebookCaption(captionRaw);

    // Upload unpublished photos for carousel/single post (if media exists)
    const attachedMedia: { media_fbid: string }[] = [];

    for (const cm of sortedMedia) {
      const media = cm.media;
      
      // Validate media exists
      if (!media) {
        throw new Error(`Media not found for contentMedia ${cm.id}`);
      }

      // Get publishable URL for media
      let mediaUrl: string;
      try {
        mediaUrl = await getPublishableUrlForMedia(media);
      } catch (urlError: any) {
        throw new Error(`Failed to generate publishable URL for media ${media.id}: ${urlError.message}`);
      }

      // Validate URL is accessible
      if (!mediaUrl || !mediaUrl.startsWith('http')) {
        throw new Error(`Invalid media URL for media ${media.id}: ${mediaUrl}`);
      }

      try {
        const photoRes = await this.http.post(
          `${GRAPH_BASE}/${pageId}/photos`,
          null,
          {
            params: {
              published: false,
              url: mediaUrl,
              access_token: accessToken,
            },
            timeout: 60000, // 60 seconds for photo upload
          }
        );

        if (!photoRes.data?.id) {
          throw new Error(`Facebook API returned no photo ID. Response: ${JSON.stringify(photoRes.data)}`);
        }

        const photoId = photoRes.data.id as string;
        attachedMedia.push({ media_fbid: photoId });
      } catch (photoError: any) {
        const fbError = photoError?.response?.data?.error;
        const errorMsg = fbError?.message || photoError?.message || "Unknown error uploading photo";
        const errorCode = fbError?.code || photoError?.code || 'unknown';
        
        // Check if it's a URL access issue
        if (errorCode === 1 || errorCode === 100) {
          throw new Error(
            `Failed to upload photo to Facebook (media ${media.id}): ${errorMsg}. ` +
            `Error code: ${errorCode}. ` +
            `This usually means Facebook cannot access the media URL. ` +
            `Please verify: 1) URL is publicly accessible, 2) URL is not expired, 3) URL format is correct. ` +
            `Media URL: ${mediaUrl.substring(0, 100)}...`
          );
        }
        
        throw new Error(
          `Failed to upload photo to Facebook (media ${media.id}): ${errorMsg}. ` +
          `Error code: ${errorCode}. ` +
          `Response: ${JSON.stringify(photoError?.response?.data)}`
        );
      }
    }

    let feedRes;

    try {
      if (attachedMedia.length === 0) {
        // Text-only post (no media)
        feedRes = await this.http.post(
          `${GRAPH_BASE}/${pageId}/feed`,
          null,
          {
            params: {
              message: caption,
              access_token: accessToken,
            },
            timeout: 30000,
          }
        );
      } else if (attachedMedia.length === 1) {
        // Single image post - Try multiple methods for reliability
        // Method 1: Feed endpoint with attached_media (most reliable for unpublished photos)
        try {
          feedRes = await this.http.post(
            `${GRAPH_BASE}/${pageId}/feed`,
            null,
            {
              params: {
                message: caption,
                attached_media: JSON.stringify([attachedMedia[0]]),
                access_token: accessToken,
              },
              timeout: 30000,
            }
          );
        } catch (attachedMediaError: any) {
          // Method 2: Feed endpoint with object_attachment
          const fbError1 = attachedMediaError?.response?.data?.error;
          logger.warn(
            { pageId, error: fbError1?.message || attachedMediaError?.message, method: 'attached_media' },
            "Feed with attached_media failed, trying object_attachment"
          );

          try {
            feedRes = await this.http.post(
              `${GRAPH_BASE}/${pageId}/feed`,
              null,
              {
                params: {
                  message: caption,
                  object_attachment: attachedMedia[0].media_fbid,
                  access_token: accessToken,
                },
                timeout: 30000,
              }
            );
          } catch (objectAttachmentError: any) {
            // Method 3: Re-upload photo with published: true (last resort)
            const fbError2 = objectAttachmentError?.response?.data?.error;
            logger.warn(
              { pageId, error: fbError2?.message || objectAttachmentError?.message, method: 'object_attachment' },
              "Feed with object_attachment failed, trying direct photo publish"
            );

            const firstMedia = sortedMedia[0].media;
            const mediaUrl = await getPublishableUrlForMedia(firstMedia);

            feedRes = await this.http.post(
              `${GRAPH_BASE}/${pageId}/photos`,
              null,
              {
                params: {
                  url: mediaUrl,
                  published: true,
                  message: caption,
                  access_token: accessToken,
                },
                timeout: 60000,
              }
            );
          }
        }
      } else {
        // Image carousel - Use feed endpoint with attached_media array format
        const params: any = {
          message: caption,
          access_token: accessToken,
        };

        // Facebook expects attached_media as array of JSON strings
        attachedMedia.forEach((m, index) => {
          params[`attached_media[${index}]`] = JSON.stringify(m);
        });

        feedRes = await this.http.post(
          `${GRAPH_BASE}/${pageId}/feed`,
          null,
          { 
            params,
            timeout: 60000,
          }
        );
      }

      if (!feedRes.data?.id) {
        throw new Error(`Facebook API returned no post ID. Response: ${JSON.stringify(feedRes.data)}`);
      }
    } catch (feedError: any) {
      // Parse Facebook API error response - can be in different formats
      let fbError = feedError?.response?.data?.error;
      
      // Sometimes error is directly in response.data
      if (!fbError && feedError?.response?.data) {
        // Check if error is at root level
        if (feedError.response.data.error) {
          fbError = feedError.response.data.error;
        } else if (feedError.response.data.error_code || feedError.response.data.error_message) {
          // Alternative error format
          fbError = {
            code: feedError.response.data.error_code,
            message: feedError.response.data.error_message,
            type: feedError.response.data.error_type,
            error_subcode: feedError.response.data.error_subcode,
          };
        } else if (typeof feedError.response.data === 'object') {
          // Error might be the entire response
          fbError = feedError.response.data;
        }
      }

      const errorMsg = fbError?.message || feedError?.message || feedError?.response?.data?.message || "Unknown error creating feed post";
      const errorCode = fbError?.code ?? feedError?.code ?? feedError?.error_code ?? feedError?.response?.data?.error_code ?? 'unknown';
      const errorType = fbError?.type || fbError?.error_type || 'unknown';
      const errorSubcode = fbError?.error_subcode ?? fbError?.error_subcode ?? null;
      
      // Build detailed error context
      const errorContext = {
        pageId,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        mediaCount: attachedMedia.length,
        photoIds: attachedMedia.map(m => m.media_fbid),
        captionLength: caption?.length || 0,
        captionPreview: caption ? caption.substring(0, 100) : null,
        apiResponse: feedError?.response?.data,
        apiStatus: feedError?.response?.status,
        apiStatusText: feedError?.response?.statusText,
        requestUrl: feedError?.config?.url || feedError?.request?.url,
        requestMethod: feedError?.config?.method || feedError?.request?.method,
        rawError: {
          message: feedError?.message || errorMsg,
          code: errorCode,
          type: errorType,
          subcode: errorSubcode,
          fullResponse: feedError?.response?.data,
        },
      };

      // Build diagnostic message for Error Code 1
      let diagnosticMsg = '';
      if (errorCode === '1' || errorCode === 1) {
        diagnosticMsg = 
          `\n\nDIAGNOSTIC INFO for Error Code 1:\n` +
          `Error Code 1 usually means one of the following:\n` +
          `1. Access token is invalid or expired\n` +
          `2. Missing required permissions (pages_read_engagement, pages_manage_posts)\n` +
          `3. Photo IDs are invalid (photos may have been deleted or expired)\n` +
          `4. Page ID is incorrect or access token doesn't have access to this page\n` +
          `5. Media URLs were not accessible when photos were uploaded\n\n` +
          `Troubleshooting steps:\n` +
          `- Verify access token is valid: GET /v24.0/me?access_token=TOKEN\n` +
          `- Check permissions: GET /v24.0/me/permissions?access_token=TOKEN\n` +
          `- Verify page access: GET /v24.0/${pageId}?access_token=TOKEN\n` +
          `- Check photo IDs: GET /v24.0/{photo_id}?access_token=TOKEN\n`;
      }

      // Create detailed error message
      const detailedErrorMsg = 
        `Failed to create Facebook feed post: ${errorMsg}. ` +
        `Error code: ${errorCode}, Type: ${errorType}${errorSubcode ? `, Subcode: ${errorSubcode}` : ''}. ` +
        `Page ID: ${pageId}. ` +
        `Photo IDs: ${attachedMedia.map(m => m.media_fbid).join(', ')}. ` +
        diagnosticMsg +
        `Full context: ${JSON.stringify(errorContext, null, 2)}`;

      const detailedError = new Error(detailedErrorMsg);
      
      // Attach context and error details to error object for worker to use
      (detailedError as any).context = errorContext;
      (detailedError as any).fbError = fbError || {
        code: errorCode,
        message: errorMsg,
        type: errorType,
        error_subcode: errorSubcode,
      };
      (detailedError as any).response = feedError?.response;
      
      throw detailedError;
    }

    const postId = feedRes.data.id as string;

    return {
      platformPostId: postId,
      publishedAt: new Date(),
      payloadSnapshot: {
        type: "FACEBOOK_FEED",
        caption,
        attachedMedia,
        mediaCount: attachedMedia.length,
      },
    };
  }

  /**
   * Publish photo or video story
   */
  private async publishStory(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;
    const pageId = socialAccount.platformAccountId;
    const accessToken = socialAccount.accessToken;

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    const first = sortedMedia[0];

    if (!first || !first.media) {
      throw new Error("Facebook story publish requires at least one media");
    }

    const media = first.media;
    const isVideo = media.mimeType?.startsWith('video/') ?? false;
    const mediaUrl = await getPublishableUrlForMedia(media);

    if (isVideo) {
      // Video story - use video_stories endpoint
      return this.publishVideoStory(pageId, accessToken, media, mediaUrl);
    } else {
      // Photo story - use photo_stories endpoint
      return this.publishPhotoStory(pageId, accessToken, mediaUrl);
    }
  }

  /**
   * Publish photo story
   */
  private async publishPhotoStory(
    pageId: string,
    accessToken: string,
    mediaUrl: string
  ): Promise<PublicationResult> {
    // Upload photo unpublished first
    const photoRes = await this.http.post(
      `${GRAPH_BASE}/${pageId}/photos`,
      null,
      {
        params: {
          published: false,
          url: mediaUrl,
          access_token: accessToken,
        },
        timeout: 60000,
      }
    );

    if (!photoRes.data?.id) {
      throw new Error(`Facebook API returned no photo ID. Response: ${JSON.stringify(photoRes.data)}`);
    }

    const photoId = photoRes.data.id as string;

    // Create photo story
    const storyRes = await this.http.post(
      `${GRAPH_BASE}/${pageId}/photo_stories`,
      null,
      {
        params: {
          photo_id: photoId,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    // Facebook can return either 'id' or 'post_id' in the response
    const storyId = storyRes.data?.id || storyRes.data?.post_id;

    if (!storyId) {
      throw new Error(
        `Facebook API returned no story ID. Response: ${JSON.stringify(storyRes.data)}. ` +
        `Photo ID used: ${photoId}.`
      );
    }

    return {
      platformPostId: storyId,
      publishedAt: new Date(),
      payloadSnapshot: {
        type: "FACEBOOK_STORY_PHOTO",
        photoId,
        mediaUrl,
      },
    };
  }

  /**
   * Publish video story
   * 
   * Facebook video story uses a special multipart upload flow via video_stories endpoint:
   * 1. Start phase: POST /{page_id}/video_stories with upload_phase=start
   * 2. Transfer phase: POST {upload_url} with file_url (or use video_stories with upload_phase=transfer)
   * 3. Finish phase: POST /{page_id}/video_stories with upload_phase=finish
   * 
   * Facebook video story requirements:
   * - Max duration: 20 seconds (recommended for stories)
   * - Format: MP4, MOV (H.264 codec recommended)
   * - Max file size: Varies, but typically up to 4GB
   * - Aspect ratio: 9:16 (vertical) recommended
   */
  private async publishVideoStory(
    pageId: string,
    accessToken: string,
    media: Media,
    mediaUrl: string
  ): Promise<PublicationResult> {
    // Log video info for debugging
    logger.info(
      { 
        pageId, 
        mediaId: media.id,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        sizeMB: (media.sizeBytes / 1024 / 1024).toFixed(2),
        durationMs: media.durationMs,
      },
      "Starting Facebook video story upload using multipart flow"
    );

    // Step 1: Start upload session for video story
    const startRes = await this.http.post(
      `${GRAPH_BASE}/${pageId}/video_stories`,
      null,
      {
        params: {
          upload_phase: "start",
          file_size: media.sizeBytes,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    if (!startRes.data?.video_id && !startRes.data?.upload_session_id) {
      throw new Error(
        `Failed to start video story upload session. Response: ${JSON.stringify(startRes.data)}. ` +
        `Video size: ${(media.sizeBytes / 1024 / 1024).toFixed(2)}MB.`
      );
    }

    const videoId = startRes.data.video_id;
    const uploadUrl = startRes.data.upload_url;

    logger.info(
      { pageId, videoId, hasUploadUrl: !!uploadUrl },
      "Started Facebook video story upload session"
    );

    // If no upload_url, video might be ready immediately
    if (!uploadUrl) {
      if (!videoId) {
        throw new Error(
          `No upload_url and no video_id returned from start phase. Response: ${JSON.stringify(startRes.data)}.`
        );
      }

      // Video might be ready, try to finish with video_id
      logger.info(
        { pageId, videoId },
        "No upload_url returned, attempting to finish with video_id"
      );

      const finishRes = await this.http.post(
        `${GRAPH_BASE}/${pageId}/video_stories`,
        null,
        {
          params: {
            upload_phase: "finish",
            video_id: videoId,
            access_token: accessToken,
          },
          timeout: 30000,
        }
      );

      // Facebook can return either 'id' or 'post_id' in the response
      const storyId = finishRes.data?.id || finishRes.data?.post_id;

      if (!storyId) {
        throw new Error(
          `Failed to finish video story. Video ID: ${videoId}. ` +
          `Response: ${JSON.stringify(finishRes.data)}.`
        );
      }

      const isProcessing = finishRes.data?.success === true && 
                           finishRes.data?.message?.toLowerCase().includes("processing");

      return {
        platformPostId: storyId,
        publishedAt: new Date(),
        payloadSnapshot: {
          type: "FACEBOOK_STORY_VIDEO",
          videoId,
          storyId,
          mediaUrl,
          uploadMethod: "direct",
          videoSizeBytes: media.sizeBytes,
          isProcessing: isProcessing || false,
          finishResponse: finishRes.data,
        },
      };
    }

    if (!videoId) {
      throw new Error(
        `No video_id returned from start phase. Response: ${JSON.stringify(startRes.data)}.`
      );
    }

    // Step 2: Transfer video using file_url
    // n8n workflow: POST to upload_url with file_url in headers and access_token in query
    try {
      await this.http.post(
        uploadUrl,
        null,
        {
          headers: {
            file_url: mediaUrl,
          },
          params: {
            access_token: accessToken,
          },
          timeout: 600000, // 10 minutes for large video transfer
        }
      );

      logger.info(
        { pageId, videoId, uploadUrl },
        "Video transfer completed"
      );
    } catch (transferError: any) {
      const fbError = transferError?.response?.data?.error;
      logger.warn(
        { pageId, videoId, error: fbError?.message || transferError?.message },
        "Video transfer phase failed, attempting finish anyway"
      );
      // Continue to finish phase - sometimes finish works even if transfer fails
    }

    // Step 3: Finish upload - n8n workflow: upload_phase=finish + video_id
    const finishRes = await this.http.post(
      `${GRAPH_BASE}/${pageId}/video_stories`,
      null,
      {
        params: {
          upload_phase: "finish",
          video_id: videoId, // Use video_id from start phase, not upload_session_id
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    // Facebook can return either 'id' or 'post_id' in the response
    // Also, video might be processing, in which case we get success: true with post_id
    const storyId = finishRes.data?.id || finishRes.data?.post_id;
    const isProcessing = finishRes.data?.success === true && 
                         finishRes.data?.message?.toLowerCase().includes("processing");

    if (!storyId) {
      throw new Error(
        `Failed to finish video story upload. Response: ${JSON.stringify(finishRes.data)}. ` +
        `Video ID: ${videoId}. ` +
        `Video size: ${(media.sizeBytes / 1024 / 1024).toFixed(2)}MB. ` +
        `This may indicate the video URL is not accessible or the video format is not supported.`
      );
    }

    // If video is processing, wait for it to be ready
    // Calculate wait time and check interval based on video size
    if (isProcessing) {
      const videoSizeMB = media.sizeBytes / (1024 * 1024);
      
      // Calculate check interval based on video size
      // 10MB video → 5 seconds, larger videos → longer intervals
      let checkIntervalMs: number;
      let maxWaitTimeMs: number;
      
      if (videoSizeMB <= 10) {
        // Small videos: check every 5 seconds, max 30 seconds
        checkIntervalMs = 5000;
        maxWaitTimeMs = 30000;
      } else if (videoSizeMB <= 50) {
        // Medium videos: check every 8 seconds, max 60 seconds
        checkIntervalMs = 8000;
        maxWaitTimeMs = 60000;
      } else if (videoSizeMB <= 100) {
        // Large videos: check every 10 seconds, max 90 seconds
        checkIntervalMs = 10000;
        maxWaitTimeMs = 90000;
      } else {
        // Very large videos: check every 15 seconds, max 120 seconds
        checkIntervalMs = 15000;
        maxWaitTimeMs = 120000;
      }
      
      const maxAttempts = Math.ceil(maxWaitTimeMs / checkIntervalMs);
      
      logger.info(
        { 
          pageId, 
          videoId, 
          storyId, 
          videoSizeMB: videoSizeMB.toFixed(2),
          checkIntervalMs,
          maxWaitTimeMs,
          maxAttempts,
          message: finishRes.data?.message 
        },
        "Video story is processing, waiting for video to be ready"
      );

      // Wait for video to be ready (check video status)
      // Note: Video status check is optional - if it fails, we proceed anyway since we have post_id
      let videoReady = false;
      let attempts = 0;
      let statusCheckFailed = false;
      
      while (!videoReady && !statusCheckFailed && attempts < maxAttempts) {
        try {
          // Check video status - this might fail for video stories, so we make it optional
          const videoStatusRes = await this.http.get(
            `${GRAPH_BASE}/${videoId}`,
            {
              params: {
                fields: "status,processing_phase,length",
                access_token: accessToken,
              },
              timeout: 10000,
            }
          );

          const status = videoStatusRes.data?.status;
          const processingPhase = videoStatusRes.data?.processing_phase;

          // Video is ready if status is "ready" or "published", or if processing_phase is "complete"
          // Also check if video has length (indicates it's been processed)
          if (status === "ready" || status === "published" || processingPhase === "complete" || videoStatusRes.data?.length) {
            videoReady = true;
            logger.info(
              { pageId, videoId, storyId, status, processingPhase, length: videoStatusRes.data?.length, attempts },
              "Video is ready, story should be published"
            );
            break;
          }

          // If video is still processing, wait a bit
          if (status === "processing" || processingPhase === "transcoding" || processingPhase === "uploading") {
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
              logger.info(
                { 
                  pageId, 
                  videoId, 
                  storyId, 
                  status, 
                  processingPhase, 
                  attempt: attempts, 
                  maxAttempts,
                  waitTimeMs: checkIntervalMs 
                },
                "Video still processing, waiting..."
              );
              continue;
            } else {
              logger.warn(
                { pageId, videoId, storyId, status, processingPhase, attempts, totalWaitTimeMs: attempts * checkIntervalMs },
                "Video processing timeout reached, but story post_id is available"
              );
              break;
            }
          }

          // Unknown status, assume ready
          break;
        } catch (statusError: any) {
          // If we get a 400 error, video status check is not available for video stories
          // This is expected - we'll skip status checking and proceed
          const statusCode = statusError?.response?.status || statusError?.status;
          if (statusCode === 400 || statusCode === 404) {
            logger.info(
              { 
                pageId, 
                videoId, 
                storyId, 
                statusCode,
                error: statusError?.response?.data?.error?.message || statusError?.message,
                attempt: attempts 
              },
              "Video status check not available for video stories (expected), proceeding with story post_id"
            );
            statusCheckFailed = true;
            break; // Skip status checking, proceed with story
          }
          
          // For other errors, log and continue (but don't wait too long)
          logger.warn(
            { 
              pageId, 
              videoId, 
              storyId, 
              error: statusError?.response?.data?.error?.message || statusError?.message,
              statusCode,
              attempt: attempts 
            },
            "Could not check video status, but story post_id is available"
          );
          
          // Only retry a few times for non-400 errors
          if (attempts >= 2) {
            logger.info(
              { pageId, videoId, storyId, attempts },
              "Skipping video status check after multiple failures, proceeding with story"
            );
            statusCheckFailed = true;
            break;
          }
          
          attempts++;
          await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
        }
      }
      
      if (statusCheckFailed) {
        logger.info(
          { pageId, videoId, storyId },
          "Skipped video status check, story should be published (post_id available)"
        );
      }
    }
    
    logger.info(
      { pageId, videoId, storyId, isProcessing, fileSize: media.sizeBytes },
      "Video story created successfully"
    );

    return {
      platformPostId: storyId,
      publishedAt: new Date(),
      payloadSnapshot: {
        type: "FACEBOOK_STORY_VIDEO",
        videoId,
        storyId,
        mediaUrl,
        uploadMethod: "multipart",
        videoSizeBytes: media.sizeBytes,
        isProcessing: isProcessing || false,
        finishResponse: finishRes.data,
      },
    };
  }

  /**
   * Upload large video using Facebook multipart upload
   * Flow: start_session -> (file_url transfer) -> finish_upload
   * 
   * Note: Facebook's multipart upload can work with file_url if the URL is accessible.
   * We start a session, then use file_url to transfer, then finish.
   */
  private async uploadVideoMultipart(
    pageId: string,
    accessToken: string,
    media: Media,
    mediaUrl: string
  ): Promise<string> {
    // Step 1: Start upload session
    const startRes = await this.http.post(
      `${GRAPH_VIDEO_BASE}/${pageId}/videos`,
      null,
      {
        params: {
          upload_phase: "start",
          file_size: media.sizeBytes,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    if (!startRes.data?.upload_session_id) {
      throw new Error(
        `Failed to start video upload session. Response: ${JSON.stringify(startRes.data)}. ` +
        `Video size: ${(media.sizeBytes / 1024 / 1024).toFixed(2)}MB.`
      );
    }

    const uploadSessionId = startRes.data.upload_session_id as string;
    const videoId = startRes.data.video_id; // May be returned if video already exists

    logger.info(
      { pageId, uploadSessionId, videoId, fileSize: media.sizeBytes },
      "Started Facebook video multipart upload session"
    );

    // If video_id is returned, we can use it directly
    if (videoId) {
      return videoId as string;
    }

    // Step 2: Transfer video using file_url
    // Facebook can download the video from the URL we provide
    try {
      const transferRes = await this.http.post(
        `${GRAPH_VIDEO_BASE}/${pageId}/videos`,
        null,
        {
          params: {
            upload_phase: "transfer",
            upload_session_id: uploadSessionId,
            file_url: mediaUrl,
            access_token: accessToken,
          },
          timeout: 600000, // 10 minutes for large video transfer
        }
      );

      // Transfer might return video_id immediately
      if (transferRes.data?.video_id) {
        return transferRes.data.video_id as string;
      }
    } catch (transferError: any) {
      const fbError = transferError?.response?.data?.error;
      logger.warn(
        { pageId, uploadSessionId, error: fbError?.message || transferError?.message },
        "Video transfer phase failed, attempting finish anyway"
      );
      // Continue to finish phase - sometimes finish works even if transfer fails
    }

    // Step 3: Finish upload
    const finishRes = await this.http.post(
      `${GRAPH_VIDEO_BASE}/${pageId}/videos`,
      null,
      {
        params: {
          upload_phase: "finish",
          upload_session_id: uploadSessionId,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    const finalVideoId = finishRes.data?.video_id || finishRes.data?.id;
    
    if (!finalVideoId) {
      throw new Error(
        `Failed to finish video upload. Response: ${JSON.stringify(finishRes.data)}. ` +
        `Upload session ID: ${uploadSessionId}. ` +
        `Video size: ${(media.sizeBytes / 1024 / 1024).toFixed(2)}MB. ` +
        `This may indicate the video URL is not accessible or the video format is not supported.`
      );
    }
    
    logger.info(
      { pageId, videoId: finalVideoId, uploadSessionId, fileSize: media.sizeBytes },
      "Video multipart upload completed successfully"
    );

    return finalVideoId;
  }

  /**
   * Publish video reel
   */
  /**
   * Publish Facebook Reel
   * 
   * Facebook Reels uses multipart upload flow:
   * 1. Start phase: POST /{page_id}/video_reels with upload_phase=start
   * 2. Transfer phase: POST {upload_url} with file_url in header
   * 3. Finish phase: POST /{page_id}/video_reels with upload_phase=finish + video_id + video_state=PUBLISHED + description
   * 
   * Facebook Reels requirements:
   * - Max duration: 90 seconds
   * - Format: MP4, MOV (H.264 codec recommended)
   * - Max file size: Varies, but typically up to 4GB
   * - Aspect ratio: 9:16 (vertical) recommended
   */
  private async publishReel(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;
    const pageId = socialAccount.platformAccountId;
    const accessToken = socialAccount.accessToken;

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    const first = sortedMedia[0];

    if (!first) {
      throw new Error("Facebook reel publish requires at least one media");
    }

    const media = first.media;
    const videoUrl = await getPublishableUrlForMedia(media);

    const accountOptions = content.accountOptions.find(
      (opt) => opt.socialAccountId === socialAccount.id
    );
    const captionRaw = buildFacebookCaption(content, accountOptions);
    const caption = clampFacebookCaption(captionRaw);

    // Log video info for debugging
    logger.info(
      { 
        pageId, 
        mediaId: media.id,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        sizeMB: (media.sizeBytes / 1024 / 1024).toFixed(2),
        durationMs: media.durationMs,
      },
      "Starting Facebook Reel upload using multipart flow"
    );

    // Step 1: Start upload session for reel
    const startRes = await this.http.post(
      `${GRAPH_BASE}/${pageId}/video_reels`,
      null,
      {
        params: {
          upload_phase: "start",
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    if (!startRes.data?.video_id && !startRes.data?.upload_url) {
      throw new Error(
        `Failed to start reel upload session. Response: ${JSON.stringify(startRes.data)}. ` +
        `Video size: ${(media.sizeBytes / 1024 / 1024).toFixed(2)}MB.`
      );
    }

    const videoId = startRes.data.video_id;
    const uploadUrl = startRes.data.upload_url;

    logger.info(
      { pageId, videoId, hasUploadUrl: !!uploadUrl },
      "Started Facebook Reel upload session"
    );

    if (!uploadUrl) {
      throw new Error(
        `No upload_url returned from start phase. Response: ${JSON.stringify(startRes.data)}.`
      );
    }

    if (!videoId) {
      throw new Error(
        `No video_id returned from start phase. Response: ${JSON.stringify(startRes.data)}.`
      );
    }

    // Step 2: Transfer video using file_url
    // n8n workflow: POST to upload_url with file_url in header and Authorization: OAuth {token}
    try {
      await this.http.post(
        uploadUrl,
        null,
        {
          headers: {
            Authorization: `OAuth ${accessToken}`,
            file_url: videoUrl,
          },
          timeout: 600000, // 10 minutes for large video transfer
        }
      );

      logger.info(
        { pageId, videoId, uploadUrl },
        "Video transfer completed for reel"
      );
    } catch (transferError: any) {
      const fbError = transferError?.response?.data?.error;
      logger.warn(
        { pageId, videoId, error: fbError?.message || transferError?.message },
        "Video transfer phase failed, attempting finish anyway"
      );
      // Continue to finish phase - sometimes finish works even if transfer fails
    }

    // Step 3: Finish upload and publish reel
    // n8n workflow: upload_phase=finish + video_id + video_state=PUBLISHED + description
    const finishRes = await this.http.post(
      `${GRAPH_BASE}/${pageId}/video_reels`,
      null,
      {
        params: {
          upload_phase: "finish",
          video_id: videoId,
          video_state: "PUBLISHED",
          description: caption,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    // Facebook can return either 'id' or 'post_id' in the response
    // Also, video might be processing, in which case we get success: true with post_id
    const reelId = finishRes.data?.id || finishRes.data?.post_id;
    const isProcessing = finishRes.data?.success === true && 
                         finishRes.data?.message?.toLowerCase().includes("processing");

    if (!reelId) {
      throw new Error(
        `Failed to finish reel upload. Response: ${JSON.stringify(finishRes.data)}. ` +
        `Video ID: ${videoId}. ` +
        `Video size: ${(media.sizeBytes / 1024 / 1024).toFixed(2)}MB. ` +
        `This may indicate the video URL is not accessible or the video format is not supported.`
      );
    }

    // If video is processing, wait for it to be ready (optional, since we have post_id)
    if (isProcessing) {
      const videoSizeMB = media.sizeBytes / (1024 * 1024);
      
      // Calculate check interval based on video size (same as video story)
      let checkIntervalMs: number;
      let maxWaitTimeMs: number;
      
      if (videoSizeMB <= 10) {
        checkIntervalMs = 5000;
        maxWaitTimeMs = 30000;
      } else if (videoSizeMB <= 50) {
        checkIntervalMs = 8000;
        maxWaitTimeMs = 60000;
      } else if (videoSizeMB <= 100) {
        checkIntervalMs = 10000;
        maxWaitTimeMs = 90000;
      } else {
        checkIntervalMs = 15000;
        maxWaitTimeMs = 120000;
      }
      
      const maxAttempts = Math.ceil(maxWaitTimeMs / checkIntervalMs);
      
      logger.info(
        { 
          pageId, 
          videoId, 
          reelId, 
          videoSizeMB: videoSizeMB.toFixed(2),
          checkIntervalMs,
          maxWaitTimeMs,
          maxAttempts,
          message: finishRes.data?.message 
        },
        "Reel is processing, optionally checking video status"
      );

      // Optional: Check video status (might fail for reels, so we make it optional)
      let videoReady = false;
      let attempts = 0;
      let statusCheckFailed = false;
      
      while (!videoReady && !statusCheckFailed && attempts < maxAttempts) {
        try {
          const videoStatusRes = await this.http.get(
            `${GRAPH_BASE}/${videoId}`,
            {
              params: {
                fields: "status,processing_phase,length",
                access_token: accessToken,
              },
              timeout: 10000,
            }
          );

          const status = videoStatusRes.data?.status;
          const processingPhase = videoStatusRes.data?.processing_phase;

          if (status === "ready" || status === "published" || processingPhase === "complete" || videoStatusRes.data?.length) {
            videoReady = true;
            logger.info(
              { pageId, videoId, reelId, status, processingPhase, length: videoStatusRes.data?.length, attempts },
              "Video is ready, reel should be published"
            );
            break;
          }

          if (status === "processing" || processingPhase === "transcoding" || processingPhase === "uploading") {
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
              logger.info(
                { 
                  pageId, 
                  videoId, 
                  reelId, 
                  status, 
                  processingPhase, 
                  attempt: attempts, 
                  maxAttempts,
                  waitTimeMs: checkIntervalMs 
                },
                "Video still processing, waiting..."
              );
              continue;
            } else {
              logger.warn(
                { pageId, videoId, reelId, status, processingPhase, attempts, totalWaitTimeMs: attempts * checkIntervalMs },
                "Video processing timeout reached, but reel post_id is available"
              );
              break;
            }
          }

          break;
        } catch (statusError: any) {
          const statusCode = statusError?.response?.status || statusError?.status;
          if (statusCode === 400 || statusCode === 404) {
            logger.info(
              { 
                pageId, 
                videoId, 
                reelId, 
                statusCode,
                error: statusError?.response?.data?.error?.message || statusError?.message,
                attempt: attempts 
              },
              "Video status check not available for reels (expected), proceeding with reel post_id"
            );
            statusCheckFailed = true;
            break;
          }
          
          if (attempts >= 2) {
            logger.info(
              { pageId, videoId, reelId, attempts },
              "Skipping video status check after multiple failures, proceeding with reel"
            );
            statusCheckFailed = true;
            break;
          }
          
          attempts++;
          await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
        }
      }
      
      if (statusCheckFailed) {
        logger.info(
          { pageId, videoId, reelId },
          "Skipped video status check, reel should be published (post_id available)"
        );
      }
    }
    
    logger.info(
      { pageId, videoId, reelId, isProcessing, fileSize: media.sizeBytes },
      "Facebook Reel created successfully"
    );

    return {
      platformPostId: reelId,
      publishedAt: new Date(),
      payloadSnapshot: {
        type: "FACEBOOK_REEL",
        videoId,
        reelId,
        videoUrl,
        caption,
        uploadMethod: "multipart",
        videoSizeBytes: media.sizeBytes,
        isProcessing: isProcessing || false,
        finishResponse: finishRes.data,
      },
    };
  }
}

/**
 * Build Facebook caption from content and account options
 */
function buildFacebookCaption(content: Content, accountOptions?: ContentAccountOptions | null): string | undefined {
  let caption: string | undefined;

  // 1) Account-specific override
  if (accountOptions?.captionOverride?.trim()) {
    caption = accountOptions.captionOverride;
  }
  // 2) Platform-specific caption from content
  else {
    const platformCaptions = (content.platformCaptions ?? {}) as Record<string, string>;
    const fbCaption = platformCaptions["FACEBOOK"] || platformCaptions["FACEBOOK_PAGE"];
    if (fbCaption?.trim()) {
      caption = fbCaption;
    }
    // 3) Base caption as fallback
    else if (content.baseCaption?.trim()) {
      caption = content.baseCaption;
    }
  }

  if (!caption) return undefined;

  // Preserve line breaks: only trim leading/trailing whitespace, not line breaks
  // This ensures line breaks (\n) are preserved when sent to Facebook API
  return caption.trim();
}

/**
 * Clamp Facebook caption to platform limit
 * Also normalizes line breaks to ensure they're preserved when sent to Facebook API
 */
function clampFacebookCaption(caption?: string): string | undefined {
  if (!caption) return undefined;

  // Normalize line breaks: ensure \r\n and \r are converted to \n
  // This ensures consistent line break handling across different platforms
  let normalized = caption.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Facebook caption limit: 63,206 characters
  const MAX = 63206;
  if (normalized.length > MAX) {
    normalized = normalized.slice(0, MAX);
    // If we truncated, try to truncate at the last line break to avoid breaking mid-line
    const lastLineBreak = normalized.lastIndexOf('\n');
    if (lastLineBreak > MAX * 0.9) { // Only if truncation happened near the end
      normalized = normalized.slice(0, lastLineBreak);
    }
  }

  return normalized;
}