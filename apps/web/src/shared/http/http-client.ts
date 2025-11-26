import { appConfig } from "../config";
import type { HttpMethod, HttpResponse } from "./types";

interface RequestOptions extends RequestInit {
  method?: HttpMethod;
}

class HttpClient {
  private baseUrl: string;

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

  private async request<T>(
    method: HttpMethod,
    url: string,
    body?: any,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    const fullUrl = this.buildUrl(url);

    // Log request
    console.log(`[HTTP] ${method} ${fullUrl}`);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
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

