"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/animate-ui/components/radix/sidebar";
import { locales } from "@/shared/i18n/locales";
import { RealtimeStatusBadge } from "./realtime-status-badge";

function getPageTitle(pathname: string, workspace: string): string {
  const segments = pathname.split("/").filter(Boolean);
  
  // Determine if first segment is locale
  const firstSegment = segments[0];
  const firstIsLocale = (locales as readonly string[]).includes(firstSegment);
  
  // Calculate workspace index: 0 if no locale, 1 if locale exists
  const workspaceIndex = firstIsLocale ? 1 : 0;
  
  // Get segments after workspace
  const workspaceSegments = segments.slice(workspaceIndex + 1);
  
  // If no segments (workspace root), return Dashboard
  if (workspaceSegments.length === 0) {
    return "Dashboard";
  }
  
  // Get the last segment as page title
  const lastSegment = workspaceSegments[workspaceSegments.length - 1];
  
  // Format label - capitalize first letter of each word
  return lastSegment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface SpaceHeaderAltProps {
  workspace: string;
}

/**
 * Alternative header component for workspace layout
 * 
 * This is an alternative design to SpaceHeader that can be used
 * for testing different header layouts without breaking the structure.
 */
export function SpaceHeaderAlt({ workspace }: SpaceHeaderAltProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, workspace);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base text-foreground font-medium">{pageTitle}</h1>
      </div>
      <div className="flex items-center px-4">
        <RealtimeStatusBadge />
      </div>
    </header>
  );
}

