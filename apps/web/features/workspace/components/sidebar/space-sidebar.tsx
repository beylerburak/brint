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
import { apiCache } from "@/shared/api/cache";
import type { SubscriptionSnapshot } from "@/shared/api/subscription";
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
    Array<{ id: string; slug: string; name?: string | null }>
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
            all.map((w) => ({ id: w.id, slug: w.slug, name: w.name }))
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

  const navCtx: NavigationContext = {
    locale,
    workspace: workspace?.slug ?? null,
    brand: brand?.slug ?? null,
    permissions,
    subscriptionPlan,
    role,
  };

  const items = sidebarNavigation.filter((item) => item.show(navCtx));
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

  // Get subscription plans for all workspaces from cache
  // Use useMemo to recalculate when availableWorkspaces, current subscription, or workspace changes
  const [prefetchTrigger, setPrefetchTrigger] = React.useState(0);
  
  // Listen for prefetch completion and subscription update events
  React.useEffect(() => {
    const handlePrefetch = () => {
      setPrefetchTrigger((prev) => prev + 1);
    };
    
    const handleSubscriptionUpdate = () => {
      setPrefetchTrigger((prev) => prev + 1);
    };
    
    window.addEventListener("subscriptions-prefetched", handlePrefetch);
    window.addEventListener("subscription-updated", handleSubscriptionUpdate);
    return () => {
      window.removeEventListener("subscriptions-prefetched", handlePrefetch);
      window.removeEventListener("subscription-updated", handleSubscriptionUpdate);
    };
  }, []);
  
  const workspacePlans = React.useMemo(() => {
    const plans = new Map<string, string>();
    
    availableWorkspaces.forEach((ws) => {
      const cached = apiCache.get<SubscriptionSnapshot | null>(
        `subscription:${ws.id}`,
        60000 // 60 seconds TTL
      );
      
      if (cached?.plan) {
        plans.set(ws.id, cached.plan);
      } else {
        // Default to FREE if not cached
        plans.set(ws.id, "FREE");
      }
    });
    
    return plans;
  }, [availableWorkspaces, subscriptionPlan, workspace?.id, prefetchTrigger]); // Recalculate when workspaces, current subscription, workspace changes, or prefetch completes

  // Format plan for display
  const formatPlan = (plan: string | undefined): string => {
    if (!plan) return "Free";
    const upperPlan = plan.toUpperCase();
    if (upperPlan === "FREE") return "Free";
    if (upperPlan === "PRO") return "Pro";
    if (upperPlan === "ENTERPRISE") return "Enterprise";
    return plan;
  };

  const teams =
    availableWorkspaces.length > 0
      ? availableWorkspaces.map((ws) => {
          const plan = workspacePlans.get(ws.id) ?? subscriptionPlan ?? "FREE";
          return {
            name: ws.name ? ws.name : `@${ws.slug}`,
            slug: ws.slug,
            logo: sidebarNavigation[0]?.icon,
            plan: formatPlan(plan),
          };
        })
      : workspace
        ? [
            {
              name: `@${workspace.slug}`,
              slug: workspace.slug,
              logo: sidebarNavigation[0]?.icon,
              plan: formatPlan(subscriptionPlan),
            },
          ]
        : [];

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

