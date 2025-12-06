# Data View Refactor Plan

## Component Structure

```
components/data-view/
├── types.ts                    # Generic types and interfaces
├── data-view-toolbar.tsx       # Toolbar component (search, filters, view toggle)
├── data-summary-chart.tsx      # Summary statistics component
├── data-view-table.tsx         # Table view wrapper
├── data-view-kanban.tsx        # Kanban view component (to be created)
├── hooks/
│   ├── use-data-view.ts        # Main data view hook
│   ├── use-infinite-scroll.ts  # Infinite scroll logic
│   └── use-kanban-columns.ts   # Kanban column management
├── utils/
│   ├── filter-data.ts          # Data filtering utilities
│   └── generate-stats.ts        # Statistics calculation
└── index.ts                    # Main exports
```

## Component Responsibilities

### 1. DataViewToolbar ✅
- Search input
- View mode toggle (table/kanban)
- Filter tabs (all, todo, inProgress, overdue, completed)
- Filter buttons (filter, assignee, priority)
- New task button
- Mobile responsive layout

### 2. DataSummaryChart ✅
- Priority statistics (Low, Medium, High)
- Task statistics (Total, Done, Overdue)
- Memoized for performance

### 3. DataViewTable ✅
- Wraps DataTable component
- Handles filtering based on filterTab
- Infinite scroll support
- Memoized with custom comparison

### 4. DataViewKanban (To be created)
- Kanban board layout
- Column management (todo, inProgress, overdue, completed)
- Drag and drop support
- Virtualization per column
- Collapsible columns

## Custom Hooks

### useDataView
```typescript
function useDataView<T extends BaseTask>({
  initialData,
  viewMode,
  filterTab,
  onLoadMore,
}) {
  // Data filtering
  // View mode management
  // Filter management
  // Returns: filteredData, handlers, state
}
```

### useInfiniteScroll
```typescript
function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 300,
}) {
  // Scroll event handling
  // Debouncing
  // Loading state management
}
```

### useKanbanColumns
```typescript
function useKanbanColumns({
  columns,
  initialLimits,
}) {
  // Column expansion/collapse
  // Column limits
  // Returns: columnState, handlers
}
```

## Migration Steps

1. ✅ Create types.ts with generic interfaces
2. ✅ Extract DataViewToolbar component
3. ✅ Extract DataSummaryChart component
4. ✅ Extract DataViewTable component
5. ⏳ Create DataViewKanban component
6. ⏳ Create custom hooks
7. ⏳ Create utility functions
8. ⏳ Refactor main page to use new components
9. ⏳ Add tests
10. ⏳ Performance optimization

## Performance Optimizations

- ✅ React.memo for components
- ✅ useMemo for expensive calculations
- ✅ useCallback for event handlers
- ✅ Custom memo comparison functions
- ✅ Virtualization (already in place)
- ✅ Infinite scroll with debouncing

## Benefits

1. **Reusability**: Components can be used in other pages
2. **Maintainability**: Clear separation of concerns
3. **Testability**: Each component can be tested independently
4. **Performance**: Memoization and virtualization
5. **Type Safety**: Generic types for flexibility
6. **Scalability**: Easy to add new features
