import { cookies } from "next/headers";
import { appConfig } from "@/shared/config/app";

/**
 * Server-side fetch helper for making authenticated API requests
 * 
 * Automatically includes:
 * - Authorization header from access_token cookie
 * - Content-Type: application/json
 * - Cache: no-store (always fresh data)
 * 
 * @param input - API endpoint path (e.g., "/auth/me")
 * @param init - Optional fetch options
 * @returns Parsed JSON response
 * @throws Error if request fails
 */
export async function serverFetch<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  let url: string;
  if (input.startsWith("http")) {
    url = input;
  } else {
    // Remove leading slash if present to avoid double slashes
    const cleanPath = input.startsWith("/") ? input.slice(1) : input;
    
    // Non-versioned routes (health, debug, realtime) don't get /v1 prefix
    const nonVersionedRoutes = ["health", "debug", "realtime"];
    const isNonVersioned = nonVersionedRoutes.some((route) => 
      cleanPath.startsWith(`${route}/`) || cleanPath === route
    );
    
    // Add /v1 prefix for all API routes except non-versioned ones
    const versionedPath = isNonVersioned ? cleanPath : `v1/${cleanPath}`;
    url = `${appConfig.apiBaseUrl}/${versionedPath}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(
      `Server fetch failed: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ""}`
    );
  }

  return (await res.json()) as T;
}

