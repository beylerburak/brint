"use client"

import * as React from "react"

import {
  Bell,
  Building2,
  CreditCard,
  FileText,
  HelpCircle,
  Link2,
  Plug,
  Settings,
  Share2,
  Shield,
  Sliders,
  User,
  Users,
  Zap,
} from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useAuth } from "@/features/auth/context/auth-context"
import { getUserProfile } from "@/features/workspace/api/user-api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

type NavItem = {
  id: string
  translationKey: string
  icon: React.ComponentType<{ className?: string }>
}

type NavGroup = {
  id: string
  translationKey: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: "account",
    translationKey: "settings.group.account",
    items: [
      {
        id: "userProfile",
        translationKey: "settings.account.userProfile",
        icon: User,
      },
      {
        id: "preferences",
        translationKey: "settings.account.preferences",
        icon: Sliders,
      },
      {
        id: "notifications",
        translationKey: "settings.account.notifications",
        icon: Bell,
      },
      {
        id: "connections",
        translationKey: "settings.account.connections",
        icon: Link2,
      },
    ],
  },
  {
    id: "workspace",
    translationKey: "settings.group.workspace",
    items: [
      {
        id: "general",
        translationKey: "settings.workspace.general",
        icon: Settings,
      },
      {
        id: "people",
        translationKey: "settings.workspace.people",
        icon: Users,
      },
      {
        id: "identity",
        translationKey: "settings.workspace.identity",
        icon: Shield,
      },
      {
        id: "subscription",
        translationKey: "settings.workspace.subscription",
        icon: CreditCard,
      },
      {
        id: "integrations",
        translationKey: "settings.workspace.integrations",
        icon: Plug,
      },
      {
        id: "supportTickets",
        translationKey: "settings.workspace.supportTickets",
        icon: HelpCircle,
      },
    ],
  },
  {
    id: "brand",
    translationKey: "settings.group.brand",
    items: [
      {
        id: "brandProfile",
        translationKey: "settings.brand.brandProfile",
        icon: Building2,
      },
      {
        id: "socialAccounts",
        translationKey: "settings.brand.socialAccounts",
        icon: Share2,
      },
      {
        id: "publishingRules",
        translationKey: "settings.brand.publishingRules",
        icon: FileText,
      },
      {
        id: "automationReporting",
        translationKey: "settings.brand.automationReporting",
        icon: Zap,
      },
      {
        id: "integrations",
        translationKey: "settings.brand.integrations",
        icon: Plug,
      },
    ],
  },
]

interface SettingsDialogProps {
  children: React.ReactNode
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

export function SettingsDialog({ children }: SettingsDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [activeItem, setActiveItem] = React.useState<string | null>(null)
  const t = useTranslations("common")
  const pathname = usePathname()
  const { user: authUser } = useAuth()
  const [profileUser, setProfileUser] = React.useState<{
    name: string | null
    email: string
    avatarUrl: string | null | undefined
  } | null>(null)

  // Check if we're on a brand studio page: /[locale]/[workspace]/studio/[brandslug]/*
  const isBrandStudioPage = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    const studioIndex = segments.findIndex((segment) => segment === "studio")
    if (studioIndex === -1) return false
    // Check if there's a segment after "studio" (the brand slug)
    return studioIndex + 1 < segments.length
  }, [pathname])

  // Filter nav groups to exclude brand group if not on brand studio page
  const visibleNavGroups = React.useMemo(() => {
    return navGroups.filter((group) => {
      if (group.id === "brand") {
        return isBrandStudioPage
      }
      return true
    })
  }, [isBrandStudioPage])

  React.useEffect(() => {
    if (!authUser) {
      setProfileUser(null)
      return
    }

    let cancelled = false

    const loadProfile = async () => {
      try {
        const profile = await getUserProfile()
        if (cancelled) return

        setProfileUser({
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
        })
      } catch (error) {
        if (!cancelled) {
          setProfileUser({
            name: authUser.name || null,
            email: authUser.email,
            avatarUrl: null,
          })
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [authUser])

  const user = profileUser || (authUser
    ? {
        name: authUser.name || null,
        email: authUser.email,
        avatarUrl: null,
      }
    : null)

  const initials = user ? getInitials(user.name, user.email) : ""
  const displayName = user?.name || user?.email || ""

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 w-[70vw] h-[85vh] max-w-none sm:max-w-none">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start h-full">
          <Sidebar collapsible="none" className="hidden md:flex h-full">
            <SidebarContent className="overflow-y-auto h-full pb-45">
              {visibleNavGroups.map((group) => (
                <SidebarGroup key={group.id}>
                  <SidebarGroupLabel>
                    {t(group.translationKey)}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        // Special rendering for User Profile item
                        if (item.id === "userProfile" && user) {
                          return (
                            <SidebarMenuItem key={item.id}>
                              <SidebarMenuButton
                                asChild
                                isActive={activeItem === item.id}
                                onClick={() => setActiveItem(item.id)}
                                size="lg"
                              >
                                <a href="#">
                                  <Avatar className="h-8 w-8 rounded-lg">
                                    {user.avatarUrl && (
                                      <AvatarImage src={user.avatarUrl} alt={displayName} />
                                    )}
                                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                                  </Avatar>
                                  <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{displayName}</span>
                                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                                  </div>
                                </a>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          )
                        }
                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              asChild
                              isActive={activeItem === item.id}
                              onClick={() => setActiveItem(item.id)}
                            >
                              <a href="#">
                                <item.icon />
                                <span>{t(item.translationKey)}</span>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </Sidebar>
          <main className="flex h-full flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">{t("settings.title")}</BreadcrumbLink>
                    </BreadcrumbItem>
                    {activeItem && (() => {
                      const group = visibleNavGroups.find((g) =>
                        g.items.some((item) => item.id === activeItem)
                      )
                      const item = group?.items.find((item) => item.id === activeItem)
                      if (!group || !item) return null
                      return (
                        <>
                          <BreadcrumbSeparator className="hidden md:block" />
                          <BreadcrumbItem>
                            <BreadcrumbPage>{t(item.translationKey)}</BreadcrumbPage>
                          </BreadcrumbItem>
                        </>
                      )
                    })()}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted/50 aspect-video rounded-xl"
                />
              ))}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

