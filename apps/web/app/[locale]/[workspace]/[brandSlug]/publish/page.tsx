"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { IconDots, IconPlus } from "@tabler/icons-react"
import { ContentCreationModal } from "@/features/content/content-creation-modal"
import { ContentTable } from "@/components/content/content-table"
import { toast } from "sonner"
import { usePublicationWebSocket } from "@/hooks/use-publication-websocket"

export default function PublishPage() {
  // All hooks must be called before any early returns (Rules of Hooks)
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace, status, isLoadingWorkspace } = useWorkspace()
  const t = useTranslations('publish')
  
  const contentIdFromUrl = searchParams.get('contentId')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(contentIdFromUrl)
  
  // Track if we're on the publish page (this component is always on publish page)
  const isPublishPage = pathname?.includes('/publish') ?? true
  const [brandInfo, setBrandInfo] = useState<{ id: string; name: string; slug: string; logoUrl?: string | null } | null>(null)
  const [contents, setContents] = useState<Array<{
    id: string
    title: string | null
    baseCaption: string | null
    formFactor: string
    status: string
    scheduledAt: string | null
    createdAt: string
    updatedAt: string
    contentAccounts: Array<{
      socialAccount: {
        platform: string
        displayName: string | null
        username: string | null
      }
    }>
    tags: Array<{
      id: string
      name: string
      slug: string
      color: string | null
    }>
    publicationStatuses?: Array<{
      id: string
      status: string
      platform: string
    }>
  }>>([])
  const [isLoadingContents, setIsLoadingContents] = useState(false)
  
  // Use ref to track the last fetch key and prevent duplicate requests
  const lastFetchKeyRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)
  
  // Ref to prevent modal from reopening when URL is updated after close
  const isManuallyClosingRef = useRef(false)
  const previousModalOpenRef = useRef(isModalOpen)
  
  // All useEffect hooks must be called before early returns (Rules of Hooks)
  useEffect(() => {
    const fetchBrandInfo = async () => {
      if (!currentWorkspace || !brandSlug) return

      try {
        const brandsResponse = await apiClient.listBrands(currentWorkspace.id)
        const brand = brandsResponse.brands.find((b) => b.slug === brandSlug)
        if (brand) {
          setBrandInfo({
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            logoUrl: brand.logoUrl,
          })
        }
      } catch (error) {
        console.error('Failed to fetch brand info:', error)
      }
    }

    fetchBrandInfo()
  }, [currentWorkspace, brandSlug])

  // Sync URL with modal state - only open modal when URL has contentId
  // Only sync when we're on the publish page
  useEffect(() => {
    // Only handle URL sync on publish page
    if (!isPublishPage) {
      // If we're not on publish page, ensure modal is closed and contentId is cleared
      if (isModalOpen) {
        setIsModalOpen(false)
        setSelectedContentId(null)
      }
      return
    }

    // Skip if we just manually closed the modal (prevent reopening)
    if (isManuallyClosingRef.current) {
      isManuallyClosingRef.current = false
      return
    }

    const contentIdFromUrl = searchParams.get('contentId')
    
    // Only open modal if URL has contentId and modal is closed
    // Don't close modal here - let handleModalOpenChange handle closing
    // Don't close modal if it was manually opened (for new content creation)
    if (contentIdFromUrl && !isModalOpen) {
      setSelectedContentId(contentIdFromUrl)
      setIsModalOpen(true)
    }
    // Removed the else clause that was closing modal when contentId is not in URL
    // This was preventing "New Content" button from working
  }, [searchParams, isModalOpen, isPublishPage])

  useEffect(() => {
    if (!currentWorkspace || !brandSlug) return

    // Create a unique key for this fetch request
    const fetchKey = `${currentWorkspace.id}:${brandSlug}`
    
    // Skip if we already fetched with the same key and not currently fetching
    if (lastFetchKeyRef.current === fetchKey && !isFetchingRef.current) {
      return
    }

    // Skip if already fetching with the same key
    if (isFetchingRef.current && lastFetchKeyRef.current === fetchKey) {
      return
    }

    isFetchingRef.current = true
    setIsLoadingContents(true)
    
    const fetchContents = async () => {
      try {
        // API now has caching, so this won't make duplicate requests
        const response = await apiClient.listContents(currentWorkspace.id, brandSlug)
        setContents(response.contents)
        lastFetchKeyRef.current = fetchKey
      } catch (error) {
        console.error('Failed to fetch contents:', error)
        toast.error('Failed to load contents')
        lastFetchKeyRef.current = null
      } finally {
        setIsLoadingContents(false)
        isFetchingRef.current = false
      }
    }

    fetchContents()
    // Use workspaceId directly instead of currentWorkspace?.id to avoid unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id, brandSlug])

  // Refetch contents when modal closes (for updates)
  useEffect(() => {
    // Only refetch if modal was open and now closed (not on initial mount)
    const wasOpen = previousModalOpenRef.current
    const isNowOpen = isModalOpen
    previousModalOpenRef.current = isModalOpen

    if (wasOpen && !isNowOpen && currentWorkspace && brandSlug) {
      const fetchKey = `${currentWorkspace.id}:${brandSlug}`
      
      // Small delay to ensure modal close animation completes
      const timeoutId = setTimeout(() => {
        // Only refetch if not already fetching
        if (!isFetchingRef.current) {
          // Reset fetch key to allow new fetch
          lastFetchKeyRef.current = null
          
          const fetchContents = async () => {
            isFetchingRef.current = true
            try {
              // Use skipCache to force fresh data after modal close
              const response = await apiClient.listContents(currentWorkspace.id, brandSlug, { skipCache: true })
              setContents(response.contents)
              lastFetchKeyRef.current = fetchKey
            } catch (error) {
              console.error('Failed to fetch contents:', error)
            } finally {
              isFetchingRef.current = false
            }
          }
          fetchContents()
        }
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [isModalOpen, currentWorkspace?.id, brandSlug])

  // WebSocket connection for real-time publication/content updates
  // Note: This hook must be called before early returns, but it's safe because enabled flag prevents execution
  usePublicationWebSocket({
    workspaceId: currentWorkspace?.id || "",
    brandId: brandInfo?.id || undefined,
    enabled: !!currentWorkspace && !!brandInfo?.id && status === "READY",
    onEvent: (event) => {
      switch (event.type) {
        case "content.status.changed": {
          // Update content status and publication statuses in the list
          setContents((prev) =>
            prev.map((content) => {
              if (content.id === event.data.id) {
                // Calculate effective status: if any publication is PUBLISHING, show PUBLISHING
                const hasPublishing = event.data.publications?.some(
                  (p: any) => p.status === 'PUBLISHING'
                )
                const effectiveStatus = hasPublishing ? 'PUBLISHING' : event.data.status
                
                return {
                  ...content,
                  status: effectiveStatus,
                  publicationStatuses: event.data.publications || [],
                }
              }
              return content
            })
          )
          break
        }

        case "publication.status.changed": {
          // Update content based on publication status change
          // If publication is PUBLISHING, update content to show PUBLISHING status
          setContents((prev) =>
            prev.map((content) => {
              if (content.id === event.data.contentId) {
                // Update publication statuses
                const updatedPublicationStatuses = content.publicationStatuses || []
                const pubIndex = updatedPublicationStatuses.findIndex(
                  (p: any) => p.id === event.data.id
                )
                
                if (pubIndex >= 0) {
                  updatedPublicationStatuses[pubIndex] = {
                    id: event.data.id,
                    status: event.data.status,
                    platform: event.data.platform,
                  }
                } else {
                  updatedPublicationStatuses.push({
                    id: event.data.id,
                    status: event.data.status,
                    platform: event.data.platform,
                  })
                }
                
                // Check if any publication is PUBLISHING
                const hasPublishing = updatedPublicationStatuses.some(
                  (p: any) => p.status === 'PUBLISHING'
                )
                
                // If publication failed or succeeded, we should refetch to get accurate content status
                // But for PUBLISHING status, we can update optimistically
                if (event.data.status === 'PUBLISHING') {
                  return {
                    ...content,
                    status: 'PUBLISHING',
                    publicationStatuses: updatedPublicationStatuses,
                  }
                } else {
                  // For SUCCESS/FAILED, trigger a refetch to get accurate overall content status
                  if (currentWorkspace && brandSlug && !isFetchingRef.current) {
                    const fetchKey = `${currentWorkspace.id}:${brandSlug}`
                    lastFetchKeyRef.current = null
                    
                    const fetchContents = async () => {
                      isFetchingRef.current = true
                      try {
                        // Use skipCache to force fresh data after publication status change
                        const response = await apiClient.listContents(currentWorkspace.id, brandSlug, { skipCache: true })
                        setContents(response.contents)
                        lastFetchKeyRef.current = fetchKey
                      } catch (error) {
                        console.error('Failed to fetch contents:', error)
                      } finally {
                        isFetchingRef.current = false
                      }
                    }
                    // Small delay to ensure backend has updated
                    setTimeout(fetchContents, 500)
                  }
                  
                  return {
                    ...content,
                    publicationStatuses: updatedPublicationStatuses,
                  }
                }
              }
              return content
            })
          )
          break
        }
      }
    },
  })

  // Guard: Handle loading and error states (after all hooks)
  if (isLoadingWorkspace || status === "LOADING") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    )
  }
  
  if (status === "NO_ACCESS" || status === "ERROR" || !currentWorkspace) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold">Workspace not available</p>
          <p className="text-sm text-muted-foreground">
            {status === "NO_ACCESS" ? "You don't have access to this workspace." : "Failed to load workspace."}
          </p>
        </div>
      </div>
    )
  }

  // Update URL when modal opens/closes
  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      // Modal is closing - mark as manually closing to prevent useEffect from reopening
      isManuallyClosingRef.current = true
      
      // Reset selectedContentId immediately when closing
      setSelectedContentId(null)
      
      // Remove contentId from URL
      const params = new URLSearchParams(searchParams.toString())
      params.delete('contentId')
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
      router.push(newUrl, { scroll: false })
    }
    
    setIsModalOpen(open)
    // Note: URL update for opening is handled by the click handlers (table click, new content button)
    // Contents refresh is handled by the useEffect above
  }

  const statusMap: Record<string, string> = {
    DRAFT: t('status.draft') || 'Draft',
    SCHEDULED: t('status.scheduled') || 'Scheduled',
    PUBLISHING: t('status.publishing') || 'Publishing',
    PUBLISHED: t('status.published') || 'Published',
    PARTIALLY_PUBLISHED: t('status.partiallyPublished') || 'Partially Published',
    FAILED: t('status.failed') || 'Failed',
    ARCHIVED: t('status.archived') || 'Archived',
  }

  const formFactorMap: Record<string, string> = {
    FEED_POST: t('formFactor.feedPost') || 'Feed Post',
    STORY: t('formFactor.story') || 'Story',
    VERTICAL_VIDEO: t('formFactor.verticalVideo') || 'Vertical Video',
    BLOG_ARTICLE: t('formFactor.blogArticle') || 'Blog Article',
    LONG_VIDEO: t('formFactor.longVideo') || 'Long Video',
  }

  return (
    <>
      <div className="w-full flex flex-col min-h-0" style={{ height: "100vh" }}>
        {/* Header */}
        <div className="flex items-center px-6 pt-6 pb-0 gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <IconDots className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => {
            setSelectedContentId(null)
            setIsModalOpen(true)
            // Remove contentId from URL when creating new
            const params = new URLSearchParams(searchParams.toString())
            params.delete('contentId')
            const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
            router.push(newUrl, { scroll: false })
          }} className="ml-auto">
            <IconPlus className="h-4 w-4 mr-2" />
            {t('newContent')}
          </Button>
        </div>

        {/* Table */}
        <div className="w-full sm:px-6 px-0 flex-1 min-h-0 flex flex-col overflow-auto">
          {isLoadingContents ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <ContentTable
              contents={contents}
              statusMap={statusMap}
              formFactorMap={formFactorMap}
              onContentClick={(contentId) => {
                setSelectedContentId(contentId)
                setIsModalOpen(true)
                // Update URL with contentId
                const params = new URLSearchParams(searchParams.toString())
                params.set('contentId', contentId)
                router.push(`?${params.toString()}`, { scroll: false })
              }}
            />
          )}
        </div>
      </div>

      <ContentCreationModal
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        brandSlug={brandInfo?.slug || brandSlug}
        brandName={brandInfo?.name}
        brandLogoUrl={brandInfo?.logoUrl || undefined}
        contentId={selectedContentId}
      />
    </>
  )
}
