"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Bell, User, Sliders } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar"
import { SettingsSidebarNavItem } from "./settings-sidebar-nav-item"
import { useWorkspace } from "@/contexts/workspace-context"

interface SettingsSidebarAccountGroupProps {
  activeItem: string | null
  onItemClick: (id: string) => void
}

export const SettingsSidebarAccountGroup = React.memo<SettingsSidebarAccountGroupProps>(
  ({ activeItem, onItemClick }) => {
    const t = useTranslations('settings.settingsModal')
    const { user } = useWorkspace()

    const accountItems = React.useMemo(() => [
      {
        id: 'user',
        name: user?.name || user?.email || 'User',
        icon: User,
        isUser: true,
      },
      {
        id: 'preferences',
        name: t('preferences'),
        icon: Sliders,
      },
      {
        id: 'notifications',
        name: t('notifications'),
        icon: Bell,
      },
    ], [user?.name, user?.email, t])

    const userAvatarUrl = React.useMemo(
      () => user?.avatarUrls?.small || user?.avatarUrls?.thumbnail || null,
      [user?.avatarUrls]
    )

    const userInitial = React.useMemo(
      () => (user?.name || user?.email || 'U').charAt(0).toUpperCase(),
      [user?.name, user?.email]
    )

    return (
      <SidebarGroup>
        <SidebarGroupLabel>{t('account')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {accountItems.map((item) => (
              <SettingsSidebarNavItem
                key={item.id}
                id={item.id}
                name={item.name}
                icon={item.icon}
                isActive={activeItem === item.id}
                onClick={onItemClick}
                isUser={item.isUser}
                userAvatarUrl={item.isUser ? userAvatarUrl : undefined}
                userInitial={item.isUser ? userInitial : undefined}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }
)

SettingsSidebarAccountGroup.displayName = "SettingsSidebarAccountGroup"
