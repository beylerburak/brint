"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { LoaderIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { fetchApi } from "@/lib/api/http"
import { toast } from "sonner"
import { useTheme } from "next-themes"

export const AccountPreferencesContent = React.memo(() => {
  const t = useTranslations('settings')
  const { user, refreshUser } = useWorkspace()
  const [savingField, setSavingField] = React.useState<
    'theme' | 'timezonePreference' | 'timezone' | 'language' | 'dateFormat' | 'timeFormat' | null
  >(null)

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Hydration mismatch'i önlemek için
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const [formData, setFormData] = React.useState({
    theme: (user?.settings?.ui?.theme || 'system') as 'light' | 'dark' | 'system',
    timezonePreference: user?.timezonePreference || 'WORKSPACE',
    timezone: user?.timezone || '',
    language: user?.settings?.ui?.language || 'en',
    dateFormat: user?.dateFormat || 'DMY',
    timeFormat: user?.timeFormat || 'H24',
  })

  React.useEffect(() => {
    if (user) {
      setFormData({
        theme: (user.settings?.ui?.theme || 'system') as 'light' | 'dark' | 'system',
        timezonePreference: user.timezonePreference || 'WORKSPACE',
        timezone: user.timezone || '',
        language: user.settings?.ui?.language || 'en',
        dateFormat: user.dateFormat || 'DMY',
        timeFormat: user.timeFormat || 'H24',
      })
    }
  }, [user])

  // Common timezones list
  const commonTimezones = React.useMemo(() => [
    { value: 'Europe/Istanbul', label: '(GMT+3:00) Istanbul' },
    { value: 'Europe/London', label: '(GMT+0:00) London' },
    { value: 'America/New_York', label: '(GMT-5:00) New York' },
    { value: 'America/Los_Angeles', label: '(GMT-8:00) Los Angeles' },
    { value: 'Asia/Tokyo', label: '(GMT+9:00) Tokyo' },
    { value: 'Asia/Dubai', label: '(GMT+4:00) Dubai' },
    { value: 'Europe/Berlin', label: '(GMT+1:00) Berlin' },
    { value: 'America/Sao_Paulo', label: '(GMT-3:00) Sao Paulo' },
    { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney' },
  ], [])

  // Language options (matches LanguageSwitcher)
  const languageOptions = React.useMemo(() => [
    { value: 'en', label: 'English', flag: '🇬🇧' },
    { value: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  ], [])

  const dateFormatOptions = React.useMemo(() => [
    { value: 'DMY', label: t('dateFormatDMY') },
    { value: 'MDY', label: t('dateFormatMDY') },
    { value: 'YMD', label: t('dateFormatYMD') },
  ], [t])

  const timeFormatOptions = React.useMemo(() => [
    { value: 'H24', label: t('timeFormat24Hour') },
    { value: 'H12', label: t('timeFormat12Hour') },
  ], [t])

  const themeOptions = React.useMemo(() => [
    { value: 'light', label: t('themeLight') },
    { value: 'dark', label: t('themeDark') },
    { value: 'system', label: t('themeSystem') },
  ], [t])

  const handleTimezonePreferenceSave = React.useCallback(async (value: string) => {
    if (!user) return
    if (value === (user.timezonePreference || 'WORKSPACE')) return

    setSavingField('timezonePreference')
    try {
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          timezonePreference: value || null,
        }),
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Failed to update timezonePreference:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, refreshUser, t])

  const handleTimezoneSave = React.useCallback(async (value: string) => {
    if (!user) return
    if (value === (user.timezone || '')) return

    setSavingField('timezone')
    try {
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          timezone: value || null,
        }),
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Failed to update timezone:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, refreshUser, t])

  const handleLanguageSave = React.useCallback(async (value: string) => {
    if (!user) return
    const currentLanguage = user.settings?.ui?.language || 'en'
    if (value === currentLanguage) return

    setSavingField('language')
    try {
      await apiClient.updateMySettings({
        ui: { language: value as 'tr' | 'en' },
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
      
      // Language change will trigger redirect via UserSettingsSync
      // No need to manually redirect here
    } catch (error) {
      console.error('Failed to update language:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, refreshUser, t])

  const handleDateFormatSave = React.useCallback(async (value: string) => {
    if (!user) return
    if (value === (user.dateFormat || 'DMY')) return

    setSavingField('dateFormat')
    try {
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          dateFormat: value || null,
        }),
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Failed to update dateFormat:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, refreshUser, t])

  const handleTimeFormatSave = React.useCallback(async (value: string) => {
    if (!user) return
    if (value === (user.timeFormat || 'H24')) return

    setSavingField('timeFormat')
    try {
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          timeFormat: value || null,
        }),
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Failed to update timeFormat:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, refreshUser, t])

  const handleThemeSave = React.useCallback(async (value: string) => {
    if (!user || !mounted) return
    const currentTheme = user.settings?.ui?.theme || 'system'
    if (value === currentTheme) return

    setSavingField('theme')
    try {
      const themeValue = value as 'light' | 'dark' | 'system'
      
      // Optimistic update
      setTheme(themeValue)
      
      // Persist to backend
      await apiClient.updateMySettings({
        ui: { theme: themeValue },
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Failed to update theme:', error)
      toast.error(t('profileUpdateFailed'))
      // Revert on error
      const originalTheme = user.settings?.ui?.theme || 'system'
      setTheme(originalTheme)
    } finally {
      setSavingField(null)
    }
  }, [user, mounted, setTheme, refreshUser, t])

  const handleTimezonePreferenceChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, timezonePreference: value as 'WORKSPACE' | 'LOCAL' }))
    handleTimezonePreferenceSave(value)
  }, [handleTimezonePreferenceSave])

  const handleTimezoneChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, timezone: value }))
    handleTimezoneSave(value)
  }, [handleTimezoneSave])

  const handleLanguageChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, language: value }))
    handleLanguageSave(value)
  }, [handleLanguageSave])

  const handleDateFormatChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, dateFormat: value as 'DMY' | 'MDY' | 'YMD' }))
    handleDateFormatSave(value)
  }, [handleDateFormatSave])

  const handleTimeFormatChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, timeFormat: value as 'H24' | 'H12' }))
    handleTimeFormatSave(value)
  }, [handleTimeFormatSave])

  const handleThemeChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, theme: value as 'light' | 'dark' | 'system' }))
    handleThemeSave(value)
  }, [handleThemeSave])

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6">
      {/* Main Title */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t('preferencesTitle')}</h2>
      </div>

      {/* Language & Time Section */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t('languageAndTime')}</h2>
        </div>

        {/* Theme */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="theme" className="text-sm font-medium">
              {t('themeLabel')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('themeDescription')}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {mounted ? (
              <>
                <Select
                  value={formData.theme}
                  onValueChange={handleThemeChange}
                  disabled={savingField === 'theme'}
                >
                  <SelectTrigger id="theme" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {savingField === 'theme' && (
                  <LoaderIcon className="animate-spin size-4" />
                )}
              </>
            ) : (
              <div className="w-[180px] h-10 bg-muted animate-pulse rounded-md" />
            )}
          </div>
        </div>

        <Separator />

        {/* Language */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="language" className="text-sm font-medium">
              {t('languageLabel')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('languageDescription')}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Select
              value={formData.language}
              onValueChange={handleLanguageChange}
              disabled={savingField === 'language'}
            >
              <SelectTrigger id="language" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingField === 'language' && (
              <LoaderIcon className="animate-spin size-4" />
            )}
          </div>
        </div>

        <Separator />

        {/* Timezone Preference */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="timezonePreference" className="text-sm font-medium">
              {t('timezonePreference')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {formData.timezonePreference === 'WORKSPACE'
                ? t('timezonePreferenceWorkspaceDesc')
                : t('timezonePreferenceLocalDesc')}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Select
              value={formData.timezonePreference}
              onValueChange={handleTimezonePreferenceChange}
              disabled={savingField === 'timezonePreference'}
            >
              <SelectTrigger id="timezonePreference" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKSPACE">{t('timezonePreferenceWorkspace')}</SelectItem>
                <SelectItem value="LOCAL">{t('timezonePreferenceLocal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Timezone (only shown when preference is LOCAL) */}
        {formData.timezonePreference === 'LOCAL' && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <Label htmlFor="timezone" className="text-sm font-medium">
                  {t('timezoneLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('timezoneDescription')}
                </p>
              </div>
              <div className="flex-shrink-0">
                <Select
                  value={formData.timezone || commonTimezones[0].value}
                  onValueChange={handleTimezoneChange}
                  disabled={savingField === 'timezone'}
                >
                  <SelectTrigger id="timezone" className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commonTimezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Date Format */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="dateFormat" className="text-sm font-medium">
              {t('dateFormatLabel')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('dateFormatDescription')}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Select
              value={formData.dateFormat}
              onValueChange={handleDateFormatChange}
              disabled={savingField === 'dateFormat'}
            >
              <SelectTrigger id="dateFormat" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFormatOptions.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Time Format */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="timeFormat" className="text-sm font-medium">
              {t('timeFormatLabel')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('timeFormatDescription')}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Select
              value={formData.timeFormat}
              onValueChange={handleTimeFormatChange}
              disabled={savingField === 'timeFormat'}
            >
              <SelectTrigger id="timeFormat" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeFormatOptions.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
})

AccountPreferencesContent.displayName = "AccountPreferencesContent"
