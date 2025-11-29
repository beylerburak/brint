import { env } from "./env";
import type { AppConfig } from "./types";

export const appConfig: AppConfig = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",
  isProd: env.NODE_ENV === "production",
  apiBaseUrl: env.NEXT_PUBLIC_API_BASE_URL,
  appUrl: env.NEXT_PUBLIC_APP_URL ?? null,
  defaultLocale: "en",
  supportedLocales: ["en", "tr"] as const,
};

// Backward compatibility: export apiBaseUrl directly
export const apiBaseUrl = appConfig.apiBaseUrl;

