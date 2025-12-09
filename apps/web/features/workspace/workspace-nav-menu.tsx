"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import {
  IconCamera,
  IconChartBar,
  IconCirclePlusFilled,
  IconDashboard,
  IconDots,
  IconFileAi,
  IconFileDescription,
  IconFolder,
  IconHelp,
  IconListDetails,
  IconMail,
  IconSearch,
  IconSettings,
  IconShare3,
  IconUsers,
  type Icon,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

// Navigation data structure
export const navigationData = {
  navMain: (workspaceSlug: string, locale: string) => [
    {
      title: "Home",
      titleKey: "nav.home", // Translation key
      url: `/${locale}/${workspaceSlug}/home`,
      icon: IconDashboard,
    },
    {
      title: "Brands",
      titleKey: "nav.brands",
      url: `/${locale}/${workspaceSlug}/brands`,
      icon: IconShare3,
    },
    {
      title: "Lifecycle",
      titleKey: "nav.lifecycle",
      url: "#",
      icon: IconListDetails,
    },
    {
      title: "Analytics",
      titleKey: "nav.analytics",
      url: "#",
      icon: IconChartBar,
    },
    {
      title: "Projects",
      titleKey: "nav.projects",
      url: "#",
      icon: IconFolder,
    },
    {
      title: "Team",
      titleKey: "nav.team",
      url: "#",
      icon: IconUsers,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: (workspaceSlug: string, locale: string) => [
    {
      title: "Settings",
      titleKey: "nav.settings",
      url: `/${locale}/${workspaceSlug}/settings`,
      icon: IconSettings,
    },
    {
      title: "Get Help",
      titleKey: "nav.help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      titleKey: "nav.search",
      url: "#",
      icon: IconSearch,
    },
  ],
  documents: [],
}

// NavMain Component
export function NavMain() {
  const params = useParams()
  const t = useTranslations('nav')
  const workspaceSlug = params?.workspace as string
  const locale = (params?.locale as string) || 'en'
  
  const items = navigationData.navMain(workspaceSlug, locale)

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip={t('quickCreate')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <IconCirclePlusFilled />
              <span>{t('quickCreate')}</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <IconMail />
              <span className="sr-only">{t('inbox')}</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const translatedTitle = item.titleKey ? t(item.titleKey.split('.')[1]) : item.title
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={translatedTitle} asChild={item.url !== '#'}>
                  {item.url === '#' ? (
                    <>
                      {item.icon && <item.icon />}
                      <span>{translatedTitle}</span>
                    </>
                  ) : (
                    <Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{translatedTitle}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// NavBrands Component - Shows pinned brand or nothing
export function NavBrands() {
  const params = useParams()
  const t = useTranslations('nav')
  const { currentWorkspace } = useWorkspace()
  const workspaceSlug = params?.workspace as string
  const locale = (params?.locale as string) || 'en'
  
  // Get pinned brand from localStorage
  const [pinnedBrand, setPinnedBrand] = React.useState<{ 
    brandSlug: string; 
    brandName?: string;
    logoUrl?: string | null;
  } | null>(null)

  // Try to fetch fresh brand info if logoUrl is missing
  React.useEffect(() => {
    const fetchBrandInfo = async () => {
      if (!pinnedBrand || !currentWorkspace?.id || pinnedBrand.logoUrl !== undefined) {
        return
      }

      try {
        const response = await apiClient.listBrands(currentWorkspace.id)
        const brand = response.brands.find(b => b.slug === pinnedBrand.brandSlug)
        if (brand) {
          setPinnedBrand(prev => prev ? {
            ...prev,
            brandName: brand.name,
            logoUrl: brand.logoUrl,
          } : null)
        }
      } catch (error) {
        console.error('Failed to fetch brand info:', error)
      }
    }

    fetchBrandInfo()
  }, [pinnedBrand, currentWorkspace?.id])

  const loadPinnedBrand = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      const key = `pinned-brand-${workspaceSlug}`
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          setPinnedBrand(JSON.parse(stored))
        } catch {
          // Invalid JSON, ignore
          setPinnedBrand(null)
        }
      } else {
        setPinnedBrand(null)
      }
    }
  }, [workspaceSlug])

  React.useEffect(() => {
    loadPinnedBrand()
    
    // Listen for pin changes
    const handlePinChange = () => {
      loadPinnedBrand()
    }
    
    window.addEventListener('brand-pin-changed', handlePinChange)
    return () => {
      window.removeEventListener('brand-pin-changed', handlePinChange)
    }
  }, [loadPinnedBrand])

  // Don't render if no brand is pinned
  if (!pinnedBrand) {
    return null
  }

  const brandUrl = `/${locale}/${workspaceSlug}/${pinnedBrand.brandSlug}/home`
  const displayName = pinnedBrand.brandName || pinnedBrand.brandSlug

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t('brands')}</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href={brandUrl} className="flex items-center gap-2">
              <Avatar className="h-5 w-5 rounded-md">
                <AvatarImage 
                  src={pinnedBrand.logoUrl || undefined} 
                  alt={displayName}
                />
                <AvatarFallback className="rounded-md text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>@{pinnedBrand.brandSlug}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

// NavSecondary Component
export function NavSecondary({
  ...props
}: React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const params = useParams()
  const t = useTranslations('nav')
  const workspaceSlug = params?.workspace as string
  const locale = (params?.locale as string) || 'en'
  
  const items = navigationData.navSecondary(workspaceSlug, locale)

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const translatedTitle = item.titleKey ? t(item.titleKey.split('.')[1]) : item.title
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  {item.url === '#' ? (
                    <a href={item.url}>
                      <item.icon />
                      <span>{translatedTitle}</span>
                    </a>
                  ) : (
                    <Link href={item.url}>
                      <item.icon />
                      <span>{translatedTitle}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

