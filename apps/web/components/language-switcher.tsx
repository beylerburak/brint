"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/lib/i18n/locales";

const localeLabels: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
};

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;

  const switchLocale = (newLocale: Locale) => {
    // Get pathname without locale prefix
    // If current locale is default (en), pathname might not have locale prefix
    let pathWithoutLocale = pathname;
    
    // Remove current locale from pathname if it exists
    if (currentLocale !== "en" || pathname.startsWith(`/${currentLocale}`)) {
      pathWithoutLocale = pathname.replace(`/${currentLocale}`, "");
    }
    
    // Add new locale prefix
    // For default locale (en), don't add prefix (as-needed strategy)
    const newPath = newLocale === "en" 
      ? pathWithoutLocale || "/"
      : `/${newLocale}${pathWithoutLocale}`;
    
    router.push(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Globe className="size-4" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => switchLocale(locale)}
            className={currentLocale === locale ? "bg-accent" : ""}
          >
            {localeLabels[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

