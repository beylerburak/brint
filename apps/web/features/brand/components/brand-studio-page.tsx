"use client";

/**
 * Brand Studio Page
 * 
 * Main page component for brand management in the workspace.
 */

import { useState } from "react";
import { Plus, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHasPermission, usePagePermissions } from "@/features/permissions/hooks/hooks";
import { useBrandList, useArchiveBrand } from "../hooks";
import { BrandListTable } from "./brand-list-table";
import { BrandWizard } from "./brand-wizard";
import type { BrandSummary } from "../types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Brand Studio Page - Lists all brands for the workspace
 */
export function BrandStudioPage() {
  const { permissions, loading: permissionsLoading } = usePagePermissions();
  const canView = useHasPermission("studio:brand.view");
  const canCreate = useHasPermission("studio:brand.create");
  
  const { brands, loading, error, refresh } = useBrandList();
  
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandSummary | null>(null);
  const [archivingBrand, setArchivingBrand] = useState<BrandSummary | null>(null);

  // Permission check
  if (!permissionsLoading && !canView) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <Palette className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            You don&apos;t have permission to view brands.
          </p>
        </div>
      </div>
    );
  }

  const handleEdit = (brand: BrandSummary) => {
    setEditingBrand(brand);
    setWizardOpen(true);
  };

  const handleArchive = (brand: BrandSummary) => {
    setArchivingBrand(brand);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    setEditingBrand(null);
  };

  const handleWizardSuccess = () => {
    handleWizardClose();
    refresh();
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Brand Studio</h1>
          <p className="text-muted-foreground">
            Manage your brands and their settings
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Brand
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button variant="outline" size="sm" onClick={refresh} className="mt-2">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && brands.length === 0 && (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Palette className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>No brands yet</CardTitle>
            <CardDescription>
              Create your first brand to start publishing content
            </CardDescription>
          </CardHeader>
          {canCreate && (
            <CardContent className="flex justify-center pb-6">
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first brand
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Brand list */}
      {(loading || brands.length > 0) && (
        <BrandListTable
          brands={brands}
          loading={loading}
          onEdit={handleEdit}
          onArchive={handleArchive}
        />
      )}

      {/* Brand Wizard */}
      <BrandWizard
        open={wizardOpen}
        brand={editingBrand}
        onClose={handleWizardClose}
        onSuccess={handleWizardSuccess}
      />

      {/* Archive Confirmation Dialog */}
      <ArchiveConfirmDialog
        brand={archivingBrand}
        onClose={() => setArchivingBrand(null)}
        onSuccess={() => {
          setArchivingBrand(null);
          refresh();
        }}
      />
    </div>
  );
}

// ============================================================================
// Archive Confirmation Dialog
// ============================================================================

interface ArchiveConfirmDialogProps {
  brand: BrandSummary | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ArchiveConfirmDialog({ brand, onClose, onSuccess }: ArchiveConfirmDialogProps) {
  const { archiveBrand, loading } = useArchiveBrand(brand?.id || "");

  const handleConfirm = async () => {
    if (!brand) return;
    const success = await archiveBrand();
    if (success) {
      onSuccess();
    }
  };

  return (
    <AlertDialog open={!!brand} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Brand</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to archive &quot;{brand?.name}&quot;? This will hide the brand
            from the active list, but you can restore it later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

