export type SupportedLocale = "en" | "tr";

export interface AppConfig {
  apiBaseUrl: string;
  defaultLocale: SupportedLocale;
  supportedLocales: SupportedLocale[];
}

