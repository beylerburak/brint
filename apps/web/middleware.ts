import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./shared/i18n/locales";

export default createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Don't use a prefix for the default locale (EN)
  localePrefix: "as-needed",

  // Disable automatic locale detection - always use default locale for root path
  localeDetection: false,
});

export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};

