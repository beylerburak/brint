import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./shared/i18n/locales";

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Don't use a prefix for the default locale (EN)
  localePrefix: "as-needed",

  // Disable automatic locale detection - always use default locale for root path
  localeDetection: false,
});

export default function middleware(request: NextRequest) {
  // Dev ve test ortamında debug route'ları serbest
  if (process.env.NODE_ENV !== "production") {
    return intlMiddleware(request);
  }

  const { pathname } = request.nextUrl;

  // Debug route pattern'lerini kontrol et
  const isDebugRoute =
    pathname.startsWith("/config-debug") ||
    pathname.startsWith("/http-debug") ||
    // /[locale]/debug-* pattern'i (ör: /en/debug-context, /tr/debug-error)
    /^\/[^/]+\/debug-/.test(pathname) ||
    // /[locale]/[workspace]/playground pattern'i (ör: /en/my-workspace/playground)
    /^\/[^/]+\/[^/]+\/playground/.test(pathname);

  if (isDebugRoute) {
    // Production'da debug route'ları ana sayfaya yönlendir
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Diğer route'lar için next-intl middleware'i çalıştır
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};

