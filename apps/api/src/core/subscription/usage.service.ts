import { prisma } from '../../lib/prisma.js';
import { LIMIT_KEY_REGISTRY, type LimitKey } from './limit-keys.js';

export interface UsageContext {
  limitKey: LimitKey;
  workspaceId?: string;
  brandId?: string;
  userId?: string;
}

export interface UsageResult {
  limitKey: LimitKey;
  current: number;
  scopeId?: string;
  note?: string;
}

export class UnsupportedLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedLimitError';
  }
}

export class BrandNotFoundError extends Error {
  constructor(brandId: string) {
    super(`Brand not found: ${brandId}`);
    this.name = 'BrandNotFoundError';
  }
}

async function requireBrand(brandId?: string) {
  if (!brandId) {
    throw new Error('brandId is required for this usage query');
  }
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, workspaceId: true },
  });
  if (!brand) {
    throw new BrandNotFoundError(brandId);
  }
  return brand;
}

/**
 * Returns current usage for a given limit key.
 * Only implements limits that have a clear data source today.
 */
export async function getUsage(context: UsageContext): Promise<UsageResult> {
  const { limitKey } = context;

  switch (limitKey) {
    case 'workspace.maxCount': {
      if (!context.userId) {
        throw new Error('userId is required for workspace.maxCount usage');
      }

      // Count workspaces where the user is OWNER (acts as "created by" for now)
      const current = await prisma.workspaceMember.count({
        where: {
          userId: context.userId,
          role: 'OWNER',
        },
      });

      return { limitKey, current, scopeId: context.userId };
    }

    case 'brand.maxCount': {
      if (!context.workspaceId) {
        throw new Error('workspaceId is required for brand.maxCount usage');
      }

      const current = await prisma.brand.count({
        where: { workspaceId: context.workspaceId, isActive: true },
      });

      return { limitKey, current, scopeId: context.workspaceId };
    }

    case 'brand.socialAccount.maxCount': {
      const brand = await requireBrand(context.brandId);
      const current = await prisma.socialAccount.count({
        where: { brandId: brand.id, workspaceId: brand.workspaceId },
      });
      return { limitKey, current, scopeId: brand.id };
    }

    case 'brand.content.maxCountPerMonth': {
      const brand = await requireBrand(context.brandId);
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const current = await prisma.brandContent.count({
        where: {
          brandId: brand.id,
          workspaceId: brand.workspaceId,
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
      });

      return { limitKey, current, scopeId: brand.id };
    }

    default: {
      // Should be unreachable thanks to LimitKey type + registry
      throw new UnsupportedLimitError(`Unsupported limit key: ${limitKey}`);
    }
  }
}

export function getLimitDefinition(limitKey: LimitKey) {
  return LIMIT_KEY_REGISTRY[limitKey];
}
