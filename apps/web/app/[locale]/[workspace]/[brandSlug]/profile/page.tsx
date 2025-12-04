"use client"

import { useParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useWorkspace } from "@/contexts/workspace-context"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { IconPencil, IconExternalLink, IconPhone, IconMail, IconSparkles, IconPlus, IconCheck, IconX, IconUpload, IconLayoutDashboard, IconUsers, IconMessageCircle, IconShieldCheck, IconPalette } from "@tabler/icons-react"
import { Slider } from "@/components/ui/slider"
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentWorkspace?.id && brandSlug) {
      loadBrand()
    }
  }, [currentWorkspace?.id, brandSlug])

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
          <TabsList className="gap-1">
            <TabsTrigger value="overview" className="data-[state=inactive]:text-muted-foreground gap-2">
              <IconLayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="audience" className="data-[state=inactive]:text-muted-foreground gap-2">
              <IconUsers className="h-4 w-4" />
              Audience & Positioning
            </TabsTrigger>
            <TabsTrigger value="voice" className="data-[state=inactive]:text-muted-foreground gap-2">
              <IconMessageCircle className="h-4 w-4" />
              Voice & Tone
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=inactive]:text-muted-foreground gap-2">
              <IconShieldCheck className="h-4 w-4" />
              Content Rules
            </TabsTrigger>
            <TabsTrigger value="assets" className="data-[state=inactive]:text-muted-foreground gap-2">
              <IconPalette className="h-4 w-4" />
              Assets & AI Config
            </TabsTrigger>
          </TabsList>
          <Button size="sm">
            <IconPencil className="h-4 w-4" />
            Edit Profile
          </Button>
        </div>

        <div className="mt-2 space-y-4">
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 m-0">
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
                        73%
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="relative h-3 rounded-full overflow-visible">
                        {/* Gradient filled portion */}
                        <div 
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500"
                          style={{ width: '73%' }}
                        />
                        
                        {/* Circular indicator at the end */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-lg flex items-center justify-center z-10"
                          style={{ left: '73%' }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        </div>
                        
                        {/* Dotted remaining portion - responsive */}
                        <div 
                          className="absolute inset-y-0 rounded-full flex items-center justify-start gap-1 px-2 overflow-hidden"
                          style={{ left: '73%', right: 0 }}
                        >
                          {Array.from({ length: 50 }).map((_, i) => (
                            <div key={i} className="w-0.5 h-2 bg-muted-foreground/20 rounded-full flex-shrink-0" />
                          ))}
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

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Brand Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Tagline</p>
                    <p className="text-sm text-muted-foreground">
                      {brand.description || "Empowering digital experiences through innovation"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Mission</p>
                    <p className="text-sm text-muted-foreground">
                      To create meaningful digital experiences that connect brands with their audiences through innovative technology and creative storytelling.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Vision</p>
                    <p className="text-sm text-muted-foreground">
                      Becoming the leading digital experience studio in the region, known for transformative brand narratives and cutting-edge technology solutions.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {brand.name} is a {brand.industry || 'technology'} brand focused on innovation and user experience. The brand emphasizes authenticity, creativity, and technical excellence in all communications.
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    Generated by AI • Updated 2 days ago
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Contact & Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <IconPhone className="h-4 w-4 text-muted-foreground" />
                    <span>+90 212 555 0123</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <IconMail className="h-4 w-4 text-muted-foreground" />
                    <span>hello@{brand.slug}.com</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm sm:col-span-2">
                    <IconExternalLink className="h-4 w-4 text-muted-foreground" />
                    <a href="#" className="text-primary hover:underline">
                      www.{brand.slug}.com
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Facts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Primary Language</p>
                    <p className="text-sm font-medium">{brand.primaryLocale || 'Not set'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Timezone</p>
                    <p className="text-sm font-medium">{brand.timezone || 'Not set'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Industry</p>
                    <p className="text-sm font-medium capitalize">{brand.industry || 'Not set'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">
                      {brand.city && brand.country 
                        ? `${brand.city}, ${brand.country}` 
                        : 'Not set'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audience & Positioning Tab */}
          <TabsContent value="audience" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Primary Personas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4 space-y-2">
                    <h4 className="font-medium">Tech-Savvy Professional</h4>
                    <p className="text-sm text-muted-foreground">
                      Age 28-45, urban professional seeking efficiency and innovation
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Pain Points:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Time constraints</li>
                        <li>Information overload</li>
                        <li>Need for reliable solutions</li>
                      </ul>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 space-y-2">
                    <h4 className="font-medium">Creative Entrepreneur</h4>
                    <p className="text-sm text-muted-foreground">
                      Age 25-40, building their brand, values authenticity
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Pain Points:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Limited budget</li>
                        <li>Need for quick results</li>
                        <li>Desire for customization</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Positioning</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-1">Category</p>
                    <p className="text-sm text-muted-foreground">Digital Experience Studio</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-2">Unique Selling Points</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-start gap-2">
                        <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>Cutting-edge technology integration</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>Human-centered design approach</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>End-to-end brand solutions</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Competitors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium">Acme Digital</p>
                      <p className="text-xs text-muted-foreground">Focus on enterprise, less creative</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium">Creative Studio X</p>
                      <p className="text-xs text-muted-foreground">Strong design, weaker tech stack</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium">Tech Solutions Co</p>
                      <p className="text-xs text-muted-foreground">Tech-focused, lacks brand strategy</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Voice & Tone Tab */}
          <TabsContent value="voice" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Tone Characteristics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Formal - Informal */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Formal</span>
                    <span className="font-medium">75%</span>
                    <span className="text-muted-foreground">Informal</span>
                  </div>
                  <Slider defaultValue={[75]} max={100} step={1} disabled />
                  <p className="text-xs text-muted-foreground">Slightly informal, approachable but professional</p>
                </div>

                {/* Serious - Playful */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Serious</span>
                    <span className="font-medium">60%</span>
                    <span className="text-muted-foreground">Playful</span>
                  </div>
                  <Slider defaultValue={[60]} max={100} step={1} disabled />
                  <p className="text-xs text-muted-foreground">Balanced with occasional humor</p>
                </div>

                {/* Simple - Complex */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Simple</span>
                    <span className="font-medium">70%</span>
                    <span className="text-muted-foreground">Complex</span>
                  </div>
                  <Slider defaultValue={[70]} max={100} step={1} disabled />
                  <p className="text-xs text-muted-foreground">Clear communication with depth when needed</p>
                </div>

                {/* Warm - Neutral */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Warm</span>
                    <span className="font-medium">80%</span>
                    <span className="text-muted-foreground">Neutral</span>
                  </div>
                  <Slider defaultValue={[80]} max={100} step={1} disabled />
                  <p className="text-xs text-muted-foreground">Friendly and empathetic tone</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Do Say ✅</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>&quot;Let&apos;s create something amazing together&quot;</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>&quot;We understand your challenges&quot;</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>&quot;Innovation meets practicality&quot;</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>&quot;Your vision, our expertise&quot;</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Don&apos;t Say ❌</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <span>&quot;Industry-disrupting revolutionary&quot;</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <span>&quot;Best in the world&quot;</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <span>&quot;Cheap and affordable&quot;</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <span>&quot;Trust us blindly&quot;</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Content Rules Tab */}
          <TabsContent value="rules" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Allowed Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Product Updates</Badge>
                  <Badge variant="secondary">Industry Insights</Badge>
                  <Badge variant="secondary">Client Success Stories</Badge>
                  <Badge variant="secondary">Technology Trends</Badge>
                  <Badge variant="secondary">Team Culture</Badge>
                  <Badge variant="secondary">Design Tips</Badge>
                  <Badge variant="secondary">Innovation</Badge>
                  <Badge variant="secondary">Sustainability</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Forbidden Topics & Brand Safety</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Topics to Avoid</p>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li className="flex items-start gap-2">
                        <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <span>Political opinions or endorsements</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <span>Religious discussions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <span>Negative competitor comparisons</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconX className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <span>Unverified claims or statistics</span>
                      </li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">Crisis Guidelines</p>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li>• Pause promotional content during major disasters</li>
                      <li>• No humor during sensitive situations</li>
                      <li>• Coordinate all crisis responses with leadership</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ⚖️ Legal Constraints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-900/50">
                    <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                      Disclosure Requirements
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      All paid partnerships must include #ad or #sponsored hashtag
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-900/50">
                    <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                      Copyright Compliance
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Only use licensed images, music, and content. Credit creators when required.
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-900/50">
                    <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                      Data Privacy
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Follow GDPR/KVKK guidelines. Never share client data without consent.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assets & AI Config Tab */}
          <TabsContent value="assets" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Brand Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-2">Primary Colors</p>
                    <div className="flex gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-12 w-12 rounded-lg bg-[#2563eb] border" />
                        <span className="text-xs text-muted-foreground">#2563eb</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-12 w-12 rounded-lg bg-[#1e293b] border" />
                        <span className="text-xs text-muted-foreground">#1e293b</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-12 w-12 rounded-lg bg-[#f8fafc] border" />
                        <span className="text-xs text-muted-foreground">#f8fafc</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-2">Accent Colors</p>
                    <div className="flex gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-12 w-12 rounded-lg bg-[#10b981] border" />
                        <span className="text-xs text-muted-foreground">#10b981</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-12 w-12 rounded-lg bg-[#f59e0b] border" />
                        <span className="text-xs text-muted-foreground">#f59e0b</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visual Style Guidelines</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Prefer authentic photos over stock images</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Use minimalist, clean compositions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Include human elements when possible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Maintain consistent lighting and tone</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Content Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Default Language</p>
                    <p className="text-sm">{brand.primaryLocale || 'en-US'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Content Length</p>
                    <p className="text-sm">50-280 characters</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Preferred Platforms</p>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">Instagram</Badge>
                      <Badge variant="outline" className="text-xs">LinkedIn</Badge>
                      <Badge variant="outline" className="text-xs">Twitter</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">CTA Style</p>
                    <p className="text-sm text-muted-foreground">Soft, invitational</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Test Playground</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Generate sample content using your brand profile settings.
                </p>
                <Button variant="outline" size="sm" disabled>
                  <IconSparkles className="h-4 w-4" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
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

