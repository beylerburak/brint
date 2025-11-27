"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Building2 } from "lucide-react";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useBrands } from "@/features/studio/hooks/use-brands";
import { CreateBrandDialog } from "@/features/studio/components/create-brand-dialog";

export function WorkspaceStudioPage() {
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const { brands, loading, error } = useBrands();

  // Empty state - no brands
  if (!loading && brands.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-8 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">Create your first brand</h1>
            <p className="text-muted-foreground">
              Brands help you organize your content and social accounts. Get started by creating your first brand.
            </p>
          </div>
          <CreateBrandDialog />
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  // Brands list (when brands exist)
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Brand Studio</h1>
        <p className="text-muted-foreground">
          Manage your workspace brands
        </p>
      </div>
      {/* Brand list will be implemented here */}
    </div>
  );
}

