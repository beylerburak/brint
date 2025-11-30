"use client";

/**
 * Studio Sidebar
 * 
 * Full sidebar component for the Studio layout.
 * Includes brand switcher and navigation items.
 */

import Link from "next/link";
import { useLocale } from "next-intl";
import { ArrowLeft, Settings, HelpCircle } from "lucide-react";
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
        {/* Back to Workspace */}
        <SidebarGroup className="pb-0">
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
        </SidebarGroup>

        <SidebarSeparator />

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

