"use client"

import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import React, { useEffect, useState, useMemo, useCallback } from "react"
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/features/auth/context/auth-context"
import { apiCache } from "@/shared/api/cache"

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

function NavUserComponent() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("common")
  const { logout, user: authUser, loading: authLoading } = useAuth()
  const [avatarUrl, setAvatarUrl] = React.useState<string | null | undefined>(null)

  // Get avatarUrl from cache (getCurrentSession populates user:profile cache)
  // Only read from cache, never trigger API calls
  // This prevents re-renders when workspace changes or settings dialog opens
  // Use effect to read from cache only when userId changes, not on every render
  React.useEffect(() => {
    if (!authUser?.id) {
      setAvatarUrl(null);
      return;
    }

    // Read from cache without triggering fetch
    const cachedProfile = apiCache.get<{
      id: string;
      email: string;
      name: string | null;
      avatarUrl?: string | null;
    }>("user:profile", 30000); // 30 seconds TTL
    
    setAvatarUrl(cachedProfile?.avatarUrl ?? null);
  }, [authUser?.id]) // Only depend on userId, cache will update when getCurrentSession is called elsewhere

  // Memoize user data to prevent unnecessary re-renders
  // Use auth context user as primary source, enhance with avatarUrl from cache
  const user = useMemo(() => {
    if (!authUser) {
      return null;
    }
    return {
      name: authUser.name || null,
      email: authUser.email,
      avatarUrl: avatarUrl,
    };
  }, [authUser?.id, authUser?.name, authUser?.email, avatarUrl]) // Only depend on specific user fields

  // Memoize logout handler to prevent unnecessary re-renders
  const handleLogout = useCallback(async () => {
    await logout()
    const localePrefix = locale === "en" ? "" : `/${locale}`
    router.push(`${localePrefix}/login`)
  }, [logout, locale, router])

  // Show loading state while auth is loading
  if (authLoading || !user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="grid flex-1 text-left text-sm leading-tight gap-1">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const initials = getInitials(user.name, user.email)
  const displayName = user.name || user.email

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={displayName} />
                )}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={displayName} />
                  )}
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              {t("logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// Export component - memoization is handled internally via useMemo
export const NavUser = NavUserComponent
