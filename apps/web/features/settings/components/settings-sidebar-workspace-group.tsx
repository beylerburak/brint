"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Settings as SettingsIcon, Users, Plug } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar"
import { SettingsSidebarNavItem } from "./settings-sidebar-nav-item"
import { useWorkspace } from "@/contexts/workspace-context"

interface SettingsSidebarWorkspaceGroupProps {
  activeItem: string | null
  onItemClick: (id: string) => void
}

export const SettingsSidebarWorkspaceGroup = React.memo<SettingsSidebarWorkspaceGroupProps>(
  ({ activeItem, onItemClick }) => {
    const t = useTranslations('settings.settingsModal')
    const { currentWorkspace } = useWorkspace()

    // Only show workspace group to ADMIN or OWNER
    const canManageWorkspace = React.useMemo(() => {
      if (!currentWorkspace) return false
      const role = currentWorkspace.userRole
      return role === 'ADMIN' || role === 'OWNER'
    }, [currentWorkspace])

    const workspaceItems = React.useMemo(() => [
      {
        id: 'general',
        name: t('general'),
        icon: SettingsIcon,
      },
      {
        id: 'members',
        name: t('members'),
        icon: Users,
      },
      {
        id: 'integrations',
        name: t('integrations'),
        icon: Plug,
      },
    ], [t])

    // Don't render workspace group if user doesn't have permission
    if (!canManageWorkspace) {
      return null
    }

    return (
      <SidebarGroup>
        <SidebarGroupLabel>{t('workspace')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {workspaceItems.map((item) => (
              <SettingsSidebarNavItem
                key={item.id}
                id={item.id}
                name={item.name}
                icon={item.icon}
                isActive={activeItem === item.id}
                onClick={onItemClick}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }
)

SettingsSidebarWorkspaceGroup.displayName = "SettingsSidebarWorkspaceGroup"
