# Data View Components

Generic, reusable data view components for displaying data in multiple view modes (table, kanban, calendar).

## Overview

The data-view components provide a complete solution for displaying and managing data with:
- **Multiple view modes**: Table, Kanban, and Calendar
- **Generic design**: Works with any data type
- **Customizable**: Columns, filters, and actions are fully configurable
- **Conditional features**: Summary and completed filter features are optional and only appear when their props are provided
- **Header menu**: Built-in dropdown menu (three dots) next to title with conditional items based on provided props
- **Consistent UI**: Unified styling and behavior across all views

## Components

### DataViewPage
Main container component that provides the page structure with header, toolbar, and content area.

**Features:**
- **Title**: Displayed on the left side of the header (required prop)
- **Header Menu**: Three-dot dropdown menu next to title with conditional items:
  - Summary toggle: Only shown if `summaryStats` is provided
  - Completed filter toggle: Only shown if both `showCompleted` and `onCompletedFilterChange` are provided
  - Menu button is automatically hidden if no items are available
- **Conditional Features**: Summary and completed filter features are completely optional and only appear when their respective props are provided

### DataViewToolbar
Toolbar component for search, view mode switching, filtering, and actions.

### DataViewTable
Table view component for displaying data in a tabular format.

### DataViewKanban
Kanban board view component for drag-and-drop task management.

### DataViewCalendar
Calendar view component for date-based data visualization.

### DataTable
Low-level table component with sorting, filtering, pagination, and row selection.

## Basic Usage

### 1. Define Your Data Type

```typescript
type MyDataType = {
  id: string | number
  name: string
  status: string
  // ... other fields
}
```

### 2. Define Table Columns

```typescript
import { ColumnDef } from "@tanstack/react-table"
import { DataViewTable } from "@/components/data-view"

const columns: ColumnDef<MyDataType>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div>{row.original.name}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge>{row.original.status}</Badge>,
  },
  // ... more columns
]
```

### 3. Use DataViewPage

```typescript
import {
  DataViewPage,
  DataViewToolbar,
  DataViewTable,
  ViewMode,
} from "@/components/data-view"

export default function MyPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [data, setData] = useState<MyDataType[]>([])
  
  return (
    <DataViewPage
      title="My Data"
      viewMode={viewMode}
      availableViewModes={["table"]} // Only show table view
      headerRight={
        <DataViewToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreate={() => {
            // Handle create action
          }}
          createLabel="New Item"
          availableViewModes={["table"]}
        />
      }
    >
      <DataViewTable
        data={data}
        columns={columns}
        onRowClick={(row) => {
          // Handle row click
        }}
        onDeleteRow={(id) => {
          // Handle delete
        }}
      />
    </DataViewPage>
  )
}
```

## Props Reference

### DataViewPage

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** | Page title displayed on the left side of header |
| `viewMode` | `ViewMode` | **required** | Current view mode |
| `availableViewModes` | `ViewMode[]` | `["table", "kanban", "calendar"]` | Available view modes to show |
| `summaryStats` | `SummaryStats?` | - | Summary statistics. **If provided**, shows summary chart and toggle in dropdown menu. If not provided, summary features are completely hidden |
| `showCompleted` | `boolean?` | - | Show completed items. **Required if you want completed filter functionality**. Must be provided together with `onCompletedFilterChange` |
| `showSummary` | `boolean?` | - | Show summary chart. Only used if `summaryStats` is provided |
| `onCompletedFilterChange` | `(showCompleted: boolean) => void?` | - | Callback when completed filter changes. **Required if `showCompleted` is provided** |
| `onSummaryVisibilityChange` | `(showSummary: boolean) => void?` | - | Callback when summary visibility changes |
| `headerRight` | `ReactNode?` | - | Desktop header actions (toolbar) |
| `headerRightMobile` | `ReactNode?` | - | Mobile header actions |
| `toolbar` | `ReactNode?` | - | Mobile toolbar below header |
| `contentSpacing` | `string?` | View mode based | Spacing between toolbar and content |
| `isEmpty` | `boolean?` | `false` | Whether to show empty state instead of children |
| `emptyState` | `EmptyStateConfig?` | - | Configuration for empty state (icon, title, description, action) |
| `children` | `ReactNode` | **required** | View content (DataViewTable, DataViewKanban, etc.) |

