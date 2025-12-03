"use client";

/**
 * Studio Layout Client Component
 * 
 * Client-side layout shell for the Studio.
 * Wraps children with sidebar provider and renders the studio sidebar.
 * 
 * Uses fixed positioning to overlay the workspace layout entirely,
 * providing a dedicated studio experience with its own sidebar.
 */

import { SidebarProvider, SidebarInset } from "@/components/animate-ui/components/radix/sidebar";
import { StudioSidebar } from "./studio-sidebar";
import { StudioPageHeader } from "./studio-page-header";
import { StudioBrandProvider } from "../context/studio-brand-context";
import { StudioPageHeaderProvider } from "../context/page-header-context";
import type { BrandDetail } from "@/features/brand/types";

interface StudioLayoutClientProps {
  children: React.ReactNode;
  workspaceSlug: string;
  brand: BrandDetail;
  refreshBrand: () => Promise<void>;
}

export function StudioLayoutClient({
  children,
  workspaceSlug,
  brand,
  refreshBrand,
}: StudioLayoutClientProps) {
  return (
    <div className="fixed inset-0 z-40 flex overflow-hidden bg-background">
      <StudioBrandProvider brand={brand} refreshBrand={refreshBrand}>
        <SidebarProvider className="!min-h-0 h-full min-w-0 overflow-hidden">
          <StudioSidebar workspaceSlug={workspaceSlug} brand={brand} />
          <SidebarInset className="!flex-col h-full min-w-0 overflow-hidden">
            <StudioPageHeaderProvider>
              <StudioPageHeader />
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                {children}
              </div>
            </StudioPageHeaderProvider>
          </SidebarInset>
        </SidebarProvider>
      </StudioBrandProvider>
    </div>
  );
}
