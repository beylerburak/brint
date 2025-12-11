/**
 * Publication Service
 *
 * Handles synchronization between Content and Publication records.
 * Creates Publication records when Content is scheduled for publishing.
 */

import { PrismaClient, ContentStatus, PublicationStatus } from "@prisma/client";
import { enqueuePublicationJob, removePublicationJob } from "../../core/queue/publication.queue";

const prisma = new PrismaClient();

export class PublicationService {
  /**
   * Synchronize publications for a specific content.
   *
   * Creates Publication records for each ContentAccount if they don't exist.
   * Only processes content that has a scheduledAt date (SCHEDULED/PUBLISHED flow).
   *
   * @param contentId - ID of the content to sync publications for
   */
  async syncPublicationsForContent(contentId: string): Promise<void> {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        contentAccounts: {
          where: { deletedAt: null },
        },
        publications: {
          where: { deletedAt: null },
        },
      },
    });

    if (!content) {
      throw new Error("Content not found");
    }

    // Only create publications for content that has been scheduled
    if (!content.scheduledAt) {
      return;
    }

    // Map existing publications by socialAccountId for quick lookup
    const existingByAccount = new Map(
      content.publications.map((p) => [p.socialAccountId, p])
    );

    // 1) Reschedule existing publications if scheduledAt changed
    for (const pub of content.publications) {
      if (pub.scheduledAt.getTime() !== content.scheduledAt.getTime()) {
        // Remove old job
        await removePublicationJob(pub.id);

        // Update publication scheduledAt and reset status to PENDING
        await prisma.publication.update({
          where: { id: pub.id },
          data: {
            scheduledAt: content.scheduledAt,
            status: PublicationStatus.PENDING,
          },
        });

        // Enqueue new job with updated scheduled time
        await enqueuePublicationJob(pub.id, content.scheduledAt);
      }
    }

    // 2) Create publications for any missing accounts
    for (const contentAccount of content.contentAccounts) {
      if (existingByAccount.has(contentAccount.socialAccountId)) {
        continue; // Already exists
      }

      // Get social account to extract platform
      const socialAccount = await prisma.socialAccount.findUnique({
        where: { id: contentAccount.socialAccountId },
      });

      if (!socialAccount) {
        continue; // Skip if social account doesn't exist
      }

      const publication = await prisma.publication.create({
        data: {
          contentId: content.id,
          socialAccountId: contentAccount.socialAccountId,
          platform: socialAccount.platform,
          status: PublicationStatus.PENDING,
          scheduledAt: content.scheduledAt,
        },
      });

      // Enqueue the publication job
      await enqueuePublicationJob(publication.id, publication.scheduledAt);
    }

    // Update content status to SCHEDULED if scheduledAt is in the future
    if (content.scheduledAt && content.scheduledAt > new Date()) {
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.SCHEDULED },
      });
    }
  }

  /**
   * Publish a publication immediately (bypass scheduling)
   *
   * @param publicationId - ID of the publication to publish now
   */
  async publishNow(publicationId: string): Promise<void> {
    const publication = await prisma.publication.findUnique({
      where: { id: publicationId },
    });

    if (!publication || publication.deletedAt) {
      throw new Error("Publication not found");
    }

    if (
      publication.status !== PublicationStatus.PENDING &&
      publication.status !== PublicationStatus.FAILED &&
      publication.status !== PublicationStatus.SKIPPED
    ) {
      throw new Error(`Publication cannot be published in status ${publication.status}`);
    }

    const now = new Date();

    await prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: PublicationStatus.QUEUED,
        scheduledAt: now, // publish now = immediately
      },
    });

    await enqueuePublicationJob(publicationId, now);
  }

  /**
   * Update content status based on its publications' statuses
   *
   * Logic:
   * - All publications SUCCESS -> PUBLISHED
   * - Some SUCCESS, some failed/pending/queued/publishing -> PARTIALLY_PUBLISHED
   * - All publications FAILED -> FAILED
   * - No publications or all pending/queued/publishing -> SCHEDULED (if scheduled) or keep current status
   *
   * @param contentId - ID of the content to update status for
   */
  async updateContentStatusFromPublications(contentId: string): Promise<void> {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        publications: {
          where: { deletedAt: null },
        },
      },
    });

    if (!content) {
      throw new Error("Content not found");
    }

    // If no publications, don't change status (could be DRAFT or manually set)
    if (content.publications.length === 0) {
      return;
    }

    const publications = content.publications;
    const successCount = publications.filter((p) => p.status === PublicationStatus.SUCCESS).length;
    const failedCount = publications.filter((p) => p.status === PublicationStatus.FAILED).length;
    const pendingCount = publications.filter(
      (p) =>
        p.status === PublicationStatus.PENDING ||
        p.status === PublicationStatus.QUEUED ||
        p.status === PublicationStatus.PUBLISHING
    ).length;
    const skippedCount = publications.filter((p) => p.status === PublicationStatus.SKIPPED).length;

    const totalActive = publications.length - skippedCount;
    
    // Determine new status
    let newStatus: ContentStatus | null = null;

    if (totalActive === 0) {
      // All publications skipped, keep current status
      return;
    }

    if (successCount === totalActive) {
      // All active publications succeeded
      newStatus = ContentStatus.PUBLISHED;
    } else if (failedCount === totalActive) {
      // All active publications failed
      newStatus = ContentStatus.FAILED;
    } else if (successCount > 0 && (failedCount > 0 || pendingCount > 0)) {
      // Some succeeded, some failed or pending
      newStatus = ContentStatus.PARTIALLY_PUBLISHED;
    } else if (pendingCount === totalActive) {
      // All are pending/queued/publishing
      // Only update if currently DRAFT (to set to SCHEDULED)
      if (content.status === ContentStatus.DRAFT && content.scheduledAt) {
        newStatus = ContentStatus.SCHEDULED;
      } else {
        // Keep current status (likely already SCHEDULED)
        return;
      }
    }

    // Only update if status changed
    if (newStatus && newStatus !== content.status) {
      await prisma.content.update({
        where: { id: contentId },
        data: { status: newStatus },
      });
    }
  }

  /**
   * Recalculate and update content status for all contents with publications
   * Useful for fixing inconsistencies or after migrations
   *
   * @param workspaceId - Optional workspace ID to filter contents
   * @returns Number of contents updated
   */
  async recalculateAllContentStatuses(workspaceId?: string): Promise<number> {
    const whereClause: any = {
      deletedAt: null,
      publications: {
        some: {
          deletedAt: null,
        },
      },
    };

    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }

    const contents = await prisma.content.findMany({
      where: whereClause,
      select: { id: true },
    });

    let updatedCount = 0;
    for (const content of contents) {
      try {
        const beforeStatus = (await prisma.content.findUnique({
          where: { id: content.id },
          select: { status: true },
        }))?.status;

        await this.updateContentStatusFromPublications(content.id);

        const afterStatus = (await prisma.content.findUnique({
          where: { id: content.id },
          select: { status: true },
        }))?.status;

        if (beforeStatus !== afterStatus) {
          updatedCount++;
        }
      } catch (error) {
        console.error(`Failed to update content ${content.id}:`, error);
      }
    }

    return updatedCount;
  }
}