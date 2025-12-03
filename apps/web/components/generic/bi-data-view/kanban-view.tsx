/**
 * BiDataView Kanban View
 * 
 * Kanban board view with status-based columns.
 */

import * as React from "react";
import { useMemo } from "react";
import { MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BiDataViewColumn, BiDataViewAction } from "./types";

interface KanbanViewProps<TData> {
  /** Filtered data to display */
  data: TData[];
  /** Column definitions (for extracting values) */
  columns: BiDataViewColumn<TData>[];
  /** Row ID accessor */
  getRowId: (row: TData) => string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Row actions */
  actions?: BiDataViewAction<TData>[];
  /** Empty state */
  emptyState?: React.ReactNode;
  /** Kanban grouping column ID (e.g., "status") */
  groupingColumnId: string;
  /** Kanban columns definition */
  kanbanColumns: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    color?: string;
  }>;
  /** Card renderer function */
  renderCard?: (row: TData) => React.ReactNode;
}

export function KanbanView<TData>({
  data,
  columns,
  getRowId,
  onRowClick,
  actions,
  emptyState,
  groupingColumnId,
  kanbanColumns,
  renderCard,
}: KanbanViewProps<TData>) {
  // Get grouping column
  const groupingColumn = columns.find((col) => col.id === groupingColumnId);

  // Group data by status/grouping
  const groupedData = useMemo(() => {
    const groups: Record<string, TData[]> = {};
    
    // Initialize groups
    kanbanColumns.forEach((col) => {
      groups[col.id] = [];
    });

    // Group data
    data.forEach((row) => {
      if (!groupingColumn) return;
      // Use filterValueFn for raw value (e.g., "BACKLOG" instead of "Backlog")
      const value = groupingColumn.filterValueFn?.(row) ?? groupingColumn.accessorFn(row);
      const groupId = String(value || "");
      if (groups[groupId]) {
        groups[groupId].push(row);
      }
    });

    return groups;
  }, [data, groupingColumn, kanbanColumns]);

  // Default card renderer
  const defaultCardRenderer = (row: TData) => {
    const titleColumn = columns[0];
    const title = titleColumn ? String(titleColumn.accessorFn(row) || "") : "";
    
    return (
      <div
        className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={() => onRowClick?.(row)}
      >
        <div className="font-medium text-sm">{title}</div>
      </div>
    );
  };

  const cardRenderer = renderCard || defaultCardRenderer;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        {emptyState || <p className="text-sm text-muted-foreground">No data</p>}
      </div>
    );
  }

  return (
    <div className="flex gap-4 pb-4 min-w-max">
      {kanbanColumns.map((column) => {
        const columnData = groupedData[column.id] || [];
        
        return (
          <div key={column.id} className="flex flex-col w-80 shrink-0">
            {/* Column Header */}
            <div className="flex items-center justify-between p-3 mb-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {column.icon}
                <h3 className="font-semibold text-sm">{column.label}</h3>
              </div>
              <Badge variant="secondary" className="h-5 px-2 text-xs">
                {columnData.length}
              </Badge>
            </div>
            
            {/* Cards */}
            <div className="flex flex-col gap-2">
              {columnData.map((row) => (
                <div key={getRowId(row)} className="group relative">
                  {cardRenderer(row)}
                  
                  {/* Actions Menu (if provided) */}
                  {actions && actions.length > 0 && (
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {actions.map((action, index) => {
                            const isDisabled = typeof action.disabled === 'function' 
                              ? action.disabled(row) 
                              : action.disabled ?? false;
                            
                            return (
                              <React.Fragment key={action.label}>
                                {action.separator && index > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    if (isDisabled) {
                                      e.preventDefault();
                                      return;
                                    }
                                    e.stopPropagation();
                                    action.onClick(row);
                                  }}
                                  disabled={isDisabled}
                                  className={action.destructive ? "text-destructive focus:text-destructive" : ""}
                                >
                                  {action.icon}
                                  {action.label}
                                </DropdownMenuItem>
                              </React.Fragment>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Empty State */}
              {columnData.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  No items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

