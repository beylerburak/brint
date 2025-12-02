"use client";

/**
 * Studio Sidebar
 * 
 * Full sidebar component for the Studio layout.
 * Includes brand switcher, quick actions, and navigation items.
 */

import Link from "next/link";
import { useLocale } from "next-intl";
import { ArrowLeft, Sliders, HelpCircle, Command, Search } from "lucide-react";
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
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
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
          <div className="flex gap-1.5 group-data-[collapsible=icon]:flex-col">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-start gap-1.5 px-2 text-xs group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
            >
              <Command className="size-3.5 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Quick actions</span>
              <Kbd className="ml-auto group-data-[collapsible=icon]:hidden text-[10px] px-1">⌘K</Kbd>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
            >
              <Search className="size-3.5 shrink-0" />
              <Kbd className="ml-1 group-data-[collapsible=icon]:hidden text-[10px] px-1">/</Kbd>
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
            <SettingsDialog defaultActiveItem="preferences">
              <SidebarMenuButton tooltip="Preferences">
                <Sliders className="size-4" />
                <span>Preferences</span>
              </SidebarMenuButton>
            </SettingsDialog>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help & Support" disabled>
              <HelpCircle className="size-4" />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
