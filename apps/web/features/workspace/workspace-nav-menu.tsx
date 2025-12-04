"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  IconCamera,
  IconChartBar,
  IconCirclePlusFilled,
  IconDashboard,
  IconDatabase,
  IconDots,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconListDetails,
  IconMail,
  IconReport,
  IconSearch,
  IconSettings,
  IconShare3,
  IconTrash,
  IconUsers,
  type Icon,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
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
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
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

// NavDocuments Component
export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: Icon
  }[]
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Documents</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="data-[state=open]:bg-accent rounded-sm"
                >
                  <IconDots />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-24 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <IconFolder />
                  <span>Open</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <IconShare3 />
                  <span>Share</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <IconTrash />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <IconDots className="text-sidebar-foreground/70" />
            <span>More</span>
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

