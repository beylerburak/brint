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

import { WorkspaceBrandsList } from "@/features/brand/components/workspace-brands-list";
import { useBrandList } from "@/features/brand/hooks";
import { Badge } from "@/components/ui/badge";

export default function WorkspaceBrandsPage() {
  const { brands } = useBrandList({ limit: 20 });
  
  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Brands</h1>
          <Badge variant="secondary">{brands.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your brands and their information.
        </p>
      </div>
      <WorkspaceBrandsList />
    </div> 
  );
}