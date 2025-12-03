/**
 * BiDataView Toolbar
 * 
 * Unified toolbar for all view modes with search, filter, and view switching.
 */

import * as React from "react";
import {
  Search,
  Funnel,
  MoreHorizontal,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewMode, BiDataViewColumn, ActiveFilter } from "./types";

interface ToolbarProps<TData> {
  /** Available view modes */
  availableViews: ViewMode[];
  /** Current view mode */
  viewMode: ViewMode;
  /** View mode change handler */
  onViewModeChange: (mode: ViewMode) => void;
  /** Search query */
  searchQuery: string;
  /** Search query change handler */
  onSearchChange: (query: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Columns for filter menu */
  columns: BiDataViewColumn<TData>[];
  /** Active filters */
  activeFilters: ActiveFilter[];
  /** Add filter handler */
  onAddFilter: (columnId: string) => void;
  /** Action buttons (right side) */
  actions?: React.ReactNode;
  /** View-specific settings menu content */
  viewSettings?: React.ReactNode;
}

export function BiDataViewToolbar<TData>({
  availableViews,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  columns,
  activeFilters,
  onAddFilter,
  actions,
  viewSettings,
}: ToolbarProps<TData>) {
  const filterableColumns = columns.filter(
    (col) => col.filterable !== false && !col.hiddenInTable
  );
  const activeFilterCount = activeFilters.length;

  const getColumnIcon = (column: BiDataViewColumn<TData>) => {
    return column.icon;
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background flex-shrink-0" style={{ minHeight: '58px' }}>
      {/* Left Section */}
      <div className="flex items-center gap-2 min-w-0">
        {/* View Switcher - Only show if multiple views */}
        {availableViews.length > 1 && (
          <div className="inline-flex rounded-md" role="group">
            {availableViews.includes("table") && (
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => onViewModeChange("table")}
                className="gap-2 rounded-r-none border-r-0"
              >
                <TableIcon className="h-4 w-4" />
                Table
              </Button>
            )}
            {availableViews.includes("kanban") && (
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => onViewModeChange("kanban")}
                className="gap-2 rounded-l-none"
              >
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </Button>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative ml-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-64 h-9"
          />
        </div>

        {/* Filter Button */}
        {filterableColumns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Funnel className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by column</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filterableColumns.map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  onClick={() => onAddFilter(column.id)}
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

      {/* Right Section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        
        {/* View Settings */}
        {viewSettings && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {viewSettings}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

