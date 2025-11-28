export type FieldRule = {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  i18nKey?: string;
  description?: string;
};

const IDENTIFIER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])$/;

export const identifierRules: FieldRule = {
  minLength: 3,
  maxLength: 32,
  pattern: IDENTIFIER_REGEX,
};

export const usernameRules: FieldRule = {
  ...identifierRules,
  maxLength: 24,
  i18nKey: 'validation.username.invalid',
};

export const slugRules: FieldRule = {
  ...identifierRules,
  maxLength: 64,
  pattern: /^[a-zA-Z0-9](?:[a-zA-Z0-9-_]*[a-zA-Z0-9])$/,
  i18nKey: 'validation.slug.invalid',
};

export const workspaceSlugRules: FieldRule = {
  ...slugRules,
  i18nKey: 'validation.workspaceSlug.invalid',
};

export const displayNameRules: FieldRule = {
  minLength: 1,
  maxLength: 80,
  i18nKey: 'validation.displayName.invalid',
};

export const fieldRules = {
  identifier: identifierRules,
  username: usernameRules,
  slug: slugRules,
  workspaceSlug: workspaceSlugRules,
  displayName: displayNameRules,
} as const;

export type FieldRuleKey = keyof typeof fieldRules;
