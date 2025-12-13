"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useLocale } from "next-intl"
import { Sun, Moon, Monitor, Settings, LogOut } from "lucide-react"
import {
  IconCreditCard,
  IconDotsVertical,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { buildLoginUrl, getLocaleFromPathnameOrParams } from "@/lib/locale-path"
import { apiClient } from "@/lib/api-client"
import { useSettingsModal } from "@/stores/use-settings-modal"
import { useWorkspace } from "@/contexts/workspace-context"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function getAvatarUrl(user: any) {
  // Use presigned URLs from backend
  if (user?.avatarUrls?.thumbnail) {
    return user.avatarUrls.thumbnail
  }
  return user?.avatar || undefined
}

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
    avatarUrls?: {
      thumbnail: string | null
      small: string | null
      medium: string | null
      large: string | null
    } | null
    avatarMediaId?: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const currentLocale = getLocaleFromPathnameOrParams(undefined, params as { locale?: string }) || locale
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { openWithItem } = useSettingsModal()
  const { theme, setTheme } = useTheme()
  const { user: workspaceUser, refreshUser } = useWorkspace()
  const [mounted, setMounted] = useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await apiClient.logout()
      toast.success("Logged out successfully")
      router.push(buildLoginUrl(currentLocale))
    } catch (error) {
      console.error("Logout failed:", error)
      toast.error("Failed to logout")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    if (!mounted || !workspaceUser) return
    
    try {
      setTheme(newTheme)
      await apiClient.updateMySettings({
        ui: { theme: newTheme },
      })
      await refreshUser()
    } catch (error) {
      console.error('Failed to update theme:', error)
      // Revert on error
      const currentTheme = workspaceUser.settings?.ui?.theme || 'system'
      setTheme(currentTheme as 'light' | 'dark' | 'system')
    }
  }

  const currentTheme = mounted ? (theme || workspaceUser?.settings?.ui?.theme || 'system') : 'system'

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
                <AvatarImage src={getAvatarUrl(user)} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
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
          <AvatarImage 
            src={getAvatarUrl(user)} 
            alt={user.name || 'User'} 
          />
          <AvatarFallback className="rounded-lg">
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Theme Switcher */}
            <div className="px-2 py-2">
              <ToggleGroup 
                type="single" 
                value={currentTheme}
                onValueChange={(value) => {
                  if (value && (value === 'light' || value === 'dark' || value === 'system')) {
                    handleThemeChange(value)
                  }
                }}
                variant="outline"
                spacing={0}
                className="grid grid-cols-3 w-full"
              >
                <ToggleGroupItem 
                  value="light" 
                  aria-label="Light mode"
                  className="flex-1"
                >
                  <Sun className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="dark" 
                  aria-label="Dark mode"
                  className="flex-1"
                >
                  <Moon className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="system" 
                  aria-label="System theme"
                  className="flex-1"
                >
                  <Monitor className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <DropdownMenuSeparator />
            
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => openWithItem('user')}>
                <IconUserCircle />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openWithItem('general')}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
              <LogOut className="size-4" />
              {isLoggingOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
