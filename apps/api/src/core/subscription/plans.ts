import type { LimitKey } from './limit-keys.js';

export type SubscriptionPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export type LimitValue = number | 'unlimited';

export interface PlanLimit {
  key: LimitKey;
  value: LimitValue;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimit[]> = {
  FREE: [
    { key: 'workspace.maxCount', value: 1 },
    { key: 'brand.maxCount', value: 1 },
    { key: 'brand.socialAccount.maxCount', value: 3 },
    { key: 'brand.content.maxCountPerMonth', value: 20 },
  ],
  PRO: [
    { key: 'workspace.maxCount', value: 'unlimited' },
    { key: 'brand.maxCount', value: 'unlimited' },
    { key: 'brand.socialAccount.maxCount', value: 'unlimited' },
    { key: 'brand.content.maxCountPerMonth', value: 'unlimited' },
  ],
  ENTERPRISE: [
    { key: 'workspace.maxCount', value: 'unlimited' },
    { key: 'brand.maxCount', value: 'unlimited' },
    { key: 'brand.socialAccount.maxCount', value: 'unlimited' },
    { key: 'brand.content.maxCountPerMonth', value: 'unlimited' },
  ],
};

export function getPlanLimit(plan: SubscriptionPlan, limitKey: LimitKey): LimitValue {
  const limits = PLAN_LIMITS[plan];
  const limit = limits.find((l) => l.key === limitKey);
  return limit?.value ?? 'unlimited';
}

export function isUnlimited(plan: SubscriptionPlan, limitKey: LimitKey): boolean {
  return getPlanLimit(plan, limitKey) === 'unlimited';
}

export function getNumericLimit(plan: SubscriptionPlan, limitKey: LimitKey): number {
  const limit = getPlanLimit(plan, limitKey);
  return limit === 'unlimited' ? Infinity : limit;
}
