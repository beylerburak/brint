import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./lib/i18n/locales";
import { buildLoginUrl, buildOnboardingUrl } from "./lib/locale-path";

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/signup'];

// Auth callback paths (special handling)
const AUTH_CALLBACK_PATHS = ['/auth/google/callback', '/auth/magic-link/verify'];

// Dynamic locale regex (cached) - built from locales array
// Matches /en, /tr, etc. at the start of pathname
// Escape special regex characters for safety
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LOCALE_REGEX = new RegExp(`^/(${locales.map(escapeRegex).join('|')})(?=/|$)`);

// Check if path is public (after locale)
function isPublicPath(pathname: string): boolean {
  // Remove locale prefix to check path (using dynamic regex)
  const pathWithoutLocale = pathname.replace(LOCALE_REGEX, '') || '/';
  
  // Check public paths
  if (PUBLIC_PATHS.some(path => pathWithoutLocale.startsWith(path))) {
    return true;
  }
  
  // Check auth callback paths
  if (AUTH_CALLBACK_PATHS.some(path => pathWithoutLocale.startsWith(path))) {
    return true;
  }
  
  return false;
}

// Create the intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: false,
});

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // First, run intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // Check for access token
  const accessToken = request.cookies.get('access_token')?.value;

  // Get current locale
  const pathSegments = pathname.split('/').filter(Boolean);
  const locale = pathSegments[0] && locales.includes(pathSegments[0] as any) 
    ? pathSegments[0] 
    : defaultLocale;

  // Handle root path
  if (pathname === '/' || pathname === `/${locale}` || pathname === `/${locale}/`) {
    if (!accessToken) {
      // Not logged in -> redirect to login
      return NextResponse.redirect(new URL(buildLoginUrl(locale), request.url));
    } else {
      // Logged in - let the root page handle workspace redirect
      // It will call /me and redirect to first workspace
      return intlResponse;
    }
  }

  // If user is logged in and tries to access login/signup, redirect to first workspace
  if (accessToken && isPublicPath(pathname)) {
    try {
      const [, payload] = accessToken.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      const userWorkspaces = decodedPayload.workspaces || [];
      
      // Has workspaces -> redirect to first workspace (or onboarding to auto-redirect)
      if (userWorkspaces.length > 0) {
        return NextResponse.redirect(new URL(buildOnboardingUrl(locale), request.url));
      }
    } catch {
      // Invalid token, let them access login/signup
      return intlResponse;
    }
  }

  // Allow public paths for non-authenticated users
  if (isPublicPath(pathname)) {
    return intlResponse;
  }

  // No token - redirect to login
  if (!accessToken) {
    const loginUrl = new URL(buildLoginUrl(locale, pathname), request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token and check workspace access
  try {
    const [, payload] = accessToken.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp && decodedPayload.exp < now) {
      const locale = pathname.split('/')[1];
      const validLocale = locales.includes(locale as any) ? locale : defaultLocale;
      const loginUrl = new URL(buildLoginUrl(validLocale, pathname), request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check onboarding status
    const hasCompletedOnboarding = decodedPayload.hasCompletedOnboarding ?? false;
    const pathWithoutLocale = pathname.replace(LOCALE_REGEX, '') || '/';
    const isOnOnboardingPage = pathWithoutLocale.startsWith('/onboarding');

    // If user hasn't completed onboarding and not on onboarding page, redirect to onboarding
    if (!hasCompletedOnboarding && !isOnOnboardingPage) {
      const locale = pathname.split('/')[1];
      const validLocale = locales.includes(locale as any) ? locale : defaultLocale;
      return NextResponse.redirect(new URL(buildOnboardingUrl(validLocale), request.url));
    }

    // If user HAS completed onboarding but tries to access onboarding page, redirect away
    if (hasCompletedOnboarding && isOnOnboardingPage) {
      const locale = pathname.split('/')[1];
      const validLocale = locales.includes(locale as any) ? locale : defaultLocale;
      
      // Already completed onboarding - send to root, which will handle workspace redirect
      return NextResponse.redirect(new URL(`/${validLocale}/`, request.url));
    }

    // Check workspace membership for workspace-scoped paths
    // Pattern: /[locale]/[workspace]/...
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2) {
      const potentialWorkspaceSlug = pathSegments[1];
      
      // Skip if it's a known non-workspace path
      if (!['login', 'signup', 'onboarding', 'auth'].includes(potentialWorkspaceSlug)) {
        const userWorkspaces = decodedPayload.workspaces || [];
        
        // Check if user is a member of ANY workspace with this slug
        // Note: JWT has workspace IDs, not slugs, so we can't verify slug here
        // We'll verify on the server side, but at least check user has workspaces
        if (userWorkspaces.length === 0) {
          const locale = pathSegments[0];
          const validLocale = locales.includes(locale as any) ? locale : defaultLocale;
          return NextResponse.redirect(new URL(buildOnboardingUrl(validLocale), request.url));
        }
      }
    }

    return intlResponse;
  } catch (error) {
    // Invalid token - redirect to login
    const locale = pathname.split('/')[1];
    const validLocale = locales.includes(locale as any) ? locale : defaultLocale;
    const loginUrl = new URL(buildLoginUrl(validLocale, pathname), request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
