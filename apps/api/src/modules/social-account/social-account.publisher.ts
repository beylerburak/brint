/**
 * Social Account Publisher
 * 
 * Utility service for publishing content to social platforms.
 * Uses SocialAccount as the single source of truth for credentials.
 * 
 * This is a foundation/stub that can be expanded when implementing
 * actual platform integrations.
 */

import { logger } from '../../lib/logger.js';
import {
  getActiveAccountsForBrand,
  getByPlatformAccount,
  markAsExpired,
  updateTokens,
  type SocialAccountWithTokens,
} from './social-account.service.js';
import type { SocialPlatform } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export type PublishContent = {
  type: 'image' | 'video' | 'text' | 'carousel' | 'story' | 'reel';
  caption?: string;
  mediaUrls?: string[];
  link?: string;
  hashtags?: string[];
  scheduledAt?: Date;
  // Platform-specific options
  platformOptions?: Record<string, unknown>;
};

export type PublishResult = {
  success: boolean;
  platform: SocialPlatform;
  platformAccountId: string;
  platformPostId?: string;
  platformUrl?: string;
  error?: {
    code: string;
    message: string;
    isTokenError: boolean;
  };
};

// ============================================================================
// Token Error Detection
// ============================================================================

/**
 * Check if an error indicates an expired or invalid token
 */
function isTokenError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const tokenErrorPatterns = [
      'token expired',
      'token invalid',
      'access token',
      'oauth',
      'unauthorized',
      'authentication',
      '401',
      '403',
      'invalid_token',
      'expired_token',
      'session expired',
    ];
    
    return tokenErrorPatterns.some(pattern => message.includes(pattern));
  }
  
  // Check HTTP status codes
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (obj.status === 401 || obj.status === 403) {
      return true;
    }
    if (obj.statusCode === 401 || obj.statusCode === 403) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Platform-specific Publishers (Stubs)
// ============================================================================

/**
 * Instagram Publisher (Meta Graph API)
 */
async function publishToInstagram(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'INSTAGRAM', contentType: content.type },
    'Publishing to Instagram via Graph API'
  );

  try {
    const { graphRequest, graphPost } = await import('./facebook/facebook-client.js');
    const tokenData = account.tokenData as { pageId?: string } | undefined;
    const pageId = tokenData?.pageId;

    if (!pageId) {
      return {
        success: false,
        platform: 'INSTAGRAM',
        platformAccountId: account.platformAccountId,
        error: {
          code: 'MISSING_PAGE_ID',
          message: 'Page ID not found in token data. Please reconnect your Instagram account.',
          isTokenError: false,
        },
      };
    }

    // Instagram requires page token, not user token
    const pageAccessToken = account.accessToken;
    const igAccountId = account.platformAccountId;

    // For image posts
    if (content.type === 'image' && content.mediaUrls && content.mediaUrls.length > 0) {
      // Step 1: Create media container (POST request)
      const mediaResponse = await graphPost<{ id: string }>(
        `/${igAccountId}/media`,
        pageAccessToken,
        {
          image_url: content.mediaUrls[0],
          caption: content.caption || '',
        }
      );

      const creationId = mediaResponse.id;

      // Step 2: Publish the media container (POST request)
      const publishResponse = await graphPost<{ id: string }>(
        `/${igAccountId}/media_publish`,
        pageAccessToken,
        {
          creation_id: creationId,
        }
      );

      return {
        success: true,
        platform: 'INSTAGRAM',
        platformAccountId: account.platformAccountId,
        platformPostId: publishResponse.id,
        platformUrl: `https://instagram.com/p/${publishResponse.id}`,
      };
    }

    // For other content types (video, carousel, etc.)
    // TODO: Implement video, carousel, reel publishing
    return {
      success: false,
      platform: 'INSTAGRAM',
      platformAccountId: account.platformAccountId,
      error: {
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: `Content type ${content.type} is not yet supported for Instagram`,
        isTokenError: false,
      },
    };
  } catch (error: any) {
    logger.error({ error, accountId: account.id }, 'Instagram publish failed');
    
    // Check for token errors
    const errorMessage = error?.response?.data?.error?.message || error?.message || 'Unknown error';
    const errorCode = error?.response?.data?.error?.code || 'PUBLISH_FAILED';
    const isTokenErr = isTokenError(error) || errorCode === 190 || errorCode === 200; // Facebook token error codes

    return {
      success: false,
      platform: 'INSTAGRAM',
      platformAccountId: account.platformAccountId,
      error: {
        code: String(errorCode),
        message: errorMessage,
        isTokenError: isTokenErr,
      },
    };
  }
}

/**
 * Facebook Publisher (Meta Graph API)
 */
