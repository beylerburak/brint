/**
 * API Client
 * 
 * Centralized HTTP client for backend API calls
 */

import type {
  BrandDetailDto,
  BrandProfileDto,
  BrandContactChannelDto,
  CreateBrandContactChannelInput,
  UpdateBrandContactChannelInput,
  UpdateBrandProfileInput,
} from './brand-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================================
// Cache Management
// ============================================================================

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string, ttl: number = this.DEFAULT_TTL): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get or set pending request to prevent duplicate simultaneous requests
   */
  getPendingRequest<T>(key: string): Promise<T> | null {
    return this.pendingRequests.get(key) || null;
  }

  /**
   * Set pending request
   */
  setPendingRequest<T>(key: string, promise: Promise<T>): void {
    this.pendingRequests.set(key, promise);

    // Clean up when promise settles
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
  }
}

const apiCache = new ApiCache();

// Helper to clear auth cookies on client
function clearClientCookies() {
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { skipAuthRedirect?: boolean }
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Only set Content-Type if there's a body
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies
      headers,
    });
  } catch (networkError) {
    // Network error (blocked, offline, CORS preflight failed, etc.)
    console.error('[API] Network error:', networkError);

    // Clear potentially corrupted cookies
    if (typeof window !== 'undefined') {
      clearClientCookies();
    }

    throw new ApiError('Network error - please refresh the page', 0, 'NETWORK_ERROR');
  }

  // Check if response has content
  const contentType = response.headers.get('content-type');
  const hasJsonContent = contentType?.includes('application/json');

  let data: any;
  try {
    const responseText = await response.text();
    if (hasJsonContent && responseText) {
      data = JSON.parse(responseText);
    } else {
      data = responseText ? { raw: responseText } : {};
    }
  } catch (parseError) {
    console.error('[API] Failed to parse response:', parseError);
    data = {};
  }

  if (!response.ok) {
    // Handle 401 Unauthorized - clear cookies and redirect to login
    if (response.status === 401 && !options?.skipAuthRedirect) {
      console.warn('[API] 401 Unauthorized - clearing cookies and redirecting to login');
      clearClientCookies();

      // Only redirect if in browser
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }

      throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
    }

    throw new ApiError(
      data.error?.message || 'API request failed',
      response.status,
      data.error?.code
    );
  }

  return data;
}

// Types
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
export type WorkspacePlan = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY';

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  avatarMediaId: string | null;
  avatarUrls?: {
    thumbnail: string | null;
    small: string | null;
    medium: string | null;
    large: string | null;
  } | null;
  emailVerified: string | null;
  timezonePreference: 'WORKSPACE' | 'LOCAL';
  timezone: string | null;
  locale: string | null;
  dateFormat: 'DMY' | 'MDY' | 'YMD';
  timeFormat: 'H24' | 'H12';
  phoneNumber: string | null;
  phoneVerifiedAt: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  baseCurrency: string;
  plan: WorkspacePlan;
  role: WorkspaceRole;
};

export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  baseCurrency: string;
  plan: WorkspacePlan;
  settings: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  userRole: WorkspaceRole;
};

export type MeResponse = {
  success: true;
  user: UserProfile;
  workspaces: WorkspaceSummary[];
};

export type WorkspaceDetailsResponse = {
  success: true;
  workspace: WorkspaceDetails;
};

