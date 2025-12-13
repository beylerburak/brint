/**
 * HTTP Client Base
 * 
 * Core fetch wrapper, error handling, and cache management
 */

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
    // Clear pending request if it exists
    const pending = this.pendingRequests.get(key);
    if (pending) {
      this.pendingRequests.delete(key);
    }
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
    promise
      .then(() => {
        // Only delete if this is still the current pending request
        if (this.pendingRequests.get(key) === promise) {
          this.pendingRequests.delete(key);
        }
      })
      .catch(() => {
        // Only delete if this is still the current pending request
        if (this.pendingRequests.get(key) === promise) {
          this.pendingRequests.delete(key);
        }
      });

    // Safety timeout: if promise doesn't settle within 30 seconds, clear it
    setTimeout(() => {
      if (this.pendingRequests.get(key) === promise) {
        console.warn(`[API Cache] Pending request for "${key}" timed out, clearing`);
        this.pendingRequests.delete(key);
      }
    }, 30000);
  }
}

export const apiCache = new ApiCache();

// Helper to clear auth cookies on client
function clearClientCookies() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { skipAuthRedirect?: boolean; params?: Record<string, any> }
): Promise<T> {
  // Build URL with query parameters
  let url = `${API_BASE_URL}${endpoint}`;
  
  if (options?.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

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
      if (typeof window !== 'undefined') {
        clearClientCookies();
        window.location.href = '/';
      }

      throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
    }

    // Handle 403 Forbidden - permission denied (not session expired)
    if (response.status === 403) {
      const errorMessage = data.error?.message || data.message || 'Permission denied';
      const errorCode = data.error?.code || data.code || 'FORBIDDEN';
      throw new ApiError(errorMessage, 403, errorCode);
    }

    // Log full error response for debugging
    if (response.status >= 500) {
      console.error('[API] Server error response:', {
        status: response.status,
        statusText: response.statusText,
        data,
        error: data.error,
        errorMessage: data.error?.message,
        errorCode: data.error?.code,
        fullResponse: data
      });
    }

    throw new ApiError(
      data.error?.message || data.message || 'API request failed',
      response.status,
      data.error?.code || data.code
    );
  }

  return data;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
