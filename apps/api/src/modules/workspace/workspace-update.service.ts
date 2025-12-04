/**
 * Workspace Update Service
 * 
 * Handles workspace updates with validation.
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { z } from 'zod';

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  baseCurrency: z.string().length(3).optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

/**
 * Check if a slug is available for a workspace
 */
export async function isSlugAvailable(slug: string, excludeWorkspaceId?: string): Promise<boolean> {
  const existing = await prisma.workspace.findFirst({
    where: {
      slug,
      ...(excludeWorkspaceId ? { id: { not: excludeWorkspaceId } } : {}),
    },
  });

  return !existing;
}

/**
 * Update workspace
 */
export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  data: UpdateWorkspaceInput
) {
  logger.info({ workspaceId, userId, data }, 'Updating workspace');

  // Validate input
  const validated = UpdateWorkspaceSchema.parse(data);

  // Check slug availability if slug is being changed
  if (validated.slug) {
    const available = await isSlugAvailable(validated.slug, workspaceId);
    if (!available) {
      throw new Error('SLUG_TAKEN');
    }
  }

  // Update workspace
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: validated,
  });

  logger.info({ workspaceId }, 'Workspace updated');

  return workspace;
}

