import { appConfig } from "../config";
import type { HttpMethod, HttpResponse } from "./types";
import { getAccessToken, setAccessToken, clearAccessToken } from "../auth/token-storage";
import { refreshToken } from "@/features/auth/api/auth-api";
import { getWorkspaceId } from "./workspace-header";
import { logger } from "../utils/logger";

interface RequestOptions extends RequestInit {
  method?: HttpMethod;
  skipAuth?: boolean; // Skip adding Authorization header
  skipRefresh?: boolean; // Skip automatic refresh on 401
}

// Global event emitter for auth events
type AuthEventListener = () => void;
const authEventListeners: Set<AuthEventListener> = new Set();

export function onUnauthenticated(listener: AuthEventListener): () => void {
  authEventListeners.add(listener);
  return () => {
    authEventListeners.delete(listener);
  };
}

function emitUnauthenticated(): void {
  authEventListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      logger.error("Error in auth event listener:", error);
    }
  });
}

class HttpClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.baseUrl = appConfig.apiBaseUrl;
  }

  private buildUrl(path: string): string {
    // If path is already absolute, use it as-is
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    
    // Non-versioned routes (health, debug, realtime) don't get /v1 prefix
    const nonVersionedRoutes = ["health", "debug", "realtime"];
    const isNonVersioned = nonVersionedRoutes.some((route) => 
      cleanPath.startsWith(`${route}/`) || cleanPath === route
    );
    
    // Add /v1 prefix for all API routes except non-versioned ones
    const versionedPath = isNonVersioned ? cleanPath : `v1/${cleanPath}`;
    return `${this.baseUrl}/${versionedPath}`;
  }

  private async attemptRefresh(): Promise<string | null> {
    // If already refreshing, wait for the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const result = await refreshToken();
        setAccessToken(result.accessToken);
        return result.accessToken;
      } catch {
        // Refresh failed - clear token and emit logout event
        clearAccessToken();
        emitUnauthenticated();
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    method: HttpMethod,
    url: string,
    body?: unknown,
    options?: RequestOptions,
    retryCount = 0
  ): Promise<HttpResponse<T>> {
    const fullUrl = this.buildUrl(url);
    const skipAuth = options?.skipAuth ?? false;
    const skipRefresh = options?.skipRefresh ?? false;
    const maxRetries = 1; // Only retry once after refresh

    // Get access token if not skipping auth
    let accessToken: string | null = null;
    if (!skipAuth) {
      accessToken = getAccessToken();
    }

    // Build headers - start with options headers, but ensure auth headers are set correctly
    const headers: Record<string, string> = {};

    // Only add Content-Type if we have a body
    if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json";
    }

    // Add Authorization header if we have a token (CRITICAL: must be set)
    if (accessToken && !skipAuth) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Get workspace ID - set header if we have a resolved workspace ID
    // No heuristics - use the resolved workspace.id from context
    const workspaceId = getWorkspaceId();
    if (workspaceId && !skipAuth) {
      headers["X-Workspace-Id"] = workspaceId;
    }

    // Merge with options headers last (but don't let them override auth headers)
    if (options?.headers) {
      Object.assign(headers, options.headers);
      // Ensure auth headers are not overridden
      if (accessToken && !skipAuth) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
      if (workspaceId && !skipAuth) {
        headers["X-Workspace-Id"] = workspaceId;
      }
    }

    // Final check: ensure Authorization header is set if we have a token
    if (accessToken && !skipAuth && !headers["Authorization"]) {
      logger.error("[HTTP] CRITICAL: Access token exists but Authorization header is missing!");
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Prepare fetch options - exclude headers from options to prevent override
    const { headers: optionsHeaders, ...fetchOptions } = options || {};
    
    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
        credentials: "include", // Include cookies for refresh token
        ...fetchOptions,
      });

      // Parse response data first
      let data: T;
      const contentType = response.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        // For non-JSON responses, try to parse as text
        const text = await response.text();
        data = text as unknown as T;
      }

      // Handle only recoverable errors: AUTH_REQUIRED, WORKSPACE_ID_REQUIRED
      // Other 400/403 errors are not retried (they are permanent validation/permission errors)
      const errorCode = (data as any)?.error?.code;
      const isRecoverableError = 
        (response.status === 401 && errorCode === "AUTH_REQUIRED") ||
        (response.status === 400 && errorCode === "WORKSPACE_ID_REQUIRED");

      // Log response status with error details if failed
      if (!response.ok) {
        logger.warn(`[HTTP] ${method} ${fullUrl} → ${response.status}`, {
          errorCode,
          errorMessage: (data as any)?.error?.message,
          willRetry: isRecoverableError && !skipRefresh && retryCount < maxRetries,
        });
      }
      
      if (isRecoverableError && !skipRefresh && retryCount < maxRetries) {
        // Don't retry refresh endpoint itself
        if (url.includes("/auth/refresh")) {
          clearAccessToken();
          emitUnauthenticated();
          return {
            ok: false,
            status: 401,
            message: "Authentication failed",
            details: data,
          };
        }

        // For 400 WORKSPACE_ID_REQUIRED, wait a bit for workspace to hydrate
        if (response.status === 400 && errorCode === "WORKSPACE_ID_REQUIRED") {
          // Wait with exponential backoff before retry
          const delay = 200 * Math.pow(2, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          
          // Check if workspace ID is now available (no heuristic, just check if it exists)
          const workspaceId = getWorkspaceId();
          if (workspaceId) {
            // Retry with workspace ID
            return this.request<T>(method, url, body, options, retryCount + 1);
          }
        }

        // Attempt to refresh token for 401 errors
        if (response.status === 401) {
          const newToken = await this.attemptRefresh();

          if (newToken) {
            // Wait a bit to ensure token is set in storage
            await new Promise((resolve) => setTimeout(resolve, 50));
            
            // Retry the original request with new token
            // Force get fresh token from storage
            const freshToken = getAccessToken();
            if (freshToken) {
              return this.request<T>(method, url, body, options, retryCount + 1);
            } else {
              // Token not found after refresh - something went wrong
              clearAccessToken();
              emitUnauthenticated();
              return {
                ok: false,
                status: 401,
                message: "Authentication failed - token not found after refresh",
                details: data,
              };
            }
          } else {
            // Refresh failed
            return {
              ok: false,
              status: 401,
              message: "Authentication failed - please login again",
              details: data,
            };
          }
        }
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          message: `Request failed with status ${response.status}`,
          details: data,
        };
      }

      return {
        ok: true,
        status: response.status,
        data,
      };
    } catch (error) {
      // Log error
      logger.error(`[HTTP] ${method} ${fullUrl} → Error:`, error);

      const errorMessage =
        error instanceof Error ? error.message : "Fetch failed";
      const status = error instanceof TypeError ? 0 : 500;

      return {
        ok: false,
        status,
        message: errorMessage,
        details: error,
      };
    }
  }

  async get<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>("GET", url, undefined, options);
  }

  async post<T>(
    url: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>("POST", url, body, options);
  }

  async put<T>(
    url: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>("PUT", url, body, options);
  }

  async patch<T>(
    url: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>("PATCH", url, body, options);
  }

  async delete<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>("DELETE", url, undefined, options);
  }
}

export const httpClient = new HttpClient();
