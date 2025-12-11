import { useState, useEffect, useCallback, useMemo } from "react"
import type { ContentFormFactor, SocialPlatform } from "@brint/shared-config/platform-rules"
import type { 
  ContentCreationFormState, 
  ContentCreationInitialState, 
  ContentStatusType,
  ContentMediaItem,
  PublishMode 
} from "../content-creation.types"

interface UseContentFormStateProps {
  contentId?: string | null
  brandSlug?: string
  onLoadContent?: (contentId: string) => Promise<{
    formFactor: ContentFormFactor
    title: string
    caption: string
    tags: string[]
    status: ContentStatusType
    accountIds: string[]
    scheduledAt: string | null
    media: ContentMediaItem[]
    mediaLookupId?: string | null
    useMediaLookupOnPublish?: boolean
  }>
}

export function useContentFormState({ 
  contentId, 
  brandSlug,
  onLoadContent 
}: UseContentFormStateProps) {
  // Form state
  const [formFactor, setFormFactor] = useState<ContentFormFactor | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [caption, setCaption] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [createAnother, setCreateAnother] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [contentStatus, setContentStatus] = useState<ContentStatusType | null>(null)
  const [mediaLookupId, setMediaLookupId] = useState<string | undefined>(undefined)
  const [useMediaLookupOnPublish, setUseMediaLookupOnPublish] = useState(false)
  
  // Loading state
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  
  // Change tracking
  const [hasChanges, setHasChanges] = useState(false)
  const [initialState, setInitialState] = useState<ContentCreationInitialState | null>(null)

  // Publish options UI state (moved here for convenience)
  const [showPublishOptions, setShowPublishOptions] = useState(false)
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormFactor(null)
    setSelectedAccountIds([])
    setTitle("")
    setCaption("")
    setTags([])
    setPublishMode('now')
    setShowPublishOptions(false)
    setShowDateTimePicker(false)
    setSelectedDate(undefined)
    setSelectedTime("")
    setContentStatus(null)
    setIsDraft(true)
    setCreateAnother(false)
    setMediaLookupId(undefined)
    setUseMediaLookupOnPublish(false)
    setHasChanges(false)
    setInitialState({
      formFactor: null,
      selectedAccountIds: [],
      title: "",
      caption: "",
      tags: [],
      mediaIds: [],
    })
  }, [])

  // Load content for edit mode
  useEffect(() => {
    const loadContent = async () => {
      if (!brandSlug || !contentId || !onLoadContent) {
        if (!contentId) {
          resetForm()
        }
        return
      }

      setIsLoadingContent(true)
      try {
        const content = await onLoadContent(contentId)
        
        setFormFactor(content.formFactor)
        setTitle(content.title || "")
        setCaption(content.caption || "")
        setTags(content.tags || [])
        setContentStatus(content.status)
        setSelectedAccountIds(content.accountIds || [])
        setMediaLookupId(content.mediaLookupId || undefined)
        setUseMediaLookupOnPublish(content.useMediaLookupOnPublish ?? false)
        
        // Set scheduled date/time if exists
        if (content.scheduledAt) {
          const scheduledDate = new Date(content.scheduledAt)
          setSelectedDate(scheduledDate)
          setSelectedTime(`${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`)
          setPublishMode('setDateTime')
        } else {
          setPublishMode('now')
        }
        
        // Set initial state for change tracking
        setInitialState({
          formFactor: content.formFactor,
          selectedAccountIds: content.accountIds || [],
          title: content.title || "",
          caption: content.caption || "",
          tags: content.tags || [],
          mediaIds: content.media.map(m => m.mediaId || '').filter(Boolean),
        })
        setHasChanges(false)
      } catch (error) {
        console.error('Failed to load content:', error)
        throw error
      } finally {
        setIsLoadingContent(false)
      }
    }
    
    loadContent()
  }, [contentId, brandSlug, onLoadContent, resetForm])

  // Track changes
  const trackChanges = useCallback((
    currentMedia: ContentMediaItem[],
    currentFormFactor: ContentFormFactor | null,
    currentSelectedAccountIds: string[],
    currentTitle: string,
    currentCaption: string,
    currentTags: string[]
  ) => {
    if (!initialState) return

    const currentMediaIds = currentMedia.map(m => m.mediaId).filter(Boolean)
    const hasNewMediaFiles = currentMedia.some(m => m.file && !m.mediaId)
    const mediaCountChanged = currentMedia.length !== initialState.mediaIds.length

    const hasAnyChange =
      currentFormFactor !== initialState.formFactor ||
      JSON.stringify(currentSelectedAccountIds.sort()) !== JSON.stringify(initialState.selectedAccountIds.sort()) ||
      currentTitle !== initialState.title ||
      currentCaption !== initialState.caption ||
      JSON.stringify(currentTags.sort()) !== JSON.stringify(initialState.tags.sort()) ||
      hasNewMediaFiles ||
      mediaCountChanged ||
      JSON.stringify(currentMediaIds.sort()) !== JSON.stringify(initialState.mediaIds.sort())

    setHasChanges(hasAnyChange)
  }, [initialState])

  // Handlers
  const handleFormFactorChange = useCallback((factor: ContentFormFactor) => {
    setFormFactor(factor)
  }, [])

  const handleAccountToggle = useCallback((accountId: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }, [])

    // Derived values
    const hasSelectedAccounts = useMemo(() => selectedAccountIds.length > 0, [selectedAccountIds])
    const isFeedPost = useMemo(() => formFactor === 'FEED_POST', [formFactor])

  return {
    // State
    formFactor,
    selectedAccountIds,
    title,
    caption,
    tags,
    publishMode,
    selectedDate,
    selectedTime,
    createAnother,
    isDraft,
    contentStatus,
    isLoadingContent,
    hasChanges,
    initialState,
    showPublishOptions,
    showDateTimePicker,
    mediaLookupId,
    useMediaLookupOnPublish,
    
    // Setters
    setFormFactor,
    setSelectedAccountIds,
    setTitle,
    setCaption,
    setTags,
    setPublishMode,
    setSelectedDate,
    setSelectedTime,
    setCreateAnother,
    setIsDraft,
    setContentStatus,
    setShowPublishOptions,
    setShowDateTimePicker,
    setMediaLookupId,
    setUseMediaLookupOnPublish,
    
    // Handlers
    handleFormFactorChange,
    handleAccountToggle,
    resetForm,
    trackChanges,
    
    // Derived
    hasSelectedAccounts,
    isFeedPost,
  }
}