// API Methods
export const apiClient = {
  /**
   * Get current user profile and workspaces
   * Automatically cached to prevent duplicate requests
   * @param options.skipCache - Skip cache and fetch fresh data
   */
  async getMe(options?: { skipCache?: boolean }): Promise<MeResponse> {
    const cacheKey = 'me';

    // Check if we should skip cache
    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
    const cached = apiCache.get<MeResponse>(cacheKey);
    if (cached) {
      console.log('[API Cache] Returning cached /me response');
      return cached;
    }

    // Check if there's already a pending request
    const pending = apiCache.getPendingRequest<MeResponse>(cacheKey);
    if (pending) {
      console.log('[API Cache] Waiting for pending /me request');
      return pending;
    }

    // Make the request
    console.log('[API Cache] Fetching fresh /me data');
    const promise = fetchApi<MeResponse>('/me');
    apiCache.setPendingRequest(cacheKey, promise);

    try {
      const response = await promise;
      apiCache.set(cacheKey, response);
      return response;
    } catch (error) {
      // Don't cache errors
      apiCache.clear(cacheKey);
      throw error;
    }
  },

  /**
   * Clear /me cache (useful after logout or profile updates)
   */
  clearMeCache(): void {
    apiCache.clear('me');
  },

  /**
   * Clear all API cache
   */
  clearAllCache(): void {
    apiCache.clearAll();
  },

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceId: string): Promise<WorkspaceDetailsResponse> {
    return fetchApi<WorkspaceDetailsResponse>(`/workspaces/${workspaceId}`);
  },

  /**
   * List all user workspaces
   */
  async listWorkspaces(): Promise<{ success: true; workspaces: WorkspaceSummary[] }> {
    return fetchApi('/workspaces');
  },


  /**
   * Register new user
   */
  async register(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<{
    success: true;
    data: {
      requiresEmailVerification: boolean;
    };
  }> {
    return fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRedirect: true, // Don't redirect on 401 for registration
    });
  },

  /**
   * Verify email with 6-digit code
   */
  async verifyEmailCode(data: {
    email: string;
    code: string;
  }): Promise<{
    success: true;
    data: {
      emailVerified: boolean;
    };
  }> {
    return fetchApi('/auth/verify-email-code', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRedirect: true,
    });
  },

  /**
   * Resend verification code
   */
  async resendVerificationCode(data: {
    email: string;
  }): Promise<{
    success: true;
  }> {
    return fetchApi('/auth/resend-verification-code', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRedirect: true,
    });
  },

  /**
   * Login user
   */
  async login(data: {
    email: string;
    password: string;
  }): Promise<{
    success: true;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
    redirectTo: string;
  }> {
    return fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRedirect: true,
    });
  },

  /**
   * Logout user
   */
  async logout(): Promise<{ success: true; message: string }> {
    const result = await fetchApi<{ success: true; message: string }>('/auth/logout', {
      method: 'POST',
    });

    // Clear all cache on logout
    this.clearAllCache();

    return result;
  },

  /**
   * Complete onboarding
   */
  async completeOnboarding(): Promise<{
    success: true;
    user: {
      id: string;
      email: string;
      hasCompletedOnboarding: boolean;
    }
  }> {
    const result = await fetchApi<{
      success: true;
      user: {
        id: string;
        email: string;
        hasCompletedOnboarding: boolean;
      }
    }>('/me/onboarding/complete', {
      method: 'POST',
    });

    // Clear /me cache since user data changed
    this.clearMeCache();

    return result;
  },

  // ============================================================================
  // Brand API Methods
  // ============================================================================

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

    // Check if we should skip cache
    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
    const cached = apiCache.get<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (cached) {
      console.log(`[API Cache] Returning cached brand ${brandId}`);
      return cached;
    }

    // Check if there's already a pending request
    const pending = apiCache.getPendingRequest<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending brand request ${brandId}`);
      return pending;
    }

    // Make the request
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

    // Check if we should skip cache
    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
    const cached = apiCache.get<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (cached) {
      console.log(`[API Cache] Returning cached brand slug ${slug}`);
      return cached;
    }

    // Check if there's already a pending request
    const pending = apiCache.getPendingRequest<{ success: true; brand: BrandDetailDto }>(cacheKey);
    if (pending) {
      console.log(`[API Cache] Waiting for pending brand slug request ${slug}`);
      return pending;
    }

    // Make the request
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

    // Check if we should skip cache
    if (options?.skipCache) {
      apiCache.clear(cacheKey);
    }

    // Return cached data if available
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

    // Check if there's already a pending request
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

    // Make the request
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
   * List workspace members
   */
  async listWorkspaceMembers(workspaceId: string): Promise<{
    success: true;
    members: Array<{
      id: string;
      name: string | null;
      email: string;
      avatarMediaId: string | null;
      avatarUrl: string | null;
      role: string;
    }>;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/members`);
  },

  /**
   * Update workspace member role
   */
  async updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
  ): Promise<{
    success: true;
    member: {
      id: string;
      name: string | null;
      email: string;
      role: string;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  /**
   * Remove member from workspace
   */
  async removeWorkspaceMember(
    workspaceId: string,
    userId: string
  ): Promise<{
    success: true;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Invite a user to workspace by email
   */
  async inviteWorkspaceMember(
    workspaceId: string,
    email: string,
    role: 'ADMIN' | 'EDITOR' | 'VIEWER' = 'VIEWER'
  ): Promise<{
    success: true;
    member: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
      role: string;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
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

  // ============================================================================
  // Brand Profile API Methods
  // ============================================================================

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

  // ============================================================================
  // Brand Contact Channel API Methods
  // ============================================================================

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

  // ============================================================================
  // Brand Optimization Score API Methods
  // ============================================================================

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

  // ============================================================================
  // Task API Methods
  // ============================================================================

  /**
   * List tasks
   */
  async listTasks(params: {
    workspaceId: string;
    brandId?: string;
    projectId?: string;
    statusIds?: string[];
    assigneeUserId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: true;
    tasks: Array<{
      id: string;
      taskNumber: number;
      title: string;
      description: string | null;
      status: {
        id: string;
        label: string;
        color: string | null;
        group: 'TODO' | 'IN_PROGRESS' | 'DONE';
      };
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId: string | null;
      dueDate: string | null;
      assignedTo?: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null }>;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params.brandId) searchParams.append('brandId', params.brandId);
    if (params.projectId) searchParams.append('projectId', params.projectId);
    if (params.statusIds) params.statusIds.forEach(id => searchParams.append('statusIds[]', id));
    if (params.assigneeUserId) searchParams.append('assigneeUserId', params.assigneeUserId);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return fetchApi(`/tasks${query}`, {
      headers: {
        'X-Workspace-Id': params.workspaceId,
      },
    });
  },

  /**
   * Get task details (includes checklist, attachments, comments)
   */
  async getTask(
    workspaceId: string,
    taskId: string
  ): Promise<{
    success: true;
    task: {
      id: string;
      title: string;
      description: string | null;
      status: {
        id: string;
        label: string;
        color: string | null;
        group: 'TODO' | 'IN_PROGRESS' | 'DONE';
      };
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId: string | null;
      dueDate: string | null;
      assignedTo?: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null }>;
      checklistItems?: Array<{
        id: string;
        title: string;
        isCompleted: boolean;
        sortOrder: number;
      }>;
      attachments?: Array<{
        id: string;
        mediaId: string;
        title: string | null;
      }>;
      comments?: Array<{
        id: string;
        body: string;
        authorUserId: string;
        createdAt: string;
        author: {
          id: string;
          name: string | null;
          email: string;
          avatarUrl: string | null;
        };
      }>;
      createdAt: string;
      updatedAt: string;
    };
  }> {
    return fetchApi(`/tasks/${taskId}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Create a new task
   */
  async createTask(
    workspaceId: string,
    data: {
      title: string;
      description?: string;
      brandId?: string;
      projectId?: string;
      statusId?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId?: string;
      dueDate?: string;
    }
  ): Promise<{ success: true; task: any }> {
    return fetchApi('/tasks', {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a task
   */
  async updateTask(
    workspaceId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      statusId?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeUserId?: string | null;
      dueDate?: string;
      checklistItems?: Array<{
        id?: string;
        title: string;
        isCompleted?: boolean;
        sortOrder?: number;
      }>;
      attachmentMediaIds?: string[];
    }
  ): Promise<{ success: true; task: any }> {
    return fetchApi(`/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a task
   */
  async deleteTask(
    workspaceId: string,
    taskId: string
  ): Promise<{ success: true; message: string }> {
    return fetchApi(`/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * List comments for a task
   */
  async listTaskComments(
    workspaceId: string,
    taskId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    success: true;
    comments: Array<{
      id: string;
      body: string;
      authorUserId: string;
      parentId: string | null;
      isEdited: boolean;
      createdAt: string;
      author: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
        avatarMediaId: string | null;
      };
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return fetchApi(`/tasks/${taskId}/comments${query}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Get activity logs for a task
   */
  async listTaskActivityLogs(
    workspaceId: string,
    taskId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    success: true;
    activities: Array<{
      id: string;
      eventKey: string;
      message: string | null;
      context: string | null;
      actorType: string;
      actorUserId: string | null;
      actorLabel: string | null;
      actor: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
        avatarMediaId: string | null;
      } | null;
      payload: any;
      severity: string;
      visibility: string;
      createdAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return fetchApi(`/tasks/${taskId}/activity${query}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Create a comment on a task
   */
  async createTaskComment(
    workspaceId: string,
    taskId: string,
    data: {
      body: string;
      parentId?: string;
    }
  ): Promise<{
    success: true;
    comment: {
      id: string;
      body: string;
      createdAt: string;
      author: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
        avatarMediaId: string | null;
      };
    };
  }> {
    return fetchApi(`/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * List task statuses (grouped)
   */
  async listTaskStatuses(
    workspaceId: string,
    brandId?: string
  ): Promise<{
    success: true;
    statuses: {
      TODO: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
      IN_PROGRESS: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
      DONE: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (brandId) searchParams.append('brandId', brandId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return fetchApi(`/task-statuses${query}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Upload media file
   */
  async uploadMedia(
    workspaceId: string,
    file: File
  ): Promise<{
    success: true;
    media: {
      id: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      baseKey: string;
      bucket: string;
      variants?: Record<string, string>;
      createdAt: string;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/media`, {
      method: 'POST',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        data.error?.message || 'Failed to upload media',
        response.status,
        data.error?.code
      );
    }

    return response.json();
  },

  /**
   * Get media URL (for downloading/viewing)
   */
  getMediaUrl(workspaceId: string, mediaId: string, variant?: string): string {
    const variantParam = variant ? `?variant=${variant}` : '';
    return `${API_BASE_URL}/workspaces/${workspaceId}/media/${mediaId}/download${variantParam}`;
  },

  /**
   * Get media details by mediaId
   */
  async getMedia(
    workspaceId: string,
    mediaId: string
  ): Promise<{
    success: true;
    media: {
      id: string;
      originalFilename: string;
      extension: string;
      sizeBytes: number;
      mimeType: string;
      [key: string]: any;
    };
  }> {
    return fetchApi(`/workspaces/${workspaceId}/media/${mediaId}`, {
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },

  /**
   * Delete media file (from S3 and database)
   */
  async deleteMedia(
    workspaceId: string,
    mediaId: string
  ): Promise<{
    success: true;
    message: string;
  }> {
    return fetchApi(`/workspaces/${workspaceId}/media/${mediaId}`, {
      method: 'DELETE',
      headers: {
        'X-Workspace-Id': workspaceId,
      },
    });
  },
};

