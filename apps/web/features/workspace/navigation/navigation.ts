import { Home, Settings, Wand2, Building2, Users, Share2, FileText, type LucideIcon } from "lucide-react";

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
    id: "dashboard",
    label: { en: "Dashboard", tr: "Gösterge" },
    icon: Home,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/dashboard`,
    show: () => true,
  },
  {
    id: "studio",
    label: { en: "Brand Studio", tr: "Marka Stüdyo" },
    icon: Wand2,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/studio`,
    show: (ctx) => ctx.permissions.includes("studio:brand.view"),
  },
  {
    id: "brands",
    label: { en: "Brands", tr: "Markalar" },
    icon: Building2,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/brands`,
    show: () => true,
  },
  {
    id: "members",
    label: { en: "Members", tr: "Üyeler" },
    icon: Users,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/members`,
    show: (ctx) => ctx.role === "OWNER" || ctx.role === "ADMIN",
  },
  {
    id: "workspaceSettings",
    label: { en: "Workspace Settings", tr: "Workspace Ayarları" },
    icon: Settings,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/settings`,
    show: (ctx) => ctx.role === "OWNER",
  },
];
