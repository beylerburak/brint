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
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
