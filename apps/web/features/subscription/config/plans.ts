import type { Limit, LimitKey } from "./limits";

export type SubscriptionPlan = "FREE" | "PRO" | "ENTERPRISE";

/**
 * Plan limit definitions
 * Each plan has specific limits for different features
 */
export const PLAN_LIMITS: Record<SubscriptionPlan, Limit[]> = {
  FREE: [
    { key: "workspace.maxCount", value: 1 },
    { key: "brand.maxCount", value: 1 },
    { key: "brand.socialAccount.maxCount", value: 3 },
    { key: "brand.content.maxCountPerMonth", value: 20 },
  ],
  PRO: [
    { key: "workspace.maxCount", value: "unlimited" },
    { key: "brand.maxCount", value: "unlimited" },
    { key: "brand.socialAccount.maxCount", value: "unlimited" },
    { key: "brand.content.maxCountPerMonth", value: "unlimited" },
  ],
  ENTERPRISE: [
    { key: "workspace.maxCount", value: "unlimited" },
    { key: "brand.maxCount", value: "unlimited" },
    { key: "brand.socialAccount.maxCount", value: "unlimited" },
    { key: "brand.content.maxCountPerMonth", value: "unlimited" },
  ],
};

/**
 * Get limit value for a specific plan and limit key
 */
export function getPlanLimit(plan: SubscriptionPlan, limitKey: LimitKey): number | "unlimited" {
  const limits = PLAN_LIMITS[plan];
  const limit = limits.find((l) => l.key === limitKey);
  return limit?.value ?? "unlimited";
}

/**
 * Check if a plan allows unlimited for a specific limit
 */
export function isUnlimited(plan: SubscriptionPlan, limitKey: LimitKey): boolean {
  return getPlanLimit(plan, limitKey) === "unlimited";
}

/**
 * Get numeric limit value (returns Infinity for unlimited)
 */
export function getNumericLimit(plan: SubscriptionPlan, limitKey: LimitKey): number {
  const limit = getPlanLimit(plan, limitKey);
  return limit === "unlimited" ? Infinity : limit;
}

