"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { IconDots, IconPlus } from "@tabler/icons-react"
import { ContentCreationModal } from "@/features/content/content-creation-modal"
import { DataViewTable } from "@/components/data-view/data-view-table"
import { TableTask } from "@/components/data-view/types"
import { toast } from "sonner"

export default function PublishPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace } = useWorkspace()
  const t = useTranslations('publish')
  const contentIdFromUrl = searchParams.get('contentId')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(contentIdFromUrl)
  const [brandInfo, setBrandInfo] = useState<{ name: string; slug: string; logoUrl?: string | null } | null>(null)
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
  }>>([])
  const [isLoadingContents, setIsLoadingContents] = useState(false)
  const [filterTab, setFilterTab] = useState<"all" | "todo" | "inProgress" | "overdue" | "completed">("all")

  useEffect(() => {
    const fetchBrandInfo = async () => {
      if (!currentWorkspace || !brandSlug) return

      try {
        const brandsResponse = await apiClient.listBrands(currentWorkspace.id)
        const brand = brandsResponse.brands.find((b) => b.slug === brandSlug)
        if (brand) {
          setBrandInfo({
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

  // Sync URL with modal state - only when modal is not already open
  useEffect(() => {
    const contentIdFromUrl = searchParams.get('contentId')
    if (contentIdFromUrl && !isModalOpen) {
      setSelectedContentId(contentIdFromUrl)
      setIsModalOpen(true)
    }
  }, [searchParams]) // Remove isModalOpen from dependencies to prevent race conditions

  useEffect(() => {
    const fetchContents = async () => {
      if (!currentWorkspace || !brandSlug) return

      setIsLoadingContents(true)
      try {
        const response = await apiClient.listContents(currentWorkspace.id, brandSlug)
        setContents(response.contents)
      } catch (error) {
        console.error('Failed to fetch contents:', error)
        toast.error('Failed to load contents')
      } finally {
        setIsLoadingContents(false)
      }
    }

    fetchContents()
  }, [currentWorkspace, brandSlug, isModalOpen])

  // Update URL when modal opens/closes
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open)

    if (!open) {
      // Modal is closing - remove contentId from URL and reset state immediately
      const params = new URLSearchParams(searchParams.toString())
      params.delete('contentId')
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
      router.push(newUrl, { scroll: false })

      // Reset selectedContentId immediately when closing
      setSelectedContentId(null)

      // Reload contents when modal closes
      if (currentWorkspace && brandSlug) {
        const fetchContents = async () => {
          try {
            const response = await apiClient.listContents(currentWorkspace.id, brandSlug)
            setContents(response.contents)
          } catch (error) {
            console.error('Failed to fetch contents:', error)
          }
        }
        fetchContents()
      }
    }
    // Note: URL update for opening is handled by the click handlers (table click, new content button)
  }

  // Transform contents to TableTask format for DataViewTable
  const contentsData: TableTask[] = contents.map((content) => {
    const statusMap: Record<string, string> = {
      DRAFT: t('status.draft') || 'Draft',
      SCHEDULED: t('status.scheduled') || 'Scheduled',
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

    const platforms = content.contentAccounts.map(ca => ca.socialAccount.platform).join(', ')

    return {
      id: content.id,
      taskNumber: 0, // Content doesn't have task numbers
      title: content.title || content.baseCaption || 'Untitled',
      description: content.baseCaption,
      header: content.title || content.baseCaption || 'Untitled',
      type: formFactorMap[content.formFactor] || content.formFactor,
      priority: 'MEDIUM', // Content doesn't have priority
      status: statusMap[content.status] || content.status,
      dueDate: content.scheduledAt || content.createdAt,
      assignedTo: [], // Content doesn't have assignees
      commentCount: 0, // Content doesn't have comments yet
    } as TableTask
  })

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
        <div className="w-full sm:px-6 px-0 flex-1 min-h-0 flex flex-col">
          {isLoadingContents ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <DataViewTable
              data={contentsData}
              filterTab={filterTab}
              onTaskClick={(task) => {
                setSelectedContentId(task.id)
                setIsModalOpen(true)
                // Update URL with contentId
                const params = new URLSearchParams(searchParams.toString())
                params.set('contentId', task.id)
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
