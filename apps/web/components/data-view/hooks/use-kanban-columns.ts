import { useState, useRef, useMemo } from "react"
import { KanbanTask } from "../types"

export interface UseKanbanColumnsOptions {
  initialLimits?: Record<string, number>
  defaultLimit?: number
}

export function useKanbanColumns({
  initialLimits = {},
  defaultLimit = 20,
}: UseKanbanColumnsOptions = {}) {
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>(
    initialLimits
  )
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set())
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(
    new Set()
  )
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)

  const columnRefs = useMemo(() => {
    return {} as Record<string, React.RefObject<HTMLDivElement>>
  }, [])

  const getColumnRef = (columnId: string) => {
    if (!columnRefs[columnId]) {
      columnRefs[columnId] = { current: null }
    }
    return columnRefs[columnId]
  }

  const setColumnLimit = (columnId: string, limit: number) => {
    setColumnLimits((prev) => ({ ...prev, [columnId]: limit }))
  }

  const expandColumn = (columnId: string) => {
    setExpandedColumns((prev) => new Set(prev).add(columnId))
  }

  const collapseColumn = (columnId: string) => {
    setCollapsedColumns((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(columnId)) {
        newSet.delete(columnId)
      } else {
        newSet.add(columnId)
      }
      return newSet
    })
  }

  const getColumnLimit = (columnId: string) => {
    return columnLimits[columnId] || defaultLimit
  }

  return {
    columnLimits,
    expandedColumns,
    collapsedColumns,
    draggingCardId,
    setDraggingCardId,
    getColumnRef,
    setColumnLimit,
    expandColumn,
    collapseColumn,
    getColumnLimit,
  }
}
