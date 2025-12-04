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
  if (hasJsonContent) {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } else {
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
   */
  async getMe(): Promise<MeResponse> {
    return fetchApi<MeResponse>('/me');
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
   * Logout user
   */
  async logout(): Promise<{ success: true; message: string }> {
    return fetchApi('/auth/logout', {
      method: 'POST',
    });
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
    return fetchApi('/me/onboarding/complete', {
      method: 'POST',
    });
  },

  // ============================================================================
  // Brand API Methods
  // ============================================================================

  /**
   * Get brand details by ID (includes profile and contact channels)
   */
  async getBrand(workspaceId: string, brandId: string): Promise<{ success: true; brand: BrandDetailDto }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}`);
  },

  /**
   * List brands in workspace
   */
  async listBrands(workspaceId: string, options?: { status?: 'ACTIVE' | 'ARCHIVED' }): Promise<{ 
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
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi(`/workspaces/${workspaceId}/brands${query}`);
  },

  /**
   * Update brand basic info
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
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // ============================================================================
  // Brand Profile API Methods
  // ============================================================================

  /**
   * Update brand profile
   */
  async updateBrandProfile(
    workspaceId: string, 
    brandId: string, 
    input: UpdateBrandProfileInput
  ): Promise<{ success: true; profile: BrandProfileDto }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
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
   */
  async createBrandContactChannel(
    workspaceId: string,
    brandId: string,
    input: CreateBrandContactChannelInput
  ): Promise<{ success: true; contactChannel: BrandContactChannelDto }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update a contact channel
   */
  async updateBrandContactChannel(
    workspaceId: string,
    brandId: string,
    channelId: string,
    input: UpdateBrandContactChannelInput
  ): Promise<{ success: true; contactChannel: BrandContactChannelDto }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/contacts/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a contact channel
   */
  async deleteBrandContactChannel(
    workspaceId: string,
    brandId: string,
    channelId: string
  ): Promise<{ success: true; message: string }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/contacts/${channelId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Reorder contact channels
   */
  async reorderBrandContactChannels(
    workspaceId: string,
    brandId: string,
    orders: { id: string; order: number }[]
  ): Promise<{ success: true; message: string }> {
    return fetchApi(`/workspaces/${workspaceId}/brands/${brandId}/contacts/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    });
  },
};

