import { httpClient } from "@/shared/http";
import { apiCache } from "@/shared/api/cache";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  firstOnboardedAt: string | null;
  completedOnboarding: boolean;
  lastLoginAt: string | null;
  locale: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  phone: string | null;
  avatarMediaId: string | null;
  avatarUrl?: string | null;
  googleId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetUserProfileResponse {
  success: boolean;
  data: UserProfile;
}

/**
 * Get current user profile
 * Uses global cache to prevent duplicate requests
 */
export async function getUserProfile(): Promise<UserProfile> {
  return apiCache.getOrFetch(
    "user:profile",
    async () => {
      const response = await httpClient.get<GetUserProfileResponse>("/users/me");

      if (!response.ok) {
        throw new Error(response.message || "Failed to get user profile");
      }

      return response.data.data;
    },
    60000 // 60 seconds cache
  );
}

export interface UpdateUserProfileRequest {
  name?: string | null;
  username?: string | null;
  locale?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  phone?: string | null;
  completedOnboarding?: boolean;
  avatarMediaId?: string | null;
}

export async function updateUserProfile(
  payload: UpdateUserProfileRequest
): Promise<UserProfile> {
  const response = await httpClient.patch<{ success: boolean; data: UserProfile }>(
    "/users/me",
    payload
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to update profile");
  }

  // Update cache with new data instead of invalidating
  // This prevents unnecessary refetches and provides immediate UI updates
  const updatedProfile = response.data.data;
  apiCache.set("user:profile", updatedProfile);
  
  // Invalidate session cache (it will refetch and update itself)
  apiCache.invalidate("session:current");
  
  // Dispatch custom event to notify components about profile update
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("userProfileUpdated", { 
      detail: updatedProfile 
    }));
  }

  return updatedProfile;
}

export async function disconnectGoogleConnection(): Promise<UserProfile> {
  const response = await httpClient.delete<{ success: boolean; data: UserProfile }>(
    "/users/me/google-connection"
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to disconnect Google");
  }

  // Invalidate caches so auth/session info refreshes
  apiCache.invalidate("user:profile");
  apiCache.invalidate("session:current");

  return response.data.data;
}

export interface CheckUsernameAvailabilityResponse {
  success: boolean;
  data: {
    available: boolean;
  };
}

/**
 * Check if username is available
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  if (!username.trim()) {
    return false;
  }

  const response = await httpClient.get<CheckUsernameAvailabilityResponse>(
    `/users/check-username/${encodeURIComponent(username.trim().toLowerCase())}`
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to check username availability");
  }

  return response.data.data.available;
}