async function publishToFacebook(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'FACEBOOK', contentType: content.type },
    'Publishing to Facebook via Graph API'
  );

  try {
    const { graphPost } = await import('./facebook/facebook-client.js');
    const pageId = account.platformAccountId;
    const pageAccessToken = account.accessToken;

    // For photo posts
    if (content.type === 'image' && content.mediaUrls && content.mediaUrls.length > 0) {
      // Facebook Page photo upload (POST request)
      const photoResponse = await graphPost<{ id: string; post_id?: string }>(
        `/${pageId}/photos`,
        pageAccessToken,
        {
          url: content.mediaUrls[0],
          message: content.caption || '',
          published: true,
        }
      );

      const postId = photoResponse.post_id || photoResponse.id;

      return {
        success: true,
        platform: 'FACEBOOK',
        platformAccountId: account.platformAccountId,
        platformPostId: postId,
        platformUrl: `https://facebook.com/${postId}`,
      };
    }

    // For text-only posts or link posts
    if (content.type === 'text' || (content.type === 'text' && content.link)) {
      const postParams: Record<string, any> = {
        message: content.caption || '',
      };

      // Add link if provided
      if (content.link) {
        postParams.link = content.link;
      }

      const postResponse = await graphPost<{ id: string }>(
        `/${pageId}/feed`,
        pageAccessToken,
        postParams
      );

      return {
        success: true,
        platform: 'FACEBOOK',
        platformAccountId: account.platformAccountId,
        platformPostId: postResponse.id,
        platformUrl: `https://facebook.com/${postResponse.id}`,
      };
    }

    // For other content types
    return {
      success: false,
      platform: 'FACEBOOK',
      platformAccountId: account.platformAccountId,
      error: {
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: `Content type ${content.type} is not yet supported for Facebook`,
        isTokenError: false,
      },
    };
  } catch (error: any) {
    logger.error({ error, accountId: account.id }, 'Facebook publish failed');
    
    // Check for token errors
    const errorMessage = error?.response?.data?.error?.message || error?.message || 'Unknown error';
    const errorCode = error?.response?.data?.error?.code || 'PUBLISH_FAILED';
    const isTokenErr = isTokenError(error) || errorCode === 190 || errorCode === 200; // Facebook token error codes

    return {
      success: false,
      platform: 'FACEBOOK',
      platformAccountId: account.platformAccountId,
      error: {
        code: String(errorCode),
        message: errorMessage,
        isTokenError: isTokenErr,
      },
    };
  }
}

/**
 * TikTok Publisher
 */
async function publishToTiktok(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'TIKTOK' },
    'Publishing to TikTok (stub)'
  );

  // TODO: Implement actual TikTok API integration
  
  return {
    success: true,
    platform: 'TIKTOK',
    platformAccountId: account.platformAccountId,
    platformPostId: `tt_${Date.now()}`,
    platformUrl: `https://tiktok.com/@user/video/stub_${Date.now()}`,
  };
}

/**
 * LinkedIn Publisher
 */
async function publishToLinkedIn(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'LINKEDIN' },
    'Publishing to LinkedIn (stub)'
  );

  // TODO: Implement actual LinkedIn Share API integration
  
  return {
    success: true,
    platform: 'LINKEDIN',
    platformAccountId: account.platformAccountId,
    platformPostId: `li_${Date.now()}`,
    platformUrl: `https://linkedin.com/posts/stub_${Date.now()}`,
  };
}

/**
 * X (Twitter) Publisher
 */
async function publishToX(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'X' },
    'Publishing to X (stub)'
  );

  // TODO: Implement actual X API v2 integration
  
  return {
    success: true,
    platform: 'X',
    platformAccountId: account.platformAccountId,
    platformPostId: `x_${Date.now()}`,
    platformUrl: `https://x.com/user/status/stub_${Date.now()}`,
  };
}

/**
 * YouTube Publisher
 */
async function publishToYouTube(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'YOUTUBE' },
    'Publishing to YouTube (stub)'
  );

  // TODO: Implement actual YouTube Data API integration
  
  return {
    success: true,
    platform: 'YOUTUBE',
    platformAccountId: account.platformAccountId,
    platformPostId: `yt_${Date.now()}`,
    platformUrl: `https://youtube.com/watch?v=stub_${Date.now()}`,
  };
}

/**
 * WhatsApp Publisher (for Business API)
 */
async function publishToWhatsApp(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'WHATSAPP' },
    'Publishing to WhatsApp (stub)'
  );

  // TODO: Implement actual WhatsApp Business API integration
  // Note: WhatsApp is typically for messaging, not content publishing
  
  return {
    success: true,
    platform: 'WHATSAPP',
    platformAccountId: account.platformAccountId,
    platformPostId: `wa_${Date.now()}`,
  };
}

/**
 * Pinterest Publisher
 */
async function publishToPinterest(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: 'PINTEREST' },
    'Publishing to Pinterest (stub)'
  );

  // TODO: Implement actual Pinterest API integration
  
  return {
    success: true,
    platform: 'PINTEREST',
    platformAccountId: account.platformAccountId,
    platformPostId: `pin_${Date.now()}`,
    platformUrl: `https://pinterest.com/pin/stub_${Date.now()}`,
  };
}

