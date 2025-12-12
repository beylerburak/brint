/**
 * Pinterest Publication Provider
 *
 * Publishes content to Pinterest using Pinterest API v5.
 * Supports FEED_POST form factor (pins with images/videos).
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

// Pinterest API endpoints
// Trial access apps must use sandbox API
// Default to sandbox for trial access compatibility
const PINTEREST_API_SANDBOX = "https://api-sandbox.pinterest.com/v5";
const PINTEREST_API_PRODUCTION = "https://api.pinterest.com/v5";
// Use sandbox by default (can be overridden via env var)
const PINTEREST_API_BASE = process.env.PINTEREST_API_BASE || PINTEREST_API_SANDBOX;

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

export class PinterestPublicationProvider {
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
            "Pinterest API Error Response"
          );
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Publish content to Pinterest based on form factor
   */
  async publish(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content } = pub;

    // Pinterest only supports FEED_POST (pins)
    if (content.formFactor !== "FEED_POST") {
      throw new Error(
        `Pinterest publication currently supports only FEED_POST form factor. Got: ${content.formFactor}`
      );
    }

    return this.publishPin(pub);
  }

  /**
   * Publish a pin to Pinterest
   * Pinterest requires: board_id, title, description, media_source (image_url or video_url)
   */
  private async publishPin(pub: PublicationWithRelations): Promise<PublicationResult> {
    const { content, socialAccount } = pub;
    let accessToken = socialAccount.accessToken;

    // Validate required fields
    if (!accessToken) {
      throw new Error(
        `Pinterest access token is missing for social account ${socialAccount.id}`
      );
    }

    // Clean token - remove "Bearer " prefix if present
    accessToken = accessToken.replace(/^Bearer\s+/i, "").trim();

    logger.info(
      {
        contentId: content.id,
        formFactor: content.formFactor,
        socialAccountId: socialAccount.id,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        platformAccountId: socialAccount.platformAccountId,
        scopes: socialAccount.scopes || [],
      },
      "Publishing to Pinterest"
    );

    const sortedMedia = [...content.contentMedia].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // Check if media is required for this platform/form factor
    const mediaRequired = requiresMedia("PINTEREST", content.formFactor as any);
    if (mediaRequired && !sortedMedia.length) {
      throw new Error(
        `Pinterest ${content.formFactor} publish requires at least one media according to platform rules`
      );
    }

    // Pinterest requires at least one media for pins
    if (sortedMedia.length === 0) {
      throw new Error("Pinterest pin publish requires at least one media");
    }

    // Pinterest supports single image/video per pin
    // If multiple media, use the first one
    if (sortedMedia.length > 1) {
      logger.warn(
        {
          contentId: content.id,
          mediaCount: sortedMedia.length,
        },
        "Pinterest supports only one media per pin, using first media"
      );
    }

    const contentMedia = sortedMedia[0];
    const media = contentMedia.media;

    if (!media) {
      throw new Error(`Media not found for contentMedia ${contentMedia.id}`);
    }

    const accountOptions = content.accountOptions.find(
      (opt) => opt.socialAccountId === socialAccount.id
    );
    const captionRaw = this.buildPinterestCaption(content, accountOptions);
    const title = this.extractTitle(captionRaw);
    const description = this.extractDescription(captionRaw);

    // Get board_id from tokenData or accountOptions
    // Pinterest requires board_id to create a pin
    let boardId: string | undefined;
    
    // Try to get from tokenData (JSON field)
    if (socialAccount.tokenData && typeof socialAccount.tokenData === 'object') {
      const tokenData = socialAccount.tokenData as any;
      boardId = tokenData?.boardId || tokenData?.board_id;
    }
    
    // If not found, check if there's a default board in account metadata
    if (!boardId && socialAccount.rawProfile) {
      const rawProfile = socialAccount.rawProfile as any;
      boardId = rawProfile?.defaultBoardId || rawProfile?.default_board_id;
    }
    
    // If still not found, fetch user's boards and use the first one
    if (!boardId) {
      logger.info(
        {
          socialAccountId: socialAccount.id,
          hasTokenData: !!socialAccount.tokenData,
          hasRawProfile: !!socialAccount.rawProfile,
          tokenDataType: typeof socialAccount.tokenData,
          tokenDataContent: socialAccount.tokenData,
          rawProfileContent: socialAccount.rawProfile,
        },
        "Pinterest board_id not found in tokenData/rawProfile, fetching user's boards from API"
      );
      
      try {
        boardId = await this.fetchFirstBoardId(accessToken);
        
        if (boardId) {
          logger.info(
            {
              socialAccountId: socialAccount.id,
              boardId,
            },
            "Using first available Pinterest board from API"
          );
        } else {
          logger.warn(
            {
              socialAccountId: socialAccount.id,
            },
            "No Pinterest boards found via API - user may not have any boards"
          );
        }
      } catch (fetchError: any) {
        logger.error(
          {
            error: fetchError,
            errorMessage: fetchError?.message,
            socialAccountId: socialAccount.id,
          },
          "Failed to fetch Pinterest boards from API"
        );
        // Continue to throw error below
      }
    }
    
    // If still no board_id, try to create a default board or use a fallback
    if (!boardId) {
      logger.warn(
        {
          socialAccountId: socialAccount.id,
        },
        "Pinterest board_id still not found, attempting to create default board"
      );
      
      try {
        // Try to create a default board
        boardId = await this.createDefaultBoard(accessToken);
        
        if (boardId) {
          logger.info(
            {
              socialAccountId: socialAccount.id,
              boardId,
            },
            "Created default Pinterest board"
          );
        }
      } catch (createError: any) {
        logger.error(
          {
            error: createError,
            errorMessage: createError?.message,
            socialAccountId: socialAccount.id,
          },
          "Failed to create default Pinterest board"
        );
      }
    }
    
    if (!boardId) {
      // Provide more helpful error message
      const apiMode = PINTEREST_API_BASE === PINTEREST_API_SANDBOX ? 'sandbox' : 'production';
      throw new Error(
        `Pinterest board_id is required to create a pin. The system attempted to:
1. Fetch existing boards from your Pinterest account (${apiMode} API)
2. Create a default "All Pins" board (${apiMode} API)

Both attempts failed. Possible reasons:
- Your Pinterest app is in Trial access mode and may have limited permissions
- The access token may be missing 'boards:read' or 'boards:write' scopes
- Your Pinterest account may not have permission to create boards
- The ${apiMode} API endpoint may be unavailable

Please ensure your Pinterest account has at least one board, or reconnect your Pinterest account with the required permissions. Check the logs for detailed API response information.`
      );
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

    // Determine media type
    const isVideo = media.mimeType?.startsWith("video/") ?? false;
    const isImage = media.mimeType?.startsWith("image/") ?? false;

    if (!isImage && !isVideo) {
      throw new Error(
        `Pinterest only supports image or video media. Got: ${media.mimeType}`
      );
    }

    // Build Pinterest pin payload
    const pinPayload: any = {
      board_id: boardId,
      title: title || "Untitled Pin",
      description: description || "",
      media_source: {
        source_type: isVideo ? "video_url" : "image_url",
        url: mediaUrl,
      },
    };

    // Pinterest API v5 endpoint
    // Use sandbox by default (required for trial access apps)
    // Can be overridden via PINTEREST_API_BASE env var
    let createPinUrl = `${PINTEREST_API_BASE}/pins`;
    let useSandbox = PINTEREST_API_BASE === PINTEREST_API_SANDBOX;

    let pinRes;
    try {
      logger.info(
        {
          mediaId: media.id,
          mediaUrl: mediaUrl.substring(0, 100),
          mimeType: media.mimeType,
          boardId,
          title: title?.substring(0, 50),
          isVideo,
          isImage,
          endpoint: "sandbox",
          payload: pinPayload,
        },
        "Creating Pinterest pin (trying sandbox first)"
      );

      try {
        pinRes = await this.http.post(
          createPinUrl,
          pinPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          }
        );
        
        logger.info(
          {
            status: pinRes.status,
            endpoint: "sandbox",
          },
          "Pinterest pin created successfully in sandbox"
        );
      } catch (sandboxError: any) {
        // If sandbox fails, try production as fallback
        const errorMsg = sandboxError?.response?.data?.message || sandboxError?.message || "";
        
        // If error explicitly says to use sandbox (trial access), don't try production
        if (
          sandboxError?.response?.status === 403 &&
          errorMsg.includes("Trial access") &&
          errorMsg.includes("Sandbox")
        ) {
          // This is a trial access limitation - must use sandbox
          logger.warn(
            {
              error: sandboxError?.response?.data,
              status: sandboxError?.response?.status,
            },
            "Pinterest sandbox API error - trial access limitation, cannot use production"
          );
          throw sandboxError;
        }
        
        // For other errors, try production as fallback
        logger.info(
          {
            sandboxError: sandboxError?.response?.data,
            sandboxStatus: sandboxError?.response?.status,
          },
          "Pinterest sandbox failed, trying production API"
        );
        
        createPinUrl = `${PINTEREST_API_PRODUCTION}/pins`;
        useSandbox = false;
        
        pinRes = await this.http.post(
          createPinUrl,
          pinPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          }
        );
        
        logger.info(
          {
            status: pinRes.status,
            endpoint: "production",
          },
          "Pinterest pin created successfully in production"
        );
      }
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.error_description ||
        error?.message ||
        "Unknown error";

      logger.error(
        {
          error: error?.response?.data,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: createPinUrl,
          payload: pinPayload,
          hasAccessToken: !!accessToken,
          accessTokenLength: accessToken?.length || 0,
        },
        "Pinterest pin creation failed"
      );

      if (error?.response?.status === 401) {
        throw new Error(
          `Failed to create Pinterest pin: Unauthorized. The access token may be invalid or expired. Please reconnect the Pinterest account. Error: ${errorMsg}`
        );
      }

      if (error?.response?.status === 403) {
        // Check if it's a sandbox/production issue
        if (errorMsg.includes("Trial access") && errorMsg.includes("Sandbox")) {
          throw new Error(
            `Failed to create Pinterest pin: Your Pinterest app is in Trial access mode and must use the Sandbox API. The system is already using the sandbox endpoint. Please check your Pinterest Developer Portal settings or wait for your app to be approved for production access. Error: ${errorMsg}`
          );
        }
        
        throw new Error(
          `Failed to create Pinterest pin: Forbidden. The access token may be missing the 'pins:write' scope, or your app may be in Trial access mode (requiring Sandbox API). Please reconnect the Pinterest account with the correct permissions or check your app's access level. Error: ${errorMsg}`
        );
      }

      throw new Error(`Failed to create Pinterest pin: ${errorMsg}`);
    }

    // Extract pin ID from response
    // Pinterest API v5 response format: { id: "...", ... }
    const pinData = pinRes.data;
    const pinId = pinData?.id;

    if (!pinId) {
      throw new Error(
        `Pinterest pin creation failed: No pin ID in response. Response: ${JSON.stringify(pinRes.data)}`
      );
    }

    logger.info(
      {
        pinId,
        boardId,
        title: title?.substring(0, 50),
      },
      "Pinterest pin created successfully"
    );

    return {
      platformPostId: pinId,
      publishedAt: new Date(),
      payloadSnapshot: {
        endpoint: createPinUrl,
        method: "POST",
        apiMode: useSandbox ? "sandbox" : "production",
        request: {
          boardId,
          title: title?.substring(0, 100),
          description: description?.substring(0, 200),
          mediaType: isVideo ? "video" : "image",
        },
        response: {
          pinId,
          boardId: pinData?.board_id,
        },
      },
    };
  }

  /**
   * Build Pinterest caption from content and account options
   */
  private buildPinterestCaption(
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
   * Extract title from caption (first line or first 100 chars)
   */
  private extractTitle(caption: string | undefined): string | undefined {
    if (!caption) {
      return undefined;
    }

    // Use first line as title, or first 100 chars
    const firstLine = caption.split("\n")[0].trim();
    const titleLimit = 100; // Pinterest title limit
    
    if (firstLine.length <= titleLimit) {
      return firstLine;
    }

    return firstLine.substring(0, titleLimit);
  }

  /**
   * Extract description from caption (remaining text after title)
   */
  private extractDescription(caption: string | undefined): string | undefined {
    if (!caption) {
      return undefined;
    }

    // Get remaining text after first line
    const lines = caption.split("\n");
    if (lines.length <= 1) {
      // No description if only one line (used as title)
      return undefined;
    }

    const description = lines.slice(1).join("\n").trim();
    const descriptionLimit = getCaptionLimitFor("PINTEREST", "FEED_POST");
    
    if (description.length <= descriptionLimit) {
      return description;
    }

    logger.warn(
      {
        originalLength: description.length,
        limit: descriptionLimit,
        truncatedLength: descriptionLimit,
      },
      "Pinterest description exceeds limit, truncating"
    );

    return description.substring(0, descriptionLimit);
  }

  /**
   * Fetch user's boards and return the first board ID
   */
  private async fetchFirstBoardId(accessToken: string): Promise<string | undefined> {
    try {
      // Use the same base URL as pin creation (sandbox by default)
      let boardsUrl = `${PINTEREST_API_BASE}/boards`;
      
      logger.info(
        {
          url: boardsUrl,
          hasAccessToken: !!accessToken,
          apiBase: PINTEREST_API_BASE,
        },
        "Fetching Pinterest boards"
      );

      let response;
      try {
        response = await this.http.get(boardsUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            page_size: 25, // Get up to 25 boards
          },
          timeout: 30000,
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        });
      } catch (baseError: any) {
        // If base endpoint fails, try the other one
        const isSandbox = PINTEREST_API_BASE === PINTEREST_API_SANDBOX;
        const fallbackUrl = isSandbox 
          ? `${PINTEREST_API_PRODUCTION}/boards`
          : `${PINTEREST_API_SANDBOX}/boards`;
        
        logger.info(
          {
            baseError: baseError?.response?.data,
            baseStatus: baseError?.response?.status,
            baseUrl: boardsUrl,
            fallbackUrl,
          },
          `Pinterest ${isSandbox ? 'sandbox' : 'production'} boards API failed, trying ${isSandbox ? 'production' : 'sandbox'}`
        );
        
        boardsUrl = fallbackUrl;
        response = await this.http.get(boardsUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            page_size: 25,
          },
          timeout: 30000,
          validateStatus: (status) => status < 500,
        });
      }

      // Check if request was successful
      if (response.status !== 200) {
        const errorData = response.data;
        const errorMsg = errorData?.message || errorData?.error || `HTTP ${response.status}`;
        
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            errorData,
            errorMsg,
            url: boardsUrl,
            apiBase: PINTEREST_API_BASE,
          },
          "Pinterest boards API returned non-200 status"
        );
        
        // If 401 or 403, don't throw - let the calling code try to create a board
        // This allows the system to attempt board creation as a fallback
        if (response.status === 401 || response.status === 403) {
          logger.warn(
            {
              status: response.status,
              errorMsg,
            },
            "Pinterest boards API auth error - will attempt to create default board"
          );
        }
        
        return undefined;
      }

      logger.info(
        {
          status: response.status,
          dataKeys: Object.keys(response.data || {}),
          responseData: response.data,
        },
        "Pinterest boards API response"
      );

      const boardsData = response.data;
      
      // Pinterest API v5 response format: { items: [...], bookmark: "..." }
      // Or sometimes just an array directly
      let boards: any[] = [];
      
      if (Array.isArray(boardsData)) {
        boards = boardsData;
      } else if (boardsData?.items && Array.isArray(boardsData.items)) {
        boards = boardsData.items;
      } else if (boardsData?.data && Array.isArray(boardsData.data)) {
        boards = boardsData.data;
      }
      
      logger.info(
        {
          boardsCount: boards.length,
          firstBoard: boards[0],
        },
        "Parsed Pinterest boards"
      );
      
      if (boards.length > 0) {
        const firstBoard = boards[0];
        const boardId = firstBoard?.id;
        
        if (boardId) {
          logger.info(
            {
              boardId,
              boardName: firstBoard?.name,
            },
            "Found Pinterest board ID"
          );
          return boardId;
        } else {
          logger.warn(
            {
              firstBoard,
              boardKeys: Object.keys(firstBoard || {}),
            },
            "Pinterest board object missing id field"
          );
        }
      } else {
        logger.warn(
          {
            boardsData,
          },
          "No Pinterest boards found in response"
        );
      }

      return undefined;
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.error_description ||
        error?.message ||
        "Unknown error";

      logger.error(
        {
          error: error?.response?.data,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: `${PINTEREST_API_BASE}/boards`,
          hasAccessToken: !!accessToken,
        },
        "Failed to fetch Pinterest boards"
      );

      // Don't throw, just return undefined so the calling code can handle it
      return undefined;
    }
  }

  /**
   * Create a default board for the user
   */
  private async createDefaultBoard(accessToken: string): Promise<string | undefined> {
    try {
      // Use the same base URL as pin creation (sandbox by default)
      let createBoardUrl = `${PINTEREST_API_BASE}/boards`;
      
      logger.info(
        {
          url: createBoardUrl,
          apiBase: PINTEREST_API_BASE,
        },
        "Creating default Pinterest board"
      );

      const boardPayload = {
        name: "All Pins", // Default board name
        description: "Default board for pins",
        privacy: "PUBLIC",
      };

      let response;
      try {
        response = await this.http.post(
          createBoardUrl,
          boardPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );
      } catch (baseError: any) {
        // If base endpoint fails, try the other one
        const isSandbox = PINTEREST_API_BASE === PINTEREST_API_SANDBOX;
        const fallbackUrl = isSandbox 
          ? `${PINTEREST_API_PRODUCTION}/boards`
          : `${PINTEREST_API_SANDBOX}/boards`;
        
        logger.info(
          {
            baseError: baseError?.response?.data,
            baseStatus: baseError?.response?.status,
            baseUrl: createBoardUrl,
            fallbackUrl,
          },
          `Pinterest ${isSandbox ? 'sandbox' : 'production'} board creation failed, trying ${isSandbox ? 'production' : 'sandbox'}`
        );
        
        createBoardUrl = fallbackUrl;
        response = await this.http.post(
          createBoardUrl,
          boardPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );
      }

      // Check if request was successful
      if (response.status === 201 || response.status === 200) {
        const boardData = response.data;
        const boardId = boardData?.id;

        if (boardId) {
          logger.info(
            {
              boardId,
              boardName: boardData?.name,
              endpoint: createBoardUrl.includes('sandbox') ? 'sandbox' : 'production',
            },
            "Default Pinterest board created successfully"
          );
          return boardId;
        } else {
          logger.error(
            {
              responseData: boardData,
              responseStatus: response.status,
              url: createBoardUrl,
              apiBase: PINTEREST_API_BASE,
            },
            "Pinterest board creation response missing id"
          );
        }
      } else {
        const errorData = response.data;
        const errorMsg = errorData?.message || errorData?.error || `HTTP ${response.status}`;
        
        logger.warn(
          {
            status: response.status,
            statusText: response.statusText,
            errorData,
            errorMsg,
            url: createBoardUrl,
            apiBase: PINTEREST_API_BASE,
          },
          "Pinterest board creation returned non-success status"
        );
      }

      return undefined;
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.error_description ||
        error?.message ||
        "Unknown error";

      logger.error(
        {
          error: error?.response?.data,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: `${PINTEREST_API_BASE}/boards`,
        },
        "Failed to create default Pinterest board"
      );

      // Don't throw, just return undefined
      return undefined;
    }
  }
}
