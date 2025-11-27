/**
 * Subscription limit keys and metadata registry (backend)
 * Mirrors the frontend definitions in apps/web/features/subscription/config/limits.ts
 */

export type LimitKey =
  | 'workspace.maxCount' // Maximum number of workspaces an account can own
  | 'brand.maxCount' // Maximum number of brands per workspace
  | 'brand.socialAccount.maxCount' // Maximum number of social accounts per brand
  | 'brand.content.maxCountPerMonth'; // Maximum number of content items per brand per month

export type LimitScope = 'account' | 'workspace' | 'brand';
export type LimitPeriod = 'none' | 'monthly';

export interface LimitDefinition {
  key: LimitKey;
  scope: LimitScope;
  period: LimitPeriod;
  description: string;
}

export const LIMIT_KEY_REGISTRY: Record<LimitKey, LimitDefinition> = {
  'workspace.maxCount': {
    key: 'workspace.maxCount',
    scope: 'account',
    period: 'none',
    description: 'Maximum number of workspaces an account can own',
  },
  'brand.maxCount': {
    key: 'brand.maxCount',
    scope: 'workspace',
    period: 'none',
    description: 'Maximum number of brands allowed per workspace',
  },
  'brand.socialAccount.maxCount': {
    key: 'brand.socialAccount.maxCount',
    scope: 'brand',
    period: 'none',
    description: 'Maximum number of social accounts that can be linked to a brand',
  },
  'brand.content.maxCountPerMonth': {
    key: 'brand.content.maxCountPerMonth',
    scope: 'brand',
    period: 'monthly',
    description: 'Maximum number of content items that can be created per brand per month',
  },
};

export function isLimitKey(value: string): value is LimitKey {
  return value in LIMIT_KEY_REGISTRY;
}
