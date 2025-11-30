/**
 * Brand API Client
 * 
 * Wraps /v1/brands endpoints with typed functions.
 * Uses shared HTTP client which automatically handles:
 * - Authorization header (Bearer token)
 * - X-Workspace-Id header
 * - Token refresh on 401
 * - API versioning (/v1 prefix)
 */

import { httpClient } from "@/shared/http";
import type {
  BrandSummary,
  BrandDetail,
  BrandHashtagPreset,
  CreateBrandRequest,
  UpdateBrandRequest,
  UpdateBrandOnboardingRequest,
  BrandOnboardingResponse,
  CompleteBrandOnboardingResponse,
  CreateHashtagPresetRequest,
  UpdateHashtagPresetRequest,
  PaginatedResponse,
  SingleResponse,
  DeleteResponse,
  ActivityListResponse,
} from "../types";

// ============================================================================
// Brand CRUD Operations
// ============================================================================

export interface ListBrandsParams {
  cursor?: string;
  limit?: number;
  includeArchived?: boolean;
}

export interface ListBrandsResult {
  items: BrandSummary[];
  nextCursor: string | null;
}

/**
 * List brands for the current workspace
 */
export async function listBrands(params?: ListBrandsParams): Promise<ListBrandsResult> {
  const searchParams = new URLSearchParams();
  
  if (params?.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  if (params?.limit) {
    searchParams.set("limit", params.limit.toString());
  }
  if (params?.includeArchived) {
    searchParams.set("includeArchived", "true");
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/brands?${queryString}` : "/brands";
  
  const response = await httpClient.get<PaginatedResponse<BrandSummary>>(url);

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to list brands";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Get a single brand by ID
 */
export async function getBrand(brandId: string): Promise<BrandDetail> {
  const response = await httpClient.get<SingleResponse<BrandDetail>>(`/brands/${brandId}`);

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to get brand";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Get a single brand by slug
 */
export async function getBrandBySlug(slug: string): Promise<BrandDetail> {
  const response = await httpClient.get<SingleResponse<BrandDetail>>(`/brands/by-slug/${slug}`);

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to get brand";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Create a new brand
 */
export async function createBrand(data: CreateBrandRequest): Promise<BrandDetail> {
  const response = await httpClient.post<SingleResponse<BrandDetail>>("/brands", data);

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to create brand";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Update an existing brand
 */
export async function updateBrand(brandId: string, data: UpdateBrandRequest): Promise<BrandDetail> {
  const response = await httpClient.patch<SingleResponse<BrandDetail>>(`/brands/${brandId}`, data);

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to update brand";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Archive (soft delete) a brand
 */
export async function archiveBrand(brandId: string): Promise<void> {
  const response = await httpClient.delete<DeleteResponse>(`/brands/${brandId}`);

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to archive brand";
    throw new Error(errorMessage);
  }
}

// ============================================================================
// Onboarding Operations
// ============================================================================

/**
 * Update brand onboarding step
 */
export async function updateBrandOnboarding(
  brandId: string,
  data: UpdateBrandOnboardingRequest
): Promise<BrandOnboardingResponse> {
  const response = await httpClient.patch<SingleResponse<BrandOnboardingResponse>>(
    `/brands/${brandId}/onboarding`,
    data
  );

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to update onboarding";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Complete brand onboarding
 */
export async function completeBrandOnboarding(brandId: string): Promise<CompleteBrandOnboardingResponse> {
  const response = await httpClient.post<SingleResponse<CompleteBrandOnboardingResponse>>(
    `/brands/${brandId}/complete-onboarding`,
    {}
  );

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to complete onboarding";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

// ============================================================================
// Hashtag Preset Operations
// ============================================================================

/**
 * List hashtag presets for a brand
 */
export async function listHashtagPresets(brandId: string): Promise<BrandHashtagPreset[]> {
  const response = await httpClient.get<PaginatedResponse<BrandHashtagPreset>>(
    `/brands/${brandId}/hashtag-presets`
  );

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to list hashtag presets";
    throw new Error(errorMessage);
  }

  return response.data.data.items;
}

/**
 * Create a new hashtag preset
 */
export async function createHashtagPreset(
  brandId: string,
  data: CreateHashtagPresetRequest
): Promise<BrandHashtagPreset> {
  const response = await httpClient.post<SingleResponse<BrandHashtagPreset>>(
    `/brands/${brandId}/hashtag-presets`,
    data
  );

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to create hashtag preset";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Update a hashtag preset
 */
export async function updateHashtagPreset(
  brandId: string,
  presetId: string,
  data: UpdateHashtagPresetRequest
): Promise<BrandHashtagPreset> {
  const response = await httpClient.patch<SingleResponse<BrandHashtagPreset>>(
    `/brands/${brandId}/hashtag-presets/${presetId}`,
    data
  );

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to update hashtag preset";
    throw new Error(errorMessage);
  }

  return response.data.data;
}

/**
 * Delete a hashtag preset
 */
export async function deleteHashtagPreset(brandId: string, presetId: string): Promise<void> {
  const response = await httpClient.delete<DeleteResponse>(
    `/brands/${brandId}/hashtag-presets/${presetId}`
  );

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to delete hashtag preset";
    throw new Error(errorMessage);
  }
}

// ============================================================================
// Activity Operations
// ============================================================================

export interface ListBrandActivityParams {
  workspaceId: string;
  brandId: string;
  cursor?: string;
  limit?: number;
}

/**
 * List activity events for a brand
 * Uses the workspace activity endpoint and filters client-side by brand scope
 */
export async function listBrandActivity(params: ListBrandActivityParams): Promise<{
  items: any[]; // Raw activity events
  nextCursor: string | null;
}> {
  const searchParams = new URLSearchParams();
  
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  if (params.limit) {
    searchParams.set("limit", params.limit.toString());
  }

  const queryString = searchParams.toString();
  const url = queryString 
    ? `/workspaces/${params.workspaceId}/activity?${queryString}`
    : `/workspaces/${params.workspaceId}/activity`;

  const response = await httpClient.get<ActivityListResponse>(url);

  if (!response.ok) {
    const errorMessage = (response.details as any)?.error?.message || response.message || "Failed to list brand activity";
    throw new Error(errorMessage);
  }

  // Filter client-side to only show brand-related events
  const allItems = response.data.data.items || [];
  const brandItems = allItems.filter(
    (item: any) => item.scopeType === "brand" && item.scopeId === params.brandId
  );

  return {
    items: brandItems,
    nextCursor: response.data.data.nextCursor,
  };
}

