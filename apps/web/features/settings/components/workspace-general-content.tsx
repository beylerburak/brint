"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { LoaderIcon, Lock, Upload } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Cropper, CropperImage, CropperControls } from "@/components/ui/cropper"
import type { Area } from "react-easy-crop"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

export const WorkspaceGeneralContent = React.memo(() => {
  const t = useTranslations('settings')
  const { currentWorkspace, refreshWorkspace } = useWorkspace()
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false)
  const [isCropperOpen, setIsCropperOpen] = React.useState(false)
  const [cropImageSrc, setCropImageSrc] = React.useState<string | null>(null)
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null)
  const [previewLogoUrl, setPreviewLogoUrl] = React.useState<string | null>(null)
  
  const [formData, setFormData] = React.useState({
    name: currentWorkspace?.name || '',
    slug: currentWorkspace?.slug || '',
    timezone: currentWorkspace?.timezone || 'Europe/Istanbul',
    locale: currentWorkspace?.locale || 'tr-TR',
    baseCurrency: currentWorkspace?.baseCurrency || 'TRY',
  })

  const [slugStatus, setSlugStatus] = React.useState<{
    checking: boolean
    available: boolean | null
    message: string | null
  }>({
    checking: false,
    available: null,
    message: null,
  })

  React.useEffect(() => {
    if (currentWorkspace) {
      setFormData({
        name: currentWorkspace.name || '',
        slug: currentWorkspace.slug || '',
        timezone: currentWorkspace.timezone || 'Europe/Istanbul',
        locale: currentWorkspace.locale || 'tr-TR',
        baseCurrency: currentWorkspace.baseCurrency || 'TRY',
      })
    }
  }, [currentWorkspace])

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

  const localeOptions = React.useMemo(() => [
    { value: 'tr-TR', label: 'Türkçe (Türkiye)' },
    { value: 'en-US', label: 'English (United States)' },
    { value: 'en-GB', label: 'English (United Kingdom)' },
    { value: 'de-DE', label: 'Deutsch (Deutschland)' },
    { value: 'fr-FR', label: 'Français (France)' },
    { value: 'es-ES', label: 'Español (España)' },
    { value: 'it-IT', label: 'Italiano (Italia)' },
    { value: 'ja-JP', label: '日本語 (日本)' },
  ], [])

  const currencyOptions = React.useMemo(() => [
    { value: 'TRY', label: 'TRY - Turkish Lira' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'JPY', label: 'JPY - Japanese Yen' },
    { value: 'CNY', label: 'CNY - Chinese Yuan' },
  ], [])

  const checkSlugAvailability = React.useCallback(async (slug: string) => {
    if (!slug || !currentWorkspace) return
    
    // Convert to lowercase and replace spaces with hyphens
    const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-')
    
    if (normalizedSlug === currentWorkspace.slug) {
      setSlugStatus({ checking: false, available: null, message: null })
      return
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(normalizedSlug)) {
      setSlugStatus({
        checking: false,
        available: false,
        message: t('slugInvalid') || 'Slug can only contain lowercase letters, numbers, and hyphens',
      })
      return
    }

    if (normalizedSlug.length < 3 || normalizedSlug.length > 50) {
      setSlugStatus({
        checking: false,
        available: false,
        message: t('slugLengthInvalid') || 'Slug must be between 3 and 50 characters',
      })
      return
    }

    setSlugStatus({ checking: true, available: null, message: null })

    try {
      const response = await apiClient.checkSlugAvailable(
        normalizedSlug,
        currentWorkspace.id
      )

      if (response.available) {
        setSlugStatus({
          checking: false,
          available: true,
          message: t('slugAvailable') || 'This slug is available',
        })
      } else {
        setSlugStatus({
          checking: false,
          available: false,
          message: t('slugTaken') || 'This slug is already taken',
        })
      }
    } catch (error) {
      console.error('Failed to check slug availability:', error)
      setSlugStatus({
        checking: false,
        available: false,
        message: 'Failed to check slug availability',
      })
    }
  }, [currentWorkspace, t])

  const slugCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleSlugChange = React.useCallback((value: string) => {
    // Convert to lowercase and replace spaces with hyphens
    const normalizedValue = value.toLowerCase().replace(/\s+/g, '-')
    setFormData((prev) => ({ ...prev, slug: normalizedValue }))

    // Clear previous timeout
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current)
    }

    // If slug changed and is different from current, show spinner immediately
    if (normalizedValue !== (currentWorkspace?.slug || '')) {
      setSlugStatus({ checking: true, available: null, message: null })
    } else {
      setSlugStatus({ checking: false, available: null, message: null })
      return
    }

    // Debounce slug check (500ms)
    slugCheckTimeoutRef.current = setTimeout(() => {
      checkSlugAvailability(normalizedValue)
    }, 500)
  }, [checkSlugAvailability, currentWorkspace?.slug])

  React.useEffect(() => {
    return () => {
      if (slugCheckTimeoutRef.current) {
        clearTimeout(slugCheckTimeoutRef.current)
      }
    }
  }, [])

  const [savingField, setSavingField] = React.useState<
    'name' | 'slug' | 'timezone' | 'locale' | 'baseCurrency' | null
  >(null)

  const handleNameSave = React.useCallback(async () => {
    if (!currentWorkspace) return
    if (formData.name === currentWorkspace.name) return

    setSavingField('name')
    try {
      await apiClient.updateWorkspace(currentWorkspace.id, {
        name: formData.name,
      })

      await refreshWorkspace(currentWorkspace.id)
      toast.success(t('workspaceUpdated') || 'Workspace updated successfully')
    } catch (error) {
      console.error('Failed to update workspace name:', error)
      toast.error(t('workspaceUpdateFailed') || 'Failed to update workspace')
    } finally {
      setSavingField(null)
    }
  }, [currentWorkspace, formData.name, refreshWorkspace, t])

  const handleSlugSave = React.useCallback(async () => {
    if (!currentWorkspace) return
    if (formData.slug === currentWorkspace.slug) return

    if (!slugStatus.available) {
      toast.error(t('slugInvalid') || 'Invalid slug')
      return
    }

    setSavingField('slug')
    try {
      await apiClient.updateWorkspace(currentWorkspace.id, {
        slug: formData.slug,
      })

      await refreshWorkspace(currentWorkspace.id)
      toast.success(t('workspaceUpdated') || 'Workspace updated successfully')
    } catch (error: any) {
      console.error('Failed to update workspace slug:', error)
      if (error.message?.includes('SLUG_TAKEN') || error.message?.includes('slug')) {
        toast.error(t('slugTaken') || 'This slug is already taken')
      } else {
        toast.error(t('workspaceUpdateFailed') || 'Failed to update workspace')
      }
    } finally {
      setSavingField(null)
    }
  }, [currentWorkspace, formData.slug, slugStatus.available, refreshWorkspace, t])

  const handleTimezoneChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, timezone: value }))
  }, [])

  const handleTimezoneSave = React.useCallback(async (value: string) => {
    if (!currentWorkspace) return
    if (value === currentWorkspace.timezone) return

    setSavingField('timezone')
    try {
      await apiClient.updateWorkspace(currentWorkspace.id, {
        timezone: value,
      })

      await refreshWorkspace(currentWorkspace.id)
      toast.success(t('workspaceUpdated') || 'Workspace updated successfully')
    } catch (error) {
      console.error('Failed to update workspace timezone:', error)
      toast.error(t('workspaceUpdateFailed') || 'Failed to update workspace')
    } finally {
      setSavingField(null)
    }
  }, [currentWorkspace, refreshWorkspace, t])

  const handleLocaleChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, locale: value }))
  }, [])

  const handleLocaleSave = React.useCallback(async (value: string) => {
    if (!currentWorkspace) return
    if (value === currentWorkspace.locale) return

    setSavingField('locale')
    try {
      await apiClient.updateWorkspace(currentWorkspace.id, {
        locale: value,
      })

      await refreshWorkspace(currentWorkspace.id)
      toast.success(t('workspaceUpdated') || 'Workspace updated successfully')
    } catch (error) {
      console.error('Failed to update workspace locale:', error)
      toast.error(t('workspaceUpdateFailed') || 'Failed to update workspace')
    } finally {
      setSavingField(null)
    }
  }, [currentWorkspace, refreshWorkspace, t])

  const handleBaseCurrencyChange = React.useCallback((value: string) => {
    setFormData(prev => ({ ...prev, baseCurrency: value }))
  }, [])

  const handleBaseCurrencySave = React.useCallback(async (value: string) => {
    if (!currentWorkspace) return
    if (value === currentWorkspace.baseCurrency) return

    setSavingField('baseCurrency')
    try {
      await apiClient.updateWorkspace(currentWorkspace.id, {
        baseCurrency: value,
      })

      await refreshWorkspace(currentWorkspace.id)
      toast.success(t('workspaceUpdated') || 'Workspace updated successfully')
    } catch (error) {
      console.error('Failed to update workspace base currency:', error)
      toast.error(t('workspaceUpdateFailed') || 'Failed to update workspace')
    } finally {
      setSavingField(null)
    }
  }, [currentWorkspace, refreshWorkspace, t])

  // Utility function to create image from URL
  const createImage = React.useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = (error) => reject(error)
      image.src = url
    })
  }, [])

  // Utility function to get cropped image as blob
  const getCroppedImg = React.useCallback(async (
    imageSrc: string,
    pixelCrop: Area,
    rotation: number = 0
  ): Promise<Blob> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Could not get canvas context')
    }

    const radians = (rotation * Math.PI) / 180
    const rotatedWidth =
      Math.abs(Math.cos(radians) * image.width) +
      Math.abs(Math.sin(radians) * image.height)
    const rotatedHeight =
      Math.abs(Math.sin(radians) * image.width) +
      Math.abs(Math.cos(radians) * image.height)

    canvas.width = rotatedWidth
    canvas.height = rotatedHeight

    ctx.translate(rotatedWidth / 2, rotatedHeight / 2)
    ctx.rotate(radians)
    ctx.drawImage(image, -image.width / 2, -image.height / 2)

    const croppedCanvas = document.createElement('canvas')
    const croppedCtx = croppedCanvas.getContext('2d')

    if (!croppedCtx) {
      throw new Error('Could not get cropped canvas context')
    }

    croppedCanvas.width = pixelCrop.width
    croppedCanvas.height = pixelCrop.height

    croppedCtx.drawImage(
      canvas,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    )

    return new Promise((resolve, reject) => {
      croppedCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        resolve(blob)
      }, 'image/jpeg', 0.95)
    })
  }, [createImage])

  const handleLogoFileSelect = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !currentWorkspace) return

    if (!file.type.startsWith('image/')) {
      toast.error(t('selectImageFile') || 'Please select an image file')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('imageTooLarge') || 'Image must be less than 5MB')
      event.target.value = ''
      return
    }

    // Create preview URL and open cropper
    const imageUrl = URL.createObjectURL(file)
    setCropImageSrc(imageUrl)
    setIsCropperOpen(true)
    // Reset input
    event.target.value = ''
  }, [currentWorkspace, t])

  const handleCropComplete = React.useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropCancel = React.useCallback(() => {
    setIsCropperOpen(false)
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc)
      setCropImageSrc(null)
    }
    setCroppedAreaPixels(null)
  }, [cropImageSrc])

  const handleCropConfirm = React.useCallback(async () => {
    if (!cropImageSrc || !croppedAreaPixels || !currentWorkspace) return

    setIsCropperOpen(false)
    setIsUploadingLogo(true)

    try {
      // Get cropped blob
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels)
      
      // Create preview URL for immediate display
      const previewUrl = URL.createObjectURL(croppedBlob)
      setPreviewLogoUrl(previewUrl)

      // Create File from blob
      const croppedFile = new File([croppedBlob], 'logo.jpg', { type: 'image/jpeg' })

      // Upload cropped image
      const result = await apiClient.uploadMedia(currentWorkspace.id, croppedFile)
      const media = result.media

      await apiClient.updateWorkspace(currentWorkspace.id, {
        avatarMediaId: media.id,
      })

      await refreshWorkspace(currentWorkspace.id)
      toast.success(t('workspaceUpdated') || 'Workspace updated successfully')
    } catch (error) {
      console.error('Failed to upload workspace logo:', error)
      toast.error(t('workspaceUpdateFailed') || 'Failed to update workspace')
      // Clean up preview URL on error
      if (previewLogoUrl) {
        URL.revokeObjectURL(previewLogoUrl)
        setPreviewLogoUrl(null)
      }
    } finally {
      setIsUploadingLogo(false)
      // Clean up crop image URL
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc)
        setCropImageSrc(null)
      }
      setCroppedAreaPixels(null)
    }
  }, [cropImageSrc, croppedAreaPixels, currentWorkspace, getCroppedImg, t, refreshWorkspace, previewLogoUrl])

  // Clean up blob URLs on unmount
  React.useEffect(() => {
    return () => {
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc)
      }
      if (previewLogoUrl) {
        URL.revokeObjectURL(previewLogoUrl)
      }
    }
  }, [cropImageSrc, previewLogoUrl])

  // Clean up preview URL when real logo URL becomes available
  React.useEffect(() => {
    const realLogoUrl = currentWorkspace?.avatarUrls?.small || currentWorkspace?.avatarUrls?.thumbnail
    if (realLogoUrl && previewLogoUrl) {
      URL.revokeObjectURL(previewLogoUrl)
      setPreviewLogoUrl(null)
    }
  }, [currentWorkspace?.avatarUrls, previewLogoUrl])

  const hasNameChanged = React.useMemo(
    () => formData.name !== (currentWorkspace?.name || ''),
    [formData.name, currentWorkspace?.name]
  )

  const hasSlugChanged = React.useMemo(
    () => formData.slug !== (currentWorkspace?.slug || ''),
    [formData.slug, currentWorkspace?.slug]
  )

  const logoUrl = React.useMemo(() => {
    if (previewLogoUrl) return previewLogoUrl
    return currentWorkspace?.avatarUrls?.small || currentWorkspace?.avatarUrls?.thumbnail || currentWorkspace?.avatarUrl || null
  }, [previewLogoUrl, currentWorkspace?.avatarUrls, currentWorkspace?.avatarUrl])
  const workspaceInitial = React.useMemo(
    () => (currentWorkspace?.name || 'W').charAt(0).toUpperCase(),
    [currentWorkspace?.name]
  )

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Main Title */}
      <div>
        <h2 className="text-lg font-semibold">{t('workspaceTitle') || 'Workspace Settings'}</h2>
      </div>

      {/* Workspace Identity Section */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Avatar className="size-14 sm:size-16 shrink-0" key={logoUrl || 'no-logo'}>
          <AvatarImage src={logoUrl || undefined} alt={currentWorkspace.name} />
          <AvatarFallback className="text-lg sm:text-xl">{workspaceInitial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h2 className="text-lg sm:text-xl font-semibold truncate">{currentWorkspace.name}</h2>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {currentWorkspace.slug}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoFileSelect}
            className="hidden"
            id="workspace-logo-upload"
            disabled={isUploadingLogo}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('workspace-logo-upload')?.click()}
            disabled={isUploadingLogo}
          >
            {isUploadingLogo ? (
              <>
                <LoaderIcon className="animate-spin size-4 mr-2" />
                {t('uploadingAvatar') || 'Uploading...'}
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                {t('uploadAvatar') || 'Upload Logo'}
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {/* General Information Section */}
      <div className="flex flex-col gap-6">
        <h3 className="text-lg font-semibold">{t('generalSection') || 'General'}</h3>

        {/* Workspace Name */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="workspaceName">{t('workspaceNameLabel') || 'Workspace Name'}</Label>
          <InputGroup data-disabled={savingField === 'name'}>
            <InputGroupInput
              id="workspaceName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('workspaceNamePlaceholder') || 'Enter workspace name'}
              disabled={savingField === 'name'}
            />
            {hasNameChanged && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleNameSave()
                  }}
                  variant="default"
                  disabled={savingField === 'name'}
                >
                  {savingField === 'name' ? (
                    <LoaderIcon className="animate-spin size-4" />
                  ) : (
                    t('save') || 'Save'
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <p className="text-sm text-muted-foreground">
            {t('workspaceNameDesc') || 'This will be displayed across the application'}
          </p>
        </div>

        {/* Slug */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="slug">{t('slugLabel') || 'Slug'}</Label>
          <InputGroup data-disabled={savingField === 'slug'}>
            <InputGroupAddon align="inline-start">
              <InputGroupText>/</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="slug"
              type="text"
              value={formData.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder={t('workspaceSlugPlaceholder') || 'workspace-slug'}
              disabled={savingField === 'slug'}
            />
            {slugStatus.checking && (
              <InputGroupAddon align="inline-end">
                <LoaderIcon className="animate-spin size-4" />
              </InputGroupAddon>
            )}
            {hasSlugChanged && !slugStatus.checking && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSlugSave()
                  }}
                  variant="default"
                  disabled={savingField === 'slug' || !slugStatus.available}
                >
                  {savingField === 'slug' ? (
                    <LoaderIcon className="animate-spin size-4" />
                  ) : (
                    t('save') || 'Save'
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          {!slugStatus.checking && slugStatus.message && (
            <p
              className={`text-sm ${
                slugStatus.available
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {slugStatus.message}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t('workspaceSlugDesc') || 'Your unique workspace identifier'}
          </p>
        </div>

        {/* Timezone */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="timezone" className="text-sm font-medium">
              {t('timezoneLabel') || 'Timezone'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('timezoneDescription') || 'Current timezone setting'}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Select
              value={formData.timezone}
              onValueChange={(value) => {
                handleTimezoneChange(value)
                handleTimezoneSave(value)
              }}
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
            {savingField === 'timezone' && (
              <LoaderIcon className="animate-spin size-4" />
            )}
          </div>
        </div>

        <Separator />

        {/* Locale */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="locale" className="text-sm font-medium">
              {t('localeLabel') || 'Locale'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('localeDescription') || 'Language and region settings for the workspace'}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Select
              value={formData.locale}
              onValueChange={(value) => {
                handleLocaleChange(value)
                handleLocaleSave(value)
              }}
              disabled={savingField === 'locale'}
            >
              <SelectTrigger id="locale" className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {localeOptions.map((locale) => (
                  <SelectItem key={locale.value} value={locale.value}>
                    {locale.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingField === 'locale' && (
              <LoaderIcon className="animate-spin size-4" />
            )}
          </div>
        </div>

        <Separator />

        {/* Base Currency */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label htmlFor="baseCurrency" className="text-sm font-medium">
              {t('baseCurrencyLabel') || 'Base Currency'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('baseCurrencyDescription') || 'Default currency for financial calculations'}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Select
              value={formData.baseCurrency}
              onValueChange={(value) => {
                handleBaseCurrencyChange(value)
                handleBaseCurrencySave(value)
              }}
              disabled={savingField === 'baseCurrency'}
            >
              <SelectTrigger id="baseCurrency" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingField === 'baseCurrency' && (
              <LoaderIcon className="animate-spin size-4" />
            )}
          </div>
        </div>
      </div>

      {/* Logo Cropper Dialog */}
      <Dialog open={isCropperOpen} onOpenChange={(open) => {
        if (!open) {
          handleCropCancel()
        }
      }}>
        <DialogContent className="max-w-2xl p-0">
          <DialogTitle className="sr-only">{t('cropAvatar') || 'Crop Logo'}</DialogTitle>
          {cropImageSrc && (
            <div className="p-4">
              <Cropper
                aspect={1}
                onCropComplete={handleCropComplete}
                className="flex flex-col"
              >
                <CropperImage
                  src={cropImageSrc}
                  cropShape="round"
                  minZoom={1}
                  maxZoom={3}
                  className="h-[400px]"
                />
                <CropperControls
                  onCancel={handleCropCancel}
                  onCrop={handleCropConfirm}
                />
              </Cropper>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
})

WorkspaceGeneralContent.displayName = "WorkspaceGeneralContent"
