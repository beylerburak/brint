"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { IconBrandAsana, IconPlus, IconDots } from "@tabler/icons-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CursorProvider, Cursor, CursorFollow } from "@/components/animate-ui/components/animate/cursor"
import { CreateBrandDialog } from "@/features/brand/create-brand-dialog"
import { UpgradeDialog } from "@/features/workspace/upgrade-dialog"
import { PLAN_LIMITS, type PlanType } from "@brint/shared-config/plans"

type Brand = {
  id: string
  name: string
  slug: string
  description: string | null
  industry: string | null
  country: string | null
  city: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  logoMediaId: string | null
  logoUrl: string | null
  mediaCount: number
  createdAt: string
  updatedAt: string
}

export default function BrandsPage() {
  const t = useTranslations('brands')
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'en'
  const workspaceSlug = params?.workspace as string
  const { currentWorkspace } = useWorkspace()
  const [brands, setBrands] = useState<Brand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  // Check if user has permission to create brand (requires ADMIN or OWNER role)
  const canCreateBrandByRole = () => {
    if (!currentWorkspace?.userRole) return false
    const role = currentWorkspace.userRole
    // OWNER and ADMIN can create brands (backend requires ADMIN, but OWNER bypasses)
    return role === 'OWNER' || role === 'ADMIN'
  }

  const canCreateBrand = () => {
    if (!currentWorkspace) return false
    // First check role permission
    if (!canCreateBrandByRole()) return false
    // Then check plan limits
    const planLimit = PLAN_LIMITS[currentWorkspace.plan as PlanType]
    if (planLimit.maxBrands === -1) return true // unlimited
    return brands.length < planLimit.maxBrands
  }

  const getBrandLimitText = () => {
    if (!currentWorkspace) return ''
    const planLimit = PLAN_LIMITS[currentWorkspace.plan as PlanType]
    if (planLimit.maxBrands === -1) return 'Unlimited'
    return `${brands.length}/${planLimit.maxBrands}`
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 30) {
      const diffMonths = Math.floor(diffDays / 30)
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    } else {
      return 'Just now'
    }
  }

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadBrands(currentWorkspace.id)
    }
  }, [currentWorkspace?.id])

  const loadBrands = async (workspaceId: string) => {
    setIsLoading(true)
    try {
      const response = await apiClient.listBrands(workspaceId)
      setBrands(response.brands)
    } catch (error) {
      console.error('Failed to load brands:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[600px]">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconBrandAsana className="size-12" />
              </EmptyMedia>
              <EmptyTitle>{t('noBrands')}</EmptyTitle>
              <EmptyDescription>{t('noBrandsDesc')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                disabled={!canCreateBrand()}
              >
                <IconPlus className="h-4 w-4" />
                {t('createBrand')}
              </Button>
            </EmptyContent>
          </Empty>
        </div>

        <CreateBrandDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          workspaceId={currentWorkspace?.id || ''}
          onSuccess={() => currentWorkspace?.id && loadBrands(currentWorkspace.id)}
        />
      </>
    )
  }

  return (
    <CursorProvider>
      <Cursor />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <IconDots className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {getBrandLimitText()} brands
            </span>
          </div>
          <Button
            onClick={() => {
              if (canCreateBrand()) {
                setShowCreateDialog(true)
              } else {
                // If role doesn't allow, don't show upgrade dialog (it's a permission issue, not plan limit)
                if (!canCreateBrandByRole()) {
                  // Role-based restriction - could show a tooltip or message
                  return
                }
                setShowUpgradeDialog(true)
              }
            }}
            disabled={!canCreateBrand()}
          >
            <IconPlus className="h-4 w-4" />
            {t('createBrand')}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <div key={brand.id} className="relative">
              <CursorFollow>
                {t('goToBrandStudio')}
              </CursorFollow>
              <div
                className="rounded-lg border p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/${locale}/${workspaceSlug}/${brand.slug}/home`)}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarImage src={brand.logoUrl || undefined} alt={brand.name} />
                      <AvatarFallback className="rounded-lg">
                        {brand.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold truncate">{brand.name}</h3>
                        <span className="text-sm text-muted-foreground">@{brand.slug}</span>
                      </div>
                      {brand.description && (
                        <p className="text-sm text-muted-foreground truncate">{brand.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {getRelativeTime(brand.createdAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {brand.status.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <CreateBrandDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          workspaceId={currentWorkspace?.id || ''}
          onSuccess={() => currentWorkspace?.id && loadBrands(currentWorkspace.id)}
        />

        <UpgradeDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          currentPlan={currentWorkspace?.plan || 'FREE'}
          feature="brands"
        />
      </div>
    </CursorProvider>
  )
}

