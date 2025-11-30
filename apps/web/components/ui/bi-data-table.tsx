"use client";

/**
 * BiDataTable - Generic Data Table Component
 * 
 * A reusable table component with built-in:
 * - Column sorting
 * - Column filtering (text, select, number, date)
 * - Row selection
 * - Search
 * - View settings (vertical lines, row borders)
 * - Pagination/Load more
 * - Mobile card view
 */

import * as React from "react";
import { 
  Plus, 
  Loader2, 
  MoreHorizontal, 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp,
  ChevronsUpDown,
  Calendar, 
  Hash, 
  Type, 
  CircleDot,
  Filter,
  ArrowUpDown,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/utils";

// ============================================================================
// Types
// ============================================================================

export type ColumnType = "text" | "select" | "number" | "date";

export type TextOperator = "contains" | "equals" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty";
export type SelectOperator = "is" | "is_not";
export type NumberOperator = "equals" | "greater_than" | "less_than" | "greater_or_equal" | "less_or_equal";
export type DateOperator = "is" | "before" | "after" | "is_empty" | "is_not_empty";

export interface BiDataTableColumn<TData> {
  /** Unique column identifier */
  id: string;
  /** Column header label */
  label: string;
  /** Column type for filtering */
  type: ColumnType;
  /** Icon shown in filter dropdown */
  icon?: React.ReactNode;
  /** Options for select type columns */
  options?: string[];
  /** Width class (e.g., "w-[300px]") */
  width?: string;
  /** Whether column is sortable (default: true) */
  sortable?: boolean;
  /** Whether column is filterable (default: true) */
  filterable?: boolean;
  /** Accessor function to get the value from data */
  accessorFn: (row: TData) => string | number | boolean | null | undefined;
  /** Custom cell renderer */
  cell?: (row: TData) => React.ReactNode;
  /** Custom sort value (if different from accessor) */
  sortValueFn?: (row: TData) => string | number | boolean | null;
  /** Custom filter value (if different from accessor) */
  filterValueFn?: (row: TData) => string | number | boolean | null;
}

export interface BiDataTableAction<TData> {
  /** Action label */
  label: string;
  /** Action icon */
  icon?: React.ReactNode;
  /** Action handler */
  onClick: (row: TData) => void;
  /** Whether action is destructive */
  destructive?: boolean;
  /** Whether to show separator before this action */
  separator?: boolean;
}

export interface ActiveFilter {
  id: string;
  columnId: string;
  operator: string;
  value: string | string[];
}

export interface BiDataTableProps<TData> {
  /** Data array to display */
  data: TData[];
  /** Column definitions */
  columns: BiDataTableColumn<TData>[];
  /** Unique ID field accessor */
  getRowId: (row: TData) => string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Row actions */
  actions?: BiDataTableAction<TData>[];
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Fields to search in (column IDs) */
  searchableColumns?: string[];
  /** Loading state */
  loading?: boolean;
  /** Has more data to load */
  hasMore?: boolean;
  /** Load more handler */
  onLoadMore?: () => void;
  /** Loading more state */
  isLoadingMore?: boolean;
  /** Load more label */
  loadMoreLabel?: string;
  /** Loading label */
  loadingLabel?: string;
  /** Toolbar right section */
  toolbarRight?: React.ReactNode;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** Mobile card renderer */
  mobileCard?: (row: TData) => React.ReactNode;
  /** Selection change handler */
  onSelectionChange?: (selectedIds: Set<string>) => void;
  /** Enable row selection (default: true) */
  selectable?: boolean;
  /** Default view settings */
  defaultShowVerticalLines?: boolean;
  defaultShowRowBorders?: boolean;
  /** Hide view settings menu */
  hideViewSettings?: boolean;
  /** Custom skeleton row count */
  skeletonRows?: number;
  /** Table className */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

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

const DEFAULT_COLUMN_ICONS: Record<ColumnType, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  select: <CircleDot className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
};

// ============================================================================
// Main Component
// ============================================================================

export function BiDataTable<TData>({
  data,
  columns,
  getRowId,
  onRowClick,
  actions,
  searchPlaceholder = "Search...",
  searchableColumns,
  loading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  loadMoreLabel = "Load more",
  loadingLabel = "Loading...",
  toolbarRight,
  emptyState,
  mobileCard,
  onSelectionChange,
  selectable = true,
  defaultShowVerticalLines = true,
  defaultShowRowBorders = true,
  hideViewSettings = false,
  skeletonRows = 3,
  className,
}: BiDataTableProps<TData>) {
  const isMobile = useIsMobile();

  // States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = React.useState<ActiveFilter[]>([]);
  const [showVerticalLines, setShowVerticalLines] = React.useState(defaultShowVerticalLines);
  const [showRowBorders, setShowRowBorders] = React.useState(defaultShowRowBorders);
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Filterable columns
  const filterableColumns = React.useMemo(
    () => columns.filter((col) => col.filterable !== false),
    [columns]
  );

  // Get column icon
  const getColumnIcon = (column: BiDataTableColumn<TData>) => {
    return column.icon ?? DEFAULT_COLUMN_ICONS[column.type];
  };

  // Apply filtering and sorting
  const filteredData = React.useMemo(() => {
    let result = data;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const searchCols = searchableColumns ?? columns.map((c) => c.id);
      
      result = result.filter((row) => {
        return searchCols.some((colId) => {
          const column = columns.find((c) => c.id === colId);
          if (!column) return false;
          const value = column.accessorFn(row);
          if (value == null) return false;
          return String(value).toLowerCase().includes(query);
        });
      });
    }

    // Apply active column filters
    activeFilters.forEach((filter) => {
      const column = columns.find((c) => c.id === filter.columnId);
      if (!column) return;

      result = result.filter((row) => {
        const rawValue = column.filterValueFn?.(row) ?? column.accessorFn(row);
        
        switch (column.type) {
          case "text": {
            const value = String(rawValue ?? "").toLowerCase();
            const filterValue = (filter.value as string).toLowerCase();
            switch (filter.operator) {
              case "contains": return value.includes(filterValue);
              case "equals": return value === filterValue;
              case "starts_with": return value.startsWith(filterValue);
              case "ends_with": return value.endsWith(filterValue);
              case "is_empty": return !value;
              case "is_not_empty": return !!value;
              default: return true;
            }
          }
          case "select": {
            const value = String(rawValue ?? "");
            const values = filter.value as string[];
            if (filter.operator === "is") {
              return values.length === 0 || values.includes(value);
            } else {
              return !values.includes(value);
            }
          }
          case "number": {
            const value = Number(rawValue);
            const filterValue = parseFloat(filter.value as string);
            if (isNaN(filterValue)) return true;
            switch (filter.operator) {
              case "equals": return value === filterValue;
              case "greater_than": return value > filterValue;
              case "less_than": return value < filterValue;
              case "greater_or_equal": return value >= filterValue;
              case "less_or_equal": return value <= filterValue;
              default: return true;
            }
          }
          case "date": {
            const dateValue = rawValue ? new Date(String(rawValue)) : null;
            const filterDate = new Date(filter.value as string);
            if (!dateValue || isNaN(filterDate.getTime())) return true;
            switch (filter.operator) {
              case "is": return dateValue.toDateString() === filterDate.toDateString();
              case "before": return dateValue < filterDate;
              case "after": return dateValue > filterDate;
              case "is_empty": return !rawValue;
              case "is_not_empty": return !!rawValue;
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
      const column = columns.find((c) => c.id === sortColumn);
      if (column) {
        result = [...result].sort((a, b) => {
          const aValue = column.sortValueFn?.(a) ?? column.accessorFn(a);
          const bValue = column.sortValueFn?.(b) ?? column.accessorFn(b);

          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return sortDirection === "asc" ? 1 : -1;
          if (bValue == null) return sortDirection === "asc" ? -1 : 1;

          const aComp = typeof aValue === "string" ? aValue.toLowerCase() : aValue;
          const bComp = typeof bValue === "string" ? bValue.toLowerCase() : bValue;

          if (aComp < bComp) return sortDirection === "asc" ? -1 : 1;
          if (aComp > bComp) return sortDirection === "asc" ? 1 : -1;
          return 0;
        });
      }
    }

    return result;
  }, [data, searchQuery, activeFilters, sortColumn, sortDirection, columns, searchableColumns]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    const newSelected = checked
      ? new Set(filteredData.map((row) => getRowId(row)))
      : new Set<string>();
    setSelectedRows(newSelected);
    onSelectionChange?.(newSelected);
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRows(newSelected);
    onSelectionChange?.(newSelected);
  };

  const isAllSelected = filteredData.length > 0 && selectedRows.size === filteredData.length;

  // Sort handler
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
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

  // Sort icon
  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  // Filter management
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

  // Mobile sheet states
  const [mobileFilterOpen, setMobileFilterOpen] = React.useState(false);
  const [mobileSortOpen, setMobileSortOpen] = React.useState(false);

  // Loading skeleton
  if (loading && data.length === 0) {
    if (isMobile) {
      return <MobileDataTableSkeleton rowCount={skeletonRows} />;
    }
    return (
      <BiDataTableSkeleton
        columns={columns}
        selectable={selectable}
        showVerticalLines={showVerticalLines}
        showRowBorders={showRowBorders}
        rowCount={skeletonRows}
        hasActions={!!actions?.length}
      />
    );
  }

  // Empty state
  if (data.length === 0 && !loading) {
    return emptyState || (
      <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px] border rounded-lg border-dashed">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  // Mobile view
  if (isMobile) {
    const sortableColumns = columns.filter((col) => col.sortable !== false);
    const currentSortColumn = sortColumn ? columns.find((c) => c.id === sortColumn) : null;

    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {/* Mobile Toolbar */}
        <div className="flex flex-col gap-3">
          {/* Search Row */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            {/* Filter Button */}
            {filterableColumns.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start gap-2"
                onClick={() => setMobileFilterOpen(true)}
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            )}

            {/* Sort Button */}
            {sortableColumns.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start gap-2"
                onClick={() => setMobileSortOpen(true)}
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="truncate">
                  {currentSortColumn 
                    ? `${currentSortColumn.label} ${sortDirection === "asc" ? "↑" : "↓"}`
                    : "Sort"
                  }
                </span>
              </Button>
            )}

            {/* Toolbar Right (usually create button) */}
            {toolbarRight && (
              <div className="shrink-0">
                {toolbarRight}
              </div>
            )}
          </div>

          {/* Active Filters Pills */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {activeFilters.map((filter) => {
                const column = columns.find((c) => c.id === filter.columnId);
                if (!column) return null;
                
                return (
                  <MobileFilterPill
                    key={filter.id}
                    filter={filter}
                    column={column}
                    onRemove={() => removeFilter(filter.id)}
                  />
                );
              })}
              {activeFilters.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs text-muted-foreground"
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredData.length} {filteredData.length === 1 ? "result" : "results"}</span>
          {selectable && selectedRows.size > 0 && (
            <span>{selectedRows.size} selected</span>
          )}
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-3">
          {filteredData.map((row) => {
            const rowId = getRowId(row);
            const isSelected = selectedRows.has(rowId);

            return (
              <div 
                key={rowId} 
                className={cn(
                  "relative",
                  selectable && isSelected && "ring-2 ring-primary ring-offset-2 rounded-lg"
                )}
              >
                {/* Selection checkbox overlay for mobile */}
                {selectable && (
                  <div 
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                      className="bg-background"
                    />
                  </div>
                )}
                
                {/* Mobile card content */}
                {mobileCard ? (
                  <div 
                    onClick={() => onRowClick?.(row)}
                    className={cn(selectable && "pl-8")}
                  >
                    {mobileCard(row)}
                  </div>
                ) : (
                  <DefaultMobileCard
                    row={row}
                    columns={columns}
                    actions={actions}
                    onClick={() => onRowClick?.(row)}
                    selectable={selectable}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Load more button */}
        {hasMore && onLoadMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="w-full"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loadingLabel}
                </>
              ) : (
                loadMoreLabel
              )}
            </Button>
          </div>
        )}

        {/* Mobile Filter Sheet */}
        <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
            <SheetHeader className="text-left">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                Add filters to narrow down results
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Add new filter */}
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-muted-foreground">Add filter</p>
                <div className="grid grid-cols-2 gap-2">
                  {filterableColumns.map((column) => (
                    <Button
                      key={column.id}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => addFilter(column.id)}
                    >
                      {getColumnIcon(column)}
                      <span className="truncate">{column.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Active filters */}
              {activeFilters.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Active filters</p>
                    {activeFilters.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={clearAllFilters}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  {activeFilters.map((filter) => {
                    const column = columns.find((c) => c.id === filter.columnId);
                    if (!column) return null;
                    
                    return (
                      <MobileFilterEditor
                        key={filter.id}
                        filter={filter}
                        column={column}
                        onUpdate={(updates) => updateFilter(filter.id, updates)}
                        onRemove={() => removeFilter(filter.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Sort Sheet */}
        <Sheet open={mobileSortOpen} onOpenChange={setMobileSortOpen}>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader className="text-left">
              <SheetTitle>Sort by</SheetTitle>
              <SheetDescription>
                Choose how to sort the results
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4 space-y-1">
              {sortableColumns.map((column) => {
                const isActive = sortColumn === column.id;
                return (
                  <div key={column.id} className="space-y-1">
                    <button
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2.5 rounded-md text-left transition-colors",
                        isActive && sortDirection === "asc" 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-accent"
                      )}
                      onClick={() => {
                        setSortColumn(column.id);
                        setSortDirection("asc");
                        setMobileSortOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {getColumnIcon(column)}
                        <span>{column.label}</span>
                        <span className="text-xs opacity-70">↑ Ascending</span>
                      </span>
                      {isActive && sortDirection === "asc" && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2.5 rounded-md text-left transition-colors",
                        isActive && sortDirection === "desc" 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-accent"
                      )}
                      onClick={() => {
                        setSortColumn(column.id);
                        setSortDirection("desc");
                        setMobileSortOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {getColumnIcon(column)}
                        <span>{column.label}</span>
                        <span className="text-xs opacity-70">↓ Descending</span>
                      </span>
                      {isActive && sortDirection === "desc" && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}
              {sortColumn && (
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => {
                    setSortColumn(null);
                    setSortDirection("asc");
                    setMobileSortOpen(false);
                  }}
                >
                  Clear sort
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop table view
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* Add Filter Button */}
          {filterableColumns.length > 0 && (
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
                {filterableColumns.map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    onClick={() => addFilter(column.id)}
                    className="flex items-center gap-2"
                  >
                    {getColumnIcon(column)}
                    <span>{column.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {toolbarRight}
          {!hideViewSettings && (
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
          )}
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
            {selectable && (
              <TableHead className={`w-[50px] border-b px-4 bg-muted/50 rounded-tl-md ${showVerticalLines ? "border-r" : ""}`}>
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {columns.map((column, index) => (
              <TableHead 
                key={column.id}
                className={cn(
                  "border-b px-2 bg-muted/50",
                  column.width,
                  showVerticalLines && "border-r",
                  !selectable && index === 0 && "rounded-tl-md"
                )}
              >
                {column.sortable !== false ? (
                  <button 
                    className="flex items-center gap-1 hover:text-foreground w-full text-left px-2 py-1 -mx-2 rounded-sm hover:bg-accent/50"
                    onClick={() => handleSort(column.id)}
                  >
                    {column.label}
                    {getSortIcon(column.id)}
                  </button>
                ) : (
                  <span className="px-2">{column.label}</span>
                )}
              </TableHead>
            ))}
            {actions && actions.length > 0 && (
              <TableHead className="border-b px-4 w-[50px] bg-muted/50 rounded-tr-md" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((row) => {
            const rowId = getRowId(row);
            return (
              <TableRow
                key={rowId}
                className={cn(
                  "border-0",
                  onRowClick && "cursor-pointer hover:bg-accent/50"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <TableCell 
                    className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedRows.has(rowId)}
                      onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select row`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell 
                    key={column.id}
                    className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}
                  >
                    {column.cell ? column.cell(row) : String(column.accessorFn(row) ?? "—")}
                  </TableCell>
                ))}
                {actions && actions.length > 0 && (
                  <TableCell className={`px-4 ${showRowBorders ? "border-b" : ""}`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {actions.map((action, index) => (
                          <React.Fragment key={action.label}>
                            {action.separator && index > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                              }}
                              className={action.destructive ? "text-destructive focus:text-destructive" : ""}
                            >
                              {action.icon}
                              {action.label}
                            </DropdownMenuItem>
                          </React.Fragment>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Load more button */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {loadingLabel}
              </>
            ) : (
              loadMoreLabel
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Filter Chip Component
// ============================================================================

interface FilterChipProps<TData> {
  filter: ActiveFilter;
  column: BiDataTableColumn<TData>;
  onUpdate: (updates: Partial<ActiveFilter>) => void;
  onRemove: () => void;
}

function FilterChip<TData>({ filter, column, onUpdate, onRemove }: FilterChipProps<TData>) {
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
// Skeleton Component
// ============================================================================

interface BiDataTableSkeletonProps<TData> {
  columns: BiDataTableColumn<TData>[];
  selectable?: boolean;
  showVerticalLines?: boolean;
  showRowBorders?: boolean;
  rowCount?: number;
  hasActions?: boolean;
}

function BiDataTableSkeleton<TData>({
  columns,
  selectable = true,
  showVerticalLines = true,
  showRowBorders = true,
  rowCount = 3,
  hasActions = false,
}: BiDataTableSkeletonProps<TData>) {
  return (
    <Table>
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="border-0">
          {selectable && (
            <TableHead className={`w-[50px] border-b px-4 bg-muted/50 rounded-tl-md ${showVerticalLines ? "border-r" : ""}`} />
          )}
          {columns.map((column, index) => (
            <TableHead 
              key={column.id}
              className={cn(
                "border-b px-4 bg-muted/50",
                column.width,
                showVerticalLines && "border-r",
                !selectable && index === 0 && "rounded-tl-md"
              )}
            >
              {column.label}
            </TableHead>
          ))}
          {hasActions && (
            <TableHead className="border-b px-4 w-[50px] bg-muted/50 rounded-tr-md" />
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rowCount }).map((_, i) => (
          <TableRow key={i} className="border-0">
            {selectable && (
              <TableCell className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}>
                <Skeleton className="h-4 w-4" />
              </TableCell>
            )}
            {columns.map((column) => (
              <TableCell 
                key={column.id}
                className={`px-4 ${showVerticalLines ? "border-r" : ""} ${showRowBorders ? "border-b" : ""}`}
              >
                <Skeleton className="h-4 w-[80%]" />
              </TableCell>
            ))}
            {hasActions && (
              <TableCell className={`px-4 ${showRowBorders ? "border-b" : ""}`}>
                <Skeleton className="h-8 w-8 rounded" />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// Mobile Helper Components
// ============================================================================

interface MobileFilterPillProps<TData> {
  filter: ActiveFilter;
  column: BiDataTableColumn<TData>;
  onRemove: () => void;
}

function MobileFilterPill<TData>({ filter, column, onRemove }: MobileFilterPillProps<TData>) {
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

  const getSummary = () => {
    const operatorLabel = currentOperator?.label || filter.operator.replace(/_/g, " ");
    
    if (["is_empty", "is_not_empty"].includes(filter.operator)) {
      return `${column.label} ${operatorLabel}`;
    }

    if (Array.isArray(filter.value)) {
      if (filter.value.length === 0) return `${column.label}`;
      if (filter.value.length === 1) return `${column.label}: ${filter.value[0]}`;
      return `${column.label}: ${filter.value.length} selected`;
    }

    if (!filter.value) return `${column.label}`;
    
    const displayValue = String(filter.value).length > 15 
      ? String(filter.value).substring(0, 15) + "..." 
      : filter.value;
    return `${column.label}: ${displayValue}`;
  };

  return (
    <Badge variant="secondary" className="h-7 gap-1 pr-1 shrink-0">
      <span className="text-xs">{getSummary()}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 hover:bg-destructive/20"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}

interface MobileFilterEditorProps<TData> {
  filter: ActiveFilter;
  column: BiDataTableColumn<TData>;
  onUpdate: (updates: Partial<ActiveFilter>) => void;
  onRemove: () => void;
}

function MobileFilterEditor<TData>({ filter, column, onUpdate, onRemove }: MobileFilterEditorProps<TData>) {
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

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{column.label}</span>
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
          className="h-7 w-7"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {needsValue && (
        <>
          {column.type === "text" && (
            <Input
              placeholder="Type a value..."
              value={filter.value as string}
              onChange={(e) => onUpdate({ value: e.target.value })}
            />
          )}

          {column.type === "select" && column.options && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {column.options.map((option) => {
                const values = filter.value as string[];
                const isChecked = values.includes(option);
                return (
                  <div
                    key={option}
                    className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer"
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
            />
          )}

          {column.type === "date" && (
            <Input
              type="date"
              value={filter.value as string}
              onChange={(e) => onUpdate({ value: e.target.value })}
            />
          )}
        </>
      )}
    </div>
  );
}

interface DefaultMobileCardProps<TData> {
  row: TData;
  columns: BiDataTableColumn<TData>[];
  actions?: BiDataTableAction<TData>[];
  onClick?: () => void;
  selectable?: boolean;
}

function DefaultMobileCard<TData>({ 
  row, 
  columns, 
  actions, 
  onClick,
  selectable 
}: DefaultMobileCardProps<TData>) {
  const primaryColumn = columns[0];
  const secondaryColumns = columns.slice(1, 4); // Show first 3 secondary columns

  return (
    <div 
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 bg-card transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50",
        selectable && "pl-8"
      )}
      onClick={onClick}
    >
      {/* Primary info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {primaryColumn?.cell ? (
            primaryColumn.cell(row)
          ) : (
            <span className="font-medium">
              {String(primaryColumn?.accessorFn(row) ?? "")}
            </span>
          )}
        </div>
        
        {/* Actions menu */}
        {actions && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {actions.map((action, index) => (
                <React.Fragment key={action.label}>
                  {action.separator && index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(row);
                    }}
                    className={action.destructive ? "text-destructive focus:text-destructive" : ""}
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Secondary info */}
      {secondaryColumns.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {secondaryColumns.map((column) => (
            <div key={column.id} className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground/70">{column.label}:</span>
              {column.cell ? (
                <span className="text-foreground">{column.cell(row)}</span>
              ) : (
                <span>{String(column.accessorFn(row) ?? "—")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileDataTableSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar skeleton */}
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
      
      {/* Cards skeleton */}
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Date Formatting Helpers (exported for use in cell renderers)
// ============================================================================

export function formatRelativeTime(dateString: string): string {
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

export function formatFullDate(dateString: string): string {
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

