"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface SettingsSidebarNavItemProps {
  id: string
  name: string
  icon: LucideIcon
  isActive: boolean
  onClick: (id: string) => void
  isUser?: boolean
  userAvatarUrl?: string | null
  userInitial?: string
}

export const SettingsSidebarNavItem = React.memo<SettingsSidebarNavItemProps>(
  ({ id, name, icon: Icon, isActive, onClick, isUser, userAvatarUrl, userInitial }) => {
    const handleClick = React.useCallback(() => {
      onClick(id)
    }, [id, onClick])

    return (
      <SidebarMenuItem>
        <SidebarMenuButton onClick={handleClick} isActive={isActive}>
          {isUser ? (
            <>
              <Avatar className="size-5">
                <AvatarImage src={userAvatarUrl || undefined} />
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
              <span>{name}</span>
            </>
          ) : (
            <>
              <Icon />
              <span>{name}</span>
            </>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }
)

SettingsSidebarNavItem.displayName = "SettingsSidebarNavItem"
