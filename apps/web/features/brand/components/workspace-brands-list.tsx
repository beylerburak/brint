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
import { 
  Plus, 
  Briefcase, 
  Loader2, 
  MoreHorizontal, 
  Edit, 
  Archive, 
  Trash2, 
  Copy, 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp,
  ChevronsUpDown,
  Calendar, 
  Hash, 
  Type, 
  CircleDot,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useHasPermission, usePagePermissions } from "@/features/permissions/hooks/hooks";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useBrandList } from "../hooks";
import { buildWorkspaceRoute } from "@/features/space/constants";
import type { BrandSummary } from "../types";

// ============================================================================
// Column Filter Types
// ============================================================================

type ColumnType = "text" | "select" | "number" | "date";

type TextOperator = "contains" | "equals" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty";
type SelectOperator = "is" | "is_not";
type NumberOperator = "equals" | "greater_than" | "less_than" | "greater_or_equal" | "less_or_equal";
type DateOperator = "is" | "before" | "after" | "is_empty" | "is_not_empty";

interface ColumnDefinition {
  id: string;
  label: string;
  type: ColumnType;
  icon: React.ReactNode;
  options?: string[]; // For select type
}

interface ActiveFilter {
  id: string;
  columnId: string;
  operator: string;
  value: string | string[];
}

