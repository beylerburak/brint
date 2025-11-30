"use client";

/**
 * Studio Navigation Items
 * 
 * Sidebar navigation links for the Studio layout.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Home,
  FileText,
  Calendar,
  Users,
  BadgeInfo,
  type LucideIcon,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/animate-ui/components/radix/sidebar";
import { buildWorkspaceRoute } from "@/features/space/constants";

interface StudioNavItem {
  hrefSuffix: string;
  label: string;
  icon: LucideIcon;
}

const STUDIO_NAV_ITEMS: StudioNavItem[] = [
  { hrefSuffix: "/home", label: "Home", icon: Home },
  { hrefSuffix: "/contents", label: "Contents", icon: FileText },
  { hrefSuffix: "/calendar", label: "Calendar", icon: Calendar },
  { hrefSuffix: "/social-accounts", label: "Social Accounts", icon: Users },
  { hrefSuffix: "/brand-profile", label: "Brand Profile", icon: BadgeInfo },
];

interface StudioNavItemsProps {
  workspaceSlug: string;
  brandSlug: string;
}

export function StudioNavItems({
  workspaceSlug,
  brandSlug,
}: StudioNavItemsProps) {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {STUDIO_NAV_ITEMS.map((item) => {
        const href = buildWorkspaceRoute(
          locale,
          workspaceSlug,
          `studio/${brandSlug}${item.hrefSuffix}`
        );
        const Icon = item.icon;
        
        // Check if current path matches this nav item
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <SidebarMenuItem key={item.hrefSuffix}>
            <SidebarMenuButton tooltip={item.label} isActive={isActive} asChild>
              <Link href={href}>
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

