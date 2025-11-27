import type { Locale } from "./locales";

export type Messages = typeof import("../../locales/en/common.json");

export interface I18nConfig {
  locale: Locale;
  messages: Messages;
}
