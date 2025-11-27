import { useSubscription } from "../context/subscription-context";
import { getPlanLimit, isUnlimited, getNumericLimit } from "../config/plans";
import type { LimitKey } from "../config/limits";

/**
 * Hook to get subscription plan limits
 */
export function useSubscriptionLimits() {
  const { plan } = useSubscription();

  return {
    plan,
    getLimit: (limitKey: LimitKey) => getPlanLimit(plan, limitKey),
    isUnlimited: (limitKey: LimitKey) => isUnlimited(plan, limitKey),
    getNumericLimit: (limitKey: LimitKey) => getNumericLimit(plan, limitKey),
  };
}

