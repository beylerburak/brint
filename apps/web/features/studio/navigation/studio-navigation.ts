import { Share2, FileText, LayoutDashboard, type LucideIcon } from "lucide-react";

export type StudioNavigationContext = {
  locale: string;
  workspace: string | null;
  brand: string | null;
  permissions: string[];
};

export type StudioNavigationItem = {
  id: string;
  label: { en: string; tr: string };
  icon: LucideIcon;
  href: (ctx: StudioNavigationContext) => string;
  show: (ctx: StudioNavigationContext) => boolean;
};

export const studioNavigation: StudioNavigationItem[] = [
  {
    id: "dashboard",
    label: { en: "Dashboard", tr: "Gösterge" },
    icon: LayoutDashboard,
    href: (ctx) => ctx.brand 
      ? `/${ctx.locale}/${ctx.workspace}/studio/${ctx.brand}/dashboard`
      : `/${ctx.locale}/${ctx.workspace}/studio`,
    show: (ctx) => ctx.permissions.includes("studio:brand.view"),
  },
  {
    id: "socialAccounts",
    label: { en: "Social Accounts", tr: "Sosyal Hesaplar" },
    icon: Share2,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/studio/${ctx.brand}/social-accounts`,
    show: (ctx) => ctx.brand !== null && ctx.permissions.includes("studio:brand.view"),
  },
  {
    id: "content",
    label: { en: "Content", tr: "İçerik" },
    icon: FileText,
    href: (ctx) => `/${ctx.locale}/${ctx.workspace}/studio/${ctx.brand}/content`,
    show: (ctx) => ctx.brand !== null && ctx.permissions.includes("studio:brand.view"),
  },
];

