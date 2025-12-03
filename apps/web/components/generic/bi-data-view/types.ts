/**
 * BiDataView Types
 * 
 * Shared type definitions for the BiDataView component system.
 */

export type ViewMode = "table" | "kanban";

export type ColumnType = "text" | "select" | "number" | "date";

export interface BiDataViewColumn<TData> {
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
  /** Width class (e.g., "w-[300px]") - for table view */
  width?: string;
  /** Whether column is sortable (default: true) */
  sortable?: boolean;
  /** Whether column is filterable (default: true) */
  filterable?: boolean;
  /** Whether column is hidden in table view (default: false) - useful for Kanban grouping columns */
  hiddenInTable?: boolean;
  /** Accessor function to get the value from data */
  accessorFn: (row: TData) => string | number | boolean | null | undefined;
  /** Custom cell renderer - for table view */
  cell?: (row: TData) => React.ReactNode;
  /** Custom sort value (if different from accessor) */
  sortValueFn?: (row: TData) => string | number | boolean | null;
  /** Custom filter value (if different from accessor) */
  filterValueFn?: (row: TData) => string | number | boolean | null;
}

export interface BiDataViewAction<TData> {
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
  /** Whether action is disabled (function receives row data) */
  disabled?: boolean | ((row: TData) => boolean);
}

export interface BiDataViewProps<TData> {
  /** Data array to display */
  data: TData[];
  /** Column definitions */
  columns: BiDataViewColumn<TData>[];
  /** Unique ID field accessor */
  getRowId: (row: TData) => string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Row actions (... menu) */
  actions?: BiDataViewAction<TData>[];
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Fields to search in (column IDs) */
  searchableColumns?: string[];
  /** Loading state */
  loading?: boolean;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** Available views (if only one view, switcher is hidden) */
  views?: ViewMode[];
  /** Action buttons in toolbar right */
  toolbarActions?: React.ReactNode;
  /** Enable row selection (default: false) */
  selectable?: boolean;
  /** Selection change handler */
  onSelectionChange?: (selectedIds: Set<string>) => void;
  /** Custom Kanban column grouping key (default: "status") */
  kanbanGroupKey?: string;
  /** Custom Kanban columns (if not using status) */
  kanbanColumns?: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    color?: string;
  }>;
  /** Custom Kanban card renderer */
  renderKanbanCard?: (row: TData) => React.ReactNode;
  /** Table view settings */
  tableSettings?: {
    defaultShowVerticalLines?: boolean;
    defaultShowRowBorders?: boolean;
  };
}

export type TextOperator = "contains" | "equals" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty";
export type SelectOperator = "is" | "is_not";
export type NumberOperator = "equals" | "greater_than" | "less_than" | "greater_or_equal" | "less_or_equal";
export type DateOperator = "is" | "before" | "after" | "is_empty" | "is_not_empty";

export interface ActiveFilter {
  id: string;
  columnId: string;
  operator: string;
  value: string | string[];
}

export interface ViewState {
  searchQuery: string;
  activeFilters: ActiveFilter[];
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  selectedRows: Set<string>;
}

