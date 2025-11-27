import { httpClient } from "@/shared/http";

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
  phone: string | null;
  avatarMediaId: string | null;
  avatarUrl?: string | null;
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
 */
export async function getUserProfile(): Promise<UserProfile> {
  const response = await httpClient.get<GetUserProfileResponse>("/users/me");

  if (!response.ok) {
    throw new Error(response.message || "Failed to get user profile");
  }

  return response.data.data;
}

export interface UpdateUserProfileRequest {
  name?: string | null;
  username?: string | null;
  locale?: string;
  timezone?: string;
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

  return response.data.data;
}