### DataViewToolbar

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `viewMode` | `ViewMode` | **required** | Current view mode |
| `onViewModeChange` | `(mode: ViewMode) => void` | **required** | View mode change handler |
| `onCreate` | `() => void?` | - | Create button click handler |
| `createLabel` | `string?` | `"New"` | Create button label |
| `availableViewModes` | `ViewMode[]` | `["table", "kanban", "calendar"]` | Available view modes |
| `showToolbar` | `boolean?` | `true` | Show/hide toolbar |
| `searchValue` | `string?` | - | Search input value |
| `onSearchChange` | `(value: string) => void?` | - | Search change handler |
| `searchPlaceholder` | `string?` | `"Search..."` | Search placeholder text |
| `filterTab` | `FilterTab?` | - | Current filter tab |
| `onFilterChange` | `(filter: FilterTab) => void?` | - | Filter change handler |

**Deprecated Props** (still work for backwards compatibility):
- `onNewTask` → Use `onCreate`
- `newTaskLabel` → Use `createLabel`

### DataViewTable

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `TData[]` | **required** | Table data |
| `columns` | `ColumnDef<TData>[]` | **required** | Table column definitions |
| `onRowClick` | `(row: TData) => void?` | - | Row click handler |
| `onDeleteRow` | `(id: string \| number) => void?` | - | Delete row handler |
| `onStatusChange` | `(id: string \| number, status: string) => void?` | - | Status change handler |
| `onLoadMore` | `() => void?` | - | Load more data (infinite scroll) |
| `hasMore` | `boolean?` | `false` | Has more data to load |
| `isLoading` | `boolean?` | `false` | Loading state |
| `filterTab` | `FilterTab?` | - | Filter tab (optional, only for task-like data) |
| `className` | `string?` | - | Additional CSS classes |

### DataTable

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `TData[]` | **required** | Table data |
| `columns` | `ColumnDef<TData>[]` | **required** | Column definitions |
| `onRowClick` | `(row: TData) => void?` | - | Row click handler |
| `onDeleteRow` | `(id: string \| number) => void?` | - | Delete handler |
| `onStatusChange` | `(id: string \| number, status: string) => void?` | - | Status change handler |
| `onLoadMore` | `() => void?` | - | Infinite scroll handler |
| `hasMore` | `boolean?` | `false` | Has more data |
| `isLoading` | `boolean?` | `false` | Loading state |

## Examples

### Simple Table View

```typescript
import { DataViewPage, DataViewTable, ViewMode } from "@/components/data-view"
import { ColumnDef } from "@tanstack/react-table"

type Product = {
  id: string
  name: string
  price: number
  stock: number
}

const columns: ColumnDef<Product>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "price", header: "Price" },
  { accessorKey: "stock", header: "Stock" },
]

export default function ProductsPage() {
  const [viewMode] = useState<ViewMode>("table")
  const [products, setProducts] = useState<Product[]>([])

  return (
    <DataViewPage
      title="Products"
      viewMode={viewMode}
      availableViewModes={["table"]}
      headerRight={
        <DataViewToolbar
          viewMode={viewMode}
          onViewModeChange={() => {}}
          onCreate={() => console.log("Create product")}
          createLabel="New Product"
          availableViewModes={["table"]}
        />
      }
    >
      <DataViewTable
        data={products}
        columns={columns}
        onRowClick={(product) => console.log("Clicked:", product)}
        onDeleteRow={(id) => console.log("Delete:", id)}
      />
    </DataViewPage>
  )
}
```

### Multiple View Modes

```typescript
export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  
  return (
    <DataViewPage
      title="Tasks"
      viewMode={viewMode}
      availableViewModes={["table", "kanban", "calendar"]}
      headerRight={
        <DataViewToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreate={handleCreate}
          createLabel="New Task"
          availableViewModes={["table", "kanban", "calendar"]}
        />
      }
    >
      {viewMode === "table" && (
        <DataViewTable data={tasks} columns={columns} />
      )}
      {viewMode === "kanban" && (
        <DataViewKanban columns={kanbanColumns} />
      )}
      {viewMode === "calendar" && (
        <DataViewCalendar tasks={tasks} />
      )}
    </DataViewPage>
  )
}
```

### With Optional Features (Summary & Completed Filter)

```typescript
export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [showCompleted, setShowCompleted] = useState(true)
  const [showSummary, setShowSummary] = useState(true)
  
  // Summary stats - if provided, shows summary chart and toggle in dropdown
  const summaryStats = {
    total: 10,
    completed: 5,
    inProgress: 3,
    todo: 2
  }
  
  return (
    <DataViewPage
      title="Tasks"
      viewMode={viewMode}
      // Summary feature - only shown if summaryStats is provided
      summaryStats={summaryStats}
      showSummary={showSummary}
      onSummaryVisibilityChange={setShowSummary}
      // Completed filter - only shown if both showCompleted and onCompletedFilterChange are provided
      showCompleted={showCompleted}
      onCompletedFilterChange={setShowCompleted}
      headerRight={<DataViewToolbar ... />}
    >
      <DataViewTable data={tasks} columns={columns} />
    </DataViewPage>
  )
}
```

