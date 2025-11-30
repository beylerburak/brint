"use client";

/**
 * Studio Sidebar
 * 
 * Full sidebar component for the Studio layout.
 * Includes brand switcher, quick actions, and navigation items.
 */

import Link from "next/link";
import { useLocale } from "next-intl";
import { ArrowLeft, Settings, HelpCircle, Command, Search } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarSeparator,
} from "@/components/animate-ui/components/radix/sidebar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { StudioBrandSwitcher } from "./studio-brand-switcher";
import { StudioNavItems } from "./studio-nav-items";
import { buildWorkspaceRoute } from "@/features/space/constants";
import type { BrandDetail } from "@/features/brand/types";

interface StudioSidebarProps {
  workspaceSlug: string;
  brand: BrandDetail;
}

export function StudioSidebar({ workspaceSlug, brand }: StudioSidebarProps) {
  const locale = useLocale();
  
  const workspaceHomeUrl = buildWorkspaceRoute(locale, workspaceSlug, "dashboard");
  const brandsListUrl = buildWorkspaceRoute(locale, workspaceSlug, "brands");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <StudioBrandSwitcher
          workspaceSlug={workspaceSlug}
          activeBrand={brand}
        />
      </SidebarHeader>

      <SidebarContent>
        {/* Quick Actions & Search */}
        <SidebarGroup className="pb-0">
          <div className="flex gap-2 group-data-[collapsible=icon]:flex-col">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-start gap-2 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
            >
              <Command className="size-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Quick actions</span>
              <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
            >
              <Search className="size-4 shrink-0" />
              <Kbd className="ml-1 group-data-[collapsible=icon]:hidden">/</Kbd>
            </Button>
          </div>
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup>
          <div className="flex items-center px-0">
            <SidebarGroupLabel className="uppercase text-muted-foreground/80 text-xs">
              Studio
            </SidebarGroupLabel>
            <div className="flex-1 h-px bg-border" />
          </div>
          <StudioNavItems
            workspaceSlug={workspaceSlug}
            brandSlug={brand.slug}
          />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Back to Workspace" asChild>
              <Link href={workspaceHomeUrl}>
                <ArrowLeft className="size-4" />
                <span>Back to Workspace</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Brand Settings" asChild>
              <Link
                href={buildWorkspaceRoute(
                  locale,
                  workspaceSlug,
                  `studio/${brand.slug}/brand-profile`
                )}
              >
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help & Support" asChild>
              <Link href={brandsListUrl}>
                <HelpCircle className="size-4" />
                <span>Help</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
