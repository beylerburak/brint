/**
 * Brand Domain Types
 * 
 * Domain-level type definitions for the Brand module.
 */

import type { Brand, BrandHashtagPreset } from "@prisma/client";

/**
 * Brand with computed fields
 */
export interface BrandWithReadiness extends Brand {
  readinessScore: number;
  profileCompleted: boolean;
  hasAtLeastOneSocialAccount: boolean;
  publishingDefaultsConfigured: boolean;
}

/**
 * Brand list item (used in list responses)
 */
export interface BrandListItem {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string | null;
  readinessScore: number;
  profileCompleted: boolean;
  hasAtLeastOneSocialAccount: boolean;
  publishingDefaultsConfigured: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Brand detail (full brand info for GET /brands/:brandId)
 */
export interface BrandDetail extends BrandListItem {
  language: string | null;
  timezone: string | null;
  toneOfVoice: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  websiteUrl: string | null;
  logoMediaId: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Brand create input
 * Note: slug is optional - if not provided, it will be generated from name
 */
export interface CreateBrandInput {
  name: string;
  slug?: string;
  description?: string | null;
  industry?: string | null;
  language?: string | null;
  timezone?: string | null;
  toneOfVoice?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  websiteUrl?: string | null;
}

/**
 * Brand update input
 */
export interface UpdateBrandInput {
  name?: string;
  slug?: string;
  description?: string | null;
  industry?: string | null;
  language?: string | null;
  timezone?: string | null;
  toneOfVoice?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  websiteUrl?: string | null;
}

/**
 * Brand readiness update input
 */
export interface UpdateBrandReadinessInput {
  profileCompleted?: boolean;
  publishingDefaultsConfigured?: boolean;
}

/**
 * Brand change diff - tracks what changed in an update
 */
export interface BrandChangeDiff {
  [key: string]: {
    before: unknown;
    after: unknown;
  };
}

/**
 * Readiness score calculation result
 */
export interface ReadinessScoreResult {
  score: number;
  profileCompleted: boolean;
  hasAtLeastOneSocialAccount: boolean;
  publishingDefaultsConfigured: boolean;
}

/**
 * Brand hashtag preset list item
 */
export interface HashtagPresetListItem {
  id: string;
  workspaceId: string;
  brandId: string;
  name: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create hashtag preset input
 */
export interface CreateHashtagPresetInput {
  name: string;
  tags: string[];
}

/**
 * Update hashtag preset input
 */
export interface UpdateHashtagPresetInput {
  name?: string;
  tags?: string[];
}

