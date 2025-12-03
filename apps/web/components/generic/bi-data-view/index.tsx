/**
 * BiDataView - Unified Data Viewer
 * 
 * A flexible data viewer component with multiple view modes (table, kanban).
 * Features dynamic filtering, search, sorting, and view-specific settings.
 */

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BiDataViewToolbar } from "./toolbar";
import { TableView } from "./table-view";
import { KanbanView } from "./kanban-view";
import { FilterChip } from "./filter-chip";
import type { BiDataViewProps, ViewMode, ViewState, ActiveFilter } from "./types";

export * from "./types";

export function BiDataView<TData>({
  data,
  columns,
  getRowId,
  onRowClick,
  actions,
  searchPlaceholder = "Search...",
  searchableColumns,
  loading = false,
  emptyState,
  views = ["table", "kanban"],
  toolbarActions,
  selectable = false,
  onSelectionChange,
  kanbanGroupKey = "status",
  kanbanColumns,
  renderKanbanCard,
  tableSettings,
}: BiDataViewProps<TData>) {
  // View mode state - default to first view
  const [viewMode, setViewMode] = useState<ViewMode>(views[0] || "table");

  // View state
  const [viewState, setViewState] = useState<ViewState>({
    searchQuery: "",
    activeFilters: [],
    sortColumn: null,
    sortDirection: "asc",
    selectedRows: new Set(),
  });

  // Table settings
  const [showVerticalLines, setShowVerticalLines] = useState(
    tableSettings?.defaultShowVerticalLines ?? true
  );
  const [showRowBorders, setShowRowBorders] = useState(
    tableSettings?.defaultShowRowBorders ?? true
  );

  // Update view state helper
  const updateViewState = useCallback((updates: Partial<ViewState>) => {
    setViewState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Selection change handler
  React.useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(viewState.selectedRows);
    }
  }, [viewState.selectedRows, onSelectionChange]);

  // Filter management
  const addFilter = useCallback((columnId: string) => {
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

    updateViewState({ activeFilters: [...viewState.activeFilters, newFilter] });
  }, [columns, viewState.activeFilters, updateViewState]);

  const updateFilter = useCallback((filterId: string, updates: Partial<ActiveFilter>) => {
    updateViewState({
      activeFilters: viewState.activeFilters.map((f) => 
        f.id === filterId ? { ...f, ...updates } : f
      ),
    });
  }, [viewState.activeFilters, updateViewState]);

  const removeFilter = useCallback((filterId: string) => {
    updateViewState({
      activeFilters: viewState.activeFilters.filter((f) => f.id !== filterId),
    });
  }, [viewState.activeFilters, updateViewState]);

  const clearAllFilters = useCallback(() => {
    updateViewState({ activeFilters: [] });
  }, [updateViewState]);

  // Apply filtering and search
  const filteredData = useMemo(() => {
    let result = data;

    // Search filter
    if (viewState.searchQuery.trim()) {
      const query = viewState.searchQuery.toLowerCase();
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

    // Apply active column filters (simplified version, full logic in BiDataTable)
    viewState.activeFilters.forEach((filter) => {
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
            const values = Array.isArray(filter.value) ? filter.value : [];
            
            // Empty selection means no filter applied
            if (values.length === 0) return true;
            
            if (filter.operator === "is") {
              return values.includes(value);
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

    return result;
  }, [data, viewState.searchQuery, viewState.activeFilters, columns, searchableColumns]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Empty data state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        {emptyState || <p className="text-sm text-muted-foreground">No data</p>}
      </div>
    );
  }

  // View-specific settings for toolbar
  const viewSettings = viewMode === "table" ? (
    <>
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
    </>
  ) : viewMode === "kanban" ? (
    <div className="px-2 py-1.5 text-sm text-muted-foreground">
      No settings available
    </div>
  ) : null;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Toolbar Section - Fixed, never scrolls */}
      <div className="flex-shrink-0 flex-grow-0 w-full">
        {/* Unified Toolbar */}
        <BiDataViewToolbar
          availableViews={views}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={viewState.searchQuery}
          onSearchChange={(query) => updateViewState({ searchQuery: query })}
          searchPlaceholder={searchPlaceholder}
          columns={columns}
          activeFilters={viewState.activeFilters}
          onAddFilter={addFilter}
          actions={toolbarActions}
          viewSettings={viewSettings}
        />

        {/* Active Filters Row */}
        {viewState.activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b bg-muted/30">
            {viewState.activeFilters.map((filter) => {
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
            {viewState.activeFilters.length > 1 && (
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
      </div>

      {/* Content Area - Takes remaining space, contains scrolling */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center p-4 min-h-[400px]">
            {emptyState || <p className="text-sm text-muted-foreground">No data</p>}
          </div>
        ) : viewMode === "table" ? (
          <div className="h-full w-full overflow-auto p-4">
            <TableView
              data={filteredData}
              columns={columns}
              getRowId={getRowId}
              onRowClick={onRowClick}
              actions={actions}
              emptyState={emptyState}
              selectable={selectable}
              viewState={viewState}
              onViewStateChange={updateViewState}
              settings={{
                showVerticalLines,
                showRowBorders,
                onSettingsChange: (settings) => {
                  if (settings.showVerticalLines !== undefined) {
                    setShowVerticalLines(settings.showVerticalLines);
                  }
                  if (settings.showRowBorders !== undefined) {
                    setShowRowBorders(settings.showRowBorders);
                  }
                },
              }}
            />
          </div>
        ) : (
          <div className="h-full w-full overflow-x-auto overflow-y-auto p-4">
            <KanbanView
              data={filteredData}
              columns={columns}
              getRowId={getRowId}
              onRowClick={onRowClick}
              actions={actions}
              emptyState={emptyState}
              groupingColumnId={kanbanGroupKey}
              kanbanColumns={kanbanColumns || []}
              renderCard={renderKanbanCard}
            />
          </div>
        )}
      </div>
    </div>
  );
}

