/**
 * Publication Worker
 *
 * BullMQ worker for processing publication jobs.
 * Handles scheduled publishing to social media platforms.
 */

import { createWorker } from "./bullmq";
import { PUBLICATION_QUEUE_NAME } from "./publication.queue";
import { PUBLICATION_QUEUE_RULES } from "@brint/shared-config/queue-rules";
import {
  PrismaClient,
  PublicationStatus,
  SocialPlatform,
  ActivityEntityType,
  ActivityActorType,
  ActivityVisibility,
  ActivitySeverity
} from "@prisma/client";
import { FacebookPublicationProvider } from "../../modules/publication/providers/facebook-publication.provider";
import { InstagramPublicationProvider } from "../../modules/publication/providers/instagram-publication.provider";
import { LinkedInPublicationProvider } from "../../modules/publication/providers/linkedin-publication.provider";
import { XPublicationProvider } from "../../modules/publication/providers/x-publication.provider";
import { TikTokPublicationProvider } from "../../modules/publication/providers/tiktok-publication.provider";
import { PinterestPublicationProvider } from "../../modules/publication/providers/pinterest-publication.provider";
import { PublicationService } from "../../modules/publication/publication.service";
import { deleteCachePattern } from "../../lib/redis.js";
import { broadcastPublicationEvent } from "../../modules/publication/publication-websocket.routes.js";
import { ensureValidFacebookToken } from "../../modules/social-account/facebook/facebook-token.service.js";
import { logger } from "../../lib/logger.js";
import { requiresMedia } from "@brint/shared-config/platform-rules";

const prisma = new PrismaClient();
const facebookProvider = new FacebookPublicationProvider();
const instagramProvider = new InstagramPublicationProvider();
const linkedinProvider = new LinkedInPublicationProvider();
const xProvider = new XPublicationProvider();
const tiktokProvider = new TikTokPublicationProvider();
const pinterestProvider = new PinterestPublicationProvider();
const publicationService = new PublicationService();

/**
 * Log publication activity to ActivityLog
 */
async function logPublicationActivity(params: {
  publication: any;
  eventKey: string;
  message?: string;
  severity?: ActivitySeverity;
  payload?: any;
}) {
  const { publication, eventKey, message, severity = ActivitySeverity.INFO, payload } = params;
  const content = publication.content;
  const brand = content.brand;

  if (!brand) {
    // Brand not found, skip logging (shouldn't happen in normal flow)
    return;
  }

  await prisma.activityLog.create({
    data: {
      workspaceId: brand.workspaceId,
      brandId: brand.id,
      entityType: ActivityEntityType.PUBLICATION,
      entityId: publication.id,
      eventKey,
      message,
      context: "publication_worker",
      actorType: ActivityActorType.WORKER,
      actorUserId: null,
      actorLabel: "Publication Worker",
      visibility: ActivityVisibility.INTERNAL,
      severity,
      payload,
    },
  });
}

