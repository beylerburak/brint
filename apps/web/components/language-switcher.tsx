"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Languages } from "lucide-react"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"

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
  const { user, refreshUser } = useWorkspace()
  const [mounted, setMounted] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

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

  const handleLocaleChange = async (newLocale: Locale) => {
    if (newLocale === currentLocale) return
    if (isSaving) return

    setIsSaving(true)
    try {
      // Save to user settings if user is logged in
      if (user) {
        await apiClient.updateMySettings({
          ui: { language: newLocale },
        })
        await refreshUser()
      }

      // Replace current locale in pathname
      const segments = pathname.split("/").filter(Boolean)
      
      // If pathname starts with a locale, replace it
      if (locales.includes(segments[0] as Locale)) {
        segments[0] = newLocale
      } else {
        // If no locale in path, prepend new locale
        segments.unshift(newLocale)
      }

      const newPathname = "/" + segments.join("/")
      router.push(newPathname)
    } catch (error) {
      console.error('Failed to update language preference:', error)
      // Still navigate even if save fails
      const segments = pathname.split("/").filter(Boolean)
      if (locales.includes(segments[0] as Locale)) {
        segments[0] = newLocale
      } else {
        segments.unshift(newLocale)
      }
      const newPathname = "/" + segments.join("/")
      router.push(newPathname)
    } finally {
      setIsSaving(false)
    }
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

