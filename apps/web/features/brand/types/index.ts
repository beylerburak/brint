/**
 * Brand Domain Types (Frontend)
 * 
 * Mirrored from backend brand-domain.md for type safety.
 */

// ============================================================================
// Brand Types
// ============================================================================

/**
 * Brand status enum
 */
export type BrandStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

/**
 * Brand summary for list views
 */
export interface BrandSummary {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  industry?: string | null;
  language?: string | null;
  timezone?: string | null;
  
  // Brand status and onboarding
  status: BrandStatus;
  onboardingStep: number;
  onboardingCompleted: boolean;
  
  // Readiness
  profileCompleted: boolean;
  hasAtLeastOneSocialAccount: boolean;
  publishingDefaultsConfigured: boolean;
  readinessScore: number;
  
  // Status
  isArchived: boolean;
  isActive: boolean;
  
  // Logo
  logoMediaId?: string | null;
  logoUrl?: string | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Full brand detail with all fields
 */
export interface BrandDetail extends BrandSummary {
  toneOfVoice?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  websiteUrl?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

/**
 * Brand create request payload
 */
export interface CreateBrandRequest {
  name: string;
  slug?: string; // Optional - auto-generated from name if not provided
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
 * Brand update request payload (all fields optional)
 */
export interface UpdateBrandRequest {
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
  logoMediaId?: string | null;
}

/**
 * Brand onboarding step update request
 */
export interface UpdateBrandOnboardingRequest {
  step: number;
  data?: UpdateBrandRequest;
}

/**
 * Brand onboarding update response
 */
export interface BrandOnboardingResponse {
  id: string;
  name: string;
  slug: string;
  status: BrandStatus;
  onboardingStep: number;
  onboardingCompleted: boolean;
  readinessScore: number;
}

/**
 * Complete onboarding response
 */
export interface CompleteBrandOnboardingResponse {
  id: string;
  slug: string;
  name: string;
  status: BrandStatus;
  onboardingCompleted: boolean;
  onboardingStep: number;
}

// ============================================================================
// Brand Hashtag Preset Types
// ============================================================================

/**
 * Brand hashtag preset
 */
export interface BrandHashtagPreset {
  id: string;
  workspaceId: string;
  brandId: string;
  name: string;
  tags: string[]; // Array of hashtags
  createdAt: string;
  updatedAt: string;
}

/**
 * Create hashtag preset request
 */
export interface CreateHashtagPresetRequest {
  name: string;
  tags: string[];
}

/**
 * Update hashtag preset request
 */
export interface UpdateHashtagPresetRequest {
  name?: string;
  tags?: string[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    nextCursor: string | null;
  };
}

/**
 * Single item response
 */
export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Delete response
 */
export interface DeleteResponse {
  success: boolean;
  data: {
    message: string;
    softDeleted?: boolean;
  };
}

// ============================================================================
// Activity Types (for brand activity tab)
// ============================================================================

/**
 * Activity event for display
 */
export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  summary: string;
  timestamp: string;
  actorType: 'user' | 'system' | 'integration';
  actorName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Activity list response
 */
export interface ActivityListResponse {
  success: boolean;
  data: {
    items: ActivityEvent[];
    nextCursor: string | null;
  };
}

