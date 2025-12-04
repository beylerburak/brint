"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useWorkspace } from "@/contexts/workspace-context"
import { Skeleton } from "@/components/ui/skeleton"

export default function GeneralSettingsPage() {
  const t = useTranslations('settings')
  const { isLoadingWorkspace } = useWorkspace()

  if (isLoadingWorkspace) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('generalTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('generalDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('generalTitle')}</CardTitle>
          <CardDescription>
            {t('generalDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('generalComingSoon')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

