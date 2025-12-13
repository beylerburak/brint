"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useRouter, usePathname, useParams } from "next/navigation"
import { useLocale } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { getLocaleFromPathnameOrParams } from "@/lib/locale-path"

/**
 * Syncs user settings (theme, language) with UI state
 * Applies theme from user.settings.ui.theme when user data loads
 * Redirects to correct locale if user.settings.ui.language differs from current locale
 */
export function UserSettingsSync() {
  const { user } = useWorkspace()
  const { setTheme, theme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const locale = useLocale()
  const [themeInitialized, setThemeInitialized] = React.useState(false)

  // Apply theme from user settings
  React.useEffect(() => {
    if (!user?.settings) return

    const preferredTheme = user.settings.ui.theme
    // Only set theme if it differs from current (avoid unnecessary updates)
    if (theme !== preferredTheme && preferredTheme) {
      setTheme(preferredTheme)
    }
    setThemeInitialized(true)
  }, [user?.settings?.ui?.theme, setTheme, theme])

  // Handle language/locale sync
  React.useEffect(() => {
    if (!user?.settings || !pathname) return

    const preferredLanguage = user.settings.ui.language
    const currentLocale = getLocaleFromPathnameOrParams(pathname, params as { locale?: string }) || locale

    // If preferred language differs from current locale, redirect
    if (preferredLanguage !== currentLocale) {
      // Extract the path without locale prefix
      const pathWithoutLocale = pathname.replace(/^\/(tr|en)/, '') || '/'
      const newPath = `/${preferredLanguage}${pathWithoutLocale}`

      // Only redirect if path would actually change
      if (newPath !== pathname) {
        router.replace(newPath)
      }
    }
  }, [user?.settings?.ui?.language, pathname, locale, router, params])

  return null // This component doesn't render anything
}
