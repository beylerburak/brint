"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { key: 'home', href: 'home' },
  { key: 'profile', href: 'profile' },
  { key: 'tasks', href: 'tasks' },
  { key: 'calendar', href: 'calendar' },
  { key: 'analytics', href: 'analytics' },
  { key: 'socialAccounts', href: 'social-accounts' },
  { key: 'publish', href: 'publish' },
] as const

export function BrandNavMenu() {
  const params = useParams()
  const pathname = usePathname()
  const t = useTranslations('brandNav')
  
  const locale = params?.locale as string || 'en'
  const workspaceSlug = params?.workspace as string
  const brandSlug = params?.brandSlug as string

  const isActive = (href: string) => {
    return pathname.endsWith(`/${href}`)
  }

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {NAV_ITEMS.map((item) => {
          const fullHref = `/${locale}/${workspaceSlug}/${brandSlug}/${item.href}`
          const active = isActive(item.href)
          
          return (
            <NavigationMenuItem key={item.key}>
              <NavigationMenuLink asChild>
                <Link 
                  href={fullHref}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    active && "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {t(item.key)}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

