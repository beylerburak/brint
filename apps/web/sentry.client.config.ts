import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_WEB || undefined,
  environment: process.env.SENTRY_ENVIRONMENT_WEB || process.env.NODE_ENV || "development",
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE_WEB ?? 0.1),
  integrations: [],
  // Only capture errors in production/staging, not in development
  enabled: process.env.NODE_ENV !== "development" || !!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
});

