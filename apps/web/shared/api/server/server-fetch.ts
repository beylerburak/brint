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

  const url = input.startsWith("http")
    ? input
    : `${appConfig.apiBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;

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

