import { appConfig } from "../config";
import type { HttpMethod, HttpResponse } from "./types";
import { getAccessToken, setAccessToken, clearAccessToken } from "../auth/token-storage";
import { refreshToken } from "../api/auth";

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
      console.error("Error in auth event listener:", error);
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
    return `${this.baseUrl}/${cleanPath}`;
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
      } catch (error) {
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
    body?: any,
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

    // Build headers
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> | undefined),
    };

    // Only add Content-Type if we have a body
    if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json";
    }

    // Add Authorization header if we have a token
    if (accessToken && !skipAuth) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Log request
    console.log(`[HTTP] ${method} ${fullUrl}`);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
        credentials: "include", // Include cookies for refresh token
        ...options,
      });

      // Log response status
      console.log(`[HTTP] ${method} ${fullUrl} → ${response.status}`);

      let data: T;
      const contentType = response.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        // For non-JSON responses, try to parse as text
        const text = await response.text();
        data = text as unknown as T;
      }

      // Handle 401 Unauthorized - attempt refresh
      if (response.status === 401 && !skipRefresh && retryCount < maxRetries) {
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

        // Attempt to refresh token
        const newToken = await this.attemptRefresh();

        if (newToken) {
          // Retry the original request with new token
          return this.request<T>(method, url, body, options, retryCount + 1);
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
      console.warn(`[HTTP] ${method} ${fullUrl} → Error:`, error);

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
    body?: any,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>("POST", url, body, options);
  }

  async put<T>(
    url: string,
    body?: any,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>("PUT", url, body, options);
  }

  async patch<T>(
    url: string,
    body?: any,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>("PATCH", url, body, options);
  }

  async delete<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>("DELETE", url, undefined, options);
  }
}

export const httpClient = new HttpClient();

