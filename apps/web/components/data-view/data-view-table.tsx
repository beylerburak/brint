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
}

export const DataViewTable = memo(function DataViewTable({
  data,
  filterTab,
  onLoadMore,
  hasMore,
  isLoading,
  className = "",
  onTaskClick,
}: DataViewTableProps) {
  // Filter data based on filterTab
  const filteredData = useMemo(() => {
    return filterTasksByTab<TableTask>(data, filterTab)
  }, [data, filterTab])

  return (
    <div className={`w-full sm:px-6 px-0 flex-1 min-h-0 flex flex-col -mt-3 ${className}`}>
      <DataTable
        data={filteredData}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
        onRowClick={(row) => onTaskClick?.(row as unknown as TableTask)}
      />
    </div>
  )
})
