"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { 
  PLATFORM_RULES, 
  type ContentFormFactor, 
  type SocialPlatform, 
  getCaptionLimitFor, 
  requiresMedia 
} from "@brint/shared-config/platform-rules"
import { GoogleDrivePickerDialog } from "./google-drive-picker-dialog"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

// Hooks
import { useContentFormState } from "./content-creation/hooks/use-content-form-state"
import { useMediaManager } from "./content-creation/hooks/use-media-manager"
import { usePublishOptions } from "./content-creation/hooks/use-publish-options"
import { useTagSuggestions } from "./content-creation/hooks/use-tag-suggestions"

// Components
import { ContentModalHeader } from "./content-creation/components/content-modal-header"
import { ContentFormFactorSelector } from "./content-creation/components/content-form-factor-selector"
import { ContentAccountSelector } from "./content-creation/components/content-account-selector"
import { ContentCaptionAndMedia } from "./content-creation/components/content-caption-and-media"
import { ContentTagsField } from "./content-creation/components/content-tags-field"
import { ContentPreviewPanel } from "./content-creation/components/content-preview-panel"
import { ContentFooterActions } from "./content-creation/components/content-footer-actions"
import { ContentDeleteDialog } from "./content-creation/components/content-delete-dialog"

// Types
import type { ContentMediaItem, SocialAccount, ContentStatusType } from "./content-creation/content-creation.types"

export interface ContentCreationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandSlug?: string
  brandName?: string
  brandLogoUrl?: string
  contentId?: string | null
}

