/**
 * Brands API
 * 
 * Brand management endpoints
 */

import { fetchApi, apiCache } from './http';
import type {
  BrandDetailDto,
  BrandProfileDto,
  BrandContactChannelDto,
  CreateBrandContactChannelInput,
  UpdateBrandContactChannelInput,
  UpdateBrandProfileInput,
} from '../brand-types';

export const brandsApi = {
  /**
   * Get brand details by ID (includes profile and contact channels)
   * Automatically cached per brand
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async getBrand(
    workspaceId: string,
    brandId: string,
    options?: { skipCache?: boolean }
  ): Promise<{ success: true; brand: BrandDetailDto }> {
    const cacheKey = `brand:${brandId}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    const cached = apiCache.get<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (cached) {
      console.log(`[API Cache] Returning cached brand ${brandId}`);
      return cached;
    }

    const pending = apiCache.getPendingRequest<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending brand request ${brandId}`);
      return pending;
    }

    console.log(`[API Cache] Fetching fresh brand ${brandId}`);
    const promise = fetchApi<{ success: true; brand: BrandDetailDto }>(`/workspaces/${workspaceId}/brands/${brandId}`);
    apiCache.setPendingRequest(cacheKey, promise);

    try {
      const response = await promise;
      apiCache.set(cacheKey, response);
      return response;
    } catch (error) {
      apiCache.clear(cacheKey);
      throw error;
    }
  },

  /**
   * Get brand details by slug
   * Automatically cached per brand
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async getBrandBySlug(
    input: { workspaceId: string; slug: string },
    options?: { skipCache?: boolean }
  ): Promise<{ success: true; brand: BrandDetailDto }> {
    const { workspaceId, slug } = input;
    const cacheKey = `brand:slug:${slug}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    const cached = apiCache.get<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (cached) {
      console.log(`[API Cache] Returning cached brand slug ${slug}`);
      return cached;
    }

    const pending = apiCache.getPendingRequest<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending brand slug request ${slug}`);
      return pending;
    }

    console.log(`[API Cache] Fetching fresh brand slug ${slug}`);
    const promise = fetchApi<{ success: true; brand: BrandDetailDto }>(`/workspaces/${workspaceId}/brands/slug/${slug}`);
    apiCache.setPendingRequest(cacheKey, promise);

    try {
      const response = await promise;
      apiCache.set(cacheKey, response);
      // Also cache by ID if we got the brand back
      if (response.brand?.id) {
        apiCache.set(`brand:${response.brand.id}`, response);
      }
      return response;
    } catch (error) {
      apiCache.clear(cacheKey);
      throw error;
    }
  },

  /**
   * Clear brand cache
   */
  clearBrandCache(brandId: string): void {
    apiCache.clear(`brand:${brandId}`);
  },

  /**
   * List brands in workspace
   * Automatically cached per workspace
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async listBrands(
    workspaceId: string,
    options?: { status?: 'ACTIVE' | 'ARCHIVED'; skipCache?: boolean }
  ): Promise<{
    success: true;
    brands: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      industry: string | null;
      country: string | null;
      city: string | null;
      primaryLocale: string | null;
      timezone: string | null;
      status: 'ACTIVE' | 'ARCHIVED';
      logoMediaId: string | null;
      logoUrl: string | null;
      mediaCount: number;
      createdAt: string;
      updatedAt: string;
    }>;
    total: number;
  }> {
    const cacheKey = `brands:${workspaceId}:${options?.status || 'all'}`;

    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    const cached = apiCache.get<{
      success: true;
      brands: Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        industry: string | null;
        country: string | null;
        city: string | null;
        primaryLocale: string | null;
        timezone: string | null;
        status: 'ACTIVE' | 'ARCHIVED';
        logoMediaId: string | null;
        logoUrl: string | null;
        mediaCount: number;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
    }>(cacheKey);

    const pending = apiCache.getPendingRequest<{
      success: true;
      brands: Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        industry: string | null;
        country: string | null;
        city: string | null;
        primaryLocale: string | null;
        timezone: string | null;
        status: 'ACTIVE' | 'ARCHIVED';
        logoMediaId: string | null;
        logoUrl: string | null;
        mediaCount: number;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
    }>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending brands request for workspace ${workspaceId}`);
      return pending;
    }

    console.log(`[API Cache] Fetching fresh brands for workspace ${workspaceId}`);
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const promise = fetchApi<{
      success: true;
      brands: Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        industry: string | null;
        country: string | null;
        city: string | null;
        primaryLocale: string | null;
        timezone: string | null;
        status: 'ACTIVE' | 'ARCHIVED';
        logoMediaId: string | null;
        logoUrl: string | null;
        mediaCount: number;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
    }>(`/workspaces/${workspaceId}/brands${query}`);
    apiCache.setPendingRequest(cacheKey, promise);

    try {
      const response = await promise;
      apiCache.set(cacheKey, response);
      return response;
    } catch (error) {
      apiCache.clear(cacheKey);
      throw error;
    }
  },

  /**
   * Clear brands cache for a workspace
   */
  clearBrandsCache(workspaceId: string): void {
    apiCache.clear(`brands:${workspaceId}:all`);
    apiCache.clear(`brands:${workspaceId}:ACTIVE`);
    apiCache.clear(`brands:${workspaceId}:ARCHIVED`);
  },

  /**
   * Update brand basic info
   * Automatically updates cache
   */
  async updateBrand(
    workspaceId: string,
    brandId: string,
    data: {
      name?: string;
      description?: string | null;
      industry?: string | null;
      country?: string | null;
      city?: string | null;
      primaryLocale?: string | null;
      timezone?: string | null;
      status?: 'ACTIVE' | 'ARCHIVED';
      logoMediaId?: string | null;
    }
  ): Promise<{ success: true; brand: any }> {
    const result = await fetchApi<{ success: true; brand: any }>(`/workspaces/${workspaceId}/brands/${brandId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    // Update brand cache with new data
    const brandCacheKey = `brand:${brandId}`;
    const cachedBrand = apiCache.get<{ success: true; brand: BrandDetailDto }>(brandCacheKey);
    if (cachedBrand) {
      console.log(`[API Cache] Updating brand cache ${brandId} with new data`);
      cachedBrand.brand = { ...cachedBrand.brand, ...result.brand };
      apiCache.set(brandCacheKey, cachedBrand);
    }

    // Clear brands list cache to reflect changes
    this.clearBrandsCache(workspaceId);

    return result;
  },

  /**
   * Update brand profile
   * Automatically updates brand cache
   */
  async updateBrandProfile(
    workspaceId: string,
    brandId: string,
    input: UpdateBrandProfileInput
  ): Promise<{ success: true; profile: BrandProfileDto }> {
    const result = await fetchApi<{ success: true; profile: BrandProfileDto }>(`/workspaces/${workspaceId}/brands/${brandId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });

    // Update brand cache with new profile data
    const brandCacheKey = `brand:${brandId}`;
    const cachedBrand = apiCache.get<{ success: true; brand: BrandDetailDto }>(brandCacheKey);
    if (cachedBrand) {
      console.log(`[API Cache] Updating brand cache ${brandId} with new profile data`);
      cachedBrand.brand.profile = result.profile;
      apiCache.set(brandCacheKey, cachedBrand);
    }

    return result;
  },

  /**
   * List contact channels for a brand
   */
  async listBrandContactChannels(
    workspaceId: string,
    brandId: string
  ): Promise<{ success: true; contactChannels: BrandContactChannelDto[] }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/contacts`);
  },

  /**
   * Create a new contact channel
   * Automatically updates brand cache
   */
  async createBrandContactChannel(
    workspaceId: string,
    brandId: string,
    input: CreateBrandContactChannelInput
  ): Promise<{ success: true; contactChannel: BrandContactChannelDto }> {
    const result = await fetchApi<{ success: true; contactChannel: BrandContactChannelDto }>(`/workspaces/${workspaceId}/brands/${brandId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    // Update brand cache with new contact channel
    const brandCacheKey = `brand:${brandId}`;
    const cachedBrand = apiCache.get<{ success: true; brand: BrandDetailDto }>(brandCacheKey);
    if (cachedBrand && cachedBrand.brand.contactChannels) {
      console.log(`[API Cache] Adding new contact channel to brand cache ${brandId}`);
      cachedBrand.brand.contactChannels.push(result.contactChannel);
      apiCache.set(brandCacheKey, cachedBrand);
    }

    return result;
  },

  /**
   * Update a contact channel
   * Automatically updates brand cache
   */
  async updateBrandContactChannel(
    workspaceId: string,
    brandId: string,
    channelId: string,
    input: UpdateBrandContactChannelInput
  ): Promise<{ success: true; contactChannel: BrandContactChannelDto }> {
    const result = await fetchApi<{ success: true; contactChannel: BrandContactChannelDto }>(`/workspaces/${workspaceId}/brands/${brandId}/contacts/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });

    // Update brand cache with updated contact channel
    const brandCacheKey = `brand:${brandId}`;
    const cachedBrand = apiCache.get<{ success: true; brand: BrandDetailDto }>(brandCacheKey);
    if (cachedBrand && cachedBrand.brand.contactChannels) {
      console.log(`[API Cache] Updating contact channel in brand cache ${brandId}`);
      const index = cachedBrand.brand.contactChannels.findIndex(c => c.id === channelId);
      if (index !== -1) {
        cachedBrand.brand.contactChannels[index] = result.contactChannel;
        apiCache.set(brandCacheKey, cachedBrand);
      }
    }

    return result;
  },

  /**
   * Delete a contact channel
   * Automatically updates brand cache
   */
  async deleteBrandContactChannel(
    workspaceId: string,
    brandId: string,
    channelId: string
  ): Promise<{ success: true; message: string }> {
    const result = await fetchApi<{ success: true; message: string }>(`/workspaces/${workspaceId}/brands/${brandId}/contacts/${channelId}`, {
      method: 'DELETE',
    });

    // Update brand cache by removing contact channel
    const brandCacheKey = `brand:${brandId}`;
    const cachedBrand = apiCache.get<{ success: true; brand: BrandDetailDto }>(brandCacheKey);
    if (cachedBrand && cachedBrand.brand.contactChannels) {
      console.log(`[API Cache] Removing contact channel from brand cache ${brandId}`);
      cachedBrand.brand.contactChannels = cachedBrand.brand.contactChannels.filter(c => c.id !== channelId);
      apiCache.set(brandCacheKey, cachedBrand);
    }

    return result;
  },

  /**
   * Reorder contact channels
   */
  async reorderBrandContactChannels(
    workspaceId: string,
    brandId: string,
    orders: { id: string; order: number }[]
  ): Promise<{ success: true; message: string }> {
    return fetchApi<{ success: true; message: string }>(`/workspaces/${workspaceId}/brands/${brandId}/contacts/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    });
  },

  /**
   * Get brand optimization score (calculates but doesn't save)
   */
  async getBrandOptimizationScore(
    workspaceId: string,
    brandId: string
  ): Promise<{
    success: true;
    optimizationScore: {
      score: number;
      maxScore: number;
      percentage: number;
      breakdown: Array<{
        section: string;
        score: number;
        maxScore: number;
        issues: string[];
      }>;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/optimization-score`);
  },

  /**
   * Refresh brand optimization score (calculates and saves to profile)
   */
  async refreshBrandOptimizationScore(
    workspaceId: string,
    brandId: string
  ): Promise<{
    success: true;
    message: string;
    optimizationScore: {
      score: number;
      maxScore: number;
      percentage: number;
      breakdown: Array<{
        section: string;
        score: number;
        maxScore: number;
        issues: string[];
      }>;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/optimization-score/refresh`, {
      method: 'POST',
    });
  },
};
