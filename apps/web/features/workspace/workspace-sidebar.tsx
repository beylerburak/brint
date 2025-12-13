"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
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
import { NavMain, NavBrands, NavProjects, NavSecondary } from "@/features/workspace/workspace-nav-menu"
import { useWorkspace } from "@/contexts/workspace-context"
import { Skeleton } from "@/components/ui/skeleton"
import { buildWorkspaceUrl } from "@/lib/locale-path"

// Main AppSidebar Component
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, currentWorkspace, status, isLoadingUser, isLoadingWorkspace } = useWorkspace();
  
  // Guard: Don't render sidebar if workspace not ready
  if (status !== "READY" || !currentWorkspace) {
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="data-[slot=sidebar-menu-button]:!p-1.5">
                <IconInnerShadowTop className="!size-5" />
                <Skeleton className="h-4 w-32" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <div className="px-2 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </SidebarContent>
        <SidebarFooter>
          <Skeleton className="h-16 w-full" />
        </SidebarFooter>
      </Sidebar>
    )
  }

  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const workspaceSlug = params?.workspace as string

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              {currentWorkspace ? (
                <Link href={buildWorkspaceUrl(locale, workspaceSlug, "/home")}>
                  <IconInnerShadowTop className="!size-5" />
                  {isLoadingWorkspace ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    <span className="text-base font-semibold">
                      {currentWorkspace.name}
                    </span>
                  )}
                </Link>
              ) : (
                <div>
                  <IconInnerShadowTop className="!size-5" />
                  {isLoadingWorkspace ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    <span className="text-base font-semibold">
                      Loading...
                    </span>
                  )}
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        <NavBrands />
        <NavProjects />
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
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
