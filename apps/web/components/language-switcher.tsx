"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { locales, type Locale } from "@/lib/i18n/locales"

const languageNames: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
}

const languageFlags: Record<Locale, string> = {
  en: "🇬🇧",
  tr: "🇹🇷",
}

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)

  // Hydration mismatch'i önlemek için
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Extract current locale from pathname
  const getCurrentLocale = (): Locale => {
    const segments = pathname.split("/").filter(Boolean)
    const firstSegment = segments[0]
    return locales.includes(firstSegment as Locale) 
      ? (firstSegment as Locale) 
      : "en"
  }

  const currentLocale = mounted ? getCurrentLocale() : "en"

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === currentLocale) return

    // Replace current locale in pathname
    const segments = pathname.split("/").filter(Boolean)
    const oldLocale = getCurrentLocale()
    
    // If pathname starts with a locale, replace it
    if (locales.includes(segments[0] as Locale)) {
      segments[0] = newLocale
    } else {
      // If no locale in path, prepend new locale
      segments.unshift(newLocale)
    }

    const newPathname = "/" + segments.join("/")
    router.push(newPathname)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Languages className="size-5" />
        <span className="sr-only">Change language</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Languages className="size-5" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={currentLocale === locale ? "bg-accent" : ""}
          >
            <span className="mr-2">{languageFlags[locale]}</span>
            <span>{languageNames[locale]}</span>
            {currentLocale === locale && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

