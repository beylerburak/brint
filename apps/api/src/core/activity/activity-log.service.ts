/**
 * Activity Log Service
 * 
 * Central service for writing activity logs across the application.
 * 
 * Features:
 * - Single source of truth for all activity logging
 * - Error handling with swallowErrors option
 * - Default values for visibility and severity
 * - Domain-specific helper functions
 * 
 * Usage:
 * ```typescript
 * await logActivity({
 *   workspaceId,
 *   brandId,
 *   entityType: ActivityEntityType.BRAND,
 *   entityId: brandId,
 *   eventKey: "brand.created",
 *   message: "Brand 'Nike' created",
 *   actorType: ActivityActorType.USER,
 *   actorUserId: userId,
 * });
 * ```
 */

import { ActivitySeverity, ActivityVisibility, ActivityEntityType, ActivityActorType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import type { LogActivityInput, LogActivityOptions } from './activity-log.types.js';

/**
 * Write an activity log entry
 * 
 * @param input - Activity log data
 * @param options - Options (swallowErrors)
 * @returns Created ActivityLog or null if swallowed
 */
export async function logActivity(
  input: LogActivityInput,
  options: LogActivityOptions = {}
) {
  const { swallowErrors = true } = options;

  const {
    visibility = ActivityVisibility.INTERNAL,
    severity = ActivitySeverity.INFO,
    ...rest
  } = input;

  try {
    return await prisma.activityLog.create({
      data: {
        ...rest,
        visibility,
        severity,
        payload: rest.payload as any, // Prisma Json type
      },
    });
  } catch (error) {
    if (!swallowErrors) {
      throw error;
    }

    // Activity log yazılamazsa ana iş akışını bozmamak için swallow ediyoruz
    logger.error(
      {
        error,
        eventKey: input.eventKey,
        entityType: input.entityType,
        entityId: input.entityId,
      },
      'Failed to write activity log'
    );

    return null;
  }
}

/**
 * Helper: Build brand activity log input
 * 
 * Pre-fills entityType as BRAND
 */
export function buildBrandActivity(
  input: Omit<LogActivityInput, 'entityType'>
): LogActivityInput {
  return {
    ...input,
    entityType: ActivityEntityType.BRAND,
  };
}

/**
 * Helper: Build content activity log input
 * 
 * Pre-fills entityType as CONTENT
 */
export function buildContentActivity(
  input: Omit<LogActivityInput, 'entityType'>
): LogActivityInput {
  return {
    ...input,
    entityType: ActivityEntityType.CONTENT,
  };
}

/**
 * Helper: Build publication activity log input
 * 
 * Pre-fills entityType as PUBLICATION
 */
export function buildPublicationActivity(
  input: Omit<LogActivityInput, 'entityType'>
): LogActivityInput {
  return {
    ...input,
    entityType: ActivityEntityType.PUBLICATION,
  };
}

/**
 * Helper: Build media activity log input
 * 
 * Pre-fills entityType as MEDIA
 */
export function buildMediaActivity(
  input: Omit<LogActivityInput, 'entityType'>
): LogActivityInput {
  return {
    ...input,
    entityType: ActivityEntityType.MEDIA,
  };
}

/**
 * Helper: Build workspace activity log input
 * 
 * Pre-fills entityType as WORKSPACE
 */
export function buildWorkspaceActivity(
  input: Omit<LogActivityInput, 'entityType'>
): LogActivityInput {
  return {
    ...input,
    entityType: ActivityEntityType.WORKSPACE,
  };
}

/**
 * Helper: Build user activity log input
 * 
 * Pre-fills entityType as USER
 */
export function buildUserActivity(
  input: Omit<LogActivityInput, 'entityType'>
): LogActivityInput {
  return {
    ...input,
    entityType: ActivityEntityType.USER,
  };
}

/**
 * Usage examples:
 *
 * // Brand created (with helper)
 * await logActivity(
 *   buildBrandActivity({
 *     workspaceId,
 *     brandId,
 *     entityId: brandId,
 *     eventKey: "brand.created",
 *     message: `Brand created: ${name}`,
 *     actorType: ActivityActorType.USER,
 *     actorUserId: currentUserId,
 *     payload: { name, slug, industry },
 *   })
 * );
 *
 * // Brand updated
 * await logActivity(
 *   buildBrandActivity({
 *     workspaceId,
 *     brandId,
 *     entityId: brandId,
 *     eventKey: "brand.updated",
 *     message: `Brand profile updated`,
 *     actorType: ActivityActorType.USER,
 *     actorUserId: currentUserId,
 *     context: "brand_profile",
 *     payload: { changes: diff },
 *   })
 * );
 *
 * // Content scheduled (system)
 * await logActivity({
 *   workspaceId,
 *   brandId,
 *   entityType: ActivityEntityType.CONTENT,
 *   entityId: contentId,
 *   eventKey: "content.scheduled",
 *   message: "Content scheduled for publication",
 *   actorType: ActivityActorType.SYSTEM,
 *   actorLabel: "Scheduler",
 *   context: "scheduler",
 *   payload: { scheduledAt, platforms },
 * });
 *
 * // Publication failed (worker)
 * await logActivity({
 *   workspaceId,
 *   brandId,
 *   entityType: ActivityEntityType.PUBLICATION,
 *   entityId: publicationId,
 *   eventKey: "publication.failed",
 *   message: `Publication failed for ${platform}`,
 *   actorType: ActivityActorType.WORKER,
 *   actorLabel: "Instagram Worker",
 *   context: "publication_worker",
 *   severity: ActivitySeverity.ERROR,
 *   payload: { platform, errorCode, errorMessage },
 * });
 *
 * // Integration event
 * await logActivity({
 *   workspaceId,
 *   brandId,
 *   entityType: ActivityEntityType.SOCIAL_ACCOUNT,
 *   entityId: accountId,
 *   eventKey: "social_account.token_refreshed",
 *   message: "Access token refreshed successfully",
 *   actorType: ActivityActorType.INTEGRATION,
 *   actorLabel: "Meta API",
 *   context: "oauth_refresh",
 *   payload: { expiresAt },
 * });
 */

