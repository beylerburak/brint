# Data View Components

Generic, reusable, and performant data view components for displaying data in table or kanban views.

## Components

### `DataViewToolbar`
Toolbar component with search, view mode toggle, filter tabs, and action buttons.

**Props:**
- `viewMode`: Current view mode ("table" | "kanban")
- `filterTab`: Current filter tab
- `onViewModeChange`: Callback when view mode changes
- `onFilterChange`: Callback when filter changes
- `onSearchChange`: Optional search handler
- `onNewTask`: Optional new task handler
- Customizable labels and counts

### `DataSummaryChart`
Summary statistics display component showing priority and task statistics.

**Props:**
- `stats`: SummaryStats object with counts
- `className`: Optional additional classes

### `DataViewTable`
Table view wrapper component with filtering and infinite scroll support.

**Props:**
- `data`: Array of TableTask items
- `filterTab`: Current filter tab
- `onLoadMore`: Optional infinite scroll handler
- `hasMore`: Whether more data is available
- `isLoading`: Loading state
- `className`: Optional additional classes

## Types

All types are exported from `./types`:
- `ViewMode`: "table" | "kanban"
- `FilterTab`: "all" | "todo" | "inProgress" | "overdue" | "completed"
- `BaseTask`, `TableTask`, `KanbanTask`: Task data types
- `SummaryStats`: Statistics data type

## Usage Example

```tsx
import { 
  DataViewToolbar, 
  DataSummaryChart, 
  DataViewTable,
  ViewMode,
  FilterTab 
} from "@/components/data-view"

function MyDataView() {
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [filterTab, setFilterTab] = useState<FilterTab>("all")
  
  return (
    <>
      <DataViewToolbar
        viewMode={viewMode}
        filterTab={filterTab}
        onViewModeChange={setViewMode}
        onFilterChange={setFilterTab}
      />
      <DataSummaryChart stats={myStats} />
      <DataViewTable
        data={myData}
        filterTab={filterTab}
        onLoadMore={loadMore}
        hasMore={hasMore}
        isLoading={isLoading}
      />
    </>
  )
}
```

## Performance Optimizations

- Components are memoized with `React.memo`
- Custom comparison functions for deep memoization
- Virtualization support for large datasets
- Infinite scroll with debouncing
