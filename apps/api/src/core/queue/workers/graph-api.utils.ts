/**
 * Graph API Utility Functions
 * 
 * Shared utilities for Instagram and Facebook Graph API operations.
 * Includes status checking, error handling, and verification functions.
 */

import { logger } from "../../../lib/logger.js";
import { env } from "../../../config/env.js";

// ====================
// Configuration
// ====================

export const GRAPH_API_VERSION = env.GRAPH_API_VERSION || "v24.0";
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ====================
// Types
// ====================

export interface GraphApiResponse {
  id?: string;
  post_id?: string;
  video_id?: string;
  upload_url?: string;
  error?: {
    message: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_msg?: string;
  };
}

export interface MediaResponse extends GraphApiResponse {
  permalink?: string;
  permalink_url?: string;
  status_code?: string;
  status?: string;
}

// ====================
// Graph API Helpers
// ====================

/**
 * Make a POST request to Graph API
 */
export async function graphPost(
  endpoint: string,
  params: Record<string, string | boolean | number>,
  accessToken: string
): Promise<GraphApiResponse> {
  const url = `${GRAPH_API_BASE}${endpoint}`;
  
  const body = new URLSearchParams();
  body.append("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    body.append(key, String(value));
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json() as GraphApiResponse;

  // Check for HTTP errors
  if (!response.ok) {
    logger.warn(
      { endpoint, status: response.status, response: data },
      "Graph API POST HTTP error"
    );
  }

  return data;
}

/**
 * Make a GET request to Graph API
 */
export async function graphGet(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<MediaResponse> {
  const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
  url.searchParams.append("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString());
  const data = await response.json() as MediaResponse;

  // Check for HTTP errors
  if (!response.ok) {
    logger.warn(
      { endpoint, status: response.status, response: data },
      "Graph API GET HTTP error"
    );
  }

  return data;
}

/**
 * Make a POST request to Graph API with JSON body
 * Used for endpoints that require JSON format (e.g., carousel with attached_media)
 */
export async function graphPostJson(
  endpoint: string,
  params: Record<string, any>,
  accessToken: string
): Promise<GraphApiResponse> {
  const url = `${GRAPH_API_BASE}${endpoint}`;
  
  // Add access_token to params
  const body = {
    ...params,
    access_token: accessToken,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as GraphApiResponse;

  // Check for HTTP errors
  if (!response.ok) {
    logger.warn(
      { endpoint, status: response.status, response: data },
      "Graph API HTTP error"
    );
  }
  
  return data;
}

// ====================
// Status Checking Utilities
// ====================

export interface StatusCheckOptions {
  maxAttempts?: number;
  initialWaitMs?: number;
  maxWaitMs?: number;
  backoffMultiplier?: number;
  context?: Record<string, unknown>;
}

/**
 * Wait for a container/media to reach a final status
 * Returns the final status code
 */
export async function waitForStatus(
  entityId: string,
  statusChecker: () => Promise<{ status_code?: string; status?: string; error?: GraphApiResponse["error"] }>,
  targetStatuses: string[],
  errorStatuses: string[],
  options: StatusCheckOptions = {}
): Promise<string> {
  const {
    maxAttempts = 60,
    initialWaitMs = 3000,
    maxWaitMs = 15000,
    backoffMultiplier = 1.5,
    context = {},
  } = options;

  let attempts = 0;
  let lastStatus = "UNKNOWN";
  let waitTime = initialWaitMs;

  while (attempts < maxAttempts) {
    try {
      const statusResponse = await statusChecker();
      
      lastStatus = statusResponse.status_code || statusResponse.status || "UNKNOWN";
      
      if (statusResponse.error) {
        logger.warn(
          { entityId, error: statusResponse.error, attempts: attempts + 1, ...context },
          "Status check returned error"
        );
        // Continue waiting for transient errors
      }

      logger.debug(
        { entityId, status: lastStatus, attempt: attempts + 1, maxAttempts, ...context },
        "Status check"
      );

      // Check if processing is complete
      if (targetStatuses.includes(lastStatus)) {
        logger.info(
          { entityId, status: lastStatus, attempts: attempts + 1, ...context },
          "Status check completed successfully"
        );
        return lastStatus;
      }

      // Check for error states
      if (errorStatuses.includes(lastStatus)) {
        throw new Error(`Entity processing failed with status: ${lastStatus}`);
      }

      // Still processing - wait before next check with exponential backoff
      logger.debug(
        { entityId, status: lastStatus, waitTime, ...context },
        "Entity still processing, waiting..."
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      
      // Exponential backoff
      waitTime = Math.min(waitTime * backoffMultiplier, maxWaitMs);
      attempts++;

    } catch (statusError: unknown) {
      const errorMessage = statusError instanceof Error ? statusError.message : String(statusError);
      logger.warn(
        { entityId, statusError: errorMessage, attempts: attempts + 1, ...context },
        "Status check failed, continuing to wait"
      );
      
      // Continue waiting even if status check fails
      await new Promise((resolve) => setTimeout(resolve, 10000));
      attempts++;
    }
  }

  throw new Error(
    `Entity processing did not complete within timeout. Current status: ${lastStatus}. Final attempt: ${attempts}`
  );
}

// ====================
// Post-Publish Verification
// ====================

/**
 * Verify that an Instagram media post was successfully published
 * Checks if the media exists and is accessible.
 * Note: Some content types (like carousels) don't support status_code field.
 * This function checks for post existence regardless of available fields.
 */
export async function verifyInstagramPostPublished(
  mediaId: string,
  accessToken: string,
  options: { maxAttempts?: number } = {}
): Promise<{ exists: boolean; permalink?: string; status?: string }> {
  const { maxAttempts = 3 } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Request only basic fields that are available for all content types
      // Don't request status_code as it's not available for carousels and some other types
      const response = await graphGet(
        `/${mediaId}`,
        { fields: "id,permalink" },
        accessToken
      );

      if (response.error) {
        // Check for specific error codes
        const errorCode = response.error.code;
        const errorSubcode = response.error.error_subcode;
        const errorMessage = response.error.message || "";
        const errorMessageLower = errorMessage.toLowerCase();
        
        // Error code 100 + subcode 33 typically means "field not supported" (post exists, field doesn't)
        // This is common for carousels, stories, and some other content types
        // Example: "Tried accessing nonexisting field (status_code) on node type (ShadowIGMedia)"
        // Check both number and string formats for subcode
        const hasFieldErrorSubcode = errorSubcode === 33 || errorSubcode === "33";
        
        // Check error message for field-related errors (check this first as it's more reliable)
        const isFieldNotSupportedError = 
          errorMessageLower.includes("nonexisting field") ||
          errorMessageLower.includes("tried accessing nonexisting field") ||
          errorMessageLower.includes("shadowigmedia") ||
          (errorMessageLower.includes("does not support") && errorMessageLower.includes("field")) ||
          (errorCode === 100 && hasFieldErrorSubcode);
        
        if (isFieldNotSupportedError) {
          // Field not supported - post exists but the requested field doesn't
          // Since publish response was successful, we trust that the post was published
          logger.info(
            { mediaId, error: response.error, errorCode, errorSubcode, attempt: attempt + 1 },
            "Instagram post verification: field not supported (error 100/33 or field error message, common for carousels/stories), assuming published (publish response was successful)"
          );
          return { exists: true, permalink: response.permalink };
        }
        
        // Error code 100 typically means "object not found" or permission issue
        // But only if it's not a field error
        if (errorCode === 100) {
          // Check if it's a true "not found" error (not field error)
          const isObjectNotFound = 
            errorMessageLower.includes("does not exist") ||
            (errorMessageLower.includes("cannot be loaded") && errorMessageLower.includes("missing permissions"));
          
          if (isObjectNotFound) {
            logger.warn(
              { mediaId, error: response.error, attempt: attempt + 1 },
              "Instagram post not found (object doesn't exist or no permissions)"
            );
            return { exists: false };
          }
          
          // For other error code 100 errors, assume it might be a field/operation issue
          // Since publish was successful, trust that post exists
          logger.info(
            { mediaId, error: response.error, attempt: attempt + 1 },
            "Instagram post verification: error code 100 (assuming field/operation not supported), assuming published (publish response was successful)"
          );
          return { exists: true };
        }
        
        // Other errors - wait and retry
        logger.warn(
          { mediaId, error: response.error, attempt: attempt + 1 },
          "Instagram post verification error, will retry"
        );
        
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        
        return { exists: false };
      }

      // Post exists if we get a valid response with an ID
      if (response.id === mediaId || response.id) {
        logger.info(
          { mediaId, permalink: response.permalink, attempt: attempt + 1 },
          "Instagram post verified as published"
        );
        return {
          exists: true,
          permalink: response.permalink,
          status: response.status_code,
        };
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.warn(
        { mediaId, error: errorMessage, attempt: attempt + 1 },
        "Error verifying Instagram post"
      );
      
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
    }
  }

  return { exists: false };
}

/**
 * Verify that a Facebook post was successfully published
 * Checks if the post exists and is accessible
 */
export async function verifyFacebookPostPublished(
  postId: string,
  accessToken: string,
  options: { maxAttempts?: number } = {}
): Promise<{ exists: boolean; permalink?: string }> {
  const { maxAttempts = 3 } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await graphGet(
        `/${postId}`,
        { fields: "id,permalink_url" },
        accessToken
      );

      if (response.error) {
        // If we get an error, the post might not exist or we don't have access
        logger.warn(
          { postId, error: response.error, attempt: attempt + 1 },
          "Failed to verify Facebook post existence"
        );
        
        if (response.error.code === 100) {
          // Object not found - post doesn't exist
          return { exists: false };
        }
        
        // Other errors - wait and retry
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        
        return { exists: false };
      }

      // Post exists if we get a valid response with an ID
      if (response.id === postId || (response as any).post_id === postId) {
        logger.info(
          { postId, permalink: response.permalink_url, attempt: attempt + 1 },
          "Facebook post verified as published"
        );
        return {
          exists: true,
          permalink: response.permalink_url || response.permalink,
        };
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        { postId, error: errorMessage, attempt: attempt + 1 },
        "Error verifying Facebook post"
      );
      
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
    }
  }

  return { exists: false };
}

// ====================
// Error Handling
// ====================

/**
 * Extract error message from Graph API error response
 */
export function extractGraphApiErrorMessage(error: GraphApiResponse["error"] | undefined): string {
  if (!error) return "Unknown error";
  
  return error.error_user_msg || error.message || `Graph API error (code: ${error.code})`;
}

/**
 * Check if a Graph API error is retryable
 */
export function isRetryableError(error: GraphApiResponse["error"] | undefined): boolean {
  if (!error) return false;
  
  // Retryable error codes (rate limiting, temporary failures, etc.)
  const retryableCodes = [
    4,      // Application request limit reached
    17,     // User request limit reached
    32,     // Page request limit reached
    613,    // Rate limit exceeded
    80001,  // Rate limit exceeded (alternative)
  ];
  
  if (retryableCodes.includes(error.code)) {
    return true;
  }
  
  // Check error message for retryable error patterns
  const errorMessage = (error.error_user_msg || error.message || "").toLowerCase();
  
  // Media not ready errors (common in Instagram/Facebook)
  const retryablePatterns = [
    "medya yayınlanmaya hazır değil",
    "not ready",
    "media is not ready",
    "please wait",
    "lütfen bekle",
    "processing",
    "in progress",
    "hazır değil",
  ];
  
  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Custom error class for retryable errors in publication workers
 * These errors should not be sent to Sentry unless max attempts reached
 */
export class RetryablePublicationError extends Error {
  readonly isRetryable = true;
  
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "RetryablePublicationError";
  }
}

