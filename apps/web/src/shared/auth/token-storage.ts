/**
 * Token Storage Helper
 * 
 * Manages access token storage in localStorage and memory.
 * Refresh token is managed by backend via HTTP-only cookies.
 */

let accessToken: string | null = null;

const ACCESS_TOKEN_KEY = "access_token";

/**
 * Set access token in memory and localStorage
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;

  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }
}

/**
 * Get access token from memory or localStorage
 */
export function getAccessToken(): string | null {
  // Return in-memory token if available
  if (accessToken) {
    return accessToken;
  }

  // Try to load from localStorage (client-side only)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored) {
      accessToken = stored;
      return stored;
    }
  }

  return null;
}

/**
 * Clear access token from memory and localStorage
 */
export function clearAccessToken(): void {
  accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

