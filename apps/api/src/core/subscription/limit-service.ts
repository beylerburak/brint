import { prisma } from '../../lib/prisma.js';
import { getUsage, UnsupportedLimitError, type UsageContext, BrandNotFoundError } from './usage.service.js';
import { getNumericLimit, isUnlimited, type SubscriptionPlan } from './plans.js';
import type { LimitKey } from './limit-keys.js';

export interface LimitDecision {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  plan: SubscriptionPlan;
  reason?: string;
}

export interface CheckLimitInput extends UsageContext {
  amount?: number;
  current?: number;
  planOverride?: SubscriptionPlan;
}

export class LimitExceededError extends Error {
  decision: LimitDecision;

  constructor(decision: LimitDecision) {
    super('LIMIT_EXCEEDED');
    this.name = 'LimitExceededError';
    this.decision = decision;
  }
}

async function resolvePlan(workspaceId?: string, planOverride?: SubscriptionPlan): Promise<SubscriptionPlan> {
  if (planOverride) {
    return planOverride;
  }

  if (!workspaceId) {
    return 'FREE';
  }

  const subscription = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { plan: true },
  });

  return (subscription?.plan as SubscriptionPlan) ?? 'FREE';
}

export async function getPlanForWorkspace(workspaceId: string): Promise<SubscriptionPlan> {
  return resolvePlan(workspaceId);
}

async function resolveWorkspaceId(input: CheckLimitInput): Promise<string | undefined> {
  if (input.workspaceId) {
    return input.workspaceId;
  }

  if (input.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: input.brandId },
      select: { workspaceId: true },
    });
    if (!brand) {
      throw new BrandNotFoundError(input.brandId);
    }
    return brand.workspaceId;
  }

  return undefined;
}

/**
 * Checks whether the requested amount can be created within the plan limits.
 */
export async function checkLimit(input: CheckLimitInput): Promise<LimitDecision> {
  const { limitKey } = input;
  const workspaceId = await resolveWorkspaceId(input);
  const plan = await resolvePlan(workspaceId, input.planOverride);
  const amount = input.amount ?? 1;

  let current = input.current;

  if (current === undefined) {
    current = (await getUsage({
      limitKey,
      workspaceId,
      brandId: input.brandId,
      userId: input.userId,
    })).current;
  }

  if (isUnlimited(plan, limitKey)) {
    return {
      allowed: true,
      current,
      limit: Infinity,
      remaining: Infinity,
      isUnlimited: true,
      plan,
    };
  }

  const limit = getNumericLimit(plan, limitKey);
  const allowed = current + amount <= limit;

  return {
    allowed,
    current,
    limit,
    remaining: Math.max(0, limit - current),
    isUnlimited: false,
    plan,
    reason: allowed ? undefined : 'LIMIT_EXCEEDED',
  };
}

/**
 * Throws LimitExceededError if limit is violated.
 */
export async function assertWithinLimit(input: CheckLimitInput): Promise<LimitDecision> {
  const decision = await checkLimit(input);

  if (!decision.allowed) {
    throw new LimitExceededError(decision);
  }

  return decision;
}

export { UnsupportedLimitError };
