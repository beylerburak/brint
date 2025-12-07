"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/contexts/workspace-context"
import { Skeleton } from "@/components/ui/skeleton"
import { IconCheck, IconX, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getPlanLimits, PLAN_TYPES, type PlanType } from "@brint/shared-config/plans"

export default function WorkspaceSettingsPage() {
  const t = useTranslations('settings')
  const router = useRouter()
  const { currentWorkspace, isLoadingWorkspace, refreshWorkspace } = useWorkspace()
  
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form values
  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name)
      setSlug(currentWorkspace.slug)
    }
  }, [currentWorkspace])

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug === currentWorkspace?.slug) {
      setSlugAvailable(null)
      return
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3) {
      setSlugAvailable(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true)
      try {
        const response = await fetch(
          `http://localhost:3001/workspaces/slug/${slug}/available?excludeWorkspaceId=${currentWorkspace?.id}`,
          { credentials: 'include' }
        )
        const data = await response.json()
        setSlugAvailable(data.available)
      } catch (error) {
        console.error('Slug check failed:', error)
        setSlugAvailable(false)
      } finally {
        setIsCheckingSlug(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [slug, currentWorkspace?.slug, currentWorkspace?.id])

  // Track changes
  useEffect(() => {
    const changed = 
      name !== currentWorkspace?.name ||
      (slug !== currentWorkspace?.slug && slugAvailable === true)
    setHasChanges(changed)
  }, [name, slug, slugAvailable, currentWorkspace])

  const handleSave = async () => {
    if (!currentWorkspace?.id || !hasChanges) return

    setIsSaving(true)
    try {
      const response = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name !== currentWorkspace.name ? name : undefined,
            slug: slug !== currentWorkspace.slug ? slug : undefined,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Update failed')
      }

      toast.success(t('workspaceUpdated'))
      
      // If slug changed, redirect to new URL
      if (slug !== currentWorkspace.slug) {
        const locale = window.location.pathname.split('/')[1]
        router.push(`/${locale}/${slug}/settings/workspace`)
      } else {
        await refreshWorkspace(currentWorkspace.id)
      }
    } catch (error) {
      console.error('Workspace update failed:', error)
      toast.error(t('workspaceUpdateFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (currentWorkspace) {
      setName(currentWorkspace.name)
      setSlug(currentWorkspace.slug)
      setHasChanges(false)
    }
  }

  if (isLoadingWorkspace) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('workspaceTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('workspaceDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('workspaceInfo')}</CardTitle>
          <CardDescription>
            {t('workspaceInfoDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('workspaceName')}</Label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('workspaceNamePlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('workspaceNameDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('workspaceSlug')}</Label>
            <InputGroup>
              <InputGroupAddon>
                <span className="text-muted-foreground font-mono">@</span>
              </InputGroupAddon>
              <InputGroupInput 
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder={t('workspaceSlugPlaceholder')}
              />
              <InputGroupAddon align="inline-end">
                {isCheckingSlug && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!isCheckingSlug && slugAvailable === true && slug !== currentWorkspace?.slug && (
                  <IconCheck className="h-4 w-4 text-green-600" />
                )}
                {!isCheckingSlug && slugAvailable === false && slug !== currentWorkspace?.slug && (
                  <IconX className="h-4 w-4 text-red-600" />
                )}
              </InputGroupAddon>
            </InputGroup>
            <p className="text-xs text-muted-foreground">
              {slug === currentWorkspace?.slug && t('currentSlug')}
              {slug !== currentWorkspace?.slug && slugAvailable === true && (
                <span className="text-green-600">{t('slugAvailable')}</span>
              )}
              {slug !== currentWorkspace?.slug && slugAvailable === false && (
                <span className="text-red-600">{t('slugTaken')}</span>
              )}
              {slug !== currentWorkspace?.slug && slugAvailable === null && t('workspaceSlugDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('plan')}</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {currentWorkspace?.plan}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('planDesc')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!hasChanges || isSaving || (slug !== currentWorkspace?.slug && !slugAvailable)}>
              {isSaving ? t('saving') : t('saveChanges')}
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={!hasChanges || isSaving}>
              {t('cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('subscriptionPlan')}</CardTitle>
          <CardDescription>
            {t('subscriptionPlanDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('currentPlan')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('currentPlanDesc', { plan: currentWorkspace?.plan || 'FREE' })}
              </p>
            </div>
            <Badge variant="secondary" className="text-base">
              {currentWorkspace?.plan}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>{t('planLimits')}</Label>
            <div className="text-sm space-y-1">
              {(() => {
                const planType = currentWorkspace?.plan || 'FREE'
                // Ensure plan type is valid, fallback to FREE if not
                const plan: PlanType = PLAN_TYPES.includes(planType as PlanType) 
                  ? planType as PlanType 
                  : 'FREE'
                const limits = getPlanLimits(plan)
                const formatLimit = (value: number | undefined | null) => {
                  if (value === undefined || value === null) return 'N/A'
                  if (value === -1) return 'Unlimited'
                  if (value >= 1000) return value.toLocaleString()
                  return String(value)
                }
                return (
                  <>
                    <p className="text-muted-foreground">
                      • Max Brands: {formatLimit(limits?.maxBrands)}
                    </p>
                    <p className="text-muted-foreground">
                      • Max Members: {formatLimit(limits?.maxTeamMembers)}
                    </p>
                    <p className="text-muted-foreground">
                      • Monthly Posts: {formatLimit(limits?.maxMonthlyPosts)}
                    </p>
                  </>
                )
              })()}
            </div>
          </div>

          <Button disabled>{t('upgradePlan')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('regionalSettings')}</CardTitle>
          <CardDescription>
            {t('regionalSettingsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('timezone')}</Label>
            <Select defaultValue={currentWorkspace?.timezone || 'Europe/Istanbul'} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Istanbul">Europe/Istanbul (UTC+3)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('locale')}</Label>
            <Select value={currentWorkspace?.locale || 'tr-TR'} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tr-TR">Türkçe (Turkey)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('baseCurrency')}</Label>
            <Select defaultValue={currentWorkspace?.baseCurrency || 'TRY'} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRY">TRY (₺)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button disabled>{t('saveChanges')}</Button>
            <Button variant="outline" disabled>{t('cancel')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('workspaceMembers')}</CardTitle>
          <CardDescription>
            {t('workspaceMembersDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('totalMembers')}</p>
              <p className="text-2xl font-bold">{currentWorkspace?.memberCount || 0}</p>
            </div>
            <Button disabled>{t('manageMembers')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

