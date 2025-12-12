/**
 * LinkedIn Publication Provider
 *
 * Publishes content to LinkedIn using UGC Posts API v2.
 * Supports Feed posts (text-only or with media).
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

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";

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

export class LinkedInPublicationProvider {
  private http: AxiosInstance;

  constructor(httpClient?: AxiosInstance) {
    this.http = httpClient ?? axios.create({
      timeout: 60000, // 60 seconds
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
            "LinkedIn API Error Response"
          );
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Publish content to LinkedIn based on form factor
   */
  async publish(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content } = pub;

    // LinkedIn supports FEED_POST and VERTICAL_VIDEO (both are published as feed posts)
    // VERTICAL_VIDEO is treated as a regular feed post with video media
    if (content.formFactor !== "FEED_POST" && content.formFactor !== "VERTICAL_VIDEO") {
      throw new Error(
        `LinkedIn publication currently supports only FEED_POST and VERTICAL_VIDEO form factors. Got: ${content.formFactor}`
      );
    }

    // Both FEED_POST and VERTICAL_VIDEO are published as feed posts
    return this.publishFeed(pub);
  }

  /**
   * Publish feed post (supports text-only or with media)
   * Handles both FEED_POST and VERTICAL_VIDEO form factors as feed posts
   */
  private async publishFeed(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;
    const organizationUrn = socialAccount.platformAccountId;
    const accessToken = socialAccount.accessToken;

    logger.info(
      {
        contentId: content.id,
        formFactor: content.formFactor,
        note: content.formFactor === "VERTICAL_VIDEO" 
          ? "VERTICAL_VIDEO will be published as a regular LinkedIn feed post" 
          : "Publishing as LinkedIn feed post",
      },
      "Publishing to LinkedIn"
    );

    // Validate required fields
    if (!organizationUrn) {
      throw new Error(
        `LinkedIn organization URN is missing for social account ${socialAccount.id}`
      );
    }
    if (!accessToken) {
      throw new Error(
        `LinkedIn access token is missing for social account ${socialAccount.id}`
      );
    }

    // Ensure organization URN is in correct format (urn:li:organization:123456)
    const orgUrn = organizationUrn.startsWith("urn:li:organization:")
      ? organizationUrn
      : `urn:li:organization:${organizationUrn}`;

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // Check if media is required for this platform/form factor
    const mediaRequired = requiresMedia("LINKEDIN", content.formFactor as any);
    if (mediaRequired && !sortedMedia.length) {
      throw new Error(
        `LinkedIn ${content.formFactor} publish requires at least one media according to platform rules`
      );
    }

    // Determine media category: check if any media is a video
    // LinkedIn supports either IMAGE or VIDEO, not mixed
    const hasVideo = sortedMedia.some(
      (cm) => cm.media?.mimeType?.startsWith("video/") ?? false
    );
    const shareMediaCategory =
      sortedMedia.length === 0
        ? "NONE"
        : hasVideo
        ? "VIDEO"
        : "IMAGE";

    // LinkedIn doesn't support mixed media (images + videos in same post)
    if (sortedMedia.length > 0) {
      const hasImage = sortedMedia.some(
        (cm) => !cm.media?.mimeType?.startsWith("video/")
      );
      if (hasVideo && hasImage) {
        throw new Error(
          "LinkedIn does not support posts with both images and videos. Please use only images or only videos."
        );
      }
    }

    const accountOptions = content.accountOptions.find(
      (opt) => opt.socialAccountId === socialAccount.id
    );
    const captionRaw = this.buildLinkedInCaption(content, accountOptions);
    const caption = this.clampLinkedInCaption(captionRaw);

    // Build UGC Post payload
    const ugcPostPayload: any = {
      author: orgUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareMediaCategory,
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    // Add shareCommentary only if caption exists
    if (caption && caption.trim().length > 0) {
      ugcPostPayload.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary = {
        text: caption,
      };
    }

    // Handle media upload if present
    const mediaUrns: string[] = [];
    if (sortedMedia.length > 0) {
      logger.info(
        {
          organizationUrn: orgUrn,
          mediaCount: sortedMedia.length,
          shareMediaCategory,
          hasVideo,
          mediaTypes: sortedMedia.map((cm) => cm.media?.mimeType || "unknown"),
        },
        "Uploading media to LinkedIn"
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
          // Upload media to LinkedIn Assets API
          const assetUrn = await this.uploadMediaToLinkedIn(
            accessToken,
            mediaUrl,
            media,
            orgUrn
          );
          mediaUrns.push(assetUrn);
        } catch (uploadError: any) {
          const errorMsg =
            uploadError?.response?.data?.message ||
            uploadError?.message ||
            "Unknown error uploading media";
          throw new Error(
            `Failed to upload media ${media.id} to LinkedIn: ${errorMsg}`
          );
        }
      }

      // Add media URNs to payload
      // LinkedIn media format: array of objects with "status" and "media" fields
      // Status must be "READY" for uploaded assets
      // For both single and multiple media, use the same array format
      if (mediaUrns.length > 0) {
        // LinkedIn expects media array with status and media fields
        // Optional: description and title can be added but are not required
        ugcPostPayload.specificContent["com.linkedin.ugc.ShareContent"].media =
          mediaUrns.map((urn) => {
            const mediaObj: any = {
              status: "READY",
              media: urn,
            };
            // Optional: Add title and description if needed (currently not adding for simplicity)
            return mediaObj;
          });
      }
    }

    // Create UGC Post
    let ugcPostRes;
    try {
      logger.info(
        {
          organizationUrn: orgUrn,
          hasCaption: !!caption,
          captionLength: caption?.length || 0,
          mediaCount: mediaUrns.length,
        },
        "Creating LinkedIn UGC Post"
      );

      // Log full payload for debugging
      logger.info(
        {
          organizationUrn: orgUrn,
          payload: JSON.stringify(ugcPostPayload, null, 2),
        },
        "LinkedIn UGC Post payload (full)"
      );

      ugcPostRes = await this.http.post(
        `${LINKEDIN_API_BASE}/ugcPosts`,
        ugcPostPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          timeout: 60000,
        }
      );

      if (!ugcPostRes.data?.id) {
        throw new Error(
          `LinkedIn API returned no post ID. Response: ${JSON.stringify(ugcPostRes.data)}`
        );
      }
    } catch (ugcPostError: any) {
      const linkedInError = ugcPostError?.response?.data;
      const errorMsg =
        linkedInError?.message ||
        ugcPostError?.message ||
        "Unknown error creating LinkedIn post";

      const errorContext = {
        organizationUrn: orgUrn,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        mediaCount: mediaUrns.length,
        mediaUrns,
        captionLength: caption?.length || 0,
        captionPreview: caption ? caption.substring(0, 100) : null,
        apiResponse: ugcPostError?.response?.data,
        apiStatus: ugcPostError?.response?.status,
        apiStatusText: ugcPostError?.response?.statusText,
        requestUrl: ugcPostError?.config?.url,
        requestMethod: ugcPostError?.config?.method,
      };

      const detailedErrorMsg = `Failed to create LinkedIn UGC post: ${errorMsg}. Organization URN: ${orgUrn}. Media URNs: ${mediaUrns.join(", ")}. Full context: ${JSON.stringify(errorContext, null, 2)}`;

      const detailedError = new Error(detailedErrorMsg);
      (detailedError as any).context = errorContext;
      (detailedError as any).linkedInError = linkedInError;
      (detailedError as any).response = ugcPostError?.response;

      throw detailedError;
    }

    const postId = ugcPostRes.data.id as string;

    return {
      platformPostId: postId,
      publishedAt: new Date(),
      payloadSnapshot: {
        type: "LINKEDIN_FEED",
        caption,
        mediaUrns,
        mediaCount: mediaUrns.length,
      },
    };
  }

  /**
   * Upload media to LinkedIn Assets API
   * Returns the asset URN for use in UGC Post
   * 
   * LinkedIn Assets API flow:
   * 1. Register upload with organization URN
   * 2. Upload binary data to provided upload URL
   * 3. Return asset URN for use in UGC Post
   */
  private async uploadMediaToLinkedIn(
    accessToken: string,
    mediaUrl: string,
    media: Media,
    organizationUrn: string
  ): Promise<string> {
    // Determine recipe based on media type
    const isVideo = media.mimeType?.startsWith("video/") ?? false;
    const recipe = isVideo
      ? "urn:li:digitalmediaRecipe:feedshare-video"
      : "urn:li:digitalmediaRecipe:feedshare-image";

    // Step 1: Register upload
    const registerRes = await this.http.post(
      `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: [recipe],
          owner: organizationUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        timeout: 30000,
      }
    );

    if (
      !registerRes.data?.value?.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl
    ) {
      throw new Error(
        `LinkedIn registerUpload failed. Response: ${JSON.stringify(registerRes.data)}`
      );
    }

    const uploadUrl =
      registerRes.data.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const assetUrn = registerRes.data.value.asset;

    // Step 2: Download media from URL
    logger.info(
      {
        assetUrn,
        mediaId: media.id,
        mediaUrl: mediaUrl.substring(0, 100),
      },
      "Downloading media for LinkedIn upload"
    );

    const mediaResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    // Step 3: Upload binary data to LinkedIn
    logger.info(
      {
        assetUrn,
        uploadUrl: uploadUrl.substring(0, 100),
        contentType: media.mimeType || "image/jpeg",
        sizeBytes: mediaResponse.data.byteLength,
      },
      "Uploading media to LinkedIn"
    );

    await this.http.put(uploadUrl, mediaResponse.data, {
      headers: {
        "Content-Type": media.mimeType || "image/jpeg",
      },
      timeout: 120000, // 2 minutes for large files
    });

    logger.info(
      {
        assetUrn,
        mediaId: media.id,
        mimeType: media.mimeType,
      },
      "Media uploaded to LinkedIn, verifying asset status"
    );

    // Wait and poll for asset to be available
    // LinkedIn needs time to process the upload before it can be used in posts
    // Wait a bit first before checking status
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds initial wait

    let assetReady = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts = 10 seconds total (after initial 2s wait)
    const pollInterval = 500; // 500ms between checks

    while (!assetReady && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;

      try {
        // Check asset status using assets endpoint
        // LinkedIn Assets API: GET /v2/assets/{assetUrn}?fields=status
        const assetStatusRes = await this.http.get(
          `${LINKEDIN_API_BASE}/assets/${encodeURIComponent(assetUrn)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Restli-Protocol-Version": "2.0.0",
            },
            params: {
              fields: "status",
            },
            timeout: 10000,
          }
        );

        const status = assetStatusRes.data?.status;
        logger.info(
          {
            assetUrn,
            status,
            attempt: attempts,
            fullResponse: assetStatusRes.data,
          },
          "LinkedIn asset status check"
        );

        // LinkedIn asset status can be: AVAILABLE, PROCESSING, FAILED, etc.
        // AVAILABLE means asset is ready to use
        if (status === "AVAILABLE") {
          assetReady = true;
          logger.info(
            {
              assetUrn,
              status,
              attempts,
            },
            "LinkedIn asset is available and ready"
          );
          break;
        }

        // If status is PROCESSING, continue waiting
        if (status === "PROCESSING") {
          logger.info(
            {
              assetUrn,
              status,
              attempt: attempts,
              maxAttempts,
            },
            "LinkedIn asset still processing, waiting..."
          );
          continue;
        }

        // If status is FAILED or other error state, log warning but continue
        if (status === "FAILED" || status === "ERROR") {
          logger.warn(
            {
              assetUrn,
              status,
              attempt: attempts,
            },
            "LinkedIn asset status indicates failure, but proceeding anyway"
          );
          // Don't break - try to use asset anyway, sometimes it still works
        }
      } catch (statusError: any) {
        // Status check might fail - this is common, asset might still be usable
        // LinkedIn API sometimes doesn't return status immediately
        const statusCode = statusError?.response?.status;
        if (statusCode === 404 || statusCode === 400) {
          // Asset endpoint might not support status check for all asset types
          logger.info(
            {
              assetUrn,
              statusCode,
              error: statusError?.response?.data?.message || statusError?.message,
              attempt: attempts,
            },
            "LinkedIn asset status check not available (expected for some asset types), proceeding"
          );
          // If we can't check status, assume it's ready after a few attempts
          if (attempts >= 3) {
            assetReady = true;
            break;
          }
        } else {
          logger.warn(
            {
              assetUrn,
              error: statusError?.response?.data?.message || statusError?.message,
              statusCode,
              attempt: attempts,
            },
            "Could not check LinkedIn asset status, continuing to poll"
          );
        }
      }
    }

    if (!assetReady) {
      logger.warn(
        {
          assetUrn,
          attempts,
        },
        "LinkedIn asset status check timeout, proceeding anyway (asset might still be usable)"
      );
    }

    logger.info(
      {
        assetUrn,
        mediaId: media.id,
        mimeType: media.mimeType,
      },
      "Media uploaded to LinkedIn successfully"
    );

    return assetUrn;
  }

  /**
   * Build LinkedIn caption from content and account options
   */
  private buildLinkedInCaption(
    content: Content,
    accountOptions?: ContentAccountOptions | null
  ): string | undefined {
    let caption: string | undefined;

    // 1) Account-specific override
    if (accountOptions?.captionOverride?.trim()) {
      caption = accountOptions.captionOverride;
    }
    // 2) Platform-specific caption from content
    else {
      const platformCaptions = (content.platformCaptions ?? {}) as Record<
        string,
        string
      >;
      const linkedInCaption = platformCaptions["LINKEDIN"];
      if (linkedInCaption?.trim()) {
        caption = linkedInCaption;
      }
      // 3) Base caption as fallback
      else if (content.baseCaption?.trim()) {
        caption = content.baseCaption;
      }
    }

    if (!caption) return undefined;

    // Preserve line breaks
    return caption.trim();
  }

  /**
   * Clamp LinkedIn caption to platform limit
   */
  private clampLinkedInCaption(caption?: string): string | undefined {
    if (!caption) return undefined;

    // Normalize line breaks
    let normalized = caption.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // LinkedIn caption limit: 3000 characters
    const MAX = getCaptionLimitFor("LINKEDIN", "FEED_POST");
    if (normalized.length > MAX) {
      normalized = normalized.slice(0, MAX);
      // Try to truncate at the last line break
      const lastLineBreak = normalized.lastIndexOf("\n");
      if (lastLineBreak > MAX * 0.9) {
        normalized = normalized.slice(0, lastLineBreak);
      }
    }

    return normalized;
  }
}