export function ContentCreationModal({
  open,
  onOpenChange,
  brandSlug,
  brandName,
  brandLogoUrl,
  contentId,
}: ContentCreationModalProps) {
  const t = useTranslations("contentCreation")
  const { currentWorkspace } = useWorkspace()
  
  // Loading states
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Google Drive state
  const [isGoogleDrivePickerOpen, setIsGoogleDrivePickerOpen] = useState(false) // Keep for backward compatibility but not used for modal
  const [showGoogleDrivePickerInPreview, setShowGoogleDrivePickerInPreview] = useState(false)
  const [isGoogleDriveAvailable, setIsGoogleDriveAvailable] = useState(false)
  const [isCheckingGoogleDrive, setIsCheckingGoogleDrive] = useState(false)
  
  // Social accounts
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  
  // Store random number for media lookup ID (generated once per modal open)
  const mediaLookupRandomRef = useRef<number | null>(null)
  
  // Store loaded media to set to mediaManager later
  const loadedMediaRef = useRef<ContentMediaItem[] | null>(null)

  // Load content callback for useContentFormState
  const loadContent = useCallback(async (contentId: string) => {
    if (!currentWorkspace || !brandSlug) throw new Error("Missing workspace or brand")
    
    const response = await apiClient.getContent(currentWorkspace.id, brandSlug, contentId)
    const content = response.content
    
    // Transform media
    const media: ContentMediaItem[] = []
    if (content.contentMedia && content.contentMedia.length > 0) {
      for (const cm of content.contentMedia) {
        const mediaItem = cm.media
        if (!mediaItem) continue
        
        let type: 'image' | 'video' | 'document' = 'image'
        if (mediaItem.mimeType?.startsWith('video/')) {
          type = 'video'
        } else if (mediaItem.mimeType?.includes('pdf') || mediaItem.mimeType?.includes('document')) {
          type = 'document'
        }
        
        media.push({
          id: `existing-${mediaItem.id}`,
          preview: mediaItem.previewUrl || '',
          type,
          mediaId: mediaItem.id,
        })
      }
    }
    
    // Store media in ref to set to mediaManager later
    loadedMediaRef.current = media
    
    return {
      formFactor: content.formFactor as ContentFormFactor,
      title: content.title || "",
      caption: content.baseCaption || "",
      tags: content.tags?.map((t: any) => t.name) || [],
      status: content.status as ContentStatusType,
      accountIds: content.contentAccounts?.map((ca: any) => ca.socialAccountId) || [],
      scheduledAt: content.scheduledAt,
      media,
      mediaLookupId: content.mediaLookupId || null,
      useMediaLookupOnPublish: content.useMediaLookupOnPublish ?? false,
    }
  }, [currentWorkspace, brandSlug])

  // Form state hook
  const formState = useContentFormState({
    contentId,
    brandSlug,
    onLoadContent: loadContent,
  })

  // Media manager hook
  const mediaManager = useMediaManager({
    formFactor: formState.formFactor,
    currentWorkspaceId: currentWorkspace?.id,
    onRemoveMediaFromBackend: useCallback(async (mediaId: string) => {
      if (!currentWorkspace) return
      await apiClient.deleteMedia(currentWorkspace.id, mediaId)
    }, [currentWorkspace]),
  })

  // Publish options hook
  const publishOptions = usePublishOptions({
    publishMode: formState.publishMode,
    selectedDate: formState.selectedDate,
    selectedTime: formState.selectedTime,
    onPublishModeChange: formState.setPublishMode,
    onDateChange: formState.setSelectedDate,
    onTimeChange: formState.setSelectedTime,
  })

  // Tag suggestions hook
  const tagSuggestions = useTagSuggestions({
    currentWorkspaceId: currentWorkspace?.id,
    tags: formState.tags,
    setTags: formState.setTags,
    onSearchTags: useCallback(async (workspaceId: string, options: { query: string; limit: number }) => {
      return await apiClient.searchTags(workspaceId, options)
    }, []),
  })

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Check Google Drive availability
  useEffect(() => {
    const checkDrive = async () => {
      if (!open || !currentWorkspace) {
        setIsGoogleDriveAvailable(false)
        return
      }
      setIsCheckingGoogleDrive(true)
      try {
        const res = await apiClient.getGoogleDriveStatus(currentWorkspace.id)
        setIsGoogleDriveAvailable(res?.status?.connected === true)
      } catch {
        setIsGoogleDriveAvailable(false)
      } finally {
        setIsCheckingGoogleDrive(false)
      }
    }
    void checkDrive()
  }, [open, currentWorkspace])

  // Load social accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!currentWorkspace || !brandSlug || !open) return
      
      setIsLoadingAccounts(true)
      try {
        const brandsResponse = await apiClient.listBrands(currentWorkspace.id)
        const brand = brandsResponse.brands.find((b) => b.slug === brandSlug)
        if (!brand) return
        
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

  // Generate or update media lookup ID for new content
  // This ID is generated when modal opens, so user can use it to name their files in Drive
  useEffect(() => {
    if (open && !contentId && brandSlug && currentWorkspace) {
      // Generate random number once when modal opens (for new content)
      if (mediaLookupRandomRef.current === null) {
        mediaLookupRandomRef.current = Math.floor(10000 + Math.random() * 90000) // 10000–99999
      }

      const generateMediaLookupId = (date: Date, brandHandle: string, title: string, random: number): string => {
        const yyyy = date.getFullYear()
        const mm = String(date.getMonth() + 1).padStart(2, "0")
        const dd = String(date.getDate()).padStart(2, "0")
        const safeTitle = (title || "Untitled").trim()
        return `${yyyy}-${mm}-${dd} ${brandHandle} ${safeTitle} #${random}`
      }

      // Use scheduled date if set, otherwise current date
      const dateForLookup = formState.selectedDate || new Date()
      const brandHandle = `@${brandSlug}`
      const title = formState.title || "Untitled"
      const lookupId = generateMediaLookupId(dateForLookup, brandHandle, title, mediaLookupRandomRef.current)
      
      // Update ID when title or date changes (random number stays the same)
      formState.setMediaLookupId(lookupId)
    }
  }, [open, contentId, brandSlug, currentWorkspace, formState.setMediaLookupId, formState.selectedDate, formState.title])

  // Reset random ref when modal closes
  useEffect(() => {
    if (!open) {
      mediaLookupRandomRef.current = null
    }
  }, [open])

  // Set loaded media to mediaManager when content is loaded (for draft/edit mode)
  useEffect(() => {
    if (loadedMediaRef.current !== null && contentId && !formState.isLoadingContent) {
      mediaManager.setSelectedMedia(loadedMediaRef.current)
      loadedMediaRef.current = null // Clear ref after setting
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, formState.isLoadingContent, mediaManager.setSelectedMedia]) // Trigger when content loading is complete

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      formState.resetForm()
      mediaManager.setSelectedMedia([])
      loadedMediaRef.current = null // Clear loaded media ref
      setShowDeleteDialog(false)
      setIsGoogleDrivePickerOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]) // Only depend on 'open' to avoid infinite loops

  // Track changes
  useEffect(() => {
    if (formState.initialState) {
      formState.trackChanges(
        mediaManager.selectedMedia,
        formState.formFactor,
        formState.selectedAccountIds,
        formState.title,
        formState.caption,
        formState.tags
      )
    }
    // trackChanges is stable (only changes when initialState changes, which is expected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mediaManager.selectedMedia,
    formState.formFactor,
    formState.selectedAccountIds,
    formState.title,
    formState.caption,
    formState.tags,
    formState.initialState,
  ])

  // Handle form factor change - remove incompatible accounts and media
  const handleFormFactorChange = useCallback((factor: ContentFormFactor) => {
    formState.handleFormFactorChange(factor)
    
    // Remove incompatible accounts
    formState.setSelectedAccountIds(prev => 
      prev.filter(accountId => {
        const account = socialAccounts.find(a => a.id === accountId)
        if (!account) return false
        return isFormFactorSupported(account.platform, factor)
      })
    )
    
    // Media cleanup is handled in useMediaManager hook via useEffect
  }, [formState, socialAccounts])

  // Check account compatibility
  const isFormFactorSupported = useCallback((platform: SocialPlatform | undefined | null, factor: ContentFormFactor): boolean => {
    if (!platform) return false
    const rule = PLATFORM_RULES[platform]
    if (!rule) return false
    
    const limits = rule.captionLimits
    switch (factor) {
      case "FEED_POST":
        return limits.FEED_POST !== undefined || limits.DEFAULT !== undefined
      case "STORY":
        return limits.STORY !== undefined || limits.DEFAULT !== undefined
      case "VERTICAL_VIDEO":
        return limits.VERTICAL_VIDEO !== undefined || limits.DEFAULT !== undefined
      case "BLOG_ARTICLE":
        return limits.BLOG_ARTICLE !== undefined || limits.DEFAULT !== undefined
      case "LONG_VIDEO":
        return limits.LONG_VIDEO !== undefined || limits.DEFAULT !== undefined
      default:
        return limits.DEFAULT !== undefined
    }
  }, [])

  const isAccountIncompatible = useCallback((accountId: string): boolean => {
    const account = socialAccounts.find((a) => a.id === accountId)
    if (!account) return false
    
    // Temporarily disable TikTok and Pinterest accounts
    if (account.platform === 'TIKTOK' || account.platform === 'PINTEREST') {
      return true
    }
    
    if (!formState.formFactor) return false
    return !isFormFactorSupported(account.platform, formState.formFactor)
  }, [formState.formFactor, socialAccounts, isFormFactorSupported])

  // Select all compatible accounts (toggle behavior)
  const handleSelectAll = useCallback(() => {
    // Get compatible accounts (exclude TikTok and Pinterest temporarily)
    const compatibleAccounts = (formState.formFactor
      ? socialAccounts.filter(account => isFormFactorSupported(account.platform, formState.formFactor!))
      : socialAccounts
    ).filter(account => account.platform !== 'TIKTOK' && account.platform !== 'PINTEREST')
    
    const compatibleAccountIds = compatibleAccounts.map(account => account.id)
    
    // Check if all compatible accounts are already selected
    const allCompatibleSelected = compatibleAccountIds.length > 0 && 
      compatibleAccountIds.every(id => formState.selectedAccountIds.includes(id))
    
    if (allCompatibleSelected) {
      // Clear all selections
      formState.setSelectedAccountIds([])
    } else {
      // Select all compatible accounts
      formState.setSelectedAccountIds(compatibleAccountIds)
    }
  }, [formState, socialAccounts, isFormFactorSupported])

  // Calculate derived values
  const selectedPlatforms = useMemo(() => {
    return Array.from(
      new Set(
        formState.selectedAccountIds
          .map(id => socialAccounts.find(acc => acc.id === id))
          .filter((acc): acc is SocialAccount => acc !== undefined)
          .map(acc => acc.platform)
      )
    )
  }, [formState.selectedAccountIds, socialAccounts])

  const globalCaptionLimit = useMemo(() => {
    return formState.formFactor && selectedPlatforms.length > 0
      ? Math.min(
          ...selectedPlatforms.map(platform =>
            getCaptionLimitFor(platform, formState.formFactor!)
          )
        )
      : null
  }, [formState.formFactor, selectedPlatforms])

  const isBaseCaptionExceeded = useMemo(() => {
    return globalCaptionLimit !== null && formState.caption.length > globalCaptionLimit
  }, [globalCaptionLimit, formState.caption.length])

  // Validation flags
  const isFeedPost = useMemo(() => formState.formFactor === 'FEED_POST', [formState.formFactor])
  const hasSelectedAccounts = useMemo(() => formState.selectedAccountIds.length > 0, [formState.selectedAccountIds])
  const hasMedia = useMemo(() => mediaManager.selectedMedia.length > 0, [mediaManager.selectedMedia])
  const hasCaption = useMemo(() => formState.caption.trim().length > 0, [formState.caption])
  
  const isMediaRequired = useMemo(() => {
    return formState.formFactor ? selectedPlatforms.some((platform) => 
      requiresMedia(platform as SocialPlatform, formState.formFactor!)
    ) : false
  }, [formState.formFactor, selectedPlatforms])

  const isCaptionRequired = useMemo(() => {
    return isFeedPost && hasSelectedAccounts
  }, [isFeedPost, hasSelectedAccounts])

  const isCaptionMissing = useMemo(() => {
    return isCaptionRequired && !hasCaption
  }, [isCaptionRequired, hasCaption])

  const isMediaMissing = useMemo(() => {
    // Media is missing only if:
    // 1. Media is required for selected platforms
    // 2. No local media is selected
    // 3. Media lookup toggle is OFF
    return isMediaRequired && !hasMedia && !formState.useMediaLookupOnPublish
  }, [isMediaRequired, hasMedia, formState.useMediaLookupOnPublish])

  // Platform-specific media requirements
  const hasInstagram = useMemo(() => selectedPlatforms.includes('INSTAGRAM'), [selectedPlatforms])
  const hasTikTok = useMemo(() => selectedPlatforms.includes('TIKTOK'), [selectedPlatforms])
  const isMediaRequiredForInstagram = useMemo(() => {
    return formState.formFactor && hasInstagram && requiresMedia('INSTAGRAM', formState.formFactor)
  }, [formState.formFactor, hasInstagram])
  const isMediaRequiredForTikTok = useMemo(() => {
    return formState.formFactor && hasTikTok && requiresMedia('TIKTOK', formState.formFactor)
  }, [formState.formFactor, hasTikTok])
  const isMediaRequiredForFacebook = useMemo(() => {
    return formState.formFactor && selectedPlatforms.includes('FACEBOOK') && requiresMedia('FACEBOOK', formState.formFactor)
  }, [formState.formFactor, selectedPlatforms])

  // Get disabled message for publish button
  const getDisabledMessage = useCallback(() => {
    if (!formState.formFactor) {
      return t("publishButtonDisabledNoContentType")
    }
    if (!hasSelectedAccounts) {
      return t("publishButtonDisabledNoAccounts")
    }
    if (isBaseCaptionExceeded) {
      return t("publishButtonDisabledCaptionTooLong")
    }
    if (isCaptionMissing) {
      return t("publishButtonDisabledNoCaption")
    }
    if (isMediaMissing) {
      // If media lookup is enabled, don't show media missing error
      if (formState.useMediaLookupOnPublish) {
        return ""
      }
      
      const platformsRequiringMedia: Array<{ name: string; platform: SocialPlatform }> = []
      
      // Collect platforms requiring media with their platform type
      selectedPlatforms.forEach((platform) => {
        if (formState.formFactor && requiresMedia(platform as SocialPlatform, formState.formFactor)) {
          const platformName = platform === 'INSTAGRAM' ? 'Instagram' 
            : platform === 'TIKTOK' ? 'TikTok'
            : platform === 'FACEBOOK' ? 'Facebook'
            : platform === 'X' ? 'X'
            : platform === 'LINKEDIN' ? 'LinkedIn'
            : platform
          platformsRequiringMedia.push({ name: platformName, platform: platform as SocialPlatform })
        }
      })

      if (platformsRequiringMedia.length === 0) {
        return t("publishButtonDisabledNoMediaOrToggle") || "Media is required. Upload media or enable 'Medya yüklemeden paylaş' option."
      }

      // Form factor-specific messages
      const formFactorKey = formState.formFactor === 'VERTICAL_VIDEO' ? 'Vertical' 
        : formState.formFactor === 'STORY' ? 'Story'
        : formState.formFactor === 'FEED_POST' ? 'Feed'
        : 'Generic'

      if (platformsRequiringMedia.length === 1) {
        const { name, platform } = platformsRequiringMedia[0]
        
        // Use existing translation keys - they work for all form factors
        // The existing keys say "feed posts" but they're generic enough
        if (platform === 'INSTAGRAM') {
          return t("publishButtonDisabledNoMediaInstagram")
        } else if (platform === 'TIKTOK') {
          return t("publishButtonDisabledNoMediaTikTok")
        }
        
        // Fallback to generic message for other platforms
        const contentType = formState.formFactor === 'VERTICAL_VIDEO' ? 'videos' 
          : formState.formFactor === 'STORY' ? 'stories'
          : 'posts'
        return `Media is required for ${name} ${contentType}`
      } else {
        // Multiple platforms
        const platformNames = platformsRequiringMedia.map(p => p.name)
        
        if (platformsRequiringMedia.some(p => p.platform === 'INSTAGRAM') && 
            platformsRequiringMedia.some(p => p.platform === 'TIKTOK')) {
          // Use existing key for Instagram + TikTok
          return t("publishButtonDisabledNoMediaInstagramTikTok")
        }
        
        // Generic multi-platform message
        const contentType = formState.formFactor === 'VERTICAL_VIDEO' ? 'videos' 
          : formState.formFactor === 'STORY' ? 'stories'
          : 'posts'
        return t("publishButtonDisabledNoMediaOrToggle") || `Media is required for ${platformNames.join(" and ")} ${contentType}. Upload media or enable 'Medya yüklemeden paylaş' option.`
      }
    }
    return ""
  }, [
    formState.formFactor,
    hasSelectedAccounts,
    isBaseCaptionExceeded,
    isCaptionMissing,
    isMediaMissing,
    formState.useMediaLookupOnPublish,
    selectedPlatforms,
    t,
  ])

  const isPublishDisabled = useMemo(() => {
    return !formState.formFactor || !hasSelectedAccounts || isBaseCaptionExceeded || isCaptionMissing || isMediaMissing
  }, [formState.formFactor, hasSelectedAccounts, isBaseCaptionExceeded, isCaptionMissing, isMediaMissing])

  // Handle save draft
  const handleSaveDraft = useCallback(async () => {
    if (!currentWorkspace || !brandSlug || !formState.formFactor || formState.selectedAccountIds.length === 0) {
      toast.error(t("saveDraftError"), {
        description: !formState.formFactor
          ? t("publishButtonDisabledNoContentType")
          : formState.selectedAccountIds.length === 0
          ? t("publishButtonDisabledNoAccounts")
          : t("saveDraftErrorDescription")
      })
      return
    }

    const hasNewMediaFiles = mediaManager.selectedMedia.some(m => m.file && !m.mediaId)
    
    if (!formState.hasChanges && !hasNewMediaFiles) {
      toast.success(t("saveDraftSuccess"))
      onOpenChange(false)
      return
    }

    setIsSavingDraft(true)
    try {
      const uploadedMediaIds: string[] = []

      for (const media of mediaManager.selectedMedia) {
        if (media.mediaId) {
          uploadedMediaIds.push(media.mediaId)
        } else if (media.file) {
          try {
            const uploadResult = await apiClient.uploadMedia(
              currentWorkspace.id,
              media.file
            )
            if (uploadResult.success && uploadResult.media?.id) {
              uploadedMediaIds.push(uploadResult.media.id)
            }
          } catch (error) {
            console.error(`Failed to upload media:`, error)
          }
        }
      }

      if (contentId) {
                        await apiClient.updateContent(
                          currentWorkspace.id,
                          brandSlug,
                          contentId,
                          {
                            formFactor: formState.formFactor,
                            title: formState.title || null,
                            baseCaption: formState.caption || null,
                            accountIds: formState.selectedAccountIds,
                            scheduledAt: null,
                            status: 'DRAFT',
                            tags: formState.tags.length > 0 ? formState.tags : undefined,
                            mediaIds: uploadedMediaIds.length > 0 ? uploadedMediaIds : undefined,
                            useMediaLookupOnPublish: formState.useMediaLookupOnPublish,
                          }
                        )
      } else {
                    await apiClient.createContent(
                      currentWorkspace.id,
                      brandSlug,
                      {
                        formFactor: formState.formFactor,
                        title: formState.title || null,
                        baseCaption: formState.caption || null,
                        accountIds: formState.selectedAccountIds,
                        scheduledAt: null,
                        status: 'DRAFT',
                        tags: formState.tags.length > 0 ? formState.tags : undefined,
                        mediaIds: uploadedMediaIds.length > 0 ? uploadedMediaIds : undefined,
                        mediaLookupId: formState.mediaLookupId || null,
                        useMediaLookupOnPublish: formState.useMediaLookupOnPublish,
                      }
                    )
      }

      mediaManager.selectedMedia.forEach(media => {
        if (media.file && media.preview) {
          try { URL.revokeObjectURL(media.preview) } catch {}
        }
      })

      toast.success(t("saveDraftSuccess"))

      if (contentId) {
        onOpenChange(false)
      } else if (formState.createAnother) {
        formState.resetForm()
        mediaManager.setSelectedMedia([])
      } else {
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Failed to save draft:', error)
      toast.error(t("saveDraftError"), {
        description: t("saveDraftErrorDescription")
      })
    } finally {
      setIsSavingDraft(false)
    }
  }, [
    currentWorkspace,
    brandSlug,
    contentId,
    formState,
    mediaManager,
    onOpenChange,
    t,
  ])

  // Handle publish
  const handlePublish = useCallback(async () => {
    if (!currentWorkspace || !brandSlug || !formState.formFactor || formState.selectedAccountIds.length === 0) {
      return
    }

    if (isBaseCaptionExceeded || isCaptionMissing || isMediaMissing) {
      return
    }

    setIsPublishing(true)
    try {
      const { scheduledAt: finalScheduledAt, status: finalStatus } = publishOptions.getFinalScheduledAtAndStatus()
      
      // Validate scheduled time if scheduling
      if (finalScheduledAt && status === 'SCHEDULED') {
        const scheduledDateTime = new Date(finalScheduledAt)
        const now = new Date()
        const minDateTime = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes from now
        
        if (scheduledDateTime < minDateTime) {
          toast.error(t("scheduleMinimumTimeError") || "Schedule time must be at least 10 minutes in the future")
          setIsPublishing(false)
          return
        }
      }

      const uploadedMediaIds: string[] = []

      for (const media of mediaManager.selectedMedia) {
        if (media.mediaId) {
          uploadedMediaIds.push(media.mediaId)
        } else if (media.file) {
          try {
            const uploadResult = await apiClient.uploadMedia(
              currentWorkspace.id,
              media.file
            )
            if (uploadResult.success && uploadResult.media?.id) {
              uploadedMediaIds.push(uploadResult.media.id)
            }
          } catch (error) {
            console.error(`Failed to upload media:`, error)
          }
        }
      }

      if (contentId) {
                        await apiClient.updateContent(
                          currentWorkspace.id,
                          brandSlug,
                          contentId,
                          {
                            formFactor: formState.formFactor,
                            title: formState.title || null,
                            baseCaption: formState.caption || null,
                            accountIds: formState.selectedAccountIds,
                            scheduledAt: finalScheduledAt,
                            status: finalStatus,
                            tags: formState.tags.length > 0 ? formState.tags : undefined,
                            mediaIds: uploadedMediaIds.length > 0 ? uploadedMediaIds : undefined,
                            useMediaLookupOnPublish: formState.useMediaLookupOnPublish,
                          }
                        )
        toast.success(t("updateSuccess") || "Content updated successfully")
      } else {
                        await apiClient.createContent(
                          currentWorkspace.id,
                          brandSlug,
                          {
                            formFactor: formState.formFactor,
                            title: formState.title || null,
                            baseCaption: formState.caption || null,
                            accountIds: formState.selectedAccountIds,
                            scheduledAt: finalScheduledAt,
                            status: finalStatus,
                            tags: formState.tags.length > 0 ? formState.tags : undefined,
                            mediaIds: uploadedMediaIds.length > 0 ? uploadedMediaIds : undefined,
                            mediaLookupId: formState.mediaLookupId || null,
                            useMediaLookupOnPublish: formState.useMediaLookupOnPublish,
                          }
                        )
        toast.success(t("createSuccess") || "Content created successfully")
      }

      mediaManager.selectedMedia.forEach(media => {
        if (media.file && media.preview) {
          try { URL.revokeObjectURL(media.preview) } catch {}
        }
      })

      if (contentId) {
        onOpenChange(false)
      } else if (formState.createAnother) {
        formState.resetForm()
        mediaManager.setSelectedMedia([])
      } else {
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Failed to save content:', error)
    } finally {
      setIsPublishing(false)
    }
  }, [
    currentWorkspace,
    brandSlug,
    contentId,
    formState,
    mediaManager,
    publishOptions,
    isBaseCaptionExceeded,
    isCaptionMissing,
    isMediaMissing,
    onOpenChange,
    t,
  ])

  // Handle delete
  const handleDeleteContent = useCallback(async () => {
    if (!currentWorkspace || !brandSlug || !contentId) {
      return
    }

    setIsDeleting(true)
    setShowDeleteDialog(false)
    
    try {
      await apiClient.deleteContent(currentWorkspace.id, brandSlug, contentId)
      
      toast.success(t("deleteDialog.deleteSuccess"))
      
      mediaManager.selectedMedia.forEach(media => {
        if (media.file && media.preview) {
          try { URL.revokeObjectURL(media.preview) } catch {}
        }
      })
      
      onOpenChange(false)
    } catch (error: any) {
      console.error('Failed to delete content:', error)
      toast.error(t("deleteDialog.deleteError"), {
        description: error.message || t("deleteDialog.deleteErrorDescription")
      })
    } finally {
      setIsDeleting(false)
    }
  }, [currentWorkspace, brandSlug, contentId, mediaManager, onOpenChange, t])

  // Handle date/time confirm
  const handleDateTimeConfirm = useCallback(() => {
    if (formState.selectedDate && formState.selectedTime) {
      const dateTime = new Date(formState.selectedDate)
      const [hours, minutes] = formState.selectedTime.split(':')
      dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      
      // Validate: must be at least 10 minutes in the future
      const now = new Date()
      const minDateTime = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes from now
      
      if (dateTime < minDateTime) {
        toast.error(t("scheduleMinimumTimeError") || "Schedule time must be at least 10 minutes in the future")
        return
      }
      
      formState.setPublishMode('setDateTime')
      formState.setShowPublishOptions(false)
      formState.setShowDateTimePicker(false)
    }
  }, [formState, t])

  // Handle Google Drive files selected
  const handleGoogleDriveFilesSelected = useCallback((mediaItems: ContentMediaItem[]) => {
    mediaManager.addMediaFromGoogleDrive(mediaItems)
  }, [mediaManager])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full h-full max-w-full max-h-full sm:w-[95vw] sm:h-[95vh] lg:w-[90vw] lg:h-[90vh] md:max-w-none md:max-h-none flex flex-col p-0 overflow-hidden rounded-none sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] gap-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Content Creation</DialogTitle>
        <DialogDescription className="sr-only">
          Create or edit content for your social media accounts
        </DialogDescription>

        <ContentModalHeader
          contentId={contentId}
          brandSlug={brandSlug}
          brandName={brandName}
          brandLogoUrl={brandLogoUrl}
          isDeleting={isDeleting}
          onClose={() => onOpenChange(false)}
          onDeleteClick={() => setShowDeleteDialog(true)}
          onSaveDraft={handleSaveDraft}
          isSavingDraft={isSavingDraft}
          canSaveDraft={!!formState.formFactor && formState.selectedAccountIds.length > 0}
        />

        {/* Main Content Area - Two Columns */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Side - Content Creation Settings */}
          <div className="w-full lg:w-[60%] xl:w-[65%] border-b lg:border-b-0 lg:border-r border-border overflow-y-auto flex-1 min-h-0">
            <div className="p-4 sm:p-6 space-y-6">
              <ContentFormFactorSelector
                formFactor={formState.formFactor}
                onFormFactorChange={handleFormFactorChange}
              />

              <ContentAccountSelector
                socialAccounts={socialAccounts}
                selectedAccountIds={formState.selectedAccountIds}
                isLoadingAccounts={isLoadingAccounts}
                formFactor={formState.formFactor}
                brandSlug={brandSlug}
                brandName={brandName}
                brandLogoUrl={brandLogoUrl}
                onAccountToggle={formState.handleAccountToggle}
                onSelectAll={handleSelectAll}
                isAccountIncompatible={isAccountIncompatible}
              />

              <ContentCaptionAndMedia
                formFactor={formState.formFactor}
                caption={formState.caption}
                onCaptionChange={formState.setCaption}
                isBaseCaptionExceeded={isBaseCaptionExceeded}
                globalCaptionLimit={globalCaptionLimit}
                selectedMedia={mediaManager.selectedMedia}
                getRootProps={mediaManager.getRootProps}
                getInputProps={mediaManager.getInputProps}
                isDragActive={mediaManager.isDragActive}
                maxFilesAllowed={mediaManager.maxFilesAllowed}
                onDragEnd={mediaManager.handleDragEnd}
                onRemoveMedia={mediaManager.handleRemoveMedia}
                sensors={sensors}
                isGoogleDriveAvailable={isGoogleDriveAvailable}
                isCheckingGoogleDrive={isCheckingGoogleDrive}
                onOpenDrivePicker={() => setShowGoogleDrivePickerInPreview(true)}
                useMediaLookupOnPublish={formState.useMediaLookupOnPublish}
                onUseMediaLookupChange={formState.setUseMediaLookupOnPublish}
                mediaLookupId={formState.mediaLookupId}
              />

              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  {t("contentTitle")}
                </Label>
                <Input
                  id="title"
                  placeholder={t("contentTitlePlaceholder")}
                  value={formState.title}
                  onChange={(e) => formState.setTitle(e.target.value)}
                />
              </div>

              <ContentTagsField
                tags={formState.tags}
                setTags={formState.setTags}
                tagSearchQuery={tagSuggestions.tagSearchQuery}
                tagSuggestions={tagSuggestions.tagSuggestions}
                showTagSuggestions={tagSuggestions.showTagSuggestions}
                isLoadingTags={tagSuggestions.isLoadingTags}
                onTagInputChange={tagSuggestions.handleTagInputChange}
                onTagSelect={tagSuggestions.handleTagSelect}
                onCreateNewTag={tagSuggestions.handleCreateNewTag}
                onShowTagSuggestionsChange={tagSuggestions.setShowTagSuggestions}
              />
            </div>
          </div>

          <ContentPreviewPanel
            isGoogleDriveAvailable={isGoogleDriveAvailable}
            onFilesSelected={handleGoogleDriveFilesSelected}
            showGoogleDrivePicker={showGoogleDrivePickerInPreview}
            onShowGoogleDrivePickerChange={setShowGoogleDrivePickerInPreview}
          />
        </div>

        <ContentFooterActions
          createAnother={formState.createAnother}
          onCreateAnotherChange={formState.setCreateAnother}
          onSaveDraft={handleSaveDraft}
          isSavingDraft={isSavingDraft}
          canSaveDraft={!!formState.formFactor && formState.selectedAccountIds.length > 0}
          publishMode={formState.publishMode}
          publishModeLabel={publishOptions.publishModeLabel}
          selectedDate={formState.selectedDate}
          selectedTime={formState.selectedTime}
          showPublishOptions={formState.showPublishOptions}
          showDateTimePicker={formState.showDateTimePicker}
          onPublishOptionsOpenChange={formState.setShowPublishOptions}
          onPublishModeChange={formState.setPublishMode}
          onDateChange={formState.setSelectedDate}
          onTimeChange={formState.setSelectedTime}
          onShowDateTimePickerChange={formState.setShowDateTimePicker}
          onDateTimeConfirm={handleDateTimeConfirm}
          onPublish={handlePublish}
          isPublishing={isPublishing}
          isDisabled={isPublishDisabled}
          disabledMessage={getDisabledMessage()}
          publishButtonText={formState.publishMode === 'now' ? t("publishNowButton") : t("schedulePosts")}
        />

        {/* Loading Overlay */}
        {(isSavingDraft || isPublishing || isDeleting) && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
            <div className="flex flex-col items-center gap-4 p-6 bg-background border border-border rounded-lg shadow-lg">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDeleting ? t("deleteDialog.deleting") : isSavingDraft ? t("savingDraft") : t("publishingContent")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isDeleting ? t("deleteDialog.deleting") : t("uploadingMedia")}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <ContentDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        contentStatus={formState.contentStatus}
        isDeleting={isDeleting}
        onConfirm={handleDeleteContent}
      />

      {/* Google Drive picker is now integrated into preview panel, no separate dialog needed */}
    </Dialog>
  )
}
