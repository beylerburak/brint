"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useWorkspace } from "@/contexts/workspace-context"
import { Skeleton } from "@/components/ui/skeleton"
import { IconUpload, IconX, IconRotate, IconZoomIn, IconCheck, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { Cropper, CropperImage } from "@/components/ui/cropper"
import type { Area } from "react-easy-crop"
import { APP_CONFIG } from "@/lib/config"

export default function ProfileSettingsPage() {
  const t = useTranslations('settings')
  const { user, isLoadingUser, currentWorkspace, refreshUser } = useWorkspace()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageSrc, setImageSrc] = useState<string>("")
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  
  // Form state
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [timezonePreference, setTimezonePreference] = useState<'WORKSPACE' | 'LOCAL'>('WORKSPACE')
  const [dateFormat, setDateFormat] = useState<'DMY' | 'MDY' | 'YMD'>('DMY')
  const [timeFormat, setTimeFormat] = useState<'H24' | 'H12'>('H24')
  const [locale, setLocale] = useState('en-US')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form values
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setUsername(user.username || '')
      setPhoneNumber(user.phoneNumber || '')
      setTimezonePreference(user.timezonePreference || 'WORKSPACE')
      setDateFormat(user.dateFormat || 'DMY')
      setTimeFormat(user.timeFormat || 'H24')
      setLocale(user.locale || 'en-US')
    }
  }, [user])

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username === user?.username) {
      setUsernameAvailable(null)
      return
    }

    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username) || username.length < 3) {
      setUsernameAvailable(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true)
      try {
        const response = await fetch(
          `http://localhost:3001/users/username/${username}/available?excludeUserId=${user?.id}`,
          { credentials: 'include' }
        )
        const data = await response.json()
        setUsernameAvailable(data.available)
      } catch (error) {
        console.error('Username check failed:', error)
        setUsernameAvailable(false)
      } finally {
        setIsCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username, user?.username, user?.id])

  // Track changes
  useEffect(() => {
    // Username change is valid if it's available
    const usernameChanged = username !== (user?.username || '')
    
    const changed = Boolean(
      (name !== (user?.name || '') && name.trim()) ||
      (phoneNumber !== (user?.phoneNumber || '')) ||
      (timezonePreference !== (user?.timezonePreference || 'WORKSPACE')) ||
      (dateFormat !== (user?.dateFormat || 'DMY')) ||
      (timeFormat !== (user?.timeFormat || 'H24')) ||
      (locale !== (user?.locale || 'en-US')) ||
      (usernameChanged && usernameAvailable === true)
    )
    
    setHasChanges(changed)
  }, [name, username, phoneNumber, timezonePreference, dateFormat, timeFormat, locale, usernameAvailable, user])

  const handleSaveProfile = async () => {
    if (!hasChanges) return

    setIsSaving(true)
    try {
      // Build update payload (only include changed fields with valid values)
      const updatePayload: any = {}
      
      console.log('[Profile] Building payload with:', {
        username: username,
        userUsername: user?.username,
        usernameChanged: username !== user?.username,
        usernameLength: username.length,
        usernameValid: /^[a-z0-9_]+$/.test(username),
        usernameAvailable: usernameAvailable,
      })
      
      if (name !== user?.name && name.trim()) updatePayload.name = name.trim()
      
      // Only include username if it's valid, different, and available
      if (username !== user?.username && username.length >= 3 && /^[a-z0-9_]+$/.test(username) && usernameAvailable === true) {
        updatePayload.username = username
      }
      
      if (phoneNumber !== user?.phoneNumber) updatePayload.phoneNumber = phoneNumber
      if (timezonePreference !== user?.timezonePreference) updatePayload.timezonePreference = timezonePreference
      if (dateFormat !== user?.dateFormat) updatePayload.dateFormat = dateFormat
      if (timeFormat !== user?.timeFormat) updatePayload.timeFormat = timeFormat
      if (locale !== user?.locale) updatePayload.locale = locale

      console.log('[Profile] Final update payload:', updatePayload)

      const response = await fetch('http://localhost:3001/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.error?.code === 'USERNAME_TAKEN') {
          toast.error(t('usernameTaken'))
          return
        }
        throw new Error('Update failed')
      }

      toast.success(t('profileUpdated'))
      await refreshUser()
      setHasChanges(false)
    } catch (error) {
      console.error('Profile update failed:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelProfile = () => {
    if (user) {
      setName(user.name || '')
      setUsername(user.username || '')
      setPhoneNumber(user.phoneNumber || '')
      setTimezonePreference(user.timezonePreference || 'WORKSPACE')
      setDateFormat(user.dateFormat || 'DMY')
      setTimeFormat(user.timeFormat || 'H24')
      setLocale(user.locale || 'en-US')
      setHasChanges(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('selectImageFile'))
      return
    }

    // Validate file size (from config)
    if (file.size > APP_CONFIG.media.avatar.maxSizeBytes) {
      toast.error(t('imageTooLarge').replace('5MB', `${APP_CONFIG.media.avatar.maxSizeMB}MB`))
      return
    }

    // Read file and show cropper
    const reader = new FileReader()
    reader.onloadend = () => {
      setImageSrc(reader.result as string)
      setSelectedFile(file)
      setShowCropDialog(true)
    }
    reader.readAsDataURL(file)

    // Reset file input
    e.target.value = ''
  }

  const handleCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const createCroppedImage = async (): Promise<Blob | null> => {
    if (!imageSrc || !croppedAreaPixels) return null

    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    // Set canvas size to cropped area
    canvas.width = croppedAreaPixels.width
    canvas.height = croppedAreaPixels.height

    // Draw cropped image
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/jpeg', 0.95)
    })
  }

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.src = url
    })
  }

  const handleCropSave = async () => {
    setIsUploading(true)
    try {
      const croppedBlob = await createCroppedImage()
      if (!croppedBlob) throw new Error('Failed to crop image')

      // Create file from blob
      const croppedFile = new File(
        [croppedBlob],
        selectedFile?.name || 'avatar.jpg',
        { type: 'image/jpeg' }
      )

      // Upload to server
      const formData = new FormData()
      formData.append('file', croppedFile)
      formData.append('title', `${user?.name}'s avatar`)
      formData.append('isPublic', 'false')

      const uploadResponse = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace?.id}/media`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      )

      if (!uploadResponse.ok) throw new Error('Upload failed')

      const uploadData = await uploadResponse.json()
      const mediaId = uploadData.media.id

      // Update user profile
      const updateResponse = await fetch('http://localhost:3001/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarMediaId: mediaId }),
      })
      
      if (!updateResponse.ok) {
        throw new Error('Profile update failed')
      }

      toast.success(t('avatarUpdated'))
      await refreshUser()
      
      // Force refresh to get updated user data with presigned URLs
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
      setShowCropDialog(false)
      setImageSrc('')
      setSelectedFile(null)
    } catch (error) {
      console.error('Avatar upload failed:', error)
      toast.error(t('avatarUploadFailed'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUploading(true)
    try {
      const currentAvatarMediaId = user?.avatarMediaId

      // First, remove avatar from user profile
      const updateResponse = await fetch('http://localhost:3001/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarMediaId: null }),
      })

      if (!updateResponse.ok) throw new Error('Failed to update profile')

      // Then delete the media from S3 and database
      if (currentAvatarMediaId && currentWorkspace?.id) {
        await fetch(
          `http://localhost:3001/workspaces/${currentWorkspace.id}/media/${currentAvatarMediaId}`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        )
        // Don't fail if media deletion fails - avatar is already removed from profile
      }

      toast.success(t('avatarRemoved'))
      setAvatarPreview(null)
      await refreshUser()
    } catch (error) {
      console.error('Avatar removal failed:', error)
      toast.error(t('avatarRemoveFailed'))
    } finally {
      setIsUploading(false)
    }
  }

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview
    // Use pre-generated URLs from backend
    if (user?.avatarUrls?.small) {
      return user.avatarUrls.small
    }
    return undefined
  }

  if (isLoadingUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('profileTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('profileDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('profilePicture')}</CardTitle>
          <CardDescription>
            {t('profilePictureDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={getAvatarUrl()} alt={user?.name || 'User'} />
              <AvatarFallback className="text-2xl">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                size="sm"
              >
                <IconUpload className="h-4 w-4 mr-2" />
                {isUploading ? t('uploading') : t('uploadPhoto')}
              </Button>
              {(user?.avatarMediaId || avatarPreview) && (
                <Button
                  onClick={handleRemoveAvatar}
                  disabled={isUploading}
                  variant="outline"
                  size="sm"
                >
                  <IconX className="h-4 w-4 mr-2" />
                  {t('remove')}
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('avatarRecommendation', {
              minSize: APP_CONFIG.media.avatar.recommendedMinSize,
              maxSize: APP_CONFIG.media.avatar.maxSizeMB,
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('personalInfo')}</CardTitle>
          <CardDescription>
            {t('personalInfoDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('username')}</Label>
            <InputGroup>
              <InputGroupAddon>
                <span className="text-muted-foreground font-mono">@</span>
              </InputGroupAddon>
              <InputGroupInput 
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder={t('usernamePlaceholder')}
              />
              <InputGroupAddon align="inline-end">
                {isCheckingUsername && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!isCheckingUsername && usernameAvailable === true && username !== user?.username && (
                  <IconCheck className="h-4 w-4 text-green-600" />
                )}
                {!isCheckingUsername && usernameAvailable === false && username !== user?.username && (
                  <IconX className="h-4 w-4 text-red-600" />
                )}
              </InputGroupAddon>
            </InputGroup>
            <p className="text-xs text-muted-foreground">
              {username === user?.username && t('currentUsername')}
              {username !== user?.username && usernameAvailable === true && (
                <span className="text-green-600">{t('usernameAvailable')}</span>
              )}
              {username !== user?.username && usernameAvailable === false && (
                <span className="text-red-600">{t('usernameTaken')}</span>
              )}
              {username !== user?.username && usernameAvailable === null && t('usernameDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('email')}</Label>
            <Input 
              value={user?.email || ''} 
              type="email"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              {t('emailChangeNotAllowed')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('phoneNumber')}</Label>
            <Input 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+90 555 123 4567"
            />
          </div>
        </CardContent>
      </Card>

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('cropAvatar')}</DialogTitle>
            <DialogDescription>
              {t('cropAvatarDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Cropper
              defaultZoom={zoom}
              defaultRotation={rotation}
              aspect={1}
              onCropComplete={handleCropComplete}
              className="h-[400px]"
            >
              <CropperImage
                src={imageSrc}
                cropShape="round"
                showGrid={false}
                minZoom={1}
                maxZoom={3}
              />
            </Cropper>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <IconZoomIn className="h-4 w-4" />
                  <Label className="text-sm">{t('zoom')}</Label>
                </div>
                <Slider
                  value={[zoom]}
                  onValueChange={(values: number[]) => setZoom(values[0])}
                  min={1}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <IconRotate className="h-4 w-4" />
                  <Label className="text-sm">{t('rotation')}</Label>
                </div>
                <Slider
                  value={[rotation]}
                  onValueChange={(values: number[]) => setRotation(values[0])}
                  min={0}
                  max={360}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCropDialog(false)
                setImageSrc('')
                setSelectedFile(null)
              }}
              disabled={isUploading}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleCropSave} disabled={isUploading}>
              {isUploading ? t('uploading') : t('saveAvatar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>{t('timeLocalePrefs')}</CardTitle>
          <CardDescription>
            {t('timeLocalePrefsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('timezonePreference')}</Label>
            <Select value={timezonePreference} onValueChange={(value: 'WORKSPACE' | 'LOCAL') => setTimezonePreference(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKSPACE">{t('useWorkspaceTz')}</SelectItem>
                <SelectItem value="LOCAL">{t('usePersonalTz')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {timezonePreference === 'WORKSPACE' ? t('useWorkspaceTzDesc') : t('usePersonalTzDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('dateFormat')}</Label>
            <Select value={dateFormat} onValueChange={(value: 'DMY' | 'MDY' | 'YMD') => setDateFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DMY">DD.MM.YYYY (31.12.2025)</SelectItem>
                <SelectItem value="MDY">MM/DD/YYYY (12/31/2025)</SelectItem>
                <SelectItem value="YMD">YYYY-MM-DD (2025-12-31)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('timeFormat')}</Label>
            <Select value={timeFormat} onValueChange={(value: 'H24' | 'H12') => setTimeFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="H24">24-hour (23:45)</SelectItem>
                <SelectItem value="H12">12-hour (11:45 PM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('language')}</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="tr-TR">Türkçe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save/Cancel Buttons - Single section for all profile changes */}
      {hasChanges && (
        <div className="flex gap-2 sticky bottom-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 rounded-lg border shadow-lg z-10">
          <Button 
            onClick={handleSaveProfile} 
            disabled={
              isSaving || 
              (username !== user?.username && username.length > 0 && usernameAvailable !== true)
            }
            className="flex-1"
          >
            {isSaving ? t('saving') : t('saveChanges')}
          </Button>
          <Button variant="outline" onClick={handleCancelProfile} disabled={isSaving} className="flex-1">
            {t('cancel')}
          </Button>
        </div>
      )}
    </div>
  )
}

