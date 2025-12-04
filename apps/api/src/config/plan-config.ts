/**
 * Workspace Plan Configuration
 * 
 * Centralized definition of plan limits and features.
 * Avoids scattering plan-specific logic across the codebase.
 */

import type { WorkspacePlan } from "@prisma/client";

export type PlanKey = WorkspacePlan;

export type PlanLimits = {
  maxBrands: number | null;
  maxMembers: number | null;
  maxMonthlyPosts: number | null;
};

export type PlanFeatures = {
  brandStudio: boolean;
  tasks: boolean;
  automation: boolean;
};

export type PlanConfig = {
  limits: PlanLimits;
  features: PlanFeatures;
};

export const PLAN_CONFIG: Record<PlanKey, PlanConfig> = {
  FREE: {
    limits: {
      maxBrands: 1,
      maxMembers: 1,
      maxMonthlyPosts: 30,
    },
    features: {
      brandStudio: true,
      tasks: true,
      automation: false,
    },
  },
  STARTER: {
    limits: {
      maxBrands: 5,
      maxMembers: 5,
      maxMonthlyPosts: 200,
    },
    features: {
      brandStudio: true,
      tasks: true,
      automation: true,
    },
  },
  PRO: {
    limits: {
      maxBrands: 20,
      maxMembers: 20,
      maxMonthlyPosts: 1000,
    },
    features: {
      brandStudio: true,
      tasks: true,
      automation: true,
    },
  },
  AGENCY: {
    limits: {
      maxBrands: null, // unlimited
      maxMembers: null, // unlimited
      maxMonthlyPosts: null, // unlimited
    },
    features: {
      brandStudio: true,
      tasks: true,
      automation: true,
    },
  },
};

/**
 * Get plan configuration for a specific workspace plan
 */
export function getWorkspacePlanConfig(plan: WorkspacePlan): PlanConfig {
  return PLAN_CONFIG[plan];
}

