/**
 * Plan Configuration
 * 
 * Subscription plan limits used by both frontend and backend
 * for feature gating and limit enforcement.
 */

// Plan types
export const PLAN_TYPES = ['FREE', 'STARTER', 'PRO', 'AGENCY'] as const
export type PlanType = typeof PLAN_TYPES[number]

// Plan limits interface
export interface PlanLimits {
    maxBrands: number        // -1 = unlimited
    maxStorageGB: number
    maxTeamMembers: number
    maxMonthlyPosts: number  // -1 = unlimited
    maxSocialAccountsPerPlatform: number  // -1 = unlimited, per brand
}

// Plan configuration
export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
    FREE: {
        maxBrands: 1,
        maxStorageGB: 1,
        maxTeamMembers: 2,
        maxMonthlyPosts: 30,
        maxSocialAccountsPerPlatform: 1, // 1 account per platform per brand
    },
    STARTER: {
        maxBrands: 5,
        maxStorageGB: 10,
        maxTeamMembers: 5,
        maxMonthlyPosts: 200,
        maxSocialAccountsPerPlatform: 3, // 3 accounts per platform per brand
    },
    PRO: {
        maxBrands: 20,
        maxStorageGB: 100,
        maxTeamMembers: 20,
        maxMonthlyPosts: 1000,
        maxSocialAccountsPerPlatform: 10, // 10 accounts per platform per brand
    },
    AGENCY: {
        maxBrands: -1, // unlimited
        maxStorageGB: 500,
        maxTeamMembers: 50,
        maxMonthlyPosts: -1, // unlimited
        maxSocialAccountsPerPlatform: -1, // unlimited
    },
} as const

// Default plan for new workspaces
export const DEFAULT_PLAN: PlanType = 'FREE'

/**
 * Get limits for a specific plan
 */
export function getPlanLimits(plan: PlanType): PlanLimits {
    return PLAN_LIMITS[plan]
}

/**
 * Check if a plan allows a certain number of brands
 */
export function canCreateBrand(plan: PlanType, currentBrandCount: number): boolean {
    const limits = PLAN_LIMITS[plan]
    if (limits.maxBrands === -1) return true // unlimited
    return currentBrandCount < limits.maxBrands
}

/**
 * Check if a plan allows adding more team members
 */
export function canAddTeamMember(plan: PlanType, currentMemberCount: number): boolean {
    const limits = PLAN_LIMITS[plan]
    return currentMemberCount < limits.maxTeamMembers
}

/**
 * Get remaining brands that can be created
 */
export function getRemainingBrands(plan: PlanType, currentBrandCount: number): number | 'unlimited' {
    const limits = PLAN_LIMITS[plan]
    if (limits.maxBrands === -1) return 'unlimited'
    return Math.max(0, limits.maxBrands - currentBrandCount)
}

/**
 * Get remaining team member slots
 */
export function getRemainingTeamMembers(plan: PlanType, currentMemberCount: number): number {
    const limits = PLAN_LIMITS[plan]
    return Math.max(0, limits.maxTeamMembers - currentMemberCount)
}

/**
 * Check if storage limit is reached
 */
export function isStorageLimitReached(plan: PlanType, usedStorageGB: number): boolean {
    const limits = PLAN_LIMITS[plan]
    return usedStorageGB >= limits.maxStorageGB
}

/**
 * Get storage usage percentage
 */
export function getStorageUsagePercent(plan: PlanType, usedStorageGB: number): number {
    const limits = PLAN_LIMITS[plan]
    return Math.min(100, (usedStorageGB / limits.maxStorageGB) * 100)
}

/**
 * Check if a plan allows adding more social accounts for a specific platform
 */
export function canAddSocialAccount(
    plan: PlanType, 
    platform: string, 
    currentAccountCount: number
): boolean {
    const limits = PLAN_LIMITS[plan]
    if (limits.maxSocialAccountsPerPlatform === -1) return true // unlimited
    return currentAccountCount < limits.maxSocialAccountsPerPlatform
}

/**
 * Get remaining social account slots for a platform
 */
export function getRemainingSocialAccounts(
    plan: PlanType, 
    platform: string, 
    currentAccountCount: number
): number | 'unlimited' {
    const limits = PLAN_LIMITS[plan]
    if (limits.maxSocialAccountsPerPlatform === -1) return 'unlimited'
    return Math.max(0, limits.maxSocialAccountsPerPlatform - currentAccountCount)
}
