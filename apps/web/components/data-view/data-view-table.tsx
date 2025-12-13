"use client"

import { memo, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./data-table"
import { TableTask, FilterTab } from "./types"
import { filterTasksByTab } from "./utils/filter-data"

interface DataViewTableProps<TData extends { id: string | number }> {
  data: TData[]
  columns: ColumnDef<TData>[] // Required
  filterTab?: FilterTab // Optional - only used if data has status field
  onLoadMore?: () => void
  hasMore?: boolean
  isLoading?: boolean
  className?: string
  onRowClick?: (row: TData) => void
  onDeleteRow?: (rowId: string | number) => void | Promise<void>
  onStatusChange?: (rowId: string | number, newStatus: string) => void
}

export const DataViewTable = memo(function DataViewTable<TData extends { id: string | number }>({
  data,
  columns,
  filterTab,
  onLoadMore,
  hasMore,
  isLoading,
  className = "",
  onRowClick,
  onDeleteRow,
  onStatusChange,
}: DataViewTableProps<TData>) {
  // Filter data based on filterTab (only if filterTab is provided and data is TableTask)
  const filteredData = useMemo(() => {
    if (!filterTab) return data
    // Only apply filter if data is TableTask-like
    if ('status' in (data[0] || {})) {
      return filterTasksByTab<TData>(data, filterTab)
    }
    return data
  }, [data, filterTab])

  return (
    <div className={`w-full px-0 flex-1 min-h-0 flex flex-col ${className}`}>
      <DataTable
        data={filteredData}
        columns={columns}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
        onRowClick={onRowClick}
        onDeleteRow={onDeleteRow}
        onStatusChange={onStatusChange}
      />
    </div>
  )
}) as <TData extends { id: string | number }>(props: DataViewTableProps<TData>) => JSX.Element
