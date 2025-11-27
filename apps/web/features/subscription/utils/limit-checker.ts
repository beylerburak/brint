import type { SubscriptionPlan } from "../config/plans";
import type { LimitKey, LimitCheckResult } from "../config/limits";
import { getNumericLimit, isUnlimited } from "../config/plans";

/**
 * Check if current usage is within limit
 */
export function checkLimit(
  plan: SubscriptionPlan,
  limitKey: LimitKey,
  current: number
): LimitCheckResult {
  if (isUnlimited(plan, limitKey)) {
    return {
      allowed: true,
      current,
      limit: Infinity,
    };
  }

  const limit = getNumericLimit(plan, limitKey);
  const allowed = current < limit;

  return {
    allowed,
    current,
    limit,
    message: allowed
      ? undefined
      : `Limit reached: ${current}/${limit}. Upgrade to PRO for unlimited.`,
  };
}

/**
 * Check if can create/increment (current + 1 would be within limit)
 */
export function canCreate(
  plan: SubscriptionPlan,
  limitKey: LimitKey,
  current: number
): boolean {
  if (isUnlimited(plan, limitKey)) {
    return true;
  }

  const limit = getNumericLimit(plan, limitKey);
  return current < limit;
}

/**
 * Get remaining quota
 */
export function getRemaining(
  plan: SubscriptionPlan,
  limitKey: LimitKey,
  current: number
): number {
  if (isUnlimited(plan, limitKey)) {
    return Infinity;
  }

  const limit = getNumericLimit(plan, limitKey);
  return Math.max(0, limit - current);
}

