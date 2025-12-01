"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/animate-ui/components/radix/sidebar";
import { useStudioPageHeaderConfig } from "../context/page-header-context";
import { RealtimeStatusBadge } from "./realtime-status-badge";

/**
 * Unified page header component for Studio that combines:
 * - Layout header (sidebar trigger)
 * - Page content header (title, description, badge, actions)
 * 
 * This component reads from StudioPageHeaderContext, which is set by individual pages
 * using the useStudioPageHeader hook.
 * 
 * If no config is set by a page, a minimal header with just the sidebar trigger
 * and realtime status badge is shown.
 */
export function StudioPageHeader() {
  const config = useStudioPageHeaderConfig();

  // Always render header - show minimal version if no config
  return (
    <header className="flex shrink-0 flex-col gap-1 border-b bg-background px-4 py-3 transition-[height] ease-linear">
      {/* Top bar with sidebar trigger */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        {config && (
          <>
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
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
          </>
        )}
        {!config && (
          <div className="flex flex-1 items-center justify-end">
            <RealtimeStatusBadge />
          </div>
        )}
      </div>
      
      {/* Description row (if provided) */}
      {config?.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
    </header>
  );
}