const TEXT_OPERATORS: { value: TextOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const SELECT_OPERATORS: { value: SelectOperator; label: string }[] = [
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
];

const NUMBER_OPERATORS: { value: NumberOperator; label: string }[] = [
  { value: "equals", label: "=" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_or_equal", label: "≥" },
  { value: "less_or_equal", label: "≤" },
];

const DATE_OPERATORS: { value: DateOperator; label: string }[] = [
  { value: "is", label: "is" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

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
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedBrands, setSelectedBrands] = React.useState<Set<string>>(new Set());
  
  // Column filter states
  const [activeFilters, setActiveFilters] = React.useState<ActiveFilter[]>([]);
  
  // View settings state
  const [showVerticalLines, setShowVerticalLines] = React.useState(true);
  const [showRowBorders, setShowRowBorders] = React.useState(true);
  
  // Sort state
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Get unique industries from brands
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
  const columns: ColumnDefinition[] = React.useMemo(() => [
    { id: "name", label: "Brand", type: "text", icon: <Type className="h-4 w-4" /> },
    { id: "industry", label: "Industry", type: "select", icon: <CircleDot className="h-4 w-4" />, options: uniqueIndustries },
    { id: "readiness", label: "Readiness", type: "number", icon: <Hash className="h-4 w-4" /> },
    { id: "status", label: "Status", type: "select", icon: <CircleDot className="h-4 w-4" />, options: ["Active", "Archived"] },
    { id: "created", label: "Created", type: "date", icon: <Calendar className="h-4 w-4" /> },
  ], [uniqueIndustries]);

  // Apply filters to brands
  const filteredBrands = React.useMemo(() => {
    let result = brands;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((brand) => 
        brand.name.toLowerCase().includes(query) ||
        brand.slug.toLowerCase().includes(query) ||
        (brand.industry && brand.industry.toLowerCase().includes(query))
      );
    }

    // Apply active column filters
    activeFilters.forEach((filter) => {
      result = result.filter((brand) => {
        switch (filter.columnId) {
          case "name": {
            const name = brand.name.toLowerCase();
            const value = (filter.value as string).toLowerCase();
            switch (filter.operator) {
              case "contains": return name.includes(value);
              case "equals": return name === value;
              case "starts_with": return name.startsWith(value);
              case "ends_with": return name.endsWith(value);
              case "is_empty": return !brand.name;
              case "is_not_empty": return !!brand.name;
              default: return true;
            }
          }
          case "industry": {
            const industry = brand.industry || "";
            const values = filter.value as string[];
            if (filter.operator === "is") {
              return values.length === 0 || values.includes(industry);
            } else {
              return !values.includes(industry);
            }
          }
          case "readiness": {
            const score = brand.readinessScore;
            const value = parseFloat(filter.value as string);
            if (isNaN(value)) return true;
            switch (filter.operator) {
              case "equals": return score === value;
              case "greater_than": return score > value;
              case "less_than": return score < value;
              case "greater_or_equal": return score >= value;
              case "less_or_equal": return score <= value;
              default: return true;
            }
          }
          case "status": {
            const status = brand.isArchived ? "Archived" : "Active";
            const values = filter.value as string[];
            if (filter.operator === "is") {
              return values.length === 0 || values.includes(status);
            } else {
              return !values.includes(status);
            }
          }
          case "created": {
            const createdDate = new Date(brand.createdAt);
            const filterDate = new Date(filter.value as string);
            if (isNaN(filterDate.getTime())) return true;
            switch (filter.operator) {
              case "is": return createdDate.toDateString() === filterDate.toDateString();
              case "before": return createdDate < filterDate;
              case "after": return createdDate > filterDate;
              case "is_empty": return !brand.createdAt;
              case "is_not_empty": return !!brand.createdAt;
              default: return true;
            }
          }
          default:
            return true;
        }
      });
    });

    // Apply sorting
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let aValue: string | number | boolean | null = null;
        let bValue: string | number | boolean | null = null;

        switch (sortColumn) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "industry":
            aValue = (a.industry || "").toLowerCase();
            bValue = (b.industry || "").toLowerCase();
            break;
          case "readiness":
            aValue = a.readinessScore;
            bValue = b.readinessScore;
            break;
          case "status":
            aValue = a.isArchived ? 1 : 0;
            bValue = b.isArchived ? 1 : 0;
            break;
          case "created":
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
        }

        if (aValue === null || bValue === null) return 0;
        
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [brands, searchQuery, activeFilters, sortColumn, sortDirection]);

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

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle column sort
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Toggle direction or clear sort
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  };

  // Get sort icon for column
  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  // Filter management functions
  const addFilter = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return;

    const defaultOperator = column.type === "text" ? "contains" 
      : column.type === "select" ? "is"
      : column.type === "number" ? "equals"
      : "is";

    const newFilter: ActiveFilter = {
      id: `filter-${Date.now()}`,
      columnId,
      operator: defaultOperator,
      value: column.type === "select" ? [] : "",
    };

    setActiveFilters([...activeFilters, newFilter]);
  };

  const updateFilter = (filterId: string, updates: Partial<ActiveFilter>) => {
    setActiveFilters(activeFilters.map((f) => 
      f.id === filterId ? { ...f, ...updates } : f
    ));
  };

  const removeFilter = (filterId: string) => {
    setActiveFilters(activeFilters.filter((f) => f.id !== filterId));
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  // Handle checkbox selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBrands(new Set(filteredBrands.map((brand) => brand.id)));
    } else {
      setSelectedBrands(new Set());
    }
  };

  const handleSelectBrand = (brandId: string, checked: boolean) => {
    const newSelected = new Set(selectedBrands);
    if (checked) {
      newSelected.add(brandId);
    } else {
      newSelected.delete(brandId);
    }
    setSelectedBrands(newSelected);
  };

  const isAllSelected = filteredBrands.length > 0 && selectedBrands.size === filteredBrands.length;
  const isIndeterminate = selectedBrands.size > 0 && selectedBrands.size < filteredBrands.length;

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
  if (brands.length === 0 && !loading) {
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
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 w-64"
            />
          </div>

          {/* Add Filter Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by column</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  onClick={() => addFilter(column.id)}
                  className="flex items-center gap-2"
                >
                  {column.icon}
                  <span>{column.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {canCreate && (
            <Button onClick={handleCreateBrand}>
              <Plus className="mr-2 h-4 w-4" />
              New Brand
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm">Vertical lines</span>
                <Switch
                  checked={showVerticalLines}
                  onCheckedChange={setShowVerticalLines}
                />
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm">Row borders</span>
                <Switch
                  checked={showRowBorders}
                  onCheckedChange={setShowRowBorders}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Filters Row */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter) => {
            const column = columns.find((c) => c.id === filter.columnId);
            if (!column) return null;
            
            return (
              <FilterChip
                key={filter.id}
                filter={filter}
                column={column}
                onUpdate={(updates) => updateFilter(filter.id, updates)}
                onRemove={() => removeFilter(filter.id)}
              />
            );
          })}
          {activeFilters.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearAllFilters}
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      <Table>
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0">
              <TableHead className={`w-[50px] border-b px-4 bg-muted/50 rounded-tl-md ${showVerticalLines ? "border-r" : ""}`}>
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className={`w-[300px] border-b px-2 bg-muted/50 ${showVerticalLines ? "border-r" : ""}`}>
                <button 
                  className="flex items-center gap-1 hover:text-foreground w-full text-left px-2 py-1 -mx-2 rounded-sm hover:bg-accent/50"
                  onClick={() => handleSort("name")}
                >
                  {t("brands.table.name") || "Brand"}
                  {getSortIcon("name")}
                </button>
              </TableHead>
              <TableHead className={`border-b px-2 bg-muted/50 ${showVerticalLines ? "border-r" : ""}`}>
                <button 
                  className="flex items-center gap-1 hover:text-foreground w-full text-left px-2 py-1 -mx-2 rounded-sm hover:bg-accent/50"
                  onClick={() => handleSort("industry")}
                >
                  {t("brands.table.industry") || "Industry"}
                  {getSortIcon("industry")}
                </button>
              </TableHead>
              <TableHead className={`border-b px-2 bg-muted/50 ${showVerticalLines ? "border-r" : ""}`}>
                <button 
                  className="flex items-center gap-1 hover:text-foreground w-full text-left px-2 py-1 -mx-2 rounded-sm hover:bg-accent/50"
                  onClick={() => handleSort("readiness")}
                >
                  {t("brands.table.readiness") || "Readiness"}
                  {getSortIcon("readiness")}
                </button>
              </TableHead>
              <TableHead className={`border-b px-2 bg-muted/50 ${showVerticalLines ? "border-r" : ""}`}>
                <button 
                  className="flex items-center gap-1 hover:text-foreground w-full text-left px-2 py-1 -mx-2 rounded-sm hover:bg-accent/50"
                  onClick={() => handleSort("status")}
                >
                  {t("brands.table.status") || "Status"}
                  {getSortIcon("status")}
                </button>
              </TableHead>
              <TableHead className={`border-b px-2 bg-muted/50 ${showVerticalLines ? "border-r" : ""}`}>
                <button 
                  className="flex items-center gap-1 hover:text-foreground w-full text-left px-2 py-1 -mx-2 rounded-sm hover:bg-accent/50"
                  onClick={() => handleSort("created")}
                >
                  {t("brands.table.created") || "Created"}
                  {getSortIcon("created")}
                </button>
              </TableHead>
              <TableHead className="border-b px-4 w-[50px] bg-muted/50 rounded-tr-md"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBrands.map((brand) => (
              <TableRow
                key={brand.id}
                className="cursor-pointer hover:bg-accent/50 border-0"
                onClick={() => handleRowClick(brand)}
              >
                <TableCell className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`} onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedBrands.has(brand.id)}
                    onCheckedChange={(checked) => handleSelectBrand(brand.id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${brand.name}`}
                  />
                </TableCell>
                <TableCell className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}>
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
                <TableCell className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}>
                  {brand.industry ? (
                    <span className="text-sm">{brand.industry}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}>
                  <BrandReadinessBadge score={brand.readinessScore} />
                </TableCell>
                <TableCell className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}>
                  <BrandStatusBadge isArchived={brand.isArchived} />
                </TableCell>
                <TableCell className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-muted-foreground cursor-help">
                          {formatRelativeTime(brand.createdAt)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatFullDate(brand.createdAt)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className={`px-4 ${showRowBorders ? "border-b" : ""}`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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
// Filter Chip Component - Shows summary, editable via popover
// ============================================================================

interface FilterChipProps {
  filter: ActiveFilter;
  column: ColumnDefinition;
  onUpdate: (updates: Partial<ActiveFilter>) => void;
  onRemove: () => void;
}

function FilterChip({ filter, column, onUpdate, onRemove }: FilterChipProps) {
  const [open, setOpen] = React.useState(false);
  
  const getOperators = () => {
    switch (column.type) {
      case "text": return TEXT_OPERATORS;
      case "select": return SELECT_OPERATORS;
      case "number": return NUMBER_OPERATORS;
      case "date": return DATE_OPERATORS;
      default: return [];
    }
  };

  const operators = getOperators();
  const currentOperator = operators.find((op) => op.value === filter.operator);
  const needsValue = !["is_empty", "is_not_empty"].includes(filter.operator);

  // Get summary text for the filter
  const getSummary = () => {
    const operatorLabel = currentOperator?.label || filter.operator.replace(/_/g, " ");
    
    if (!needsValue) {
      return `${column.label}: ${operatorLabel}`;
    }

    if (Array.isArray(filter.value)) {
      if (filter.value.length === 0) {
        return `${column.label}: ${operatorLabel} ...`;
      }
      return `${column.label}: ${operatorLabel} ${filter.value.join(", ")}`;
    }

    if (!filter.value) {
      return `${column.label}: ${operatorLabel} ...`;
    }

    return `${column.label}: ${operatorLabel} ${filter.value}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-sm font-normal"
        >
          <span>{getSummary()}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* Header with Operator */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{column.label}</span>
              <Select
                value={filter.operator}
                onValueChange={(value) => onUpdate({ operator: value })}
              >
                <SelectTrigger className="h-7 w-auto border-0 bg-muted/50 px-2 text-sm shadow-none">
                  <SelectValue>{currentOperator?.label || filter.operator}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Value Input */}
          {needsValue && (
            <>
              {column.type === "text" && (
                <Input
                  placeholder="Type a value..."
                  value={filter.value as string}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  className="h-8"
                />
              )}

              {column.type === "select" && column.options && (
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {column.options.map((option) => {
                    const values = filter.value as string[];
                    const isChecked = values.includes(option);
                    return (
                      <div
                        key={option}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                        onClick={() => {
                          const newValues = isChecked
                            ? values.filter((v) => v !== option)
                            : [...values, option];
                          onUpdate({ value: newValues });
                        }}
                      >
                        <Checkbox checked={isChecked} />
                        <span className="text-sm">{option}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {column.type === "number" && (
                <Input
                  type="number"
                  placeholder="Enter a number..."
                  value={filter.value as string}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  className="h-8"
                />
              )}

              {column.type === "date" && (
                <Input
                  type="date"
                  value={filter.value as string}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  className="h-8"
                />
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
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

// ============================================================================
// Date Formatting Helpers
// ============================================================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function BrandsListSkeleton() {
  return (
    <Table>
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0">
            <TableHead className="w-[50px] border-r border-b px-4 bg-muted/50 rounded-tl-md"></TableHead>
            <TableHead className="w-[300px] border-r border-b px-4 bg-muted/50">Brand</TableHead>
            <TableHead className="border-r border-b px-4 bg-muted/50">Industry</TableHead>
            <TableHead className="border-r border-b px-4 bg-muted/50">Readiness</TableHead>
            <TableHead className="border-r border-b px-4 bg-muted/50">Status</TableHead>
            <TableHead className="border-r border-b px-4 bg-muted/50">Created</TableHead>
            <TableHead className="border-b px-4 w-[50px] bg-muted/50 rounded-tr-md"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i} className="border-0">
              <TableCell className="border-r border-b px-4">
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell className="border-r border-b px-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[80px]" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="border-r border-b px-4">
                <Skeleton className="h-4 w-[80px]" />
              </TableCell>
              <TableCell className="border-r border-b px-4">
                <Skeleton className="h-5 w-[50px]" />
              </TableCell>
              <TableCell className="border-r border-b px-4">
                <Skeleton className="h-5 w-[60px]" />
              </TableCell>
              <TableCell className="border-r border-b px-4">
                <Skeleton className="h-4 w-[80px]" />
              </TableCell>
              <TableCell className="border-b px-4">
                <Skeleton className="h-8 w-8 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  );
}

