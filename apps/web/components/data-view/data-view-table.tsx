"use client"

import { memo, useMemo } from "react"
import { DataTable } from "@/components/data-table"
import { TableTask, FilterTab } from "./types"
import { filterTasksByTab } from "./utils/filter-data"

interface DataViewTableProps {
  data: TableTask[]
  filterTab: FilterTab
  onLoadMore?: () => void
  hasMore?: boolean
  isLoading?: boolean
  className?: string
  onTaskClick?: (task: TableTask) => void
  onDeleteTask?: (taskId: string | number) => void
  workspaceId?: string
  brandId?: string
  taskStatuses?: {
    TODO: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
    IN_PROGRESS: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
    DONE: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
  }
}

export const DataViewTable = memo(function DataViewTable({
  data,
  filterTab,
  onLoadMore,
  hasMore,
  isLoading,
  className = "",
  onTaskClick,
  onDeleteTask,
  onStatusChange,
  workspaceId,
  brandId,
  taskStatuses,
}: DataViewTableProps & { onStatusChange?: (taskId: string | number, newStatus: string) => void }) {
  // Filter data based on filterTab
  const filteredData = useMemo(() => {
    return filterTasksByTab<TableTask>(data, filterTab)
  }, [data, filterTab])

  return (
    <div className={`w-full px-0 flex-1 min-h-0 flex flex-col -mt-3 ${className}`}>
      <DataTable
        data={filteredData}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
        onRowClick={(row) => onTaskClick?.(row as unknown as TableTask)}
        onDeleteTask={onDeleteTask}
        onStatusChange={onStatusChange}
        workspaceId={workspaceId}
        brandId={brandId}
        taskStatuses={taskStatuses}
      />
    </div>
  )
})
