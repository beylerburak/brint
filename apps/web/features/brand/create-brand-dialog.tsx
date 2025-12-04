"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Cropper, CropperImage } from "@/components/ui/cropper"
import { IconCheck, IconX, IconLoader2, IconChevronRight, IconChevronLeft, IconUpload, IconTrash, IconRotate, IconZoomIn } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Area } from "react-easy-crop"
import { Slider } from "@/components/ui/slider"

type CreateBrandDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSuccess: () => void
}

const STEPS = ['basic', 'location', 'branding'] as const
type Step = typeof STEPS[number]

export function CreateBrandDialog({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: CreateBrandDialogProps) {
  const t = useTranslations('brands')
  const [currentStep, setCurrentStep] = useState<Step>('basic')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [primaryLocale, setPrimaryLocale] = useState('en-US')
  const [timezone, setTimezone] = useState('Europe/Istanbul')
  const [logoMediaId, setLogoMediaId] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageSrc, setImageSrc] = useState<string>("")
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Slug validation
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !isSlugManuallyEdited) {
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
        .slice(0, 50)
      setSlug(autoSlug)
    }
  }, [name, isSlugManuallyEdited])

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true)
      try {
        const response = await fetch(
          `http://localhost:3001/brands/slug/${slug}/available`,
          { credentials: 'include' }
        )
        const data = await response.json()
        setSlugAvailable(data.available)
      } catch (error) {
        console.error('Slug check failed:', error)
        setSlugAvailable(false)
      } finally {
        setIsCheckingSlug(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [slug])

  const canProceedToNext = (): boolean => {
    switch (currentStep) {
      case 'basic':
        return name.length > 0 && slug.length >= 3 && slugAvailable === true
      case 'location':
        return true // Optional fields
      case 'branding':
        return true // Optional fields
      default:
        return false
    }
  }

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(currentStep)
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1])
    }
  }

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1])
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    // Read file and show crop dialog
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setSelectedFile(file)
      setShowCropDialog(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const createCroppedImage = async (): Promise<Blob> => {
    const image = new Image()
    image.src = imageSrc
    
    await new Promise((resolve) => {
      image.onload = resolve
    })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx || !croppedAreaPixels) {
      throw new Error('Canvas context not available')
    }

    canvas.width = croppedAreaPixels.width
    canvas.height = croppedAreaPixels.height

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
        if (blob) resolve(blob)
      }, 'image/jpeg', 0.95)
    })
  }

  const handleCropSave = async () => {
    if (!croppedAreaPixels || !selectedFile) return

    setIsUploadingLogo(true)
    try {
      const croppedBlob = await createCroppedImage()
      const formData = new FormData()
      formData.append('file', croppedBlob, selectedFile.name)
      formData.append('title', `${name || 'Brand'} Logo`)
      formData.append('isPublic', 'false')

      const response = await fetch(`http://localhost:3001/workspaces/${workspaceId}/media`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Workspace-Id': workspaceId,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Upload error:', errorData)
        throw new Error(errorData.error?.message || 'Upload failed')
      }

      const data = await response.json()
      setLogoMediaId(data.media.id)
      setLogoPreview(URL.createObjectURL(croppedBlob))
      setShowCropDialog(false)
      setZoom(1)
      setRotation(0)
      toast.success('Logo uploaded successfully')
    } catch (error) {
      console.error('Logo upload failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCropCancel = () => {
    setShowCropDialog(false)
    setImageSrc('')
    setSelectedFile(null)
    setZoom(1)
    setRotation(0)
    setCroppedAreaPixels(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveLogo = () => {
    setLogoMediaId(null)
    setLogoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch(
        `http://localhost:3001/workspaces/${workspaceId}/brands`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            slug,
            description: description || undefined,
            industry: industry || undefined,
            country: country || undefined,
            city: city || undefined,
            primaryLocale,
            timezone,
            logoMediaId: logoMediaId || undefined,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        if (error.error?.code === 'SLUG_TAKEN') {
          toast.error(t('slugTaken'))
          setCurrentStep('basic')
          return
        }
        if (error.error?.code === 'BRAND_LIMIT_REACHED') {
          toast.error(t('brandLimitReached'))
          return
        }
        throw new Error('Failed to create brand')
      }

      toast.success(t('brandCreated'))
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Brand creation failed:', error)
      toast.error(t('brandCreateFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setCurrentStep('basic')
    setName('')
    setSlug('')
    setDescription('')
    setIndustry('')
    setCountry('')
    setCity('')
    setPrimaryLocale('en-US')
    setTimezone('Europe/Istanbul')
    setLogoMediaId(null)
    setLogoPreview(null)
    setSlugAvailable(null)
    setIsSlugManuallyEdited(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('createBrand')}</DialogTitle>
          <DialogDescription>
            {t('createBrandDesc')}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 py-4">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex items-center gap-2 flex-1",
                  index > 0 && "ml-2"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    STEPS.indexOf(currentStep) >= index
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    STEPS.indexOf(currentStep) >= index
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {t(`step${index + 1}`)}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 transition-colors ml-2",
                    STEPS.indexOf(currentStep) > index
                      ? "bg-primary"
                      : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-4 py-4">
          {/* Step 1: Basic Info */}
          {currentStep === 'basic' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('brandName')}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('brandNamePlaceholder')}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  {t('brandNameDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('brandSlug')}</Label>
                <InputGroup>
                  <InputGroupAddon>
                    <span className="text-muted-foreground font-mono">@</span>
                  </InputGroupAddon>
                  <InputGroupInput
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                      setIsSlugManuallyEdited(true)
                    }}
                    placeholder={t('brandSlugPlaceholder')}
                  />
                  <InputGroupAddon align="inline-end">
                    {isCheckingSlug && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!isCheckingSlug && slugAvailable === true && (
                      <IconCheck className="h-4 w-4 text-green-600" />
                    )}
                    {!isCheckingSlug && slugAvailable === false && (
                      <IconX className="h-4 w-4 text-red-600" />
                    )}
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-xs text-muted-foreground">
                  {slugAvailable === true && (
                    <span className="text-green-600">{t('slugAvailable')}</span>
                  )}
                  {slugAvailable === false && (
                    <span className="text-red-600">{t('slugTaken')}</span>
                  )}
                  {slugAvailable === null && t('brandSlugDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('description')}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {t('descriptionDesc')}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Location & Industry */}
          {currentStep === 'location' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('industry')}</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectIndustry')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="hospitality">Hospitality</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('country')}</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectCountry')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TR">Turkey</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="DE">Germany</SelectItem>
                      <SelectItem value="FR">France</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('city')}</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('cityPlaceholder')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Branding & Localization */}
          {currentStep === 'branding' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('primaryLocale')}</Label>
                <Select value={primaryLocale} onValueChange={setPrimaryLocale}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="tr-TR">Türkçe (Turkey)</SelectItem>
                    <SelectItem value="de-DE">Deutsch (Germany)</SelectItem>
                    <SelectItem value="fr-FR">Français (France)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('primaryLocaleDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('timezone')}</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Istanbul">Europe/Istanbul (UTC+3)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles (UTC-8)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('timezoneDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('logoUpload')}</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('logoUploadDesc')}
                </p>
                
                {logoPreview ? (
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 rounded-lg">
                      <AvatarImage src={logoPreview} alt="Brand logo" />
                      <AvatarFallback className="rounded-lg">{name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        <IconUpload className="h-4 w-4 mr-2" />
                        Change Logo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveLogo}
                        disabled={isUploadingLogo}
                      >
                        <IconTrash className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <>
                        <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <IconUpload className="h-4 w-4 mr-2" />
                        {t('uploadLogo')}
                      </>
                    )}
                  </Button>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2">
          {currentStep !== 'basic' && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <IconChevronLeft className="h-4 w-4" />
              {t('back')}
            </Button>
          )}
          
          <div className="flex-1" />

          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t('cancel')}
          </Button>

          {currentStep !== 'branding' ? (
            <Button onClick={handleNext} disabled={!canProceedToNext() || isSubmitting}>
              {t('next')}
              <IconChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? t('creating') : t('createBrand')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={handleCropCancel}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Brand Logo</DialogTitle>
            <DialogDescription>
              Adjust the crop area and zoom to fit your logo perfectly
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Cropper
              defaultZoom={zoom}
              defaultRotation={rotation}
              aspect={1}
              onCropComplete={handleCropComplete}
              className="h-96"
            >
              <CropperImage
                src={imageSrc}
                cropShape="rect"
                showGrid={true}
                minZoom={1}
                maxZoom={3}
              />
            </Cropper>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <IconZoomIn className="h-4 w-4" />
                    Zoom
                  </Label>
                  <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
                </div>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <IconRotate className="h-4 w-4" />
                    Rotation
                  </Label>
                  <span className="text-sm text-muted-foreground">{rotation}°</span>
                </div>
                <Slider
                  value={[rotation]}
                  min={0}
                  max={360}
                  step={1}
                  onValueChange={(value) => setRotation(value[0])}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCropCancel} disabled={isUploadingLogo}>
              Cancel
            </Button>
            <Button onClick={handleCropSave} disabled={isUploadingLogo}>
              {isUploadingLogo ? (
                <>
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Save & Upload'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

