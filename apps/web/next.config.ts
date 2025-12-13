import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./lib/i18n/i18n.ts");

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: path.resolve(__dirname, "../.."), // Monorepo root (apps/web -> root)
  },
};

export default withNextIntl(nextConfig);
