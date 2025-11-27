"use client";

import * as React from "react";
import { useLocale } from "next-intl";

import { sidebarNavigation, type NavigationContext } from "@/app-config/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useBrand } from "@/contexts/brand-context";
import { usePermissions } from "@/permissions";
import { NavUser } from "@/components/sidebar/nav-user";
import { SpaceSwitcher } from "@/components/sidebar/space-switcher";
import { getCurrentSession } from "@/shared/api/auth";
import { getWorkspaceSubscription } from "@/shared/api/subscription";
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const { brand } = useBrand();
  const { permissions } = usePermissions();
  const { user } = useAuth();
  const t = useTranslations("common");

  const [role, setRole] = React.useState<NavigationContext["role"]>(null);
  const [subscriptionPlan, setSubscriptionPlan] =
    React.useState<NavigationContext["subscriptionPlan"]>(null);

  // Derive role and subscription from backend session + subscription endpoint
  React.useEffect(() => {
    if (!workspace?.slug) {
      setRole(null);
      setSubscriptionPlan(null);
      return;
    }

    const load = async () => {
      try {
        const session = await getCurrentSession();
        const ownerWs = session?.ownerWorkspaces?.find((w) => w.slug === workspace.slug);
        const memberWs = session?.memberWorkspaces?.find((w) => w.slug === workspace.slug);

        if (ownerWs) {
          setRole("OWNER");
          const sub = await getWorkspaceSubscription(ownerWs.id);
          if (sub?.plan) {
            setSubscriptionPlan(sub.plan);
          }
          return;
        }

        if (memberWs) {
          setRole("MEMBER");
          const sub = await getWorkspaceSubscription(memberWs.id);
          if (sub?.plan) {
            setSubscriptionPlan(sub.plan);
          }
          return;
        }

        setRole(null);
        setSubscriptionPlan(null);
      } catch (error) {
        console.warn("Failed to load navigation role/subscription", error);
        setRole(null);
        setSubscriptionPlan(null);
      }
    };

    load();
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

  const teams = workspace
    ? [
        {
          name: `@${workspace.slug}`,
          logo: sidebarNavigation[0]?.icon,
          plan: subscriptionPlan ?? "Free",
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
            {items.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton asChild tooltip={item.label[locale as "en" | "tr"] ?? item.label.en}>
                  <a href={item.href(navCtx)}>
                    <item.icon />
                    <span>{item.label[locale as "en" | "tr"] ?? item.label.en}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
