import type { AppConfig } from "./types";

export const appConfig: AppConfig = {
  apiBaseUrl: "http://localhost:3001",
  defaultLocale: "en",
  supportedLocales: ["en", "tr"] as const,
};