// ============================================================================
// Main Publisher Functions
// ============================================================================

/**
 * Platform publisher router
 */
async function publishToPlatform(
  account: SocialAccountWithTokens,
  content: PublishContent
): Promise<PublishResult> {
  switch (account.platform) {
    case 'INSTAGRAM':
      return publishToInstagram(account, content);
    case 'FACEBOOK':
      return publishToFacebook(account, content);
    case 'TIKTOK':
      return publishToTiktok(account, content);
    case 'LINKEDIN':
      return publishToLinkedIn(account, content);
    case 'X':
      return publishToX(account, content);
    case 'YOUTUBE':
      return publishToYouTube(account, content);
    case 'WHATSAPP':
      return publishToWhatsApp(account, content);
    case 'PINTEREST':
      return publishToPinterest(account, content);
    default:
      return {
        success: false,
        platform: account.platform,
        platformAccountId: account.platformAccountId,
        error: {
          code: 'UNSUPPORTED_PLATFORM',
          message: `Platform ${account.platform} is not supported`,
          isTokenError: false,
        },
      };
  }
}

/**
 * Publish content to a specific social account
 * Handles token errors by marking account as expired
 */
export async function publishToAccount(
  account: SocialAccountWithTokens,
  content: PublishContent,
  workspaceId: string
): Promise<PublishResult> {
  logger.info(
    { accountId: account.id, platform: account.platform },
    'Publishing content to social account'
  );

  try {
    const result = await publishToPlatform(account, content);
    
    if (!result.success && result.error?.isTokenError) {
      // Mark account as expired
      await markAsExpired(
        account.id,
        workspaceId,
        result.error.code,
        result.error.message
      );
      
      logger.warn(
        { accountId: account.id, platform: account.platform, error: result.error },
        'Social account marked as expired due to token error'
      );
    }

    return result;
  } catch (error) {
    const tokenError = isTokenError(error);
    
    if (tokenError) {
      // Mark account as expired
      await markAsExpired(
        account.id,
        workspaceId,
        'TOKEN_ERROR',
        error instanceof Error ? error.message : 'Token error occurred'
      );
      
      logger.warn(
        { accountId: account.id, platform: account.platform, error },
        'Social account marked as expired due to caught token error'
      );
    }

    logger.error(
      { accountId: account.id, platform: account.platform, error },
      'Failed to publish content'
    );

    return {
      success: false,
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      error: {
        code: tokenError ? 'TOKEN_ERROR' : 'PUBLISH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        isTokenError: tokenError,
      },
    };
  }
}

/**
 * Publish content to all active accounts for a brand
 * Returns results for each account
 */
export async function publishToAllBrandAccounts(
  brandId: string,
  workspaceId: string,
  content: PublishContent,
  options?: {
    platforms?: SocialPlatform[];
  }
): Promise<PublishResult[]> {
  logger.info(
    { brandId, platforms: options?.platforms },
    'Publishing content to all brand accounts'
  );

  // Get all active accounts
  let accounts = await getActiveAccountsForBrand(brandId);

  // Filter by platform if specified
  if (options?.platforms && options.platforms.length > 0) {
    accounts = accounts.filter(a => options.platforms!.includes(a.platform));
  }

  if (accounts.length === 0) {
    logger.warn({ brandId }, 'No active social accounts found for brand');
    return [];
  }

  // Publish to each account in parallel
  const results = await Promise.all(
    accounts.map(account => publishToAccount(account, content, workspaceId))
  );

  // Log summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const tokenErrors = results.filter(r => r.error?.isTokenError).length;

  logger.info(
    { brandId, total: accounts.length, successful, failed, tokenErrors },
    'Finished publishing to brand accounts'
  );

  return results;
}

/**
 * Publish content to a specific platform account for a brand
 */
export async function publishToBrandPlatformAccount(
  brandId: string,
  platform: SocialPlatform,
  platformAccountId: string,
  workspaceId: string,
  content: PublishContent
): Promise<PublishResult> {
  logger.info(
    { brandId, platform, platformAccountId },
    'Publishing to specific brand platform account'
  );

  const account = await getByPlatformAccount(brandId, platform, platformAccountId);

  if (!account) {
    return {
      success: false,
      platform,
      platformAccountId,
      error: {
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Social account not found',
        isTokenError: false,
      },
    };
  }

  if (account.status !== 'ACTIVE') {
    return {
      success: false,
      platform,
      platformAccountId,
      error: {
        code: 'ACCOUNT_INACTIVE',
        message: `Social account is ${account.status}. Please reconnect.`,
        isTokenError: account.status === 'EXPIRED',
      },
    };
  }

  if (!account.canPublish) {
    return {
      success: false,
      platform,
      platformAccountId,
      error: {
        code: 'PUBLISH_DISABLED',
        message: 'Publishing is disabled for this account',
        isTokenError: false,
      },
    };
  }

  return publishToAccount(account, content, workspaceId);
}
