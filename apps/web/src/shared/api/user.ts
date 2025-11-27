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

