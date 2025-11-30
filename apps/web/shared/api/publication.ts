import { httpClient } from "@/shared/http";

// ======================
// Instagram Publication Types
// ======================

interface InstagramImagePayload {
  contentType: "IMAGE";
  caption?: string;
  imageMediaId: string;
  altText?: string;
  locationId?: string;
  disableComments?: boolean;
  disableLikes?: boolean;
}

interface InstagramCarouselItem {
  mediaId: string;
  type: "IMAGE" | "VIDEO";
  altText?: string;
}

interface InstagramCarouselPayload {
  contentType: "CAROUSEL";
  caption?: string;
  items: InstagramCarouselItem[];
  locationId?: string;
  disableComments?: boolean;
  disableLikes?: boolean;
}

interface InstagramReelPayload {
  contentType: "REEL";
  caption?: string;
  videoMediaId: string;
  coverMediaId?: string;
  shareToFeed?: boolean;
  thumbOffsetSeconds?: number;
  audioRename?: string;
  disableComments?: boolean;
  disableLikes?: boolean;
}

interface InstagramStoryPayload {
  contentType: "STORY";
  storyType: "IMAGE" | "VIDEO";
  imageMediaId?: string;
  videoMediaId?: string;
}

type InstagramPublicationPayload =
  | InstagramImagePayload
  | InstagramCarouselPayload
  | InstagramReelPayload
  | InstagramStoryPayload;

export interface CreateInstagramPublicationRequest {
  socialAccountId: string;
  publishAt?: string; // ISO datetime string, optional for immediate publish
  clientRequestId?: string;
  payload: InstagramPublicationPayload;
}

// ======================
// Facebook Publication Types
// ======================

interface FacebookPhotoPayload {
  contentType: "PHOTO";
  message?: string;
  imageMediaId: string;
  altText?: string;
}

interface FacebookVideoPayload {
  contentType: "VIDEO";
  message?: string;
  videoMediaId: string;
  title?: string;
  thumbMediaId?: string;
}

interface FacebookLinkPayload {
  contentType: "LINK";
  message?: string;
  linkUrl: string;
}

interface FacebookStoryPayload {
  contentType: "STORY";
  storyType: "IMAGE" | "VIDEO";
  imageMediaId?: string;
  videoMediaId?: string;
}

type FacebookPublicationPayload =
  | FacebookPhotoPayload
  | FacebookVideoPayload
  | FacebookLinkPayload
  | FacebookStoryPayload;

export interface CreateFacebookPublicationRequest {
  socialAccountId: string;
  publishAt?: string; // ISO datetime string, optional for immediate publish
  clientRequestId?: string;
  payload: FacebookPublicationPayload;
}

// ======================
// Response Types
// ======================

export interface PublicationResponse {
  id: string;
  status: string;
  scheduledAt: string | null;
}

export interface CreatePublicationResponse {
  success: boolean;
  data: PublicationResponse;
}

// API error response structure
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      errors?: Array<{ path: string[]; code: string; message: string }>;
    };
  };
}

/**
 * Extract user-friendly error message from API response
 */
function extractErrorMessage(details: unknown, fallback: string): string {
  if (!details || typeof details !== "object") {
    return fallback;
  }

  const errorResponse = details as ApiErrorResponse;
  
  // Check for validation errors
  if (errorResponse.error?.details?.errors?.length) {
    const firstError = errorResponse.error.details.errors[0];
    return `${firstError.path.join(".")}: ${firstError.message}`;
  }

  // Check for general error message
  if (errorResponse.error?.message) {
    return errorResponse.error.message;
  }

  return fallback;
}

/**
 * Create an Instagram publication
 */
export async function createInstagramPublication(
  brandId: string,
  payload: CreateInstagramPublicationRequest
): Promise<PublicationResponse> {
  const response = await httpClient.post<CreatePublicationResponse>(
    `/brands/${brandId}/publications/instagram`,
    payload
  );

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(response.details, "Failed to create Instagram publication")
    );
  }

  return response.data.data;
}

/**
 * Create a Facebook publication
 */
export async function createFacebookPublication(
  brandId: string,
  payload: CreateFacebookPublicationRequest
): Promise<PublicationResponse> {
  const response = await httpClient.post<CreatePublicationResponse>(
    `/brands/${brandId}/publications/facebook`,
    payload
  );

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(response.details, "Failed to create Facebook publication")
    );
  }

  return response.data.data;
}

