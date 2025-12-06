/**
 * Comment Domain Schemas
 * 
 * Zod schemas and TypeScript types for global polymorphic Comment system.
 * Comments can be attached to any entity (Task, Content, CRM Contact, etc.)
 */

import { z } from 'zod';

// ============================================================================
// Input Schemas
// ============================================================================

// Supported entity types for comments (whitelist)
export const CommentEntityTypeSchema = z.enum([
  'TASK',
  // TODO: Add more entity types as they are implemented
  // 'CONTENT',
  // 'CRM_CONTACT',
  // 'PROJECT',
]);

export const CreateCommentInputSchema = z.object({
  entityType: CommentEntityTypeSchema,
  entityId: z.string().min(1, 'Entity ID is required'),
  body: z.string().min(1, 'Comment body is required').max(10000),
  brandId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(), // For threaded replies
});

export const UpdateCommentInputSchema = z.object({
  body: z.string().min(1, 'Comment body is required').max(10000),
});

export const ListCommentsQuerySchema = z.object({
  entityType: CommentEntityTypeSchema,
  entityId: z.string().min(1),
  brandId: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

// ============================================================================
// DTO Types
// ============================================================================

export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;
export type UpdateCommentInput = z.infer<typeof UpdateCommentInputSchema>;
export type ListCommentsQuery = z.infer<typeof ListCommentsQuerySchema>;

export type CommentDto = {
  id: string;
  workspaceId: string;
  brandId: string | null;
  entityType: string;
  entityId: string;
  authorUserId: string;
  body: string;
  parentId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentWithAuthorDto = CommentDto & {
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type CommentWithRepliesDto = CommentWithAuthorDto & {
  replies: CommentWithAuthorDto[];
  replyCount: number;
};

// ============================================================================
// Pagination Response
// ============================================================================

export type PaginatedCommentsDto = {
  comments: CommentWithAuthorDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