// Create the worker that processes publication jobs
createWorker(
  PUBLICATION_QUEUE_NAME,
  async (job) => {
  const { publicationId } = job.data as { publicationId: string };

  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    include: {
      content: {
        include: {
          contentMedia: {
            include: { media: true },
            orderBy: { sortOrder: "asc" },
          },
          accountOptions: true, // Get all account options, filter in code
          brand: true, // Needed for ActivityLog workspaceId
        },
      },
      socialAccount: true,
    },
  });

  if (!publication || publication.deletedAt) {
    // Publication not found or deleted, nothing to do
    return;
  }

  // Safety check: if scheduled time is in the future, skip
  if (publication.scheduledAt && publication.scheduledAt > new Date()) {
    return;
  }

  // Status guard: only process PENDING or QUEUED publications
  if (publication.status !== PublicationStatus.PENDING && publication.status !== PublicationStatus.QUEUED) {
    return;
  }

  // Update status to PUBLISHING
  await prisma.publication.update({
    where: { id: publication.id },
    data: { status: PublicationStatus.PUBLISHING },
  });

  // Broadcast PUBLISHING status
  const brand = publication.content.brand;
  if (brand) {
    broadcastPublicationEvent(
      brand.workspaceId,
      {
        type: 'publication.status.changed',
        data: {
          id: publication.id,
          contentId: publication.contentId,
          status: PublicationStatus.PUBLISHING,
          platform: publication.platform,
        },
      },
      brand.id
    );
  }

  try {
    // Media should already be resolved at content level before publication creation
    // If content has useMediaLookupOnPublish enabled but no media, this is an error condition
    // that should have been caught upstream. However, we still validate here as a safety check.
    if (publication.content.useMediaLookupOnPublish && 
        publication.content.mediaLookupId && 
        (!publication.content.contentMedia || publication.content.contentMedia.length === 0)) {
      logger.error(
        { 
          publicationId: publication.id,
          contentId: publication.contentId,
          mediaLookupId: publication.content.mediaLookupId
        },
        "[PUBLICATION_WORKER] Content has useMediaLookupOnPublish enabled but no media found. This should have been resolved upstream."
      );
      
      // Fail the publication - media should have been resolved before publication creation
      throw new Error(
        `Content has media lookup enabled but no media was found. Media lookup ID: ${publication.content.mediaLookupId || 'unknown'}. Media should have been resolved before publication creation.`
      );
    }

    // Ensure access token is valid and refresh if needed (for Facebook)
    if (publication.platform === "FACEBOOK") {
      try {
        const { token, wasRefreshed } = await ensureValidFacebookToken(publication.socialAccountId);
        
        if (wasRefreshed) {
          // Update publication's social account reference with new token
          publication.socialAccount.accessToken = token;
          logger.info(
            { publicationId: publication.id, socialAccountId: publication.socialAccountId },
            "Facebook access token refreshed before publication"
          );
        } else {
          // Update token in case it was refreshed but wasn't marked as refreshed
          publication.socialAccount.accessToken = token;
        }
      } catch (tokenError: any) {
        // Don't fail publication if token refresh fails - use existing token
        // The actual API call will determine if token works
        logger.warn(
          { 
            publicationId: publication.id, 
            socialAccountId: publication.socialAccountId,
            error: tokenError.message 
          },
          "Facebook token validation/refresh failed, will attempt publication with existing token"
        );
      }
    }

    // Validate media uploads before publishing (for Facebook)
    // This is a pre-check, but if it fails we'll still attempt publication
    // (the actual publish will do the uploads anyway)
    if (publication.platform === "FACEBOOK" && publication.content.contentMedia.length > 0) {
      try {
        const { FacebookPublicationProvider } = await import("../../modules/publication/providers/facebook-publication.provider");
        await FacebookPublicationProvider.validateMediaUploads(publication as any);
        logger.info(
          { publicationId: publication.id },
          "Media upload validation successful"
        );
      } catch (validationError: any) {
        // Validation failed, but don't fail publication - let the actual publish attempt handle it
        logger.warn(
          { 
            publicationId: publication.id,
            error: validationError.message 
          },
          "Media upload validation failed, but will attempt publication anyway"
        );
      }
    }

    let result;

    switch (publication.platform as SocialPlatform) {
      case "FACEBOOK":
        result = await facebookProvider.publish(publication as any);
        break;
      case "INSTAGRAM":
        result = await instagramProvider.publish(publication as any);
        break;
      case "LINKEDIN":
        result = await linkedinProvider.publish(publication as any);
        break;
      case "X":
        result = await xProvider.publish(publication as any);
        break;
      case "TIKTOK":
        result = await tiktokProvider.publish(publication as any);
        break;
      case "PINTEREST":
        result = await pinterestProvider.publish(publication as any);
        break;
      default:
        throw new Error(`Unsupported platform: ${publication.platform}`);
    }

    // Update publication on success
    await prisma.publication.update({
      where: { id: publication.id },
      data: {
        status: PublicationStatus.SUCCESS,
        publishedAt: result.publishedAt ?? new Date(),
        platformPostId: result.platformPostId,
        payloadSnapshot: result.payloadSnapshot,
        errorCode: null,
        errorMessage: null,
      },
    });

    // Update content status based on all publications
    await publicationService.updateContentStatusFromPublications(publication.contentId);

    // Get updated content with status
    const content = await prisma.content.findUnique({
      where: { id: publication.contentId },
      select: { 
        id: true,
        status: true,
        brandId: true, 
        workspaceId: true,
        publications: {
          where: { deletedAt: null },
          select: { id: true, status: true, platform: true },
        },
      },
    });

    if (content) {
      const brand = await prisma.brand.findUnique({
        where: { id: content.brandId },
        select: { slug: true },
      });
      
      if (brand) {
        await deleteCachePattern(`contents:workspace:${content.workspaceId}:brand:${brand.slug}`);
        
        // Broadcast publication success and content status update
        if (content.workspaceId && content.brandId) {
          broadcastPublicationEvent(
            content.workspaceId,
            {
              type: 'publication.status.changed',
              data: {
                id: publication.id,
                contentId: publication.contentId,
                status: PublicationStatus.SUCCESS,
                platform: publication.platform,
                platformPostId: result.platformPostId,
              },
            },
            content.brandId
          );

          broadcastPublicationEvent(
            content.workspaceId,
            {
              type: 'content.status.changed',
              data: {
                id: content.id,
                status: content.status,
                publications: content.publications,
              },
            },
            content.brandId
          );
        }
      }
    }

    // Log successful publication
    await logPublicationActivity({
      publication,
      eventKey: `publication.${publication.platform.toLowerCase()}_published`,
      message: `Publication published successfully on ${publication.platform}`,
      payload: {
        platform: publication.platform,
        platformPostId: result.platformPostId,
      },
    });

  } catch (err: any) {
    // Extract detailed error information from Facebook Graph API response
    // Error can come in different formats from provider
    let fbError = err?.fbError || err?.response?.data?.error;
    
    // If no fbError, try to extract from response data
    if (!fbError && err?.response?.data) {
      if (err.response.data.error) {
        fbError = err.response.data.error;
      } else if (err.response.data.error_code || err.response.data.error_message) {
        fbError = {
          code: err.response.data.error_code,
          message: err.response.data.error_message,
          type: err.response.data.error_type,
          error_subcode: err.response.data.error_subcode,
        };
      }
    }
    
    const errorCode = fbError?.code?.toString() ?? err?.code?.toString() ?? err?.response?.data?.error_code?.toString() ?? null;
    const errorMessage = fbError?.message || err?.message || err?.response?.data?.error_message || "Unknown error";
    const errorType = fbError?.type || err?.type || err?.response?.data?.error_type || null;
    const errorSubcode = fbError?.error_subcode?.toString() ?? err?.response?.data?.error_subcode?.toString() ?? null;
    
    // Get error context if available (from provider)
    const errorContext = err?.context || {};
    
    // Build detailed error payload
    const errorPayload = {
      platform: publication.platform,
      errorCode,
      errorType,
      errorSubcode,
      errorMessage,
      errorContext,
      fullError: fbError || {
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      },
      requestUrl: err?.config?.url || err?.request?.url,
      requestMethod: err?.config?.method || err?.request?.method,
      responseStatus: err?.response?.status,
      responseData: err?.response?.data,
      publicationDetails: {
        contentId: publication.contentId,
        socialAccountId: publication.socialAccountId,
        pageId: publication.socialAccount?.platformAccountId,
        formFactor: publication.content?.formFactor,
        mediaCount: publication.content?.contentMedia?.length || 0,
      },
    };

    // Update publication on failure with detailed error info
    await prisma.publication.update({
      where: { id: publication.id },
      data: {
        status: PublicationStatus.FAILED,
        errorCode,
        errorMessage: errorMessage.length > 500 ? errorMessage.substring(0, 500) : errorMessage, // Truncate if too long
        payloadSnapshot: {
          error: errorPayload,
          attemptedAt: new Date(),
        },
      },
    });

    // Update content status based on all publications
    await publicationService.updateContentStatusFromPublications(publication.contentId);

    // Get updated content with status and publications
    const updatedContentFailed = await prisma.content.findUnique({
      where: { id: publication.contentId },
      include: {
        publications: {
          where: { deletedAt: null },
          select: { id: true, status: true, platform: true },
        },
      },
    });
    
    if (updatedContentFailed) {
      const brand = publication.content.brand;
      if (brand) {
        // Get brand slug for cache key
        const brandWithSlug = await prisma.brand.findUnique({
          where: { id: brand.id },
          select: { slug: true },
        });
        
        if (brandWithSlug) {
          await deleteCachePattern(`contents:workspace:${brand.workspaceId}:brand:${brandWithSlug.slug}`);
        }
        
        // Broadcast publication failure and content status update
        broadcastPublicationEvent(
          brand.workspaceId,
          {
            type: 'publication.status.changed',
            data: {
              id: publication.id,
              contentId: publication.contentId,
              status: PublicationStatus.FAILED,
              platform: publication.platform,
              errorCode,
              errorMessage,
            },
          },
          brand.id
        );

        broadcastPublicationEvent(
          brand.workspaceId,
          {
            type: 'content.status.changed',
            data: {
              id: updatedContentFailed.id,
              status: updatedContentFailed.status,
              publications: updatedContentFailed.publications,
            },
          },
          brand.id
        );
      }
    }

    // Log failed publication with detailed payload
    await logPublicationActivity({
      publication,
      eventKey: `publication.${publication.platform.toLowerCase()}_failed`,
      message: errorMessage,
      severity: ActivitySeverity.ERROR,
      payload: errorPayload,
    });

    // Re-throw error for BullMQ retry/backoff
    throw err;
  }
  },
  {
    concurrency: PUBLICATION_QUEUE_RULES.concurrency,
  }
);