"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
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
import { GoogleDrivePickerDialog } from "../google-drive-picker-dialog"
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
import { useContentFormState } from "./hooks/use-content-form-state"
import { useMediaManager } from "./hooks/use-media-manager"
import { usePublishOptions } from "./hooks/use-publish-options"
import { useTagSuggestions } from "./hooks/use-tag-suggestions"

// Components
import { ContentModalHeader } from "./components/content-modal-header"
import { ContentFormFactorSelector } from "./components/content-form-factor-selector"
import { ContentAccountSelector } from "./components/content-account-selector"
import { ContentCaptionAndMedia } from "./components/content-caption-and-media"
import { ContentTagsField } from "./components/content-tags-field"
import { ContentPreviewPanel } from "./components/content-preview-panel"
import { ContentFooterActions } from "./components/content-footer-actions"
import { ContentDeleteDialog } from "./components/content-delete-dialog"

// Types
import type { ContentMediaItem, SocialAccount, ContentStatusType } from "./content-creation.types"

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
  const [isGoogleDrivePickerOpen, setIsGoogleDrivePickerOpen] = useState(false)
  const [isGoogleDriveAvailable, setIsGoogleDriveAvailable] = useState(false)
  const [isCheckingGoogleDrive, setIsCheckingGoogleDrive] = useState(false)
  
  // Social accounts
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])

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
    
    return {
      formFactor: content.formFactor as ContentFormFactor,
      title: content.title || "",
      caption: content.baseCaption || "",
      tags: content.tags?.map((t: any) => t.name) || [],
      status: content.status as ContentStatusType,
      accountIds: content.contentAccounts?.map((ca: any) => ca.socialAccountId) || [],
      scheduledAt: content.scheduledAt,
      media,
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

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      formState.resetForm()
      mediaManager.setSelectedMedia([])
      setShowDeleteDialog(false)
      setIsGoogleDrivePickerOpen(false)
    }
  }, [open, formState, mediaManager])

  // Track changes
  useEffect(() => {
    formState.trackChanges(
      mediaManager.selectedMedia,
      formState.formFactor,
      formState.selectedAccountIds,
      formState.title,
      formState.caption,
      formState.tags
    )
  }, [
    mediaManager.selectedMedia,
    formState.formFactor,
    formState.selectedAccountIds,
    formState.title,
    formState.caption,
    formState.tags,
    formState.trackChanges,
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
    if (!formState.formFactor) return false
    const account = socialAccounts.find((a) => a.id === accountId)
    if (!account) return false
    return !isFormFactorSupported(account.platform, formState.formFactor)
  }, [formState.formFactor, socialAccounts, isFormFactorSupported])

  // Select all compatible accounts
  const handleSelectAll = useCallback(() => {
    if (!formState.formFactor) {
      formState.setSelectedAccountIds(socialAccounts.map(acc => acc.id))
      return
    }
    
    const compatibleAccountIds = socialAccounts
      .filter(account => isFormFactorSupported(account.platform, formState.formFactor!))
      .map(account => account.id)
    
    formState.setSelectedAccountIds(compatibleAccountIds)
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
    return isMediaRequired && !hasMedia
  }, [isMediaRequired, hasMedia])

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
      const platformsRequiringMedia: string[] = []
      if (isMediaRequiredForInstagram) platformsRequiringMedia.push("Instagram")
      if (isMediaRequiredForTikTok) platformsRequiringMedia.push("TikTok")
      if (isMediaRequiredForFacebook) platformsRequiringMedia.push("Facebook")
      
      selectedPlatforms.forEach((platform) => {
        if (platform !== 'INSTAGRAM' && platform !== 'TIKTOK' && platform !== 'FACEBOOK') {
          if (formState.formFactor && requiresMedia(platform as SocialPlatform, formState.formFactor)) {
            platformsRequiringMedia.push(platform)
          }
        }
      })

      if (platformsRequiringMedia.length > 1) {
        if (platformsRequiringMedia.includes("Instagram") && platformsRequiringMedia.includes("TikTok")) {
          return t("publishButtonDisabledNoMediaInstagramTikTok")
        }
        return `Media is required for ${platformsRequiringMedia.join(" and ")}`
      } else if (platformsRequiringMedia.length === 1) {
        if (platformsRequiringMedia[0] === "Instagram") {
          return t("publishButtonDisabledNoMediaInstagram")
        } else if (platformsRequiringMedia[0] === "TikTok") {
          return t("publishButtonDisabledNoMediaTikTok")
        }
        return `Media is required for ${platformsRequiringMedia[0]}`
      }
      return "Media is required"
    }
    return ""
  }, [
    formState.formFactor,
    hasSelectedAccounts,
    isBaseCaptionExceeded,
    isCaptionMissing,
    isMediaMissing,
    isMediaRequiredForInstagram,
    isMediaRequiredForTikTok,
    isMediaRequiredForFacebook,
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
      dateTime.setHours(parseInt(hours), parseInt(minutes))
      formState.setPublishMode('setDateTime')
      formState.setShowPublishOptions(false)
      formState.setShowDateTimePicker(false)
    }
  }, [formState])

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
                onOpenDrivePicker={() => setIsGoogleDrivePickerOpen(true)}
                useMediaLookupOnPublish={formState.useMediaLookupOnPublish || false}
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
            showGoogleDrivePicker={isGoogleDrivePickerOpen}
            onShowGoogleDrivePickerChange={setIsGoogleDrivePickerOpen}
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

      <GoogleDrivePickerDialog
        open={isGoogleDrivePickerOpen}
        onOpenChange={setIsGoogleDrivePickerOpen}
        onFilesSelected={handleGoogleDriveFilesSelected}
      />
    </Dialog>
  )
}
