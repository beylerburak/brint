"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";

import { sidebarNavigation, type NavigationContext } from "@/features/workspace/navigation/navigation";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useBrand } from "@/features/brand/context/brand-context";
import { usePermissions } from "@/permissions";
import { useSubscription } from "@/features/subscription";
import { NavUser } from "@/features/workspace/components/sidebar/nav-user";
import { SpaceSwitcher } from "@/features/workspace/components/sidebar/space-switcher";
import { getCurrentSession } from "@/features/auth/api/auth-api";
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
import { useTranslations } from "next-intl";
import { Settings, LifeBuoy } from "lucide-react";
import { cn } from "@/shared/utils";
import { SettingsDialog } from "@/features/settings";

// Memoized navigation menu item to prevent unnecessary re-renders
const NavMenuItem = React.memo<{
  itemId: string;
  href: string;
  isActive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}>(({ itemId, href, isActive, icon: Icon, label }) => {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={cn(
          "text-sidebar-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
        tooltip={label}
      >
        <Link href={href}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});
NavMenuItem.displayName = "NavMenuItem";

export function SpaceSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const locale = useLocale();
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const { brand } = useBrand();
  const { permissions } = usePermissions();
  const t = useTranslations("common");

  const { plan: subscriptionPlan } = useSubscription();
  const [role, setRole] = React.useState<NavigationContext["role"]>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = React.useState<
    Array<{
      id: string;
      slug: string;
      name?: string | null;
      subscription?: { plan: string; status: string; renewsAt: string | null } | null;
    }>
  >([]);

  // Derive role from backend session
  React.useEffect(() => {
    if (!workspace?.slug) {
      setRole(null);
      setAvailableWorkspaces([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        // getCurrentSession now uses global cache, so no need for local cache
        const session = await getCurrentSession();

        if (cancelled) return;

        if (session) {
          const all = [
            ...(session.ownerWorkspaces ?? []),
            ...(session.memberWorkspaces ?? []),
          ];
          setAvailableWorkspaces(
            all.map((w) => ({
              id: w.id,
              slug: w.slug,
              name: w.name,
              subscription: w.subscription,
            }))
          );
        } else {
          setAvailableWorkspaces([]);
        }

        if (cancelled) return;

        const ownerWs = session?.ownerWorkspaces?.find((w) => w.slug === workspace.slug);
        const memberWs = session?.memberWorkspaces?.find((w) => w.slug === workspace.slug);

        if (ownerWs) {
          setRole("OWNER");
          return;
        }

        if (memberWs) {
          setRole("MEMBER");
          return;
        }

        if (!cancelled) {
          setRole(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load navigation role", error);
          setRole(null);
          setAvailableWorkspaces([]);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [workspace?.slug]);

  // Memoize navigation context to prevent unnecessary re-renders
  const navCtx: NavigationContext = React.useMemo(() => ({
    locale,
    workspace: workspace?.slug ?? null,
    brand: brand?.slug ?? null,
    permissions,
    subscriptionPlan,
    role,
  }), [locale, workspace?.slug, brand?.slug, permissions, subscriptionPlan, role]);

  // Memoize filtered navigation items
  const items = React.useMemo(
    () => sidebarNavigation.filter((item) => item.show(navCtx)),
    [navCtx]
  );

  // Memoize secondary items (they don't change)
  const secondaryItems = React.useMemo(() => [
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
  ], [t]);

  // Format plan for display (memoized function)
  const formatPlan = React.useCallback((plan: string | undefined): string => {
    if (!plan) return "Free";
    const upperPlan = plan.toUpperCase();
    if (upperPlan === "FREE") return "Free";
    if (upperPlan === "PRO") return "Pro";
    if (upperPlan === "ENTERPRISE") return "Enterprise";
    return plan;
  }, []);

  // Memoize teams array - only recalculate when workspaces or subscription changes
  const teams = React.useMemo(() => {
    if (availableWorkspaces.length > 0) {
      return availableWorkspaces.map((ws) => {
        // Get plan from workspace subscription (from /auth/me) or fallback to current subscription or FREE
        const plan = ws.subscription?.plan ?? subscriptionPlan ?? "FREE";
        return {
          name: ws.name ? ws.name : `@${ws.slug}`,
          slug: ws.slug,
          logo: sidebarNavigation[0]?.icon,
          plan: formatPlan(plan),
        };
      });
    }
    if (workspace) {
      return [
        {
          name: `@${workspace.slug}`,
          slug: workspace.slug,
          logo: sidebarNavigation[0]?.icon,
          plan: formatPlan(subscriptionPlan),
        },
      ];
    }
    return [];
  }, [availableWorkspaces, workspace?.slug, subscriptionPlan, formatPlan]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SpaceSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("menu")}</SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => {
              const itemHref = item.href(navCtx);
              const isActive = pathname === itemHref || pathname.startsWith(itemHref + "/");
              const translatedLabel = item.label[locale as "en" | "tr"] ?? item.label.en;
              // Memoize each menu item to prevent unnecessary re-renders
              return (
                <NavMenuItem
                  key={item.id}
                  itemId={item.id}
                  href={itemHref}
                  isActive={isActive}
                  icon={item.icon}
                  label={translatedLabel}
                />
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {secondaryItems.map((item) => {
            if (item.id === "preferences") {
              return (
                <SidebarMenuItem key={item.id}>
                  <SettingsDialog>
                    <SidebarMenuButton asChild>
                      <button type="button" className="w-full">
                        <item.icon />
                        <span>{item.label}</span>
                      </button>
                    </SidebarMenuButton>
                  </SettingsDialog>
                </SidebarMenuItem>
              );
            }
            return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton asChild>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

