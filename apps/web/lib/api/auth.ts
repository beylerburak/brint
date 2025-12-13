/**
 * Auth API
 * 
 * Authentication and user management endpoints
 */

import { fetchApi, apiCache } from './http';
import type { UserSettings, UserSettingsPatch } from '@brint/shared-config';

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
  settings: UserSettings;
  createdAt: string;
  updatedAt: string;
};

export type MeResponse = {
  success: true;
  user: UserProfile;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    timezone: string;
    locale: string;
    baseCurrency: string;
    plan: 'FREE' | 'STARTER' | 'PRO' | 'AGENCY';
    role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  }>;
};

export const authApi = {
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
      // Add timeout to pending request - if it takes too long, clear and retry
      return Promise.race([
        pending,
        new Promise<MeResponse>((_, reject) => {
          setTimeout(() => {
            console.warn('[API Cache] Pending /me request timed out, clearing cache');
            apiCache.clear(cacheKey);
            reject(new Error('Request timeout - please refresh the page'));
          }, 30000);
        })
      ]);
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
      // Don't cache errors - also clear pending request
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
   * Update user settings (theme, language, etc.)
   * @param patch - Partial settings to update
   */
  async updateMySettings(patch: UserSettingsPatch): Promise<{ success: true; settings: UserSettings }> {
    const response = await fetchApi<{ success: true; settings: UserSettings }>('/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });

    // Clear /me cache since settings changed
    apiCache.clear('me');

    return response;
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
    return fetchApi<{ success: true; message: string }>('/auth/logout', {
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
};
