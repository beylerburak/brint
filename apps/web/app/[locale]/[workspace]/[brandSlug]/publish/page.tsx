"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { IconDots, IconPlus } from "@tabler/icons-react"
import { ContentCreationModal } from "@/features/content/content-creation-modal"

export default function PublishPage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace } = useWorkspace()
  const t = useTranslations('publish')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [brandInfo, setBrandInfo] = useState<{ name: string; slug: string; logoUrl?: string | null } | null>(null)

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

  return (
    <>
      <div className="w-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <IconDots className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <IconPlus className="h-4 w-4 mr-2" />
            {t('newContent')}
          </Button>
        </div>
        
        <div>
          <p className="text-muted-foreground">Brand: @{brandSlug}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('description')}
          </p>
        </div>
      </div>

      <ContentCreationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        brandSlug={brandInfo?.slug || brandSlug}
        brandName={brandInfo?.name}
        brandLogoUrl={brandInfo?.logoUrl || undefined}
      />
    </>
  )
}
