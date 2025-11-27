// Context
export { SubscriptionProvider, useSubscription } from "./context/subscription-context";

// Hooks
export { useHasLimit, useCanCreate, useRemaining } from "./hooks/use-has-limit";
export { useSubscriptionLimits } from "./hooks/use-subscription-limits";
export { useUsage } from "./hooks/use-usage";
export type { UseUsageResult } from "./hooks/use-usage";

// Config
export type { SubscriptionPlan } from "./config/plans";
export type { LimitKey, LimitValue, Limit, LimitCheckResult } from "./config/limits";
export { PLAN_LIMITS, getPlanLimit, isUnlimited, getNumericLimit } from "./config/plans";

// Utils
export { checkLimit, canCreate, getRemaining } from "./utils/limit-checker";

