"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";

import { studioNavigation, type StudioNavigationContext } from "@/features/studio/navigation/studio-navigation";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useBrand } from "@/features/brand/context/brand-context";
import { usePermissions } from "@/permissions";
import { NavUser } from "@/features/workspace/components/sidebar/nav-user";
import { BrandSwitcher } from "@/features/studio/components/studio-brand-swticher";
import { useBrands } from "@/features/studio/hooks/use-brands";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Settings, LifeBuoy, Building2, ArrowRight } from "lucide-react";
import { cn } from "@/shared/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function StudioSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const locale = useLocale();
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const { brand } = useBrand();
  const { permissions } = usePermissions();
  const t = useTranslations("common");

  const navCtx: StudioNavigationContext = {
    locale,
    workspace: workspace?.slug ?? null,
    brand: brand?.slug ?? null,
    permissions,
  };

  const { brands, loading: brandsLoading } = useBrands();
  const items = studioNavigation.filter((item) => item.show(navCtx));
  const secondaryItems = [
    {
      id: "preferences",
      label: t("preferences"),
      icon: Settings,
      href: "#",
    },
    {
      id: "support",
      label: t("support"),
      icon: LifeBuoy,
      href: "#",
    },
  ];

  // Show skeleton only on /studio root page (not on create-brand or brand pages)
  // Skeleton should show when loading brands OR when no brands exist on studio root
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const studioIndex = pathSegments.findIndex((seg) => seg === "studio");
  const isStudioRoot = studioIndex !== -1 && pathSegments.length === studioIndex + 1;
  const showSkeleton = isStudioRoot && (brandsLoading || (brands.length === 0 && !brand));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <BrandSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("menu")}</SidebarGroupLabel>
          <SidebarMenu>
            {showSkeleton ? (
              // Show skeleton when loading or no brands on studio root
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-28" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            ) : (
              items.map((item) => {
                const itemHref = item.href(navCtx);
                const isActive = pathname === itemHref || pathname.startsWith(itemHref + "/");
                const translatedLabel = item.label[locale as "en" | "tr"] ?? item.label.en;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "text-sidebar-foreground",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                      tooltip={translatedLabel}
                    >
                      <Link href={itemHref}>
                        <item.icon />
                        <span>{translatedLabel}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* Workspace Dashboard Card */}
        <div className="px-2 pb-2">
          <Link
            href={`/${locale}/${workspace?.slug}`}
            className="group relative flex items-center gap-3 rounded-lg border bg-sidebar-accent/50 p-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="flex flex-1 min-w-0 flex-col gap-0.5">
              <div className="font-medium truncate">
                {workspace?.name || `@${workspace?.slug}` || t("workspaceDashboard")}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {t("backToWorkspace") || "Back to workspace"}
              </div>
            </div>
            <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100 shrink-0" />
          </Link>
        </div>
        <SidebarMenu>
          {secondaryItems.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton asChild>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
