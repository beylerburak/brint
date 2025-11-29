'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible';
import {
  Sidebar,
  SidebarContent,
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
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export const SpaceSidebar = () => {
  const locale = useLocale();
  const { workspace } = useWorkspace();

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

      <SpaceNavUser />
      <SidebarRail />
    </Sidebar>
  );
};

