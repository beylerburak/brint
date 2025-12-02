'use client';

import { PanelLeftClose } from 'lucide-react';
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/animate-ui/components/radix/sidebar';
import { Button } from '@/components/ui/button';

export function SpaceSidebarHeader() {
  const { toggleSidebar, state } = useSidebar();

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <a href="#">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <img
                  src="/beyler-interactive-letter-logo-light.svg"
                  alt="Beyler Interactive Logo"
                  className="size-5"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-semibold">Agency Management</span>
                <span className="truncate text-[11px] text-muted-foreground">by Beyler Interactive</span>
              </div>
              {state === 'expanded' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSidebar();
                  }}
                >
                  <PanelLeftClose className="size-4" />
                  <span className="sr-only">Close sidebar</span>
                </Button>
              )}
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