**Note**: The dropdown menu (three dots) next to the title automatically shows/hides items based on provided props:
- Summary toggle appears only if `summaryStats` is provided
- Completed filter toggle appears only if both `showCompleted` and `onCompletedFilterChange` are provided
- If no items are available, the dropdown menu button is hidden

### Custom Content Spacing

```typescript
<DataViewPage
  title="My Data"
  viewMode="table"
  contentSpacing="mt-8" // Custom spacing
>
  <DataViewTable data={data} columns={columns} />
</DataViewPage>
```

### Without Toolbar

```typescript
<DataViewPage
  title="My Data"
  viewMode="table"
>
  <DataViewTable data={data} columns={columns} />
</DataViewPage>
```

Or hide toolbar:

```typescript
<DataViewToolbar
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  showToolbar={false} // Hide toolbar
/>
```

## Task-Specific Helpers

For task management, you can use the exported `createTaskColumns` function:

```typescript
import { createTaskColumns } from "@/components/data-view"
import { useTranslations } from "next-intl"

const t = useTranslations("tasks")
const columns = createTaskColumns(t, taskStatuses)
```

## Layout Integration

The data-view components expect to be used within a layout that provides padding:

```typescript
// In your layout.tsx
<main className="flex-1">
  <div className="w-full px-4 py-4 md:px-6 md:py-6">
    {children} {/* DataViewPage goes here */}
  </div>
</main>
```

The components themselves don't add padding - they fill the available space.

## Styling

### Table Header Styling

The table header automatically uses:
- Background: `bg-muted/50`
- Text color: `text-muted-foreground`
- Border: `border-b border-border`
- Rounded corners: `rounded-lg` (on container)

### Content Spacing

Default spacing between toolbar and content:
- **Calendar**: `mt-4`
- **Table**: `mt-0` (no spacing)
- **Kanban**: `mt-1`

You can override with `contentSpacing` prop.

### Empty State

Display an empty state when there's no data:

```typescript
import { DataViewPage, EmptyStateConfig } from "@/components/data-view"
import { IconInbox } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export default function MyPage() {
  const [data, setData] = useState<MyDataType[]>([])
  const isEmpty = data.length === 0

  const emptyState: EmptyStateConfig = {
    icon: <IconInbox className="h-8 w-8" />,
    title: "No items found",
    description: "Get started by creating your first item.",
    action: (
      <Button onClick={() => handleCreate()}>
        Create Item
      </Button>
    ),
  }

  return (
    <DataViewPage
      title="My Data"
      viewMode="table"
      isEmpty={isEmpty}
      emptyState={emptyState}
      // ... other props
    >
      <DataViewTable data={data} columns={columns} />
    </DataViewPage>
  )
}
```

**EmptyStateConfig Properties:**
- `icon?: ReactNode` - Icon to display (optional)
- `title: string` - Title text (required)
- `description?: string` - Description text (optional)
- `action?: ReactNode` - Action button/content (optional)

## Best Practices

1. **Always provide columns**: The `columns` prop is required for DataViewTable
2. **Use generic prop names**: Prefer `onCreate` over `onNewTask`, `onRowClick` over `onTaskClick`
3. **Define columns in page**: Keep column definitions close to where they're used
4. **Handle loading states**: Use `isLoading` prop for better UX
5. **Implement infinite scroll**: Use `onLoadMore` and `hasMore` for large datasets
6. **Handle empty states**: Use `isEmpty` and `emptyState` props to show a helpful message when data is empty
7. **Conditional features**: Only provide props for features you want to use:
   - Don't provide `summaryConfig` if you don't want summary functionality (chart and dropdown item will be hidden)
   - Don't provide `showCompleted`/`onCompletedFilterChange` if you don't want completed filter (dropdown item will be hidden)
   - The dropdown menu automatically adjusts based on what you provide
8. **Title is required**: Always provide a `title` prop - it's displayed on the left side of the header

## Migration from Task-Specific Usage

If you're migrating from task-specific usage:

1. Replace `onNewTask` → `onCreate`
2. Replace `newTaskLabel` → `createLabel`
3. Replace `onTaskClick` → `onRowClick`
4. Replace `onDeleteTask` → `onDeleteRow`
5. Remove `taskStatuses`, `workspaceId`, `brandId` props
6. Add `columns` prop (required)
7. Use `createTaskColumns` helper if needed for tasks

## Type Safety

All components are fully typed with TypeScript generics:

```typescript
<DataViewTable<MyDataType>
  data={myData}
  columns={myColumns}
  onRowClick={(row) => {
    // row is typed as MyDataType
  }}
/>
```
