import { useSubscription } from "../context/subscription-context";
import type { LimitKey } from "../config/limits";
import { checkLimit, canCreate, getRemaining } from "../utils/limit-checker";

/**
 * Hook to check if current usage is within limit
 */
export function useHasLimit(limitKey: LimitKey, current: number) {
  const { plan } = useSubscription();
  return checkLimit(plan, limitKey, current);
}

/**
 * Hook to check if can create/increment
 */
export function useCanCreate(limitKey: LimitKey, current: number) {
  const { plan } = useSubscription();
  return canCreate(plan, limitKey, current);
}

/**
 * Hook to get remaining quota
 */
export function useRemaining(limitKey: LimitKey, current: number) {
  const { plan } = useSubscription();
  return getRemaining(plan, limitKey, current);
}

