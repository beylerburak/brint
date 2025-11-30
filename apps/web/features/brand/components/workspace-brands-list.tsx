"use client";

/**
 * Workspace Brands List
 * 
 * Displays brands in a table format using the generic BiDataTable component.
 * Includes a New Brand dialog that creates a draft brand and redirects to setup.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Briefcase, 
  Edit, 
  Archive, 
  Trash2, 
  Copy, 
  Calendar, 
  Hash, 
  Type, 
  CircleDot,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  BiDataTable, 
  type BiDataTableColumn,
  type BiDataTableAction,
  formatRelativeTime,
  formatFullDate,
} from "@/components/ui/bi-data-table";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useHasPermission, usePagePermissions } from "@/features/permissions/hooks/hooks";
import { useBrandList, useCreateBrand } from "../hooks";
import { buildWorkspaceRoute } from "@/features/space/constants";
import type { BrandSummary } from "../types";

// ============================================================================
// Helper Functions
// ============================================================================

function getBrandInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// ============================================================================
// Cell Components
// ============================================================================

function BrandCell({ brand }: { brand: BrandSummary }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        {brand.logoUrl && (
          <AvatarImage src={brand.logoUrl} alt={brand.name} />
        )}
        <AvatarFallback className="bg-muted text-xs">
          {brand.logoUrl ? getBrandInitials(brand.name) : (
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="font-medium">{brand.name}</span>
        <span className="text-sm text-muted-foreground">@{brand.slug}</span>
      </div>
    </div>
  );
}

function BrandStatusBadge({ brand }: { brand: BrandSummary }) {
  if (brand.isArchived) {
    return (
      <Badge variant="secondary" className="shrink-0 text-xs">
        Archived
      </Badge>
    );
  }
  
  if (brand.status === "DRAFT") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 text-xs bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
      >
        Draft
      </Badge>
    );
  }
  
  return (
    <Badge
      variant="outline"
      className="shrink-0 text-xs bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
    >
      Active
    </Badge>
  );
}

function BrandReadinessBadge({ score }: { score: number }) {
  const getReadinessColor = (readiness: number) => {
    if (readiness >= 80) {
      return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
    }
    if (readiness >= 50) {
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
    }
    return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700";
  };

  return (
    <Badge variant="outline" className={`text-xs ${getReadinessColor(score)}`}>
      {score}%
    </Badge>
  );
}

function CreatedAtCell({ createdAt }: { createdAt: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-muted-foreground cursor-help">
            {formatRelativeTime(createdAt)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatFullDate(createdAt)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Mobile Card Component
// ============================================================================

function BrandMobileCard({ brand }: { brand: BrandSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 bg-card text-left transition-colors hover:bg-accent/50 w-full cursor-pointer">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-10 w-10 shrink-0">
            {brand.logoUrl && (
              <AvatarImage src={brand.logoUrl} alt={brand.name} />
            )}
            <AvatarFallback className="bg-muted">
              {brand.logoUrl ? getBrandInitials(brand.name) : (
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-medium truncate">{brand.name}</span>
            <span className="text-xs text-muted-foreground truncate">@{brand.slug}</span>
          </div>
        </div>
        <BrandStatusBadge brand={brand} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          {brand.industry && (
            <span className="text-xs text-muted-foreground">{brand.industry}</span>
          )}
        </div>
        <BrandReadinessBadge score={brand.readinessScore} />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceBrandsList() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common");
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const { loading: permissionsLoading } = usePagePermissions();
  const canView = useHasPermission("studio:brand.view");
  const canCreate = useHasPermission("studio:brand.create");

  const { brands, loading, error, hasMore, loadMore, refresh } = useBrandList({
    limit: 20,
  });
  
  const { createBrand, loading: createLoading } = useCreateBrand();

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [newBrandDialogOpen, setNewBrandDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");

  // Get unique industries from brands for filter options
  const uniqueIndustries = React.useMemo(() => {
    const industries = new Set<string>();
    brands.forEach((brand) => {
      if (brand.industry) {
        industries.add(brand.industry);
      }
    });
    return Array.from(industries).sort();
  }, [brands]);

  // Column definitions
  const columns: BiDataTableColumn<BrandSummary>[] = React.useMemo(() => [
    { 
      id: "name", 
      label: t("brands.table.name") || "Brand", 
      type: "text", 
      icon: <Type className="h-4 w-4" />,
      width: "w-[300px]",
      accessorFn: (row) => row.name,
      cell: (row) => <BrandCell brand={row} />,
    },
    { 
      id: "industry", 
      label: t("brands.table.industry") || "Industry", 
      type: "select", 
      icon: <CircleDot className="h-4 w-4" />, 
      options: uniqueIndustries,
      accessorFn: (row) => row.industry || "",
      cell: (row) => row.industry ? (
        <span className="text-sm">{row.industry}</span>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
    },
    { 
      id: "readiness", 
      label: t("brands.table.readiness") || "Readiness", 
      type: "number", 
      icon: <Hash className="h-4 w-4" />,
      accessorFn: (row) => row.readinessScore,
      cell: (row) => <BrandReadinessBadge score={row.readinessScore} />,
    },
    { 
      id: "status", 
      label: t("brands.table.status") || "Status", 
      type: "select", 
      icon: <CircleDot className="h-4 w-4" />, 
      options: ["Active", "Draft", "Archived"],
      accessorFn: (row) => row.isArchived ? "Archived" : row.status === "DRAFT" ? "Draft" : "Active",
      cell: (row) => <BrandStatusBadge brand={row} />,
      sortValueFn: (row) => row.isArchived ? 2 : row.status === "DRAFT" ? 1 : 0,
    },
    { 
      id: "created", 
      label: t("brands.table.created") || "Created", 
      type: "date", 
      icon: <Calendar className="h-4 w-4" />,
      accessorFn: (row) => row.createdAt,
      cell: (row) => <CreatedAtCell createdAt={row.createdAt} />,
      sortValueFn: (row) => new Date(row.createdAt).getTime(),
    },
  ], [uniqueIndustries, t]);

  // Row actions
  const actions: BiDataTableAction<BrandSummary>[] = React.useMemo(() => [
    {
      label: "Edit",
      icon: <Edit className="mr-2 h-4 w-4" />,
      onClick: (brand) => {
        // TODO: Implement edit
        console.log("Edit brand:", brand.id);
      },
    },
    {
      label: "Duplicate",
      icon: <Copy className="mr-2 h-4 w-4" />,
      onClick: (brand) => {
        // TODO: Implement duplicate
        console.log("Duplicate brand:", brand.id);
      },
    },
    {
      label: "Archive",
      icon: <Archive className="mr-2 h-4 w-4" />,
      onClick: (brand) => {
        // TODO: Implement archive
        console.log("Archive brand:", brand.id);
      },
    },
    {
      label: "Delete",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: (brand) => {
        // TODO: Implement delete
        console.log("Delete brand:", brand.id);
      },
      destructive: true,
      separator: true,
    },
  ], []);

  // Handle row click - redirect to setup wizard for draft brands
  // NOTE: All hooks must be defined before any conditional returns
  const handleRowClick = useCallback((brand: BrandSummary) => {
    if (!workspace?.slug) return;
    
    // If brand is in DRAFT status and onboarding not completed, go to setup wizard
    if (brand.status === "DRAFT" && !brand.onboardingCompleted) {
      const setupPath = buildWorkspaceRoute(
        locale,
        workspace.slug,
        `brands/${brand.id}/setup`
      );
      router.push(setupPath);
      return;
    }
    
    // Otherwise go to studio brand page
    const brandDetailPath = buildWorkspaceRoute(
      locale,
      workspace.slug,
      `studio/${brand.slug}`
    );
    router.push(brandDetailPath);
  }, [locale, workspace?.slug, router]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, loadMore]);

  // Open new brand dialog
  const handleOpenNewBrandDialog = useCallback(() => {
    setNewBrandName("");
    setNewBrandDialogOpen(true);
  }, []);

  // Handle new brand creation
  const handleCreateNewBrand = useCallback(async () => {
    if (!workspace?.slug || !newBrandName.trim()) return;
    
    const result = await createBrand({ name: newBrandName.trim() });
    
    if (result) {
      setNewBrandDialogOpen(false);
      setNewBrandName("");
      
      // Redirect to setup wizard
      const setupPath = buildWorkspaceRoute(
        locale,
        workspace.slug,
        `brands/${result.id}/setup`
      );
      router.push(setupPath);
    }
  }, [workspace?.slug, newBrandName, createBrand, locale, router]);

  // Permission check - AFTER all hooks are defined
  if (!permissionsLoading && !canView) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 min-h-[400px]">
        <Briefcase className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">{t("accessDenied") || "Access Denied"}</h2>
          <p className="text-muted-foreground">
            {t("brands.noPermission") || "You don't have permission to view brands."}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px]">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          {t("tryAgain") || "Try again"}
        </Button>
      </div>
    );
  }

  // Empty state component
  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px] border rounded-lg border-dashed">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Briefcase className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">{t("brands.empty.title") || "No brands yet"}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("brands.empty.description") || "Create your first brand to start publishing content."}
        </p>
      </div>
      {canCreate && (
        <Button onClick={handleOpenNewBrandDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("brands.createFirst") || "Create your first brand"}
        </Button>
      )}
    </div>
  );

  // Toolbar right section
  const toolbarRight = canCreate ? (
    <Button onClick={handleOpenNewBrandDialog}>
      <Plus className="mr-2 h-4 w-4" />
      New Brand
    </Button>
  ) : null;

  return (
    <>
      <BiDataTable
        data={brands}
        columns={columns}
        getRowId={(brand) => brand.id}
        onRowClick={handleRowClick}
        actions={actions}
        searchPlaceholder="Search brands..."
        searchableColumns={["name", "industry"]}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        loadMoreLabel={t("loadMore") || "Load more"}
        loadingLabel={t("loading") || "Loading..."}
        toolbarRight={toolbarRight}
        emptyState={emptyState}
        mobileCard={(brand) => <BrandMobileCard brand={brand} />}
      />

      {/* New Brand Dialog */}
      <Dialog open={newBrandDialogOpen} onOpenChange={setNewBrandDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create New Brand
            </DialogTitle>
            <DialogDescription>
              Enter a name for your brand. You'll set up the rest in the next step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand Name</Label>
              <Input
                id="brand-name"
                placeholder="e.g., Acme Inc."
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBrandName.trim()) {
                    handleCreateNewBrand();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setNewBrandDialogOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewBrand}
              disabled={!newBrandName.trim() || createLoading}
            >
              {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
