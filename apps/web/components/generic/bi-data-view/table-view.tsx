/**
 * BiDataView Table View
 * 
 * Table view rendering using BiDataTable component.
 */

import * as React from "react";
import { BiDataTable } from "@/components/ui/bi-data-table";
import type { BiDataViewColumn, BiDataViewAction, ActiveFilter, ViewState } from "./types";

interface TableViewProps<TData> {
  /** Filtered data to display */
  data: TData[];
  /** Column definitions */
  columns: BiDataViewColumn<TData>[];
  /** Row ID accessor */
  getRowId: (row: TData) => string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Row actions */
  actions?: BiDataViewAction<TData>[];
  /** Empty state */
  emptyState?: React.ReactNode;
  /** Selection enabled */
  selectable?: boolean;
  /** View state */
  viewState: ViewState;
  /** View state update handler */
  onViewStateChange: (state: Partial<ViewState>) => void;
  /** Table-specific settings */
  settings?: {
    showVerticalLines: boolean;
    showRowBorders: boolean;
    onSettingsChange: (settings: { showVerticalLines?: boolean; showRowBorders?: boolean }) => void;
  };
}

export function TableView<TData>({
  data,
  columns,
  getRowId,
  onRowClick,
  actions,
  emptyState,
  selectable = false,
  viewState,
  onViewStateChange,
  settings,
}: TableViewProps<TData>) {
  // Filter out columns hidden in table view (e.g., Kanban grouping columns)
  const visibleColumns = React.useMemo(
    () => columns.filter((col) => !col.hiddenInTable),
    [columns]
  );

  return (
    <BiDataTable
      data={data}
      columns={visibleColumns}
      getRowId={getRowId}
      onRowClick={onRowClick}
      actions={actions}
      loading={false}
      emptyState={emptyState}
      selectable={selectable}
      onSelectionChange={(selectedIds) => onViewStateChange({ selectedRows: selectedIds })}
      defaultShowVerticalLines={settings?.showVerticalLines}
      defaultShowRowBorders={settings?.showRowBorders}
      hideToolbar={true}
    />
  );
}

