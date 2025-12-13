"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar"
import { SettingsSidebarAccountGroup } from "./settings-sidebar-account-group"
import { SettingsSidebarWorkspaceGroup } from "./settings-sidebar-workspace-group"

interface SettingsSidebarProps {
  activeItem: string | null
  onItemClick: (id: string) => void
}

export const SettingsSidebar = React.memo<SettingsSidebarProps>(
  ({ activeItem, onItemClick }) => {
    return (
      <Sidebar collapsible="none" className="hidden md:flex">
        <SidebarContent>
          <SettingsSidebarAccountGroup
            activeItem={activeItem}
            onItemClick={onItemClick}
          />
          <SettingsSidebarWorkspaceGroup
            activeItem={activeItem}
            onItemClick={onItemClick}
          />
        </SidebarContent>
      </Sidebar>
    )
  }
)

SettingsSidebar.displayName = "SettingsSidebar"
