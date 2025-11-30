"use client";

/**
 * Workspace Brands Page
 * 
 * Route: /[locale]/[workspace]/brands
 * 
 * Displays all brands accessible in the current workspace
 * using the same table pattern as the People section in Settings.
 * 
 * Clicking a row navigates to the brand detail page in Brand Studio.
 */

import { useMemo } from "react";
import { WorkspaceBrandsList } from "@/features/brand/components/workspace-brands-list";
import { useBrandList } from "@/features/brand/hooks";
import { usePageHeader } from "@/features/space/context/page-header-context";
import { Badge } from "@/components/ui/badge";

export default function WorkspaceBrandsPage() {
  const { brands } = useBrandList({ limit: 20 });
  
  const headerConfig = useMemo(() => ({
    title: "Brands",
    description: "Manage your brands and their information.",
    badge: <Badge variant="secondary">{brands.length}</Badge>,
  }), [brands.length]);

  usePageHeader(headerConfig);
  
  return (
    <div className="flex flex-1 flex-col p-4">
      <WorkspaceBrandsList />
    </div> 
  );
}
