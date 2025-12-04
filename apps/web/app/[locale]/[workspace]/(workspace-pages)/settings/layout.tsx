"use client"

import { useTranslations } from "next-intl"
import { Separator } from "@/components/ui/separator"
import { SettingsNav } from "@/features/settings/settings-nav"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('settings')

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        <Separator />
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
          <aside className="lg:w-64 shrink-0">
            <SettingsNav />
          </aside>
          <div className="flex-1 max-w-3xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

