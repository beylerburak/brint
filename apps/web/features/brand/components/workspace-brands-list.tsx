"use client";

/**
 * Workspace Brands List
 * 
 * Displays brands in a table format following the People table pattern
 * from settings-dialog.tsx (WorkspaceMembersTable).
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Briefcase, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useHasPermission, usePagePermissions } from "@/features/permissions/hooks/hooks";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useBrandList } from "../hooks";
import { buildWorkspaceRoute } from "@/features/space/constants";
import type { BrandSummary } from "../types";

/**
 * Get initials from brand name
 */
function getBrandInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Workspace Brands List - Table component for displaying brands
 * 
 * Uses the same visual pattern as the People section in settings-dialog.tsx
 */
export function WorkspaceBrandsList() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common");
  const { workspace } = useWorkspace();
  const { loading: permissionsLoading } = usePagePermissions();
  const canView = useHasPermission("studio:brand.view");
  const canCreate = useHasPermission("studio:brand.create");
  const isMobile = useIsMobile();

  const { brands, loading, error, hasMore, loadMore, refresh } = useBrandList({
    limit: 20,
  });

  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Permission check
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

  // Handle row click - navigate to brand detail page
  const handleRowClick = (brand: BrandSummary) => {
    if (!workspace?.slug) return;
    const brandDetailPath = buildWorkspaceRoute(
      locale,
      workspace.slug,
      `studio/brands/${brand.slug}`
    );
    router.push(brandDetailPath);
  };

  // Handle load more
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await loadMore();
    setIsLoadingMore(false);
  };

  // Navigate to create brand
  const handleCreateBrand = () => {
    if (!workspace?.slug) return;
    const createPath = buildWorkspaceRoute(locale, workspace.slug, "studio/brands");
    router.push(createPath);
  };

  // Loading state
  if (loading && brands.length === 0) {
    return <BrandsListSkeleton />;
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

  // Empty state
  if (brands.length === 0) {
    return (
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
          <Button onClick={handleCreateBrand}>
            <Plus className="mr-2 h-4 w-4" />
            {t("brands.createFirst") || "Create your first brand"}
          </Button>
        )}
      </div>
    );
  }

  // Mobile card view - follows WorkspaceMembersTable mobile pattern
  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        {brands.map((brand) => (
          <button
            key={brand.id}
            onClick={() => handleRowClick(brand)}
            className="flex flex-col gap-3 rounded-lg border p-3 bg-card text-left transition-colors hover:bg-accent/50"
          >
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
              <BrandStatusBadge isArchived={brand.isArchived} />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                {brand.industry && (
                  <span className="text-xs text-muted-foreground">{brand.industry}</span>
                )}
              </div>
              <BrandReadinessBadge score={brand.readinessScore} />
            </div>
          </button>
        ))}

        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("loading") || "Loading..."}
                </>
              ) : (
                t("loadMore") || "Load more"
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Desktop table view - follows WorkspaceMembersTable pattern
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">{t("brands.table.name") || "Brand"}</TableHead>
              <TableHead>{t("brands.table.industry") || "Industry"}</TableHead>
              <TableHead>{t("brands.table.readiness") || "Readiness"}</TableHead>
              <TableHead>{t("brands.table.status") || "Status"}</TableHead>
              <TableHead>{t("brands.table.created") || "Created"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((brand) => (
              <TableRow
                key={brand.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => handleRowClick(brand)}
              >
                <TableCell>
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
                </TableCell>
                <TableCell>
                  {brand.industry ? (
                    <span className="text-sm">{brand.industry}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <BrandReadinessBadge score={brand.readinessScore} />
                </TableCell>
                <TableCell>
                  <BrandStatusBadge isArchived={brand.isArchived} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(brand.createdAt).toLocaleDateString()}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("loading") || "Loading..."}
              </>
            ) : (
              t("loadMore") || "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function BrandStatusBadge({ isArchived }: { isArchived: boolean }) {
  if (isArchived) {
    return (
      <Badge variant="secondary" className="shrink-0 text-xs">
        Archived
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

function BrandsListSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Brand</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[80px]" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[80px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-[50px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-[60px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[80px]" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

