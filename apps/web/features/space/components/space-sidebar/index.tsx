'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Settings, LifeBuoy } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/animate-ui/components/radix/sidebar';
import { SpaceSidebarHeader } from './space-sidebar-header';
import { SpaceNavUser } from './space-nav-user';
import { SPACE_NAV_ITEMS, buildWorkspaceRoute } from '@/features/space/constants';
import { useWorkspace } from '@/features/space/context/workspace-context';
import { SettingsDialog } from '@/features/settings';

export const SpaceSidebar = () => {
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const t = useTranslations('common');

  // Build navigation items with full routes
  const navItems = React.useMemo(() => {
    if (!workspace?.slug) return [];

    return SPACE_NAV_ITEMS.map((item) => ({
      title: item.title,
      url: buildWorkspaceRoute(locale, workspace.slug, item.route),
      icon: item.icon,
      isActive: item.isActive,
      items: item.items?.map((subItem) => ({
        title: subItem.title,
        url: buildWorkspaceRoute(locale, workspace.slug, subItem.route),
      })),
    }));
  }, [locale, workspace?.slug]);

  // Memoize secondary items (they don't change)
  const secondaryItems = React.useMemo(() => [
    {
      id: 'preferences',
      label: t('preferences'),
      icon: Settings,
      href: '#',
    },
    {
      id: 'support',
      label: t('support'),
      icon: LifeBuoy,
      href: '#',
    },
  ], [t]);

  return (
    <Sidebar collapsible="icon">
      <SpaceSidebarHeader />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              // If item has subitems, render as collapsible
              if (item.items && item.items.length > 0) {
                return (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={item.isActive}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title} asChild>
                          <Link href={item.url}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                          </Link>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              }

              // If no subitems, render as simple link
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton tooltip={item.title} asChild>
                    <Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
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
            if (item.id === 'preferences') {
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
        <SpaceNavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

