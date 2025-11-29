import { z } from 'zod';
import { buildStringSchema, emailSchema } from './helpers.js';
import { fieldRules } from './rules.js';

export const usernameSchema = buildStringSchema(fieldRules.username, 'validation.username');
export const slugSchema = buildStringSchema(fieldRules.slug, 'validation.slug');
export const workspaceSlugSchema = buildStringSchema(fieldRules.workspaceSlug, 'validation.workspaceSlug');
export const displayNameSchema = buildStringSchema(fieldRules.displayName, 'validation.displayName');

export const identifierSchema = buildStringSchema(fieldRules.identifier, 'validation.identifier');

export const userCreateSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema,
  name: displayNameSchema.optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const workspaceCreateSchema = z.object({
  name: displayNameSchema,
  slug: workspaceSlugSchema,
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).optional().default('FREE'),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;

export const workspaceInviteCreateSchema = z.object({
  email: emailSchema,
  expiresAt: z.string().datetime().optional().nullable(),
});

export type WorkspaceInviteCreateInput = z.infer<typeof workspaceInviteCreateSchema>;

/**
 * Cursor-based pagination query schema
 * Used for validating pagination query parameters in API routes
 * 
 * @example
 * ```typescript
 * const parsed = cursorPaginationQuerySchema.safeParse(request.query);
 * if (!parsed.success) {
 *   throw new BadRequestError('INVALID_QUERY', 'Invalid pagination parameters');
 * }
 * const { limit, cursor } = parsed.data;
 * ```
 */
export const cursorPaginationQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const num = typeof value === 'string' ? parseInt(value, 10) : value;
      return isNaN(num) ? undefined : num;
    })
    .pipe(z.number().int().min(1).max(100).optional()),
  cursor: z.string().optional(),
});

export type CursorPaginationQueryInput = z.infer<typeof cursorPaginationQuerySchema>;
