"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/animate-ui/components/radix/sidebar";
import { usePageHeaderContext } from "../context/page-header-context";
import { RealtimeStatusBadge } from "./realtime-status-badge";

/**
 * Unified page header component that combines:
 * - Layout header (sidebar trigger)
 * - Page content header (title, description, badge, actions)
 * 
 * This component reads from PageHeaderContext, which is set by individual pages
 * using the usePageHeader hook.
 */
export function SpacePageHeader() {
  const { state, isMobile } = useSidebar();
  const { config } = usePageHeaderContext();
  const isCollapsed = state === "collapsed";
  
  // Show toggle when: mobile (always) or desktop with collapsed sidebar
  const showTrigger = isMobile || isCollapsed;

  // Don't render if no config is set
  if (!config) {
    return null;
  }

  return (
    <header className="flex shrink-0 flex-col gap-1 border-b bg-background px-4 py-3 transition-[height] ease-linear">
      {/* Top bar with sidebar trigger */}
      <div className="flex items-center gap-2">
        {showTrigger && (
          <>
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
          </>
        )}
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{config.title}</h1>
            {config.badge}
          </div>
          <div className="flex items-center gap-3">
            {config.actions}
            <RealtimeStatusBadge />
          </div>
        </div>
      </div>
      
      {/* Description row (if provided) */}
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
    </header>
  );
}

