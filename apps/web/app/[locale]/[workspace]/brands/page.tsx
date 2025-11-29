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

export default function WorkspaceBrandsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <WorkspaceBrandsList />
    </div>
  );
}

