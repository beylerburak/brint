export type SupportedLocale = "en" | "tr";

export interface AppConfig {
  env: "development" | "test" | "production";
  isDev: boolean;
  isTest: boolean;
  isProd: boolean;
  apiBaseUrl: string;
  appUrl: string | null;
  defaultLocale: SupportedLocale;
  supportedLocales: SupportedLocale[];
}

