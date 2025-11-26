import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, defaultLocale, type Locale } from "./locales";

export default getRequestConfig(async ({ locale }) => {
  // Use default locale if none is provided
  const validLocale = (locale || defaultLocale) as Locale;

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(validLocale)) {
    notFound();
  }

  const messages = (await import(`../../locales/${validLocale}/common.json`)).default;

  return {
    locale: validLocale,
    messages: {
      common: messages,
    },
  };
});

