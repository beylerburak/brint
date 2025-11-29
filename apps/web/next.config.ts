import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./shared/i18n/i18n.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

// Wrap with Sentry config
const sentryConfig = withSentryConfig(
  withNextIntl(nextConfig),
  {
    // Optional Sentry build settings
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  }
);

export default sentryConfig;
