import {
  Home,
  Building2,
  Wand2,
  Settings2,
  Users,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';

export interface SpaceNavItem {
  title: string;
  route: string; // Route path without locale/workspace prefix (e.g., 'dashboard', 'settings')
  icon: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    route: string;
  }[];
}

/**
 * Space sidebar navigation menu items.
 * Routes are relative to workspace (e.g., 'dashboard' becomes '/{locale}/{workspace}/dashboard').
 */
export const SPACE_NAV_ITEMS: SpaceNavItem[] = [
  {
    title: 'Dashboard',
    route: 'dashboard',
    icon: Home,
    isActive: true,
  },
  {
    title: 'Brands',
    route: 'brands',
    icon: Building2,
  },
  {
    title: 'Studio',
    route: 'studio',
    icon: Wand2,
  },
  {
    title: 'Members',
    route: 'members',
    icon: Users,
  },
  {
    title: 'Settings',
    route: 'settings',
    icon: Settings2,
    items: [
      {
        title: 'General',
        route: 'settings',
      },
      {
        title: 'Team',
        route: 'settings/team',
      },
      {
        title: 'Billing',
        route: 'settings/billing',
      },
    ],
  },
  {
    title: 'Playground',
    route: 'playground',
    icon: SquareTerminal,
  },
];

/**
 * Builds a full route path for a workspace route.
 * @param locale - Locale string (e.g., 'en', 'tr')
 * @param workspaceSlug - Workspace slug
 * @param route - Route path relative to workspace (e.g., 'dashboard', 'settings')
 * @returns Full route path (e.g., '/en/workspace-slug/dashboard' or '/workspace-slug/dashboard' for 'en')
 */
export function buildWorkspaceRoute(
  locale: string,
  workspaceSlug: string,
  route: string
): string {
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  return `${localePrefix}/${workspaceSlug}/${route}`;
}

