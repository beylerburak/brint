"use client"

import React, { useState, useEffect, Fragment } from "react"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ButtonGroup } from "@/components/ui/button-group"
import { IconX, IconDots, IconPhoto, IconVideo, IconFileUpload, IconCalendar, IconHash, IconMoodSmile, IconSparkles, IconChevronDown, IconGripVertical, IconSend, IconStar, IconCheck, IconClock, IconPin, IconLock } from "@tabler/icons-react"
import { toast } from "sonner"
import { PLATFORM_RULES, type ContentFormFactor, type SocialPlatform, getCaptionLimitFor } from "@brint/shared-config/platform-rules"
import { SocialPlatformIcon, getPlatformColor } from "@/components/social-platform-icon"
import * as TagsInput from "@diceui/tags-input"
import { useDropzone } from "react-dropzone"
import { 
  ALLOWED_IMAGE_TYPES, 
  ALLOWED_VIDEO_TYPES, 
  MAX_FILE_SIZE_BYTES,
  isFileSizeValid,
  isAllowedFileType,
  getFileTypeCategory
} from "@brint/shared-config/upload"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export interface ContentCreationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandSlug?: string
  brandName?: string
  brandLogoUrl?: string
}

export function ContentCreationModal({
  open,
  onOpenChange,
  brandSlug,
  brandName,
  brandLogoUrl,
}: ContentCreationModalProps) {
  const t = useTranslations("contentCreation")
  const { currentWorkspace } = useWorkspace()
  
  // Form state
  const [formFactor, setFormFactor] = useState<ContentFormFactor | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [caption, setCaption] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [scheduledAt, setScheduledAt] = useState<string>("")
  const [isDraft, setIsDraft] = useState(true)
  const [createAnother, setCreateAnother] = useState(false)
  
  // Publish mode: 'now' | 'setDateTime'
  const [publishMode, setPublishMode] = useState<'now' | 'setDateTime'>('now')
  const [showPublishOptions, setShowPublishOptions] = useState(false)
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>("")
  
  // Media state - stored as blobs until submit
  const [selectedMedia, setSelectedMedia] = useState<Array<{
    id: string
    file: File
    preview: string // blob URL
    type: 'image' | 'video' | 'document'
  }>>([])
  
  // Tag autocomplete state
  const [tagSearchQuery, setTagSearchQuery] = useState("")
  const [tagSuggestions, setTagSuggestions] = useState<Array<{
    id: string
    name: string
    slug: string
    color: string | null
  }>>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  
  // Data
  const [socialAccounts, setSocialAccounts] = useState<Array<{
    id: string
    platform: SocialPlatform
    displayName: string | null
    username: string | null
    avatarUrl: string | null
    externalAvatarUrl: string | null
  }>>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  
  // Load social accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!currentWorkspace || !brandSlug || !open) return
      
      setIsLoadingAccounts(true)
      try {
        // Get brand ID first
        const brandsResponse = await apiClient.listBrands(currentWorkspace.id)
        const brand = brandsResponse.brands.find((b) => b.slug === brandSlug)
        if (!brand) return
        
        // Load social accounts (only ACTIVE ones)
        const accountsResponse = await apiClient.listSocialAccounts(currentWorkspace.id, brand.id, {
          status: 'ACTIVE'
        })
        setSocialAccounts(accountsResponse.socialAccounts
          .filter((acc: any) => acc.canPublish && acc.status === 'ACTIVE')
          .map((acc: any) => ({
            id: acc.id,
            platform: acc.platform as SocialPlatform,
            displayName: acc.displayName,
            username: acc.username,
            avatarUrl: acc.avatarUrl,
            externalAvatarUrl: acc.externalAvatarUrl,
          })))
      } catch (error) {
        console.error('Failed to load social accounts:', error)
      } finally {
        setIsLoadingAccounts(false)
      }
    }
    
    loadAccounts()
  }, [currentWorkspace, brandSlug, open])
  
  // Load tag suggestions
  useEffect(() => {
    const loadTagSuggestions = async () => {
      if (!currentWorkspace || !tagSearchQuery.trim() || tagSearchQuery.trim().length < 2) {
        setTagSuggestions([])
        setShowTagSuggestions(false)
        return
      }
      
      setIsLoadingTags(true)
      try {
        const response = await apiClient.searchTags(currentWorkspace.id, {
          query: tagSearchQuery.trim(),
          limit: 10,
        })
        setTagSuggestions(response.items)
        setShowTagSuggestions(true)
      } catch (error) {
        console.error('Failed to load tag suggestions:', error)
        setTagSuggestions([])
      } finally {
        setIsLoadingTags(false)
      }
    }
    
    const debounceTimer = setTimeout(loadTagSuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [currentWorkspace, tagSearchQuery])
  
  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormFactor(null)
      setSelectedAccountIds([])
      setTitle("")
      setCaption("")
      setTags([])
      setScheduledAt("")
      setIsDraft(true)
      setCreateAnother(false)
      setPublishMode('now')
      setShowPublishOptions(false)
      setShowDateTimePicker(false)
      setSelectedDate(undefined)
      setSelectedTime("")
      setTagSearchQuery("")
      setTagSuggestions([])
      setShowTagSuggestions(false)
      // Clean up media blob URLs
      selectedMedia.forEach(media => {
        URL.revokeObjectURL(media.preview)
      })
      setSelectedMedia([])
    }
  }, [open])
  
  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      selectedMedia.forEach(media => {
        URL.revokeObjectURL(media.preview)
      })
    }
  }, [])
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  // Handle drag end for media reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setSelectedMedia((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }
  
  // File dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ALLOWED_IMAGE_TYPES,
      'video/*': ALLOWED_VIDEO_TYPES,
    },
    maxSize: MAX_FILE_SIZE_BYTES,
    maxFiles: 10,
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        console.warn('Some files were rejected:', rejectedFiles)
        // TODO: Show error toast
      }
      
      // Process accepted files
      const newMedia = acceptedFiles
        .slice(0, 10 - selectedMedia.length) // Only take what we can fit
        .map(file => {
          const id = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const preview = URL.createObjectURL(file)
          const category = getFileTypeCategory(file.type)
          const type: 'image' | 'video' | 'document' = category === 'unknown' ? 'image' : category
          
          return {
            id,
            file,
            preview,
            type,
          }
        })
      
      setSelectedMedia(prev => [...prev, ...newMedia])
    },
    disabled: selectedMedia.length >= 10,
  })
  
  // Remove media
  const handleRemoveMedia = (mediaId: string) => {
    setSelectedMedia(prev => {
      const media = prev.find(m => m.id === mediaId)
      if (media) {
        URL.revokeObjectURL(media.preview)
      }
      return prev.filter(m => m.id !== mediaId)
    })
  }
  
  // Handle tag input change
  const handleTagInputChange = (value: string) => {
    setTagSearchQuery(value)
  }
  
  // Handle tag selection from suggestions
  const handleTagSelect = (tagName: string) => {
    if (!tags.includes(tagName)) {
      setTags([...tags, tagName])
    }
    setTagSearchQuery("")
    setShowTagSuggestions(false)
  }
  
  // Handle creating new tag
  const handleCreateNewTag = () => {
    if (tagSearchQuery.trim() && !tags.includes(tagSearchQuery.trim())) {
      setTags([...tags, tagSearchQuery.trim()])
      setTagSearchQuery("")
      setShowTagSuggestions(false)
    }
  }
  
  // Check account compatibility
  const isAccountIncompatible = (accountId: string): boolean => {
    if (!formFactor) return false
    const account = socialAccounts.find((a) => a.id === accountId)
    if (!account) return false
    
    const rule = PLATFORM_RULES[account.platform]
    return !rule.supports[formFactor]
  }
  
  const handleAccountToggle = (accountId: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }
  
  const handleFormFactorChange = (factor: ContentFormFactor) => {
    setFormFactor(factor)
    // Remove incompatible accounts
    setSelectedAccountIds(prev => 
      prev.filter(accountId => {
        const account = socialAccounts.find(a => a.id === accountId)
        if (!account) return false
        const rule = PLATFORM_RULES[account.platform]
        return rule.supports[factor]
      })
    )
  }
  
  // Select all compatible accounts
  const handleSelectAll = () => {
    if (!formFactor) {
      // If no form factor selected, select all accounts
      setSelectedAccountIds(socialAccounts.map(acc => acc.id))
      return
    }
    
    // Select only compatible accounts
    const compatibleAccountIds = socialAccounts
      .filter(account => {
        const rule = PLATFORM_RULES[account.platform]
        return rule.supports[formFactor]
      })
      .map(account => account.id)
    
    setSelectedAccountIds(compatibleAccountIds)
  }

  // Calculate caption limits for validation
  const selectedPlatforms = Array.from(
    new Set(
      selectedAccountIds
        .map(id => socialAccounts.find(acc => acc.id === id))
        .filter((acc): acc is NonNullable<typeof acc> => acc !== undefined)
        .map(acc => acc.platform)
    )
  )

  // Calculate global caption limit (minimum of all selected platforms)
  const globalCaptionLimit = formFactor && selectedPlatforms.length > 0
    ? Math.min(
        ...selectedPlatforms.map(platform =>
          getCaptionLimitFor(platform, formFactor)
        )
      )
    : null

  // Check if base caption exceeds limit
  const isBaseCaptionExceeded = globalCaptionLimit !== null && caption.length > globalCaptionLimit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full h-full max-w-full max-h-full sm:w-[95vw] sm:h-[95vh] lg:w-[90vw] lg:h-[90vh] md:max-w-none md:max-h-none flex flex-col p-0 overflow-hidden rounded-none sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] gap-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Content Creation</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 flex-shrink-0 border-b">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold truncate">{t("title")}</h2>
            {brandSlug && (
              <>
                <div className="h-4 sm:h-5 w-px bg-border flex-shrink-0"></div>
                <div className="flex items-center gap-1 sm:gap-1.5 pl-1 pr-1.5 sm:pl-1.5 sm:pr-2 py-0.5 sm:py-1 rounded-md text-xs sm:text-sm font-medium border border-border hover:bg-accent transition-colors cursor-default flex-shrink-0">
                  <div className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {brandLogoUrl ? (
                      <img
                        src={brandLogoUrl}
                        alt={brandName || brandSlug}
                        className="h-full w-full rounded-full object-cover"
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent && !parent.querySelector('span')) {
                            const fallback = document.createElement('span')
                            fallback.className = 'text-[9px] sm:text-[10px] font-semibold'
                            fallback.textContent = (brandName?.substring(0, 2) || brandSlug.substring(0, 2)).toUpperCase()
                            parent.appendChild(fallback)
                          }
                        }}
                      />
                    ) : (
                      <span className="text-[9px] sm:text-[10px] font-semibold">
                        {brandName?.substring(0, 2).toUpperCase() || brandSlug.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span>@{brandSlug}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // TODO: Add menu functionality
              }}
              className="h-8 w-8"
            >
              <IconDots className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content Area - Two Columns */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Side - Content Creation Settings */}
          <div className="w-full lg:w-[60%] xl:w-[65%] border-b lg:border-b-0 lg:border-r border-border overflow-y-auto flex-1 min-h-0">
            <div className="p-4 sm:p-6 space-y-6">
              {/* Form Factor Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("contentType")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "FEED_POST" as ContentFormFactor, labelKey: "feedPost", icon: IconPhoto },
                    { value: "STORY" as ContentFormFactor, labelKey: "story", icon: IconPhoto },
                    { value: "VERTICAL_VIDEO" as ContentFormFactor, labelKey: "verticalVideo", icon: IconVideo },
                  ].map(({ value, labelKey, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleFormFactorChange(value)}
                      className={`
                        flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                        ${formFactor === value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                        }
                      `}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{t(labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{t("selectAccounts")}</Label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("selectAll")}
                  </button>
                </div>
                {isLoadingAccounts ? (
                  <p className="text-sm text-muted-foreground">{t("loadingAccounts")}</p>
                ) : socialAccounts.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">{t("noAccountsAvailable")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("connectAccountsMessage")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {socialAccounts.map((account) => {
                      const isIncompatible = isAccountIncompatible(account.id)
                      const isSelected = selectedAccountIds.includes(account.id)
                      const hasSelection = selectedAccountIds.length > 0
                      const shouldDim = hasSelection && !isSelected && !isIncompatible
                      
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => !isIncompatible && handleAccountToggle(account.id)}
                          disabled={isIncompatible}
                          className={`
                            relative flex items-center justify-center transition-all
                            ${isIncompatible
                              ? "opacity-40 cursor-not-allowed"
                              : shouldDim
                              ? "opacity-80 hover:scale-105 cursor-pointer"
                              : isSelected
                              ? "ring-2 ring-primary ring-offset-2 rounded-full"
                              : "hover:scale-105 cursor-pointer"
                            }
                          `}
                          style={{ width: 48, height: 48 }}
                        >
                          {/* Account Avatar with Platform Border + Icon */}
                          <div className="relative w-full h-full">
                            {/* Outer border with platform color */}
                            <div
                              className={`rounded-full p-0.5 flex items-center justify-center ${
                                isIncompatible
                                  ? 'border border-border/50 dark:border-border/40'
                                  : account.platform === 'X' || account.platform === 'TIKTOK'
                                  ? 'border-2 border-gray-400 dark:border-gray-500'
                                  : ''
                              }`}
                              style={{
                                backgroundColor: isIncompatible
                                  ? 'transparent'
                                  : account.platform === 'X' || account.platform === 'TIKTOK'
                                  ? 'transparent'
                                  : getPlatformColor(account.platform),
                                width: '100%',
                                height: '100%',
                              }}
                            >
                              {/* Inner white/background circle with padding */}
                              <div className="h-full w-full rounded-full bg-background p-0.5 flex items-center justify-center">
                                {/* Avatar */}
                                <div className="h-full w-full rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/50 dark:border-border/40">
                                  {account.avatarUrl || account.externalAvatarUrl ? (
                                    <img
                                      src={account.avatarUrl || account.externalAvatarUrl || ''}
                                      alt={account.displayName || account.username || account.platform}
                                      className="h-full w-full rounded-full object-cover"
                                      onError={(e) => {
                                        // Fallback to brand logo if account avatar fails
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                        const parent = target.parentElement
                                        if (parent && !parent.querySelector('img[data-brand-logo]') && brandLogoUrl) {
                                          const fallback = document.createElement('img')
                                          fallback.src = brandLogoUrl
                                          fallback.alt = brandName || brandSlug || ''
                                          fallback.className = 'h-full w-full rounded-full object-cover'
                                          fallback.setAttribute('data-brand-logo', 'true')
                                          parent.appendChild(fallback)
                                        } else if (parent && !parent.querySelector('span[data-initials]')) {
                                          const fallback = document.createElement('span')
                                          fallback.className = 'text-[10px] font-semibold'
                                          fallback.setAttribute('data-initials', 'true')
                                          fallback.textContent = (account.displayName || account.username || account.platform).substring(0, 2).toUpperCase()
                                          parent.appendChild(fallback)
                                        }
                                      }}
                                    />
                                  ) : brandLogoUrl ? (
                                    <img
                                      src={brandLogoUrl}
                                      alt={brandName || brandSlug || ''}
                                      className="h-full w-full rounded-full object-cover"
                                      data-brand-logo="true"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-semibold" data-initials="true">
                                      {(account.displayName || account.username || account.platform).substring(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Platform Icon - positioned at bottom right, overlapping border */}
                            <div 
                              className="absolute rounded-full bg-background p-0.5 border border-border dark:border-border/60 shadow-sm"
                              style={{
                                bottom: -2,
                                right: -2,
                              }}
                            >
                              <SocialPlatformIcon
                                platform={account.platform}
                                size={16}
                                className="flex-shrink-0"
                              />
                            </div>
                            
                            {/* Selected indicator */}
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                                <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Caption with Media Upload */}
              <div className="space-y-0 border border-border rounded-lg overflow-hidden">
                {/* Caption Textarea - Hidden for STORY */}
                {formFactor !== 'STORY' && (
                  <div className="relative">
                    <Textarea
                      id="caption"
                      placeholder={t("captionPlaceholder")}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={8}
                      className={`resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none min-h-[200px] ${
                        isBaseCaptionExceeded ? 'text-destructive' : ''
                      }`}
                      aria-invalid={isBaseCaptionExceeded}
                    />
                    {isBaseCaptionExceeded && globalCaptionLimit !== null && (
                      <div className="absolute bottom-2 left-3 text-xs text-destructive">
                        {t("captionTooLong", { limit: globalCaptionLimit })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Media Upload Area */}
                <div className={formFactor !== 'STORY' ? 'border-t border-border' : ''}>
                  {/* Selected Media Thumbnails */}
                  {selectedMedia.length > 0 && (
                    <div className="p-3 border-b border-border">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={selectedMedia.map(m => m.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="grid grid-cols-5 gap-2">
                            {selectedMedia.map((media) => (
                              <SortableMediaItem
                                key={media.id}
                                media={media}
                                onRemove={handleRemoveMedia}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                  
                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg m-3 p-4 text-center transition-colors ${
                      isDragActive
                        ? 'border-primary bg-primary/5'
                        : selectedMedia.length >= 10
                        ? 'border-border/50 cursor-not-allowed opacity-50'
                        : 'border-border hover:border-primary/50 cursor-pointer'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <IconFileUpload className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-0.5">
                      {isDragActive ? (
                        <span>{t("dropFilesHere")}</span>
                      ) : selectedMedia.length >= 10 ? (
                        <span>{t("maxFilesReached")}</span>
                      ) : (
                        <>
                          {t("dragDropOrSelect").split("select files")[0]}
                          <span className="text-primary underline">{t("selectFiles")}</span>
                        </>
                      )}
                    </p>
                    {selectedMedia.length > 0 && selectedMedia.length < 10 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("filesSelected", { count: selectedMedia.length })}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Bottom Toolbar - Hidden for STORY */}
                {formFactor !== 'STORY' && (
                  <div className="border-t border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      // TODO: Open add content menu
                    }}
                  >
                    <IconChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      // TODO: Open emoji picker
                    }}
                  >
                    <IconMoodSmile className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      // TODO: Add hashtag
                    }}
                  >
                    <IconHash className="h-4 w-4" />
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {caption.length}
                      {globalCaptionLimit !== null && (
                        <span className={isBaseCaptionExceeded ? 'text-destructive' : 'text-muted-foreground'}>
                          /{globalCaptionLimit}
                        </span>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => {
                        // TODO: Open AI assistant
                      }}
                    >
                      <IconSparkles className="h-4 w-4" />
                      <span className="text-xs">AI Assistant</span>
                    </Button>
                  </div>
                </div>
                )}
              </div>

              {/* Content Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  {t("contentTitle")}
                </Label>
                <Input
                  id="title"
                  placeholder={t("contentTitlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <TagsInput.Root 
                  value={tags} 
                  onValueChange={setTags} 
                  editable 
                  addOnPaste
                  className="w-full"
                >
                  <TagsInput.Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <IconHash className="h-4 w-4" />
                    {t("tags")}
                  </TagsInput.Label>
                  <div className="relative">
                    <div className="flex flex-wrap gap-2 p-2 min-h-[42px] border border-border rounded-md bg-background">
                      {tags.map((tag) => (
                        <TagsInput.Item 
                          key={tag} 
                          value={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                        >
                          <TagsInput.ItemText>{tag}</TagsInput.ItemText>
                          <TagsInput.ItemDelete className="ml-1 cursor-pointer hover:text-destructive inline-flex items-center justify-center">
                            <IconX className="h-3 w-3" />
                          </TagsInput.ItemDelete>
                        </TagsInput.Item>
                      ))}
                      <TagsInput.Input 
                        placeholder={t("addTagPlaceholder")}
                        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
                        value={tagSearchQuery}
                        onChange={(e) => handleTagInputChange(e.target.value)}
                        onFocus={() => {
                          if (tagSearchQuery.trim().length >= 2) {
                            setShowTagSuggestions(true)
                          }
                        }}
                        onBlur={() => {
                          // Delay to allow click on suggestions
                          setTimeout(() => setShowTagSuggestions(false), 200)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && tagSearchQuery.trim() && !tags.includes(tagSearchQuery.trim())) {
                            e.preventDefault()
                            handleCreateNewTag()
                          }
                        }}
                      />
                    </div>
                    {/* Autocomplete suggestions */}
                    {showTagSuggestions && (tagSuggestions.length > 0 || tagSearchQuery.trim().length >= 2) && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-auto">
                        {isLoadingTags ? (
                          <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                        ) : (
                          <>
                            {tagSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                                onClick={() => handleTagSelect(suggestion.name)}
                              >
                                <IconHash className="h-3 w-3 text-muted-foreground" />
                                <span>{suggestion.name}</span>
                              </button>
                            ))}
                            {tagSearchQuery.trim().length >= 2 && 
                             !tagSuggestions.some(s => s.name.toLowerCase() === tagSearchQuery.trim().toLowerCase()) &&
                             !tags.includes(tagSearchQuery.trim()) && (
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-primary"
                                onClick={handleCreateNewTag}
                              >
                                <IconHash className="h-3 w-3" />
                                <span>{t("createTag", { tag: tagSearchQuery.trim() })}</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </TagsInput.Root>
              </div>

            </div>
          </div>

          {/* Right Side - Preview */}
          <div className="w-full lg:w-[40%] xl:w-[35%] bg-muted/30 overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">{t("preview")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("previewPlaceholder")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer - Publish Actions */}
        <div className="flex-shrink-0 border-t bg-background px-4 py-3 flex items-center justify-between gap-4">
          {/* Left Side - Create Another & Save Drafts */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-another"
                checked={createAnother}
                onCheckedChange={(checked) => setCreateAnother(checked === true)}
              />
              <Label htmlFor="create-another" className="text-sm font-medium cursor-pointer">
                {t("createAnother")}
              </Label>
            </div>
            <div className="h-4 w-px bg-border"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDraft(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("saveDrafts")}
            </Button>
          </div>

          {/* Right Side - Publish Options */}
          <div className="flex items-center gap-2">
            <ButtonGroup>
              {/* Publish Mode Selector */}
              <Popover open={showPublishOptions} onOpenChange={setShowPublishOptions}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 rounded-r-none"
                  >
                  {publishMode === 'now' && (
                    <>
                      <IconSend className="h-4 w-4" />
                      <span>{t("publishNow")}</span>
                    </>
                  )}
                  {publishMode === 'setDateTime' && (
                    <>
                      <IconPin className="h-4 w-4" />
                      <span>
                        {selectedDate && selectedTime
                          ? `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${selectedTime}`
                          : selectedDate
                          ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : t("setDateTime")}
                      </span>
                    </>
                  )}
                  <IconChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="end">
                {!showDateTimePicker ? (
                  // Initial options screen
                  <div className="p-2">
                    {/* Now */}
                    <button
                      type="button"
                      onClick={() => {
                        setPublishMode('now')
                        setShowPublishOptions(false)
                      }}
                      className={`w-full text-left p-2.5 rounded-md transition-colors ${
                        publishMode === 'now'
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          {publishMode === 'now' && (
                            <IconCheck className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className="text-sm font-semibold">Now</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Publish your post right away.
                      </p>
                    </button>

                    {/* Separator */}
                    <div className="h-px bg-border my-2" />

                    {/* Smart Time (AI) - Coming Soon */}
                    <button
                      type="button"
                      onClick={() => {
                        toast.info(t("smartTimeToast"), {
                          description: t("smartTimeToastDescription"),
                        })
                      }}
                      disabled
                      className="w-full text-left p-2.5 rounded-md transition-colors opacity-60 cursor-not-allowed relative"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <IconSparkles className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-muted-foreground">{t("smartTime")}</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                            <IconLock className="h-3 w-3" />
                            {t("comingSoon")}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("smartTimeDescription")}
                      </p>
                    </button>

                    {/* Set Date and Time */}
                    <button
                      type="button"
                      onClick={() => {
                        setPublishMode('setDateTime')
                        // Set default date to today if not already selected
                        if (!selectedDate) {
                          setSelectedDate(new Date())
                        }
                        setShowDateTimePicker(true)
                      }}
                      className={`w-full text-left p-2.5 rounded-md transition-colors mt-2 ${
                        publishMode === 'setDateTime'
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          {publishMode === 'setDateTime' && (
                            <IconCheck className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className="text-sm font-semibold">{t("setDateTime")}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("setDateTimeDescription")}
                      </p>
                    </button>
                  </div>
                ) : (
                  // Date & Time picker screen
                  <div className="p-4 space-y-4">
                    {/* Calendar */}
                    <div>
                      <Label className="text-xs font-medium mb-2 block">Select Date</Label>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                      />
                    </div>

                    {/* Time Picker */}
                    <div>
                      <Label htmlFor="time-picker" className="text-xs font-medium mb-2 block">
                        {t("selectTime")} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                      </Label>
                      <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 w-full">
                        <IconClock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          id="time-picker"
                          type="time"
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto flex-1 w-full"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowDateTimePicker(false)
                        }}
                      >
                        ← {t("otherOptions")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedDate && selectedTime) {
                            const dateTime = new Date(selectedDate)
                            const [hours, minutes] = selectedTime.split(':')
                            dateTime.setHours(parseInt(hours), parseInt(minutes))
                            setScheduledAt(dateTime.toISOString())
                            setShowPublishOptions(false)
                            setShowDateTimePicker(false)
                          }
                        }}
                        disabled={!selectedDate || !selectedTime}
                      >
                        {t("done")}
                      </Button>
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Schedule/Publish Button */}
            <Button
              variant="outline"
              className="rounded-l-none"
              onClick={async () => {
                if (!currentWorkspace || !brandSlug || !formFactor || selectedAccountIds.length === 0) {
                  return
                }

                // Hard validation: prevent submission if caption exceeds limits
                if (isBaseCaptionExceeded) {
                  return
                }
                
                try {
                  // Determine scheduledAt based on publish mode
                  let finalScheduledAt: string | null = null
                  let finalStatus: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' = 'DRAFT'
                  
                  if (publishMode === 'now') {
                    finalStatus = 'PUBLISHED'
                    finalScheduledAt = new Date().toISOString()
                  } else if (publishMode === 'setDateTime' && selectedDate && selectedTime) {
                    const dateTime = new Date(selectedDate)
                    const [hours, minutes] = selectedTime.split(':')
                    dateTime.setHours(parseInt(hours), parseInt(minutes))
                    finalScheduledAt = dateTime.toISOString()
                    finalStatus = 'SCHEDULED'
                  }
                  
                  // Step 1: Upload media files to S3
                  const uploadedMediaIds: string[] = []
                  
                  for (const media of selectedMedia) {
                    try {
                      const uploadResult = await apiClient.uploadMedia(
                        currentWorkspace.id,
                        media.file
                      )
                      
                      if (uploadResult.success && uploadResult.media?.id) {
                        uploadedMediaIds.push(uploadResult.media.id)
                      }
                    } catch (error) {
                      console.error(`Failed to upload media ${media.file.name}:`, error)
                    }
                  }
                  
                  // Step 2: Create content
                  await apiClient.createContent(
                    currentWorkspace.id,
                    brandSlug,
                    {
                      formFactor,
                      title: title || null,
                      baseCaption: caption || null,
                      accountIds: selectedAccountIds,
                      scheduledAt: finalScheduledAt,
                      status: finalStatus,
                      tags: tags.length > 0 ? tags : undefined,
                      mediaIds: uploadedMediaIds.length > 0 ? uploadedMediaIds : undefined,
                    }
                  )
                  
                  // Step 3: Clean up
                  selectedMedia.forEach(media => {
                    URL.revokeObjectURL(media.preview)
                  })
                  
                  // Step 4: Handle create another or close
                  if (createAnother) {
                    // Reset form but keep modal open
                    setFormFactor(null)
                    setSelectedAccountIds([])
                    setTitle("")
                    setCaption("")
                    setTags([])
                    setSelectedMedia([])
                    setScheduledAt("")
                    setPublishMode('now')
                    setSelectedDate(undefined)
                    setSelectedTime("")
                  } else {
                    onOpenChange(false)
                  }
                } catch (error) {
                  console.error('Failed to save content:', error)
                }
              }}
              disabled={!formFactor || selectedAccountIds.length === 0 || isBaseCaptionExceeded}
            >
              {publishMode === 'now' ? t("publishNowButton") : t("schedulePosts")}
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sortable Media Item Component
interface SortableMediaItemProps {
  media: {
    id: string
    file: File
    preview: string
    type: 'image' | 'video' | 'document'
  }
  onRemove: (id: string) => void
}

function SortableMediaItem({ media, onRemove }: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted"
    >
      {/* Thumbnail */}
      {media.type === 'image' ? (
        <img
          src={media.preview}
          alt={media.file.name}
          className="w-full h-full object-cover"
        />
      ) : media.type === 'video' ? (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <IconVideo className="h-8 w-8 text-muted-foreground" />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <IconFileUpload className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <IconGripVertical className="h-4 w-4 text-white" />
      </div>
      
      {/* Remove Button */}
      <button
        type="button"
        onClick={() => onRemove(media.id)}
        className="absolute top-2 right-2 p-1.5 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
      >
        <IconX className="h-4 w-4 text-white" />
      </button>
      
      {/* Video Indicator */}
      {media.type === 'video' && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-xs text-white">
          Video
        </div>
      )}
    </div>
  )
}
