"use client"

import * as React from "react"
import { IconInnerShadowTop } from "@tabler/icons-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavUser } from "@/features/workspace/workspace-nav-user"
import { NavMain, NavBrands, NavSecondary } from "@/features/workspace/workspace-nav-menu"
import { useWorkspace } from "@/contexts/workspace-context"
import { Skeleton } from "@/components/ui/skeleton"

// Main AppSidebar Component
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, currentWorkspace, isLoadingUser, isLoadingWorkspace } = useWorkspace();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                {isLoadingWorkspace ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  <span className="text-base font-semibold">
                    {currentWorkspace?.name || 'Workspace'}
                  </span>
                )}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        <NavBrands />
        <NavSecondary className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {isLoadingUser ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : user ? (
          <NavUser 
            user={{
              name: user.name || user.email,
              email: user.email,
              avatar: "/avatars/default.jpg",
              avatarUrls: user.avatarUrls,
              avatarMediaId: user.avatarMediaId,
            }} 
          />
        ) : (
          <NavUser 
            user={{
              name: "Guest",
              email: "guest@example.com",
              avatar: "/avatars/default.jpg",
            }} 
          />
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
