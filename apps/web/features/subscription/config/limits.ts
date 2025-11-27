/**
 * Subscription limit type definitions
 * These define what can be limited per subscription plan
 */

export type LimitKey =
  | "workspace.maxCount" // Maximum number of workspaces
  | "brand.maxCount" // Maximum number of brands per workspace
  | "brand.socialAccount.maxCount" // Maximum number of social accounts per brand
  | "brand.content.maxCountPerMonth"; // Maximum number of content items per month per brand

export type LimitValue = number | "unlimited";

export interface Limit {
  key: LimitKey;
  value: LimitValue;
}

/**
 * Limit check result
 */
export interface LimitCheckResult {
  allowed: boolean;
  current?: number;
  limit?: number;
  message?: string;
}

