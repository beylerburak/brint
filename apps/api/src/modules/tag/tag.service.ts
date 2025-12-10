/**
 * Tag Service
 * 
 * Business logic for tag management and tag-entity relations.
 */

import { prisma } from '../../lib/prisma.js';
import { TagEntityType } from '@prisma/client';
import { normalizeTagNames } from './tag-utils.js';

/**
 * Upserts tags for a workspace.
 * 
 * Given an array of tag names, this function:
 * 1. Normalizes the tag names
 * 2. Finds existing tags by slug
 * 3. Creates missing tags
 * 4. Returns all tags (existing + newly created)
 * 
 * @param workspaceId - The workspace ID
 * @param tagNames - Array of tag names (e.g., ["Black Friday 2025", "urun-x-launch"])
 * @returns Array of Tag entities
 */
export async function upsertTagsForWorkspace(
  workspaceId: string,
  tagNames: string[]
): Promise<Array<{ id: string; name: string; slug: string; color: string | null }>> {
  if (tagNames.length === 0) {
    return [];
  }

  // Normalize tag names
  const normalized = normalizeTagNames(tagNames);

  if (normalized.length === 0) {
    return [];
  }

  const slugs = normalized.map(item => item.slug);

  // Find existing tags
  const existing = await prisma.tag.findMany({
    where: {
      workspaceId,
      slug: { in: slugs },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
    },
  });

  const existingSlugSet = new Set(existing.map(t => t.slug));

  // Create missing tags
  const toCreate = normalized.filter(item => !existingSlugSet.has(item.slug));
  const created = [];

  for (const item of toCreate) {
    const tag = await prisma.tag.create({
      data: {
        workspaceId,
        name: item.name,
        slug: item.slug,
        // color and description are optional, can be set later
      },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
    });
    created.push(tag);
  }

  return [...existing, ...created];
}

/**
 * Sets tags for a content entity.
 * 
 * This function synchronizes the tag relations for a content:
 * - Adds new tag relations
 * - Soft-deletes removed tag relations
 * 
 * The tags array represents the complete desired state.
 * 
 * @param workspaceId - The workspace ID
 * @param contentId - The content ID
 * @param tags - Array of Tag entities to associate with the content
 */
export async function setTagsForContent(
  workspaceId: string,
  contentId: string,
  tags: Array<{ id: string }>
): Promise<void> {
  // Get current active relations
  const existingRelations = await prisma.tagRelation.findMany({
    where: {
      workspaceId,
      entityType: TagEntityType.CONTENT,
      entityId: contentId,
      deletedAt: null,
    },
  });

  const currentTagIdSet = new Set(existingRelations.map(r => r.tagId));
  const newTagIdSet = new Set(tags.map(t => t.id));

  // Tags to add
  const toAdd = [...newTagIdSet].filter(id => !currentTagIdSet.has(id));

  // Tags to remove (soft delete)
  const toRemove = [...currentTagIdSet].filter(id => !newTagIdSet.has(id));

  // Create new relations
  if (toAdd.length > 0) {
    await prisma.tagRelation.createMany({
      data: toAdd.map(tagId => ({
        workspaceId,
        tagId,
        entityType: TagEntityType.CONTENT,
        entityId: contentId,
      })),
    });
  }

  // Soft delete removed relations
  if (toRemove.length > 0) {
    await prisma.tagRelation.updateMany({
      where: {
        workspaceId,
        entityType: TagEntityType.CONTENT,
        entityId: contentId,
        tagId: { in: toRemove },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}

/**
 * Gets tags for a content entity.
 * 
 * @param workspaceId - The workspace ID
 * @param contentId - The content ID
 * @returns Array of Tag entities associated with the content
 */
export async function getTagsForContent(
  workspaceId: string,
  contentId: string
): Promise<Array<{ id: string; name: string; slug: string; color: string | null }>> {
  const relations = await prisma.tagRelation.findMany({
    where: {
      workspaceId,
      entityType: TagEntityType.CONTENT,
      entityId: contentId,
      deletedAt: null,
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          deletedAt: true,
        },
      },
    },
  });

  return relations
    .map(r => r.tag)
    .filter((tag): tag is NonNullable<typeof tag> => tag !== null && tag.deletedAt === null)
    .map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
    }));
}

/**
 * Gets tags for multiple content entities (batch).
 * 
 * @param workspaceId - The workspace ID
 * @param contentIds - Array of content IDs
 * @returns Map of contentId -> Tag array
 */
export async function getTagsForContents(
  workspaceId: string,
  contentIds: string[]
): Promise<Map<string, Array<{ id: string; name: string; slug: string; color: string | null }>>> {
  if (contentIds.length === 0) {
    return new Map();
  }

  const relations = await prisma.tagRelation.findMany({
    where: {
      workspaceId,
      entityType: TagEntityType.CONTENT,
      entityId: { in: contentIds },
      deletedAt: null,
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          deletedAt: true,
        },
      },
    },
  });

  const result = new Map<string, Array<{ id: string; name: string; slug: string; color: string | null }>>();

  for (const relation of relations) {
    if (relation.tag && relation.tag.deletedAt === null) {
      const existing = result.get(relation.entityId) || [];
      existing.push({
        id: relation.tag.id,
        name: relation.tag.name,
        slug: relation.tag.slug,
        color: relation.tag.color,
      });
      result.set(relation.entityId, existing);
    }
  }

  return result;
}
