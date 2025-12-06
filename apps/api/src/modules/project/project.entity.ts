/**
 * Project Domain Schemas
 * 
 * Zod schemas and TypeScript types for Project domain.
 */

import { z } from 'zod';
import type { ProjectStatus } from '@prisma/client';

// ============================================================================
// Enums
// ============================================================================

export const ProjectStatusSchema = z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']);

// ============================================================================
// Input Schemas
// ============================================================================

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  brandId: z.string().nullable().optional(),
  status: ProjectStatusSchema.optional().default('PLANNED'),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export const UpdateProjectInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  brandId: z.string().nullable().optional(),
  status: ProjectStatusSchema.optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

// ============================================================================
// DTO Types
// ============================================================================

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export type ProjectDto = {
  id: string;
  workspaceId: string;
  brandId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectWithTaskCountDto = ProjectDto & {
  taskCount: number;
};

