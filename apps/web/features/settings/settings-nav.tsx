"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { IconSettings, IconUserCircle, IconBuilding, IconPlug } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const settingsNavItems = [
  {
    titleKey: "general",
    href: "/settings/general",
    icon: IconSettings,
  },
  {
    titleKey: "profile",
    href: "/settings/profile",
    icon: IconUserCircle,
  },
  {
    titleKey: "workspace",
    href: "/settings/workspace",
    icon: IconBuilding,
  },
  {
    titleKey: "integrations",
    href: "/settings/integrations",
    icon: IconPlug,
  },
]

export function SettingsNav() {
  const pathname = usePathname()
  const params = useParams()
  const t = useTranslations('settings')
  const workspaceSlug = params?.workspace as string
  const locale = params?.locale as string

  return (
    <nav className="flex flex-col gap-1">
      {settingsNavItems.map((item) => {
        const fullHref = `/${locale}/${workspaceSlug}${item.href}`
        const isActive = pathname.endsWith(item.href)
        
        return (
          <Link
            key={item.href}
            href={fullHref}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className={cn("size-5", isActive && "stroke-[2.5]")} />
            <span>{t(item.titleKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

