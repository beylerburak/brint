import { Home, Wand2, Building2, Share2, FileText, type LucideIcon } from "lucide-react";

export type NavigationContext = {
  locale: string;
  workspace: string | null;
  brand: string | null;
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
    id: "studio",
    label: { en: "Brand Studio", tr: "Marka Stüdyo" },
    icon: Wand2,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/studio`,
    show: (ctx) => ctx.permissions.includes("studio:brand.view"),
  },
  {
    id: "dashboard",
    label: { en: "Dashboard", tr: "Gösterge" },
    icon: Home,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/dashboard`,
    show: () => true,
  },
  {
    id: "brands",
    label: { en: "Brands", tr: "Markalar" },
    icon: Building2,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/brands`,
    show: () => true,
  },
];
