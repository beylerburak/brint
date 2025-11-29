import { Home, type LucideIcon } from "lucide-react";

export type NavigationContext = {
  locale: string;
  workspace: string | null;
  permissions: string[];
  subscriptionPlan: "FREE" | "PRO" | "ENTERPRISE" | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | null;
};

export type NavigationItem = {
  id: string;
  label: { en: string; tr: string };
  icon: LucideIcon;
  href: (ctx: NavigationContext) => string;
  show: (ctx: NavigationContext) => boolean;
};

export const sidebarNavigation: NavigationItem[] = [
  {
    id: "dashboard",
    label: { en: "Dashboard", tr: "Gösterge" },
    icon: Home,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/dashboard`,
    show: () => true,
  },
];
