"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";

import { sidebarNavigation, type NavigationContext } from "@/features/workspace/navigation/navigation";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useBrand } from "@/features/brand/context/brand-context";
import { usePermissions } from "@/permissions";
import { useAuth } from "@/features/auth/context/auth-context";

export default function DebugNavigationPage() {
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const { brand } = useBrand();
  const { permissions } = usePermissions();
  const { isAuthenticated } = useAuth();

  const navCtx: NavigationContext = useMemo(
    () => ({
      locale,
      workspace: workspace?.slug ?? null,
      brand: brand?.slug ?? null,
      permissions,
      subscriptionPlan: null,
      role: null,
    }),
    [locale, workspace?.slug, brand?.slug, permissions]
  );

  const visibleItems = sidebarNavigation.filter((item) => item.show(navCtx));

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Debug Navigation</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Context</h2>
        <pre className="rounded bg-muted p-4 text-sm whitespace-pre-wrap">
{JSON.stringify({ isAuthenticated, navCtx }, null, 2)}
        </pre>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Sidebar Config</h2>
        <pre className="rounded bg-muted p-4 text-sm whitespace-pre-wrap">
{JSON.stringify(sidebarNavigation.map((i) => ({ id: i.id, label: i.label })), null, 2)}
        </pre>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Visible Items</h2>
        <pre className="rounded bg-muted p-4 text-sm whitespace-pre-wrap">
{JSON.stringify(visibleItems.map((i) => i.id), null, 2)}
        </pre>
      </section>
    </main>
  );
}
