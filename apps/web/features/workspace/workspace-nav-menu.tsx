"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import {
  IconShieldCheck,
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
  IconUsers,
  type Icon,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { useSettingsModal } from "@/stores/use-settings-modal"

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
      icon: IconShieldCheck,
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
      url: "#",
      icon: IconSettings,
      isSettings: true,
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
            const isComingSoon = item.url === '#'
            return (
              <SidebarMenuItem key={item.title}>
                {isComingSoon ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          disabled
                          className="opacity-50 pointer-events-none cursor-not-allowed"
                          aria-disabled="true"
                          tabIndex={-1}
                        >
                          {item.icon && <item.icon />}
                          <span>{translatedTitle}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            Soon
                          </Badge>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Coming soon</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <SidebarMenuButton tooltip={translatedTitle} asChild>
                    <Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{translatedTitle}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
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
  
  // Store only brandSlug in state, fetch fresh data from API always
  const [pinnedBrandSlug, setPinnedBrandSlug] = React.useState<string | null>(null)
  const [brandData, setBrandData] = React.useState<{
    brandName: string;
    logoUrl: string | null;
  } | null>(null)

  // Always fetch fresh brand info from API (to get fresh presigned URLs)
  React.useEffect(() => {
    const fetchBrandInfo = async () => {
      if (!pinnedBrandSlug || !currentWorkspace?.id) {
        setBrandData(null)
        return
      }

      try {
        const response = await apiClient.listBrands(currentWorkspace.id)
        const brand = response.brands.find(b => b.slug === pinnedBrandSlug)
        if (brand) {
          setBrandData({
            brandName: brand.name,
            logoUrl: brand.logoUrl,
          })
        } else {
          // Brand not found, clear pinned brand
          setPinnedBrandSlug(null)
          setBrandData(null)
          if (typeof window !== 'undefined') {
            const key = `pinned-brand-${workspaceSlug}`
            localStorage.removeItem(key)
          }
        }
      } catch (error) {
        console.error('Failed to fetch brand info:', error)
        setBrandData(null)
      }
    }

    fetchBrandInfo()
  }, [pinnedBrandSlug, currentWorkspace?.id, workspaceSlug])

  const loadPinnedBrand = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      const key = `pinned-brand-${workspaceSlug}`
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Extract brandSlug from localStorage (support both old and new formats)
          // Old format: { brandSlug, brandName, logoUrl }
          // We only need brandSlug, logoUrl will be fetched fresh from API
          const slug = parsed.brandSlug || parsed.slug
          setPinnedBrandSlug(slug || null)
        } catch {
          // Invalid JSON, ignore
          setPinnedBrandSlug(null)
        }
      } else {
        setPinnedBrandSlug(null)
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
  if (!pinnedBrandSlug) {
    return null
  }

  const brandUrl = `/${locale}/${workspaceSlug}/${pinnedBrandSlug}/home`
  const displayName = brandData?.brandName || pinnedBrandSlug

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t('brands')}</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href={brandUrl} className="flex items-center gap-2">
              <Avatar className="h-5 w-5 rounded-md">
                <AvatarImage 
                  src={brandData?.logoUrl || undefined} 
                  alt={displayName}
                />
                <AvatarFallback className="rounded-md text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>@{pinnedBrandSlug}</span>
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
  const { setOpen } = useSettingsModal()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const translatedTitle = item.titleKey ? t(item.titleKey.split('.')[1]) : item.title
            const isComingSoon = item.url === '#'
            const isSettings = (item as any).isSettings === true
            
            if (isSettings) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => setOpen(true)}
                    tooltip={translatedTitle}
                  >
                    <item.icon />
                    <span>{translatedTitle}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }
            
            return (
              <SidebarMenuItem key={item.title}>
                {isComingSoon ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          disabled
                          className="opacity-50 pointer-events-none cursor-not-allowed"
                          aria-disabled="true"
                          tabIndex={-1}
                        >
                          <item.icon />
                          <span>{translatedTitle}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            Soon
                          </Badge>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Coming soon</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{translatedTitle}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

