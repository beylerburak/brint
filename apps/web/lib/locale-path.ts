import { locales, defaultLocale, type Locale } from "./i18n/locales";

/**
 * Locale-aware path utilities
 * Ensures all paths include locale prefix when needed
 */

/**
 * Add locale prefix to a path
 * @param locale - The locale (e.g., 'en', 'tr')
 * @param path - The path without locale (e.g., '/login', '/settings')
 * @returns Path with locale prefix (e.g., '/tr/login' or '/login' for default locale)
 */
export function withLocale(locale: string, path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  
  // For default locale, next-intl's "as-needed" strategy may omit the prefix
  // But we'll always include it for consistency in redirects
  if (locale === defaultLocale) {
    return normalizedPath;
  }
  
  // Remove leading slash, add locale, then add path
  return `/${locale}${normalizedPath}`;
}

/**
 * Build a login URL with optional 'from' parameter
 * @param locale - The locale
 * @param from - Optional path to redirect back to after login
 * @returns Login URL with locale prefix
 */
export function buildLoginUrl(locale: string, from?: string): string {
  const loginPath = withLocale(locale, "/login");
  if (from) {
    const url = new URL(loginPath, "http://localhost");
    url.searchParams.set("from", from);
    return url.pathname + url.search;
  }
  return loginPath;
}

/**
 * Build a workspace URL
 * @param locale - The locale
 * @param workspaceSlug - The workspace slug
 * @param path - Optional path within workspace (e.g., '/home', '/settings')
 * @returns Workspace URL with locale prefix
 */
export function buildWorkspaceUrl(
  locale: string,
  workspaceSlug: string,
  path: string = "/home"
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return withLocale(locale, `/${workspaceSlug}${normalizedPath}`);
}

/**
 * Build an onboarding URL
 * @param locale - The locale
 * @returns Onboarding URL with locale prefix
 */
export function buildOnboardingUrl(locale: string): string {
  return withLocale(locale, "/onboarding");
}

/**
 * Build a signup URL
 * @param locale - The locale
 * @returns Signup URL with locale prefix
 */
export function buildSignupUrl(locale: string): string {
  return withLocale(locale, "/signup");
}

/**
 * Extract locale from pathname or params
 * @param pathname - The pathname (e.g., '/tr/login')
 * @param params - Optional params object with locale
 * @returns The locale or default locale
 */
export function getLocaleFromPathnameOrParams(
  pathname?: string,
  params?: { locale?: string }
): Locale {
  // Try params first (more reliable in server components)
  if (params?.locale && locales.includes(params.locale as Locale)) {
    return params.locale as Locale;
  }
  
  // Fallback to pathname parsing
  if (pathname) {
    const segments = pathname.split("/").filter(Boolean);
    const potentialLocale = segments[0];
    if (potentialLocale && locales.includes(potentialLocale as Locale)) {
      return potentialLocale as Locale;
    }
  }
  
  return defaultLocale;
}

/**
 * Remove locale prefix from pathname
 * @param pathname - The pathname (e.g., '/tr/login')
 * @returns Path without locale (e.g., '/login')
 */
export function removeLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && locales.includes(segments[0] as Locale)) {
    return "/" + segments.slice(1).join("/");
  }
  return pathname;
}
