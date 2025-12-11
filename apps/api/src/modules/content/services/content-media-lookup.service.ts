/**
 * Content Media Lookup Service
 * 
 * Handles media lookup and import from Google Drive for content that uses mediaLookupId.
 * This service ensures media is resolved at content level (not publication level) to prevent duplicates.
 */

import { PrismaClient } from "@prisma/client";
import { GoogleDriveIntegrationService } from "../../integration/google-drive/google-drive.service.js";
import { logger } from "../../../lib/logger.js";

const prisma = new PrismaClient();

export class ContentMediaLookupService {
  /**
   * Resolve media for content from Google Drive if needed.
   * 
   * This function:
   * 1. Checks if useMediaLookupOnPublish is enabled and mediaLookupId exists
   * 2. Checks if content already has media
   * 3. If conditions are met, searches Google Drive and imports media
   * 4. Links imported media to content with proper sort order
   * 
   * @param contentId - ID of the content to resolve media for
   * @throws Error if media lookup is required but fails
   */
  async resolveMediaForContentIfNeeded(contentId: string): Promise<void> {
    // Fetch content with related data
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        contentMedia: {
          include: {
            media: {
              select: {
                id: true,
                description: true,
              }
            }
          }
        },
        brand: {
          select: {
            workspaceId: true,
          }
        }
      }
    });

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Early return if media lookup is not needed
    if (!content.useMediaLookupOnPublish || !content.mediaLookupId) {
      logger.debug(
        { contentId },
        "[CONTENT_MEDIA_LOOKUP] Media lookup not enabled or mediaLookupId missing, skipping"
      );
      return;
    }

    // Early return if content already has media
    if (content.contentMedia && content.contentMedia.length > 0) {
      logger.debug(
        { 
          contentId,
          existingMediaCount: content.contentMedia.length
        },
        "[CONTENT_MEDIA_LOOKUP] Content already has media, skipping lookup"
      );
      return;
    }

    // Media lookup is needed
    const workspaceId = content.brand?.workspaceId;
    if (!workspaceId) {
      throw new Error(`Workspace ID not found for content: ${contentId}`);
    }

    logger.info(
      { 
        contentId,
        mediaLookupId: content.mediaLookupId,
        workspaceId
      },
      "[CONTENT_MEDIA_LOOKUP] Starting media lookup from Google Drive"
    );

    // Get workspace owner user ID for media import
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerUserId: true }
    });

    if (!workspace?.ownerUserId) {
      throw new Error(`Workspace owner not found for workspace: ${workspaceId}`);
    }

    const userId = workspace.ownerUserId;
    const driveService = new GoogleDriveIntegrationService();

    // Search for files matching the media lookup ID
    const searchResults = await driveService.listFiles(
      { workspaceId, userId },
      { 
        query: content.mediaLookupId,
        pageSize: 100
      }
    );

    logger.info(
      { 
        contentId,
        foundFilesCount: searchResults.files?.length || 0,
        fileNames: searchResults.files?.slice(0, 5).map((f: any) => f.name) || []
      },
      "[CONTENT_MEDIA_LOOKUP] Google Drive search results"
    );

    if (!searchResults.files || searchResults.files.length === 0) {
      throw new Error(
        `No media files found in Google Drive for media lookup ID: ${content.mediaLookupId}`
      );
    }

    // Sort files by name (ascending) to ensure correct order (1, 2, 3...)
    const sortedFiles = [...searchResults.files].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    logger.info(
      { 
        contentId,
        sortedFileNames: sortedFiles.slice(0, 10).map((f: any) => f.name)
      },
      "[CONTENT_MEDIA_LOOKUP] Files sorted by name"
    );

    // Filter out duplicates by file ID first
    const seenFileIds = new Set<string>();
    const filesWithoutDuplicateIds = sortedFiles.filter(file => {
      if (seenFileIds.has(file.id)) {
        logger.warn(
          { 
            contentId,
            fileId: file.id,
            fileName: file.name
          },
          "[CONTENT_MEDIA_LOOKUP] Duplicate file ID in search results, filtering out"
        );
        return false;
      }
      seenFileIds.add(file.id);
      return true;
    });

    // Filter out duplicates by file name (case-insensitive)
    // Only keep the first occurrence of each unique filename
    const seenFileNames = new Set<string>();
    const uniqueFiles = filesWithoutDuplicateIds.filter(file => {
      const normalizedName = (file.name || '').toLowerCase().trim();
      if (seenFileNames.has(normalizedName)) {
        logger.warn(
          { 
            contentId,
            fileId: file.id,
            fileName: file.name,
            normalizedName: normalizedName
          },
          "[CONTENT_MEDIA_LOOKUP] Duplicate file name found, keeping only first occurrence"
        );
        return false;
      }
      seenFileNames.add(normalizedName);
      return true;
    }).slice(0, 10);

    logger.info(
      { 
        contentId,
        uniqueFilesCount: uniqueFiles.length,
        uniqueFileNames: uniqueFiles.map((f: any) => f.name),
        totalFilesBeforeFiltering: filesWithoutDuplicateIds.length,
        duplicateNamesRemoved: filesWithoutDuplicateIds.length - uniqueFiles.length
      },
      "[CONTENT_MEDIA_LOOKUP] Unique files after filtering (by ID and name)"
    );

    if (uniqueFiles.length === 0) {
      throw new Error(
        `No unique media files found in Google Drive for media lookup ID: ${content.mediaLookupId}`
      );
    }

    // Check for already imported media by parsing description
    // Format: "Imported from Google Drive (${fileId})"
    const existingMediaByDriveFileId = new Map<string, string>();
    for (const cm of content.contentMedia) {
      if (cm.media?.description) {
        const match = cm.media.description.match(/Imported from Google Drive \(([^)]+)\)/);
        if (match && match[1]) {
          existingMediaByDriveFileId.set(match[1], cm.media.id);
        }
      }
    }

    logger.info(
      { 
        contentId,
        existingMediaByDriveFileIdCount: existingMediaByDriveFileId.size
      },
      "[CONTENT_MEDIA_LOOKUP] Existing media mapped by Drive file ID"
    );

    // Import files in sorted order using transaction
    const importedMediaIds: string[] = [];
    const importedFileIds = new Set<string>();
    const skippedFileIds = new Set<string>();

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < uniqueFiles.length; index++) {
        const file = uniqueFiles[index];
        
        logger.info(
          { 
            contentId,
            index: index + 1,
            totalFiles: uniqueFiles.length,
            fileId: file.id,
            fileName: file.name
          },
          `[CONTENT_MEDIA_LOOKUP] Processing file ${index + 1}/${uniqueFiles.length}`
        );
        
        // Skip if already processed in this run
        if (importedFileIds.has(file.id) || skippedFileIds.has(file.id)) {
          logger.warn(
            { 
              contentId,
              fileId: file.id,
              fileName: file.name
            },
            "[CONTENT_MEDIA_LOOKUP] File already processed, skipping"
          );
          continue;
        }

        // Check if this file was already imported (by Drive file ID)
        const existingMediaId = existingMediaByDriveFileId.get(file.id);
        if (existingMediaId) {
          // Check if this media is already linked to content
          const existingLink = await tx.contentMedia.findFirst({
            where: {
              contentId: contentId,
              mediaId: existingMediaId,
            },
          });

          if (existingLink) {
            logger.warn(
              { 
                contentId,
                fileId: file.id,
                fileName: file.name,
                existingMediaId: existingMediaId
              },
              "[CONTENT_MEDIA_LOOKUP] Media already linked to content, skipping import"
            );
            skippedFileIds.add(file.id);
            continue;
          }

          // Media exists but not linked to this content - link it
          logger.info(
            { 
              contentId,
              fileId: file.id,
              fileName: file.name,
              existingMediaId: existingMediaId
            },
            "[CONTENT_MEDIA_LOOKUP] Reusing existing media, linking to content"
          );

          // Use create with error handling (unique constraint will prevent duplicates)
          try {
            await tx.contentMedia.create({
              data: {
                contentId: contentId,
                mediaId: existingMediaId,
                sortOrder: importedMediaIds.length,
              },
            });
          } catch (error: any) {
            // If unique constraint violation, update sort order instead
            if (error.code === 'P2002') {
              await tx.contentMedia.update({
                where: {
                  contentId_mediaId: {
                    contentId: contentId,
                    mediaId: existingMediaId,
                  }
                },
                data: {
                  sortOrder: importedMediaIds.length,
                }
              });
              logger.warn(
                { 
                  contentId,
                  mediaId: existingMediaId,
                  fileId: file.id
                },
                "[CONTENT_MEDIA_LOOKUP] Media link already exists, updated sort order"
              );
            } else {
              throw error;
            }
          }

          importedMediaIds.push(existingMediaId);
          importedFileIds.add(file.id);
          continue;
        }

        // New file - import it
        try {
          logger.info(
            { 
              contentId,
              fileId: file.id,
              fileName: file.name
            },
            "[CONTENT_MEDIA_LOOKUP] Importing new file from Google Drive"
          );

          const importedMedia = await driveService.importFile(
            { workspaceId, userId },
            file.id
          );

          // Double-check: Skip if media already linked to this content
          const existingLink = await tx.contentMedia.findFirst({
            where: {
              contentId: contentId,
              mediaId: importedMedia.id,
            },
          });

          if (existingLink) {
            logger.warn(
              { 
                contentId,
                mediaId: importedMedia.id,
                fileName: file.name
              },
              "[CONTENT_MEDIA_LOOKUP] Media already linked to content after import, skipping link"
            );
            skippedFileIds.add(file.id);
            continue;
          }

          // Link imported media to content with correct sort order
          // Use create with error handling (unique constraint will prevent duplicates)
          try {
            await tx.contentMedia.create({
              data: {
                contentId: contentId,
                mediaId: importedMedia.id,
                sortOrder: importedMediaIds.length,
              },
            });
          } catch (error: any) {
            // If unique constraint violation, update sort order instead
            if (error.code === 'P2002') {
              await tx.contentMedia.update({
                where: {
                  contentId_mediaId: {
                    contentId: contentId,
                    mediaId: importedMedia.id,
                  }
                },
                data: {
                  sortOrder: importedMediaIds.length,
                }
              });
              logger.warn(
                { 
                  contentId,
                  mediaId: importedMedia.id,
                  fileId: file.id
                },
                "[CONTENT_MEDIA_LOOKUP] Media link already exists, updated sort order"
              );
            } else {
              throw error;
            }
          }

          importedMediaIds.push(importedMedia.id);
          importedFileIds.add(file.id);

          logger.info(
            { 
              contentId,
              fileId: file.id,
              fileName: file.name,
              mediaId: importedMedia.id,
              sortOrder: importedMediaIds.length - 1
            },
            "[CONTENT_MEDIA_LOOKUP] Successfully imported and linked media"
          );
        } catch (importError: any) {
          logger.error(
            { 
              contentId,
              fileId: file.id,
              fileName: file.name,
              error: importError.message,
              stack: importError.stack
            },
            "[CONTENT_MEDIA_LOOKUP] Failed to import media file"
          );
          skippedFileIds.add(file.id);
        }
      }
    }, {
      timeout: 300000, // 5 minutes timeout for large imports
    });

    logger.info(
      { 
        contentId,
        totalFilesFound: uniqueFiles.length,
        importedCount: importedMediaIds.length,
        skippedCount: skippedFileIds.size,
        importedMediaIds: importedMediaIds
      },
      "[CONTENT_MEDIA_LOOKUP] Import summary"
    );

    if (importedMediaIds.length === 0) {
      throw new Error(
        `Failed to import any media files from Google Drive for media lookup ID: ${content.mediaLookupId}. Found ${uniqueFiles.length} files but none were imported.`
      );
    }
  }
}
