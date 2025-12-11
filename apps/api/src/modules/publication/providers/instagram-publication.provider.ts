/**
 * Instagram Publication Provider
 *
 * Handles publishing content to Instagram using Graph API v24.
 * Supports Reels, Feed Posts (single & carousel), and Stories.
 */

import axios, { AxiosInstance } from "axios";
import {
  Content,
  ContentFormFactor,
  ContentAccountOptions,
  ContentMedia,
  Media,
  Publication,
  SocialAccount,
  SocialPlatform,
} from "@prisma/client";
import { getPublishableUrlForMedia } from "@/core/media/media-url.helper.js";
import {
  getCaptionLimitFor,
  INSTAGRAM_VIDEO_POLLING_RULES,
  type InstagramVideoPollingRules,
} from "@brint/shared-config/platform-rules";
import { logger } from "@/lib/logger.js";

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION ?? "v24.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

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

export class InstagramPublicationProvider {
  private http: AxiosInstance;
  private readonly graphApiVersion: string;
  private readonly baseUrl: string;

  constructor(httpClient?: AxiosInstance) {
    this.http = httpClient ?? axios.create();
    this.graphApiVersion = GRAPH_API_VERSION;
    this.baseUrl = GRAPH_BASE;

    // Add response interceptor for better error logging
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          logger.error(
            {
              url: error.config?.url,
              status: error.response.status,
              data: error.response.data,
            },
            "Instagram API Error Response"
          );
        }
        return Promise.reject(error);
      }
    );
  }

  async publish(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;

    if (socialAccount.platform !== SocialPlatform.INSTAGRAM) {
      throw new Error("InstagramPublicationProvider only supports INSTAGRAM platform");
    }

    const igBusinessId = this.getIgBusinessId(socialAccount);
    const accessToken = this.getAccessToken(socialAccount);
    const caption = this.buildCaption(content, socialAccount, pub);

    switch (content.formFactor as ContentFormFactor) {
      case "VERTICAL_VIDEO":
        return this.publishReel({
          publication: pub,
          igBusinessId,
          accessToken,
          caption,
        });
      case "FEED_POST":
        return this.publishFeed({
          publication: pub,
          igBusinessId,
          accessToken,
          caption,
        });
      case "STORY":
        return this.publishStories({
          publication: pub,
          igBusinessId,
          accessToken,
        });
      default:
        throw new Error(`Unsupported form factor for Instagram: ${content.formFactor}`);
    }
  }

  /**
   * Get Instagram Business ID from SocialAccount
   */
  private getIgBusinessId(socialAccount: SocialAccount): string {
    if (!socialAccount.platformAccountId) {
      throw new Error("Instagram SocialAccount.platformAccountId (business ID) is missing");
    }
    return socialAccount.platformAccountId;
  }

  /**
   * Get access token from SocialAccount
   */
  private getAccessToken(socialAccount: SocialAccount): string {
    if (!socialAccount.accessToken) {
      throw new Error("Instagram SocialAccount.accessToken is missing");
    }
    return socialAccount.accessToken;
  }

  /**
   * Build Instagram caption from content and account options
   * Priority: captionOverride > platformCaptions[INSTAGRAM] > baseCaption
   */
  private buildCaption(
    content: PublicationWithRelations['content'],
    socialAccount: SocialAccount,
    publication: PublicationWithRelations
  ): string | undefined {
    const accountOptions = content.accountOptions.find(
      (opt: ContentAccountOptions) => opt.socialAccountId === socialAccount.id
    );

    let caption =
      accountOptions?.captionOverride ??
      (content.platformCaptions as any)?.["INSTAGRAM"] ??
      content.baseCaption ??
      undefined;

    if (!caption) return undefined;

    // Normalize line breaks
    caption = caption.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Truncate to platform limit
    const maxLen = getCaptionLimitFor(SocialPlatform.INSTAGRAM, content.formFactor as ContentFormFactor);
    if (maxLen && caption.length > maxLen) {
      // Try to truncate at last line break if possible
      const truncated = caption.slice(0, maxLen);
      const lastLineBreak = truncated.lastIndexOf("\n");
      if (lastLineBreak > maxLen * 0.9) {
        caption = truncated.slice(0, lastLineBreak);
      } else {
        caption = truncated;
      }
    }

    return caption;
  }

  /**
   * Create Instagram media container
   */
  private async createMediaContainer(
    igBusinessId: string,
    params: Record<string, any>
  ): Promise<string> {
    const url = `${this.baseUrl}/${igBusinessId}/media`;
    const response = await this.http.post(url, null, {
      params,
    });

    if (!response.data?.id) {
      throw new Error(
        `Instagram media container creation failed. Response: ${JSON.stringify(response.data)}`
      );
    }

    return response.data.id as string;
  }

  /**
   * Wait for container to finish processing
   * Uses dynamic polling based on video duration/size
   */
  private async waitForContainerFinished(
    containerId: string,
    accessToken: string,
    media?: Media
  ): Promise<"FINISHED" | "FAILED" | "TIMEOUT"> {
    const url = `${this.baseUrl}/${containerId}`;
    const rules = INSTAGRAM_VIDEO_POLLING_RULES;

    // Estimate duration
    let estimatedDurationMs = media?.durationMs ?? 0;
    if (!estimatedDurationMs && media?.sizeBytes) {
      // Rough estimate: 500kb/s
      const estimatedSec = media.sizeBytes / 500_000;
      estimatedDurationMs = estimatedSec * 1000;
    }

    // Base wait = max(shortVideoBaseWaitMs, 2 * estimatedDuration)
    const baseWaitMs = Math.max(
      rules.shortVideoBaseWaitMs,
      estimatedDurationMs * 2 || rules.shortVideoBaseWaitMs
    );

    const maxWaitMs = Math.min(baseWaitMs, rules.maxWaitMs);

    // Poll interval = clamp(estimatedDuration/10, minInterval, maxInterval)
    const rawInterval = (estimatedDurationMs || rules.shortVideoBaseWaitMs) / 10;
    const pollIntervalMs = Math.min(
      rules.maxIntervalMs,
      Math.max(rules.minIntervalMs, rawInterval)
    );

    const startedAt = Date.now();

    logger.info(
      {
        containerId,
        estimatedDurationMs,
        maxWaitMs,
        pollIntervalMs,
      },
      "Starting Instagram container status polling"
    );

    while (Date.now() - startedAt < maxWaitMs) {
      try {
        const resp = await this.http.get(url, {
          params: {
            access_token: accessToken,
            fields: "status_code,status",
          },
          timeout: 10000,
        });

        const statusCode = resp.data?.status_code as string | undefined;
        const status = resp.data?.status as string | undefined;

        if (statusCode === "FINISHED") {
          logger.info({ containerId, statusCode }, "Instagram container finished");
          return "FINISHED";
        }

        if (statusCode === "ERROR" || status === "ERROR") {
          logger.error(
            { containerId, statusCode, status, data: resp.data },
            "Instagram container failed"
          );
          return "FAILED";
        }

        // Still processing, wait before next check
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      } catch (error: any) {
        logger.warn(
          { containerId, error: error.message },
          "Error checking container status, continuing to poll"
        );
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    }

    logger.warn(
      { containerId, maxWaitMs, elapsed: Date.now() - startedAt },
      "Instagram container status check timeout"
    );
    return "TIMEOUT";
  }

  /**
   * Publish Instagram media container
   */
  private async publishContainer(
    igBusinessId: string,
    creationId: string,
    accessToken: string
  ): Promise<string> {
    const url = `${this.baseUrl}/${igBusinessId}/media_publish`;
    const response = await this.http.post(url, null, {
      params: {
        creation_id: creationId,
        access_token: accessToken,
      },
    });

    if (!response.data?.id) {
      throw new Error(
        `Instagram media_publish failed. Response: ${JSON.stringify(response.data)}`
      );
    }

    return response.data.id as string;
  }

  /**
   * Publish Instagram Reel (VERTICAL_VIDEO)
   */
  private async publishReel(args: {
    publication: PublicationWithRelations;
    igBusinessId: string;
    accessToken: string;
    caption?: string;
  }): Promise<PublicationResult> {
    const { publication, igBusinessId, accessToken, caption } = args;
    const { content } = publication;

    const primaryMedia = content.contentMedia[0]?.media;
    if (!primaryMedia) {
      throw new Error("Instagram Reel requires at least one media");
    }

    const videoUrl = await getPublishableUrlForMedia(primaryMedia, {
      expiresInSeconds: 60 * 60, // 1 hour for video uploads
    });

    // Cover options from ContentAccountOptions
    const accountOptions = content.accountOptions.find(
      (opt) => opt.socialAccountId === publication.socialAccountId
    );

    let thumbOffsetMs: number | undefined;
    let coverUrl: string | undefined;

    if (accountOptions?.coverFrameTimeSec != null) {
      thumbOffsetMs = accountOptions.coverFrameTimeSec * 1000;
    }

    if (accountOptions?.coverMediaId) {
      const coverMedia = content.contentMedia.find(
        (cm) => cm.mediaId === accountOptions.coverMediaId
      )?.media;

      if (coverMedia) {
        coverUrl = await getPublishableUrlForMedia(coverMedia, {
          expiresInSeconds: 60 * 60,
        });
      }
    }

    const params: Record<string, any> = {
      media_type: "REELS",
      video_url: videoUrl,
      share_to_feed: true,
      access_token: accessToken,
    };

    if (caption) {
      params.caption = caption;
    }
    if (thumbOffsetMs != null) {
      params.thumb_offset = thumbOffsetMs;
    }
    if (coverUrl) {
      params.cover_url = coverUrl;
    }

    logger.info(
      {
        igBusinessId,
        hasCaption: !!caption,
        hasThumbOffset: thumbOffsetMs != null,
        hasCoverUrl: !!coverUrl,
      },
      "Creating Instagram Reel container"
    );

    const containerId = await this.createMediaContainer(igBusinessId, params);

    const status = await this.waitForContainerFinished(containerId, accessToken, primaryMedia);
    if (status !== "FINISHED") {
      throw new Error(`Instagram Reel container not finished, status=${status}`);
    }

    const igPostId = await this.publishContainer(igBusinessId, containerId, accessToken);

    logger.info({ igBusinessId, containerId, igPostId }, "Instagram Reel published successfully");

    return {
      platformPostId: igPostId,
      publishedAt: new Date(),
      payloadSnapshot: {
        kind: "INSTAGRAM_REEL",
        containerId,
        igPostId,
        caption,
        thumbOffsetMs,
        hasCoverUrl: !!coverUrl,
      },
    };
  }

  /**
   * Publish Instagram Feed Post (single or carousel)
   */
  private async publishFeed(args: {
    publication: PublicationWithRelations;
    igBusinessId: string;
    accessToken: string;
    caption?: string;
  }): Promise<PublicationResult> {
    const { publication, igBusinessId, accessToken, caption } = args;
    const { content } = publication;

    const mediaItems = content.contentMedia
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cm) => cm.media);

    if (mediaItems.length === 0) {
      throw new Error("Instagram Feed requires at least one media");
    }

    if (mediaItems.length === 1) {
      return this.publishSingleFeedPost({
        media: mediaItems[0],
        igBusinessId,
        accessToken,
        caption,
      });
    }

    return this.publishCarouselFeed({
      mediaItems,
      igBusinessId,
      accessToken,
      caption,
    });
  }

  /**
   * Publish single Instagram Feed Post
   */
  private async publishSingleFeedPost(args: {
    media: Media;
    igBusinessId: string;
    accessToken: string;
    caption?: string;
  }): Promise<PublicationResult> {
    const { media, igBusinessId, accessToken, caption } = args;

    const url = await getPublishableUrlForMedia(media, {
      expiresInSeconds: 60 * 60,
    });
    const isImage = media.kind === "IMAGE";

    const params: Record<string, any> = {
      access_token: accessToken,
    };

    if (isImage) {
      params.image_url = url;
    } else {
      params.video_url = url;
    }

    if (caption) {
      params.caption = caption;
    }

    logger.info(
      { igBusinessId, isImage, hasCaption: !!caption },
      "Creating Instagram single feed post container"
    );

    const containerId = await this.createMediaContainer(igBusinessId, params);
    const status = await this.waitForContainerFinished(containerId, accessToken, media);

    if (status !== "FINISHED") {
      throw new Error(`Instagram Feed container not finished, status=${status}`);
    }

    const igPostId = await this.publishContainer(igBusinessId, containerId, accessToken);

    logger.info({ igBusinessId, containerId, igPostId }, "Instagram single feed post published");

    return {
      platformPostId: igPostId,
      publishedAt: new Date(),
      payloadSnapshot: {
        kind: "INSTAGRAM_FEED_SINGLE",
        containerId,
        igPostId,
        caption,
        isImage,
      },
    };
  }

  /**
   * Publish Instagram Carousel Feed Post
   */
  private async publishCarouselFeed(args: {
    mediaItems: Media[];
    igBusinessId: string;
    accessToken: string;
    caption?: string;
  }): Promise<PublicationResult> {
    const { mediaItems, igBusinessId, accessToken, caption } = args;

    logger.info(
      { igBusinessId, itemCount: mediaItems.length, hasCaption: !!caption },
      "Creating Instagram carousel feed post"
    );

    if (mediaItems.length === 0) {
      throw new Error("Instagram carousel requires at least one media");
    }

    const childContainerIds: string[] = [];

    // Create child containers
    for (const media of mediaItems) {
      const mediaUrl = await getPublishableUrlForMedia(media, {
        expiresInSeconds: 60 * 60,
      });
      const isImage = media.kind === "IMAGE";

      const params: Record<string, any> = {
        is_carousel_item: true,
        access_token: accessToken,
      };

      if (isImage) {
        params.image_url = mediaUrl;
        // Critical: Instagram requires media_type for carousel items
        params.media_type = "IMAGE";
      } else {
        params.video_url = mediaUrl;
        // Critical: Instagram requires media_type for carousel items
        params.media_type = "VIDEO";
      }

      logger.info(
        {
          igBusinessId,
          isImage,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
        },
        "Creating Instagram carousel child container"
      );

      const containerId = await this.createMediaContainer(igBusinessId, params);
      const status = await this.waitForContainerFinished(containerId, accessToken, media);

      if (status !== "FINISHED") {
        throw new Error(`Instagram carousel child container not finished, status=${status}`);
      }

      childContainerIds.push(containerId);
    }

    // Create root carousel container
    const rootParams: Record<string, any> = {
      media_type: "CAROUSEL",
      children: childContainerIds.join(","),
      access_token: accessToken,
    };

    if (caption) {
      rootParams.caption = caption;
    }

    logger.info(
      {
        igBusinessId,
        childCount: childContainerIds.length,
        hasCaption: !!caption,
      },
      "Creating Instagram carousel root container"
    );

    const rootContainerId = await this.createMediaContainer(igBusinessId, rootParams);
    
    // Wait for root container to finish (especially important if it contains videos)
    const rootStatus = await this.waitForContainerFinished(
      rootContainerId,
      accessToken,
      mediaItems[0]
    );

    if (rootStatus !== "FINISHED") {
      throw new Error(`Instagram carousel root container not finished, status=${rootStatus}`);
    }

    const igPostId = await this.publishContainer(igBusinessId, rootContainerId, accessToken);

    logger.info(
      { igBusinessId, rootContainerId, igPostId, childCount: childContainerIds.length },
      "Instagram carousel feed post published"
    );

    return {
      platformPostId: igPostId,
      publishedAt: new Date(),
      payloadSnapshot: {
        kind: "INSTAGRAM_FEED_CAROUSEL",
        rootContainerId,
        childContainerIds,
        igPostId,
        caption,
      },
    };
  }

  /**
   * Publish Instagram Stories
   */
  private async publishStories(args: {
    publication: PublicationWithRelations;
    igBusinessId: string;
    accessToken: string;
  }): Promise<PublicationResult> {
    const { publication, igBusinessId, accessToken } = args;
    const { content } = publication;

    const mediaItems = content.contentMedia
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cm) => cm.media);

    if (mediaItems.length === 0) {
      throw new Error("Instagram Stories requires at least one media");
    }

    logger.info(
      { igBusinessId, storyCount: mediaItems.length },
      "Creating Instagram stories"
    );

    const storyIds: string[] = [];

    // Create and publish each story
    for (const media of mediaItems) {
      const mediaUrl = await getPublishableUrlForMedia(media, {
        expiresInSeconds: 60 * 60,
      });
      const isImage = media.mimeType?.startsWith("image/") ?? false;

      const params: Record<string, any> = {
        media_type: "STORIES",
        access_token: accessToken,
      };

      if (isImage) {
        params.image_url = mediaUrl;
      } else {
        params.video_url = mediaUrl;
      }

      const containerId = await this.createMediaContainer(igBusinessId, params);
      const status = await this.waitForContainerFinished(containerId, accessToken, media);

      if (status !== "FINISHED") {
        throw new Error(`Instagram story container not finished, status=${status}`);
      }

      const igStoryId = await this.publishContainer(igBusinessId, containerId, accessToken);
      storyIds.push(igStoryId);
    }

    logger.info(
      { igBusinessId, storyIds, count: storyIds.length },
      "Instagram stories published successfully"
    );

    return {
      platformPostId: storyIds[0], // Use first story ID as primary
      publishedAt: new Date(),
      payloadSnapshot: {
        kind: "INSTAGRAM_STORIES",
        storyIds,
        count: storyIds.length,
      },
    };
  }
}
