"use client"

import { useParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useWorkspace } from "@/contexts/workspace-context"
import { Button } from "@/components/ui/button"
import { 
  Tabs, 
  TabsList, 
  TabsHighlight,
  TabsHighlightItem,
  TabsTrigger, 
  TabsContents,
  TabsContent 
} from "@/components/animate-ui/primitives/animate/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { IconPencil, IconExternalLink, IconPhone, IconMail, IconSparkles, IconPlus, IconCheck, IconX, IconUpload, IconLayoutDashboard, IconUsers, IconMessageCircle, IconShieldCheck, IconPalette } from "@tabler/icons-react"
import { Slider } from "@/components/ui/slider"
import { CountingNumber } from "@/components/animate-ui/primitives/texts/counting-number"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Cropper, { Area } from "react-easy-crop"
import { toast } from "sonner"

type Brand = {
  id: string
  name: string
  slug: string
  description: string | null
  industry: string | null
  country: string | null
  city: string | null
  primaryLocale: string | null
  timezone: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  logoUrl: string | null
}

export default function BrandProfilePage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace } = useWorkspace()
  const [brand, setBrand] = useState<Brand | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Avatar upload states
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [progressValue, setProgressValue] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentWorkspace?.id && brandSlug) {
      loadBrand()
    }
  }, [currentWorkspace?.id, brandSlug])

  // Animate progress value on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setProgressValue(73)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const loadBrand = async (skipLoading = false) => {
    if (!currentWorkspace?.id) return

    if (!skipLoading) {
      setIsLoading(true)
    }
    try {
      const response = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/brands?_t=${Date.now()}`,
        { 
          credentials: 'include',
          cache: 'no-store' // Prevent caching
        }
      )
      const data = await response.json()
      if (data.success) {
        const foundBrand = data.brands.find((b: Brand) => b.slug === brandSlug)
        if (foundBrand) {
          setBrand(foundBrand)
        }
      }
    } catch (error) {
      console.error('Failed to load brand:', error)
    } finally {
      if (!skipLoading) {
        setIsLoading(false)
      }
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setShowCropDialog(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.src = url
    })

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<Blob> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('No 2d context')
    }

    const maxSize = Math.max(image.width, image.height)
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2))

    canvas.width = safeArea
    canvas.height = safeArea

    ctx.translate(safeArea / 2, safeArea / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-safeArea / 2, -safeArea / 2)

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    )

    const data = ctx.getImageData(0, 0, safeArea, safeArea)

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.putImageData(
      data,
      0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
      0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
    )

    return new Promise((resolve) => {
      canvas.toBlob((file) => {
        resolve(file as Blob)
      }, 'image/jpeg')
    })
  }

  const handleCropSave = async () => {
    if (!selectedImage || !croppedAreaPixels || !brand || !currentWorkspace?.id) return

    setIsUploading(true)
    try {
      // Get cropped blob
      const croppedBlob = await getCroppedImg(
        selectedImage,
        croppedAreaPixels,
        rotation
      )

      // Immediately show blob preview
      const blobUrl = URL.createObjectURL(croppedBlob)
      setPreviewLogoUrl(blobUrl)
      
      // Notify brand-switcher and header to update logo preview
      window.dispatchEvent(new CustomEvent('brand-logo-preview', {
        detail: { brandId: brand.id, previewUrl: blobUrl }
      }))
      
      // Close dialog and reset states
      setShowCropDialog(false)
      setSelectedImage(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)

      // Get current brand data to check for existing logo
      const currentBrandResponse = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/brands`,
        { credentials: 'include' }
      )
      const currentBrandData = await currentBrandResponse.json()
      const currentBrand = currentBrandData.brands?.find((b: Brand) => b.id === brand.id)
      const oldLogoMediaId = currentBrand?.logoMediaId

      // Upload new logo
      const formData = new FormData()
      formData.append('file', croppedBlob, 'brand-logo.jpg')
      formData.append('title', `${brand.name} Logo`)
      formData.append('isPublic', 'false')

      const uploadResponse = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/media`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Workspace-Id': currentWorkspace.id,
          },
          body: formData,
        }
      )

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        console.error('Upload failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorData,
        })
        throw new Error(errorData.error?.message || 'Upload failed')
      }

      const uploadData = await uploadResponse.json()
      console.log('Upload response:', uploadData)
      
      if (!uploadData.success || !uploadData.media?.id) {
        throw new Error('Invalid upload response')
      }
      
      const mediaId = uploadData.media.id

      // Update brand with new logo
      const updateResponse = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/brands/${brand.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ logoMediaId: mediaId }),
        }
      )

      if (!updateResponse.ok) {
        throw new Error('Failed to update brand')
      }

      // Delete old logo if it exists
      if (oldLogoMediaId) {
        try {
          const deleteResponse = await fetch(
            `http://localhost:3001/workspaces/${currentWorkspace.id}/media/${oldLogoMediaId}`,
            {
              method: 'DELETE',
              credentials: 'include',
            }
          )
          if (deleteResponse.ok) {
            console.log('Old logo deleted successfully:', oldLogoMediaId)
          } else {
            console.warn('Failed to delete old logo:', oldLogoMediaId)
          }
        } catch (error) {
          console.warn('Error deleting old logo:', error)
          // Don't fail the whole operation if deletion fails
        }
      }

      toast.success('Brand logo updated successfully')
      
      // Note: Blob preview will stay until page refresh
      // This gives instant feedback. Real S3 URL will load on next page visit.
    } catch (error) {
      console.error('Failed to update logo:', error)
      toast.error('Failed to update brand logo')
      // Clear preview on error
      if (previewLogoUrl) {
        URL.revokeObjectURL(previewLogoUrl)
        setPreviewLogoUrl(null)
      }
    } finally {
      setIsUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <p className="text-muted-foreground">Brand not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Avatar with edit button */}
          <div className="relative">
            <Avatar className="h-20 w-20 rounded-full">
              <AvatarImage 
                src={previewLogoUrl || brand.logoUrl || undefined} 
                alt={brand.name}
                key={previewLogoUrl || brand.logoUrl || 'fallback'}
              />
              <AvatarFallback className="rounded-full text-2xl">
                {brand.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Brand info */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold">{brand.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {brand.industry && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {brand.industry}
                </Badge>
              )}
              {brand.city && brand.country && (
                <span>{brand.city}, {brand.country}</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Tabs with Edit Button */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="relative inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <TabsHighlight className="bg-background shadow-sm rounded-md">
              <TabsHighlightItem value="overview">
                <TabsTrigger value="overview" className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                  <IconLayoutDashboard className="h-4 w-4" />
                  Overview
                </TabsTrigger>
              </TabsHighlightItem>
              
              <TabsHighlightItem value="audience">
                <TabsTrigger value="audience" className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                  <IconUsers className="h-4 w-4" />
                  Audience & Positioning
                </TabsTrigger>
              </TabsHighlightItem>
              
              <TabsHighlightItem value="voice">
                <TabsTrigger value="voice" className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                  <IconMessageCircle className="h-4 w-4" />
                  Voice & Tone
                </TabsTrigger>
              </TabsHighlightItem>
              
              <TabsHighlightItem value="rules">
                <TabsTrigger value="rules" className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                  <IconShieldCheck className="h-4 w-4" />
                  Content Rules
                </TabsTrigger>
              </TabsHighlightItem>
              
              <TabsHighlightItem value="assets">
                <TabsTrigger value="assets" className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                  <IconPalette className="h-4 w-4" />
                  Assets & AI Config
                </TabsTrigger>
              </TabsHighlightItem>
            </TabsHighlight>
          </TabsList>
          
          <Button size="sm">
            <IconPencil className="h-4 w-4" />
            Edit Profile
          </Button>
        </div>

        <TabsContents className="mt-2">
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Optimization Score - Outer Container */}
            <div className="relative rounded-3xl bg-gradient-to-br from-white/80 via-purple-50/30 to-white/80 dark:from-background dark:via-purple-950/10 dark:to-background p-2 pb-4 shadow-sm">
              {/* Purple glow effect at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-purple-500/10 to-transparent rounded-b-2xl pointer-events-none" />
              
              {/* Inner Card */}
              <Card className="relative bg-background/60 backdrop-blur-sm border-0 shadow-md">
                <CardContent className="px-6 py-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Brand Optimization Score</h3>
                      </div>
                      <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                        <CountingNumber 
                          number={73} 
                          delay={0.3}
                          transition={{ stiffness: 100, damping: 30 }}
                        />
                        %
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="relative h-3 w-full">
                        {/* Progress bar container with overflow hidden */}
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                          {/* Animated gradient bar */}
                          <div 
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 transition-all duration-1000 ease-out"
                            style={{ width: `${progressValue}%` }}
                          />
                          
                          {/* Dotted remaining portion - responsive */}
                          <div 
                            className="absolute inset-y-0 left-0 right-0 rounded-full flex items-center justify-start gap-1 px-2 overflow-hidden transition-all duration-1000"
                            style={{ paddingLeft: `calc(${progressValue}% + 8px)` }}
                          >
                            {Array.from({ length: 100 }).map((_, i) => (
                              <div key={i} className="w-0.5 h-2 bg-muted-foreground/20 rounded-full flex-shrink-0" />
                            ))}
                          </div>
                        </div>

                        {/* Circular indicator at the end - outside overflow container */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center z-10 transition-all duration-1000 ease-out border border-muted-foreground/10"
                          style={{ 
                            left: `${progressValue}%`,
                            opacity: progressValue > 0 ? 1 : 0,
                            scale: progressValue > 0 ? 1 : 0.5
                          }}
                        >
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Footer - Outside the inner card */}
              <div className="relative flex items-center justify-between text-sm mt-4 px-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Last update:</span>
                  <span className="text-orange-500 font-medium">Nov, 12</span>
                  <span className="text-purple-500">at 5:56pm</span>
                </div>
                <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900">
                  At Risk
                </Badge>
              </div>
            </div>

            {/* Brand Identity Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Brand Identity</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <IconPencil className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Tagline</p>
                    <p className="text-sm">
                      {brand.description || "Empowering digital experiences"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Mission</p>
                    <p className="text-sm">
                      Create meaningful digital experiences that connect brands with audiences.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Vision</p>
                    <p className="text-sm">
                      Leading digital experience studio known for transformative narratives.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact & Quick Facts Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">Contact Channels</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPlus className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm group hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <IconPhone className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span>+90 212 555 0123</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">Yönetim</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm group hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <IconMail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span>hello@{brand.slug}.com</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">Genel</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm group hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <IconExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <a href="#" className="text-primary hover:underline">
                          www.{brand.slug}.com
                        </a>
                      </div>
                      <Badge variant="secondary" className="text-xs">Kurumsal</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">Quick Facts</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Primary Language</span>
                      <span className="font-medium">{brand.primaryLocale || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Timezone</span>
                      <span className="font-medium">{brand.timezone || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Industry</span>
                      <span className="font-medium capitalize">{brand.industry || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium">
                        {brand.city && brand.country 
                          ? `${brand.city}, ${brand.country}` 
                          : 'Not set'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audience & Positioning Tab */}
          <TabsContent value="audience" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Primary Personas</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <IconPlus className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">Tech-Savvy Professional</h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <IconPencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Age 28-45 • Urban professional seeking efficiency
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Pain Points</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">Time constraints</Badge>
                        <Badge variant="outline" className="text-xs">Info overload</Badge>
                        <Badge variant="outline" className="text-xs">Reliability</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">Creative Entrepreneur</h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <IconPencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Age 25-40 • Building brand, values authenticity
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Pain Points</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">Limited budget</Badge>
                        <Badge variant="outline" className="text-xs">Quick results</Badge>
                        <Badge variant="outline" className="text-xs">Customization</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">Positioning</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Category</span>
                    <Badge variant="secondary">Digital Experience Studio</Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Unique Selling Points</p>
                    <ul className="text-sm space-y-1.5">
                      <li className="flex items-start gap-2">
                        <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>Cutting-edge technology</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>Human-centered design</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>End-to-end solutions</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">Competitors</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPlus className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between p-2 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">Acme Digital</p>
                        <p className="text-xs text-muted-foreground">Enterprise focus, less creative</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <IconPencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-start justify-between p-2 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">Creative Studio X</p>
                        <p className="text-xs text-muted-foreground">Strong design, weaker tech</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <IconPencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-start justify-between p-2 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">Tech Solutions Co</p>
                        <p className="text-xs text-muted-foreground">Tech focus, lacks strategy</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <IconPencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Voice & Tone Tab */}
          <TabsContent value="voice" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Tone Characteristics</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <IconPencil className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Formal - Informal */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Formal</span>
                      <span className="font-medium">75%</span>
                      <span className="text-muted-foreground">Informal</span>
                    </div>
                    <Slider defaultValue={[75]} max={100} step={1} disabled />
                    <p className="text-xs text-muted-foreground">Approachable but professional</p>
                  </div>

                  {/* Serious - Playful */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Serious</span>
                      <span className="font-medium">60%</span>
                      <span className="text-muted-foreground">Playful</span>
                    </div>
                    <Slider defaultValue={[60]} max={100} step={1} disabled />
                    <p className="text-xs text-muted-foreground">Balanced with humor</p>
                  </div>

                  {/* Simple - Complex */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Simple</span>
                      <span className="font-medium">70%</span>
                      <span className="text-muted-foreground">Complex</span>
                    </div>
                    <Slider defaultValue={[70]} max={100} step={1} disabled />
                    <p className="text-xs text-muted-foreground">Clear with depth</p>
                  </div>

                  {/* Warm - Neutral */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Warm</span>
                      <span className="font-medium">80%</span>
                      <span className="text-muted-foreground">Neutral</span>
                    </div>
                    <Slider defaultValue={[80]} max={100} step={1} disabled />
                    <p className="text-xs text-muted-foreground">Friendly and empathetic</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <IconCheck className="h-4 w-4 text-green-600" />
                    Do Say
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPlus className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {[
                      "Let's create something amazing together",
                      "We understand your challenges",
                      "Innovation meets practicality",
                      "Your vision, our expertise"
                    ].map((phrase, i) => (
                      <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm group hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
                        <span>&quot;{phrase}&quot;</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <IconX className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <IconX className="h-4 w-4 text-red-600" />
                    Don&apos;t Say
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPlus className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {[
                      "Industry-disrupting revolutionary",
                      "Best in the world",
                      "Cheap and affordable",
                      "Trust us blindly"
                    ].map((phrase, i) => (
                      <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm group hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                        <span>&quot;{phrase}&quot;</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <IconX className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Content Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Allowed Topics</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <IconPlus className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Product Updates", "Industry Insights", "Client Success Stories",
                    "Technology Trends", "Team Culture", "Design Tips",
                    "Innovation", "Sustainability"
                  ].map((topic, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {topic}
                      <button className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                        <IconX className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Forbidden Topics & Safety</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <IconPlus className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Topics to Avoid</p>
                  {[
                    "Political opinions or endorsements",
                    "Religious discussions",
                    "Negative competitor comparisons",
                    "Unverified claims or statistics"
                  ].map((topic, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm group hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                      <span className="flex items-center gap-2">
                        <IconX className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        {topic}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconX className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Crisis Guidelines</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>• Pause promotional content during disasters</li>
                    <li>• No humor during sensitive situations</li>
                    <li>• Coordinate crisis responses with leadership</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  ⚖️ Legal Constraints
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <IconPlus className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { title: "Disclosure Requirements", desc: "All paid partnerships must include #ad or #sponsored" },
                    { title: "Copyright Compliance", desc: "Only use licensed content. Credit creators when required." },
                    { title: "Data Privacy", desc: "Follow GDPR/KVKK. Never share client data without consent." }
                  ].map((item, i) => (
                    <div key={i} className="flex items-start justify-between p-3 rounded-lg bg-background border border-amber-200 dark:border-amber-900/50 group hover:shadow-sm transition-shadow">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-0.5">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconPencil className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assets & AI Config Tab */}
          <TabsContent value="assets" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Brand Colors</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <IconPencil className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Primary Colors</p>
                    <div className="flex gap-2">
                      {[
                        { color: '#2563eb', name: 'Primary Blue' },
                        { color: '#1e293b', name: 'Dark Slate' },
                        { color: '#f8fafc', name: 'Light' }
                      ].map((item, i) => (
                        <button key={i} className="group relative">
                          <div 
                            className="h-12 w-12 rounded-lg border-2 border-muted transition-all group-hover:scale-110 group-hover:border-foreground/20"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="block text-xs text-muted-foreground mt-1">{item.color}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Accent Colors</p>
                    <div className="flex gap-2">
                      {[
                        { color: '#10b981', name: 'Success' },
                        { color: '#f59e0b', name: 'Warning' }
                      ].map((item, i) => (
                        <button key={i} className="group relative">
                          <div 
                            className="h-12 w-12 rounded-lg border-2 border-muted transition-all group-hover:scale-110 group-hover:border-foreground/20"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="block text-xs text-muted-foreground mt-1">{item.color}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">Visual Guidelines</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-2">
                    {[
                      "Authentic photos over stock",
                      "Minimalist compositions",
                      "Include human elements",
                      "Consistent lighting"
                    ].map((rule, i) => (
                      <li key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <IconCheck className="h-4 w-4 text-green-600 shrink-0" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base font-semibold">AI Configuration</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Default Language</span>
                      <span className="font-medium">{brand.primaryLocale || 'en-US'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Content Length</span>
                      <span className="font-medium">50-280 chars</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">CTA Style</span>
                      <span className="font-medium">Soft, invitational</span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Preferred Platforms</p>
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">Instagram</Badge>
                        <Badge variant="outline" className="text-xs">LinkedIn</Badge>
                        <Badge variant="outline" className="text-xs">Twitter</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </TabsContents>
      </Tabs>

      {/* Avatar Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Brand Logo</DialogTitle>
            <DialogDescription>
              Adjust the image to fit perfectly as your brand logo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Cropper */}
            <div className="relative h-96 w-full bg-muted rounded-lg overflow-hidden">
              {selectedImage && (
                <Cropper
                  image={selectedImage}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Zoom</label>
                  <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
                </div>
                <Slider
                  value={[zoom]}
                  onValueChange={([value]) => setZoom(value)}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Rotation</label>
                  <span className="text-sm text-muted-foreground">{rotation}°</span>
                </div>
                <Slider
                  value={[rotation]}
                  onValueChange={([value]) => setRotation(value)}
                  min={0}
                  max={360}
                  step={1}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCropDialog(false)
                  setSelectedImage(null)
                  setCrop({ x: 0, y: 0 })
                  setZoom(1)
                  setRotation(0)
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button onClick={handleCropSave} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Save Logo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

