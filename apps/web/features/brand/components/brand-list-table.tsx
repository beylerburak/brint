"use client";

/**
 * Brand List Table
 * 
 * Displays brands in a table format with readiness indicators and actions.
 */

import Link from "next/link";
import { useLocale } from "next-intl";
import { MoreHorizontal, Archive, Pencil, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useHasPermission } from "@/features/permissions/hooks/hooks";
import { BrandReadinessPanel } from "./brand-readiness-panel";
import type { BrandSummary } from "../types";
import { buildWorkspaceRoute } from "@/features/space/constants";

interface BrandListTableProps {
  brands: BrandSummary[];
  loading: boolean;
  onArchive?: (brand: BrandSummary) => void;
  onEdit?: (brand: BrandSummary) => void;
}

/**
 * Table component for displaying brands
 */
export function BrandListTable({
  brands,
  loading,
  onArchive,
  onEdit,
}: BrandListTableProps) {
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const canDelete = useHasPermission("studio:brand.delete");

  if (loading) {
    return <BrandListTableSkeleton />;
  }

  if (brands.length === 0) {
    return null; // Empty state is handled by parent
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Brand</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.map((brand) => (
            <TableRow key={brand.id}>
              <TableCell>
                <div className="flex flex-col">
                  <Link
                    href={buildWorkspaceRoute(locale, workspace?.slug || "", `studio/brands/${brand.slug}`)}
                    className="font-medium hover:underline"
                  >
                    {brand.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    /{brand.slug}
                  </span>
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
                <BrandReadinessPanel
                  data={{
                    readinessScore: brand.readinessScore,
                    profileCompleted: brand.profileCompleted,
                    hasAtLeastOneSocialAccount: brand.hasAtLeastOneSocialAccount,
                    publishingDefaultsConfigured: brand.publishingDefaultsConfigured,
                  }}
                  variant="compact"
                />
              </TableCell>
              <TableCell>
                {brand.isArchived ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        href={buildWorkspaceRoute(locale, workspace?.slug || "", `studio/brands/${brand.slug}`)}
                        className="flex items-center"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit?.(brand)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    {canDelete && !brand.isArchived && (
                      <DropdownMenuItem
                        onClick={() => onArchive?.(brand)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Loading skeleton for the brand list table
 */
function BrandListTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Brand</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[100px]" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[80px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-[100px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-[60px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

