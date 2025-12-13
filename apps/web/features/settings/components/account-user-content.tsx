"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Lock, Upload, LoaderIcon, ChevronDownIcon, SearchIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { fetchApi } from "@/lib/api/http"
import { toast } from "sonner"
import { defaultCountries, parseCountry, type ParsedCountry } from "react-international-phone"
import { parsePhoneNumber } from "libphonenumber-js"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Cropper, CropperImage, CropperControls } from "@/components/ui/cropper"
import type { Area } from "react-easy-crop"

export const AccountUserContent = React.memo(() => {
  const t = useTranslations('settings')
  const { user, refreshUser, currentWorkspace } = useWorkspace()
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false)
  const [isCropperOpen, setIsCropperOpen] = React.useState(false)
  const [cropImageSrc, setCropImageSrc] = React.useState<string | null>(null)
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null)
  const [previewAvatarUrl, setPreviewAvatarUrl] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    name: user?.name || '',
    username: user?.username || '',
    phoneNumber: user?.phoneNumber || '',
  })

  // Phone number country selection
  const [selectedCountry, setSelectedCountry] = React.useState<ParsedCountry | null>(null)
  const [countrySearchQuery, setCountrySearchQuery] = React.useState('')
  const countries = React.useMemo(() => {
    return defaultCountries.map(country => parseCountry(country))
  }, [])

  // Filter countries based on search query
  const filteredCountries = React.useMemo(() => {
    if (!countrySearchQuery.trim()) return countries
    
    const query = countrySearchQuery.toLowerCase().trim()
    return countries.filter(country => 
      country.name.toLowerCase().includes(query) ||
      country.iso2.toLowerCase().includes(query) ||
      country.dialCode.includes(query)
    )
  }, [countries, countrySearchQuery])

  // Initialize country from phone number
  React.useEffect(() => {
    if (user?.phoneNumber) {
      try {
        const parsed = parsePhoneNumber(user.phoneNumber)
        if (parsed.country) {
          const country = countries.find(c => c.iso2 === parsed.country?.toLowerCase())
          if (country) {
            setSelectedCountry(country)
          }
        }
      } catch {
        // If parsing fails, default to Turkey
        const turkey = countries.find(c => c.iso2 === 'tr')
        if (turkey) setSelectedCountry(turkey)
      }
    } else {
      // Default to Turkey
      const turkey = countries.find(c => c.iso2 === 'tr')
      if (turkey) setSelectedCountry(turkey)
    }
  }, [user?.phoneNumber, countries])

  const [usernameStatus, setUsernameStatus] = React.useState<{
    checking: boolean
    available: boolean | null
    message: string | null
  }>({
    checking: false,
    available: null,
    message: null,
  })

  // Convert ISO2 to flag emoji
  const getCountryFlag = React.useCallback((iso2: string): string => {
    if (!iso2 || iso2.length !== 2) return ''
    const codePoints = iso2
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }, [])

  // Extract phone number for saving (E.164 format: +905551234567)
  const extractPhoneNumber = React.useCallback((value: string, country?: ParsedCountry): string | null => {
    if (!value || !country) return null
    
    try {
      // Try to parse as is first
      const parsed = parsePhoneNumber(value)
      return parsed.number
    } catch {
      // If that fails, try to construct from country code
      const iso2 = country.iso2
      const callingCode = country.dialCode
      const digits = value.replace(/\D/g, '')
      
      if (digits.length === 0) return null
      
      // Remove country code if it's already there
      let phoneDigits = digits
      if (digits.startsWith(callingCode)) {
        phoneDigits = digits.slice(callingCode.length)
      }
      
      if (phoneDigits.length === 0) return null
      
      // Try to parse with country
      try {
        const fullNumber = `+${callingCode}${phoneDigits}`
        const parsed = parsePhoneNumber(fullNumber, iso2.toUpperCase() as any)
        return parsed.number
      } catch {
        // Return as E.164 format
        return `+${callingCode}${phoneDigits}`
      }
    }
  }, [])

  React.useEffect(() => {
    if (user) {
      let formattedPhone = ''
      if (user.phoneNumber && selectedCountry) {
        try {
          const parsed = parsePhoneNumber(user.phoneNumber)
          formattedPhone = parsed.formatInternational()
        } catch {
          formattedPhone = user.phoneNumber
        }
      }
      
      setFormData({
        name: user.name || '',
        username: user.username || '',
        phoneNumber: formattedPhone,
      })
    }
  }, [user, selectedCountry])

  const checkUsernameAvailability = React.useCallback(async (username: string) => {
    if (!username || username === user?.username) {
      setUsernameStatus({ checking: false, available: null, message: null })
      return
    }

    // Validate username format (lowercase, numbers, underscores only, 3-30 chars)
    const usernameRegex = /^[a-z0-9_]{3,30}$/
    if (!usernameRegex.test(username)) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: t('usernameInvalid'),
      })
      return
    }

    setUsernameStatus({ checking: true, available: null, message: null })

    try {
      const response = await fetchApi<{
        success: boolean
        available: boolean
        username: string
      }>(`/users/username/${encodeURIComponent(username)}/available`, {
        params: {
          excludeUserId: user?.id,
        },
      })

      if (response.available) {
        setUsernameStatus({
          checking: false,
          available: true,
          message: t('usernameAvailable'),
        })
      } else {
        setUsernameStatus({
          checking: false,
          available: false,
          message: t('usernameTaken'),
        })
      }
    } catch (error) {
      console.error('Failed to check username availability:', error)
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Failed to check username availability',
      })
    }
  }, [user?.id, user?.username, t])

  const usernameCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleUsernameChange = React.useCallback((value: string) => {
    // Convert to lowercase
    const lowerValue = value.toLowerCase()
    setFormData((prev) => ({ ...prev, username: lowerValue }))

    // Clear previous timeout
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current)
    }

    // If username changed and is different from current, show spinner immediately
    if (lowerValue !== (user?.username || '')) {
      setUsernameStatus({ checking: true, available: null, message: null })
    } else {
      // If back to original username, clear status
      setUsernameStatus({ checking: false, available: null, message: null })
      return
    }

    // Debounce username check (500ms)
    usernameCheckTimeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(lowerValue)
    }, 500)
  }, [checkUsernameAvailability, user?.username])

  React.useEffect(() => {
    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current)
      }
    }
  }, [])

  const handleNameChange = React.useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, name: value }))
  }, [])

  // Auto-select country based on dial code in phone number
  const autoSelectCountryByDialCode = React.useCallback((phoneValue: string) => {
    // Try to extract country code from the phone number
    if (phoneValue.startsWith('+')) {
      const withoutPlus = phoneValue.slice(1)
      // Try to match dial codes (1-4 digits)
      for (let i = 4; i >= 1; i--) {
        const possibleCode = withoutPlus.slice(0, i)
        const matchingCountry = countries.find(c => c.dialCode === possibleCode)
        if (matchingCountry) {
          if (selectedCountry?.iso2 !== matchingCountry.iso2) {
            setSelectedCountry(matchingCountry)
          }
          return matchingCountry
        }
      }
    }
    return selectedCountry
  }, [countries, selectedCountry])

  const handlePhoneNumberChange = React.useCallback((value: string) => {
    // First, try to auto-select country based on dial code
    const detectedCountry = autoSelectCountryByDialCode(value) || selectedCountry
    if (!detectedCountry) return
    
    const callingCode = detectedCountry.dialCode
    const iso2 = detectedCountry.iso2
    let digits = value.replace(/\D/g, '')
    
    // Remove country code if present
    if (digits.startsWith(callingCode)) {
      digits = digits.slice(callingCode.length)
    }
    
    // Format with libphonenumber-js
    try {
      if (digits.length > 0) {
        const fullNumber = `+${callingCode}${digits}`
        const parsed = parsePhoneNumber(fullNumber, iso2.toUpperCase() as any)
        const formatted = parsed.formatInternational()
        setFormData((prev) => ({ ...prev, phoneNumber: formatted }))
      } else {
        setFormData((prev) => ({ ...prev, phoneNumber: `+${callingCode}` }))
      }
    } catch {
      // If parsing fails, just show with country code
      const formatted = digits ? `+${callingCode} ${digits}` : `+${callingCode}`
      setFormData((prev) => ({ ...prev, phoneNumber: formatted }))
    }
  }, [selectedCountry, autoSelectCountryByDialCode])

  const [savingField, setSavingField] = React.useState<'name' | 'phoneNumber' | 'username' | null>(null)

  const handleNameSave = React.useCallback(async () => {
    if (!user) return
    if (formData.name === user.name) return

    setSavingField('name')
    try {
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.name || null,
        }),
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Failed to update name:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, formData.name, refreshUser, t])

  const handlePhoneNumberSave = React.useCallback(async () => {
    if (!user || !selectedCountry) return
    
    // Extract phone number in E.164 format
    const phoneToSave = extractPhoneNumber(formData.phoneNumber, selectedCountry)
    
    // Compare with existing
    const currentPhone = user.phoneNumber || ''
    if (phoneToSave === currentPhone) return

    setSavingField('phoneNumber')
    try {
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          phoneNumber: phoneToSave,
        }),
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Failed to update phone number:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, formData.phoneNumber, selectedCountry, extractPhoneNumber, refreshUser, t])

  const hasNameChanged = React.useMemo(
    () => formData.name !== (user?.name || ''),
    [formData.name, user?.name]
  )

  const hasPhoneNumberChanged = React.useMemo(() => {
    if (!user || !selectedCountry) return false
    const currentPhone = user.phoneNumber || ''
    const newPhone = extractPhoneNumber(formData.phoneNumber, selectedCountry)
    return newPhone !== currentPhone && newPhone !== null
  }, [formData.phoneNumber, user?.phoneNumber, selectedCountry, extractPhoneNumber])


  const handleUsernameSave = React.useCallback(async () => {
    if (!user) return
    if (usernameStatus.available !== true) return
    if (formData.username === user.username) return

    setSavingField('username')
    try {
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          username: formData.username || null,
        }),
      })

      await refreshUser()
      toast.success(t('profileUpdated'))
      // Reset username status after successful save
      setUsernameStatus({ checking: false, available: null, message: null })
    } catch (error) {
      console.error('Failed to update username:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setSavingField(null)
    }
  }, [user, formData.username, usernameStatus.available, refreshUser, t])

  const hasUsernameChanged = React.useMemo(
    () => formData.username !== (user?.username || ''),
    [formData.username, user?.username]
  )

  // Utility function to create image from blob
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

  const handleAvatarFileSelect = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      toast.error(t('selectImageFile'))
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('imageTooLarge'))
      event.target.value = ''
      return
    }

    // Create preview URL and open cropper
    const imageUrl = URL.createObjectURL(file)
    setCropImageSrc(imageUrl)
    setIsCropperOpen(true)
    // Reset input
    event.target.value = ''
  }, [user, t])

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
    if (!cropImageSrc || !croppedAreaPixels || !user) return

    setIsCropperOpen(false)
    setIsUploadingAvatar(true)

    try {
      // Get cropped blob
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels)
      
      // Create preview URL for immediate display
      const previewUrl = URL.createObjectURL(croppedBlob)
      setPreviewAvatarUrl(previewUrl)

      // Create File from blob
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' })

      if (!currentWorkspace?.id) {
        toast.error(t('workspaceRequired') || 'Workspace is required')
        URL.revokeObjectURL(previewUrl)
        setPreviewAvatarUrl(null)
        return
      }

      // Upload cropped image
      const result = await apiClient.uploadMedia(currentWorkspace.id, croppedFile)
      const media = result.media
      
      await fetchApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          avatarMediaId: media.id,
        }),
      })

      // Refresh user data - this will update user state with new avatar
      await refreshUser()
      
      // Don't clean up preview URL here - let the avatarUrl memo handle it
      // when it detects the new real avatar URL

      toast.success(t('avatarUpdated'))
    } catch (error) {
      console.error('Failed to upload avatar:', error)
      toast.error(t('avatarUploadFailed'))
      // Clean up preview URL on error
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl)
        setPreviewAvatarUrl(null)
      }
    } finally {
      setIsUploadingAvatar(false)
      // Clean up crop image URL
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc)
        setCropImageSrc(null)
      }
      setCroppedAreaPixels(null)
    }
  }, [cropImageSrc, croppedAreaPixels, user, getCroppedImg, currentWorkspace?.id, t, refreshUser, previewAvatarUrl])

  // Clean up blob URLs on unmount
  React.useEffect(() => {
    return () => {
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc)
      }
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl)
      }
    }
  }, [cropImageSrc, previewAvatarUrl])

  // Clean up preview URL when real avatar URL becomes available
  React.useEffect(() => {
    if (!previewAvatarUrl) return
    
    const realAvatarUrl = user?.avatarUrls?.small || user?.avatarUrls?.thumbnail || null
    if (realAvatarUrl) {
      // Real avatar is available, clean up preview
      // Use the current previewAvatarUrl from closure
      const urlToClean = previewAvatarUrl
      setPreviewAvatarUrl(null)
      // Clean up URL after state update
      setTimeout(() => {
        URL.revokeObjectURL(urlToClean)
      }, 0)
    }
  }, [user?.avatarUrls?.small, user?.avatarUrls?.thumbnail, previewAvatarUrl])

  const avatarUrl = React.useMemo(() => {
    const realAvatarUrl = user?.avatarUrls?.small || user?.avatarUrls?.thumbnail || null
    
    // Priority: real avatar URL > preview URL > null
    if (realAvatarUrl) {
      return realAvatarUrl
    }
    
    if (previewAvatarUrl) {
      return previewAvatarUrl
    }
    
    return null
  }, [previewAvatarUrl, user?.avatarUrls?.small, user?.avatarUrls?.thumbnail])

  const userInitial = React.useMemo(
    () => (user?.name || user?.email || 'U').charAt(0).toUpperCase(),
    [user?.name, user?.email]
  )

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* User Identity Section */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Avatar className="size-14 sm:size-16 shrink-0" key={avatarUrl || 'no-avatar'}>
          <AvatarImage src={avatarUrl || undefined} alt={user?.name || user?.email || 'User'} />
          <AvatarFallback className="text-lg sm:text-xl">{userInitial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h2 className="text-lg sm:text-xl font-semibold truncate">{user.name || user.email}</h2>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {user.email}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarFileSelect}
            className="hidden"
            id="avatar-upload"
            disabled={isUploadingAvatar}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('avatar-upload')?.click()}
            disabled={isUploadingAvatar}
            className="w-full sm:w-auto"
          >
            {isUploadingAvatar ? (
              <>{t('uploadingAvatar')}</>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                {t('uploadAvatar')}
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {/* General Information Section */}
      <div className="flex flex-col gap-6">
        <h3 className="text-lg font-semibold">{t('generalSection')}</h3>

        {/* Email Field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="pr-10"
            />
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('emailChangeNotAllowed')}.{' '}
            {t('toChangeEmail')}{' '}
            <a
              href="mailto:support@example.com"
              className="text-primary hover:underline"
            >
              {t('contactAdministrator')}
            </a>
            .
          </p>
        </div>

        {/* Username Field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="username">{t('username')}</Label>
          <InputGroup data-disabled={savingField === 'username'}>
            <InputGroupAddon align="inline-start">
              <InputGroupText>@</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder={t('usernamePlaceholder')}
              disabled={savingField === 'username'}
            />
            {savingField === 'username' && (
              <InputGroupAddon align="inline-end">
                <LoaderIcon className="animate-spin size-4" />
              </InputGroupAddon>
            )}
            {savingField !== 'username' && usernameStatus.checking && (
              <InputGroupAddon align="inline-end">
                <LoaderIcon className="animate-spin size-4" />
              </InputGroupAddon>
            )}
            {savingField !== 'username' && !usernameStatus.checking && hasUsernameChanged && usernameStatus.available === true && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleUsernameSave()
                  }}
                  variant="default"
                >
                  {t('save')}
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          {!usernameStatus.checking && usernameStatus.message && (
            <p
              className={`text-sm ${
                usernameStatus.available
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {usernameStatus.message}
            </p>
          )}
        </div>

        {/* Full Name Field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t('fullName')}</Label>
          <InputGroup data-disabled={savingField === 'name'}>
            <InputGroupInput
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t('namePlaceholder')}
              disabled={savingField === 'name'}
            />
            {savingField === 'name' && (
              <InputGroupAddon align="inline-end">
                <LoaderIcon className="animate-spin size-4" />
              </InputGroupAddon>
            )}
            {savingField !== 'name' && hasNameChanged && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleNameSave()
                  }}
                  variant="default"
                >
                  {t('save')}
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {/* Phone Number Field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="phoneNumber">{t('phoneNumber')}</Label>
          <InputGroup data-disabled={savingField === 'phoneNumber'}>
            <InputGroupAddon align="inline-start">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton variant="ghost" className="!pr-1.5 text-xs" disabled={savingField === 'phoneNumber'}>
                    {selectedCountry ? (
                      <>
                        <span className="text-base">{getCountryFlag(selectedCountry.iso2)}</span>
                        <ChevronDownIcon className="size-3" />
                      </>
                    ) : (
                      <>
                        <span>Select</span>
                        <ChevronDownIcon className="size-3" />
                      </>
                    )}
                  </InputGroupButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[280px] p-0">
                  {/* Search Input */}
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <SearchIcon className="size-4 shrink-0 opacity-50" />
                    <input
                      type="text"
                      placeholder={t('searchCountryOrCode')}
                      value={countrySearchQuery}
                      onChange={(e) => {
                        e.stopPropagation()
                        setCountrySearchQuery(e.target.value)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  {/* Countries List */}
                  <div className="max-h-[280px] overflow-y-auto">
                    {filteredCountries.length > 0 ? (
                      filteredCountries.map((country) => (
                        <DropdownMenuItem
                          key={country.iso2}
                          onClick={() => {
                            setSelectedCountry(country)
                            setCountrySearchQuery('')
                            // Reformat current phone number with new country
                            if (formData.phoneNumber) {
                              handlePhoneNumberChange(formData.phoneNumber)
                            } else {
                              setFormData(prev => ({ ...prev, phoneNumber: `+${country.dialCode}` }))
                            }
                          }}
                        >
                          <span className="text-base mr-2">{getCountryFlag(country.iso2)}</span>
                          <span>{country.name}</span>
                          <span className="ml-auto text-muted-foreground">+{country.dialCode}</span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No countries found
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
            <InputGroupInput
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handlePhoneNumberChange(e.target.value)}
              disabled={savingField === 'phoneNumber'}
              placeholder={selectedCountry ? `+${selectedCountry.dialCode} ...` : ''}
            />
            {savingField === 'phoneNumber' && (
              <InputGroupAddon align="inline-end">
                <LoaderIcon className="animate-spin size-4" />
              </InputGroupAddon>
            )}
            {savingField !== 'phoneNumber' && hasPhoneNumberChanged && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handlePhoneNumberSave()
                  }}
                  variant="default"
                >
                  {t('save')}
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>
      </div>

      {/* Avatar Cropper Dialog */}
      <Dialog open={isCropperOpen} onOpenChange={(open) => {
        if (!open) {
          handleCropCancel()
        }
      }}>
        <DialogContent className="max-w-2xl p-0">
          <DialogTitle className="sr-only">{t('cropAvatar')}</DialogTitle>
          {cropImageSrc && (
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
})

AccountUserContent.displayName = "AccountUserContent"
