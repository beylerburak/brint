"use client"

import { useRef, useMemo, createRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useWorkspace } from "@/contexts/workspace-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  IconChevronDown,
  IconPlus,
  IconDots,
  IconEdit,
  IconTrash,
  IconSettings,
  IconMessage,
  IconFlagFilled,
  IconUserOff,
} from "@tabler/icons-react"
import { KanbanTask } from "./types"

export interface KanbanColumn {
  id: string
  label: string
  icon: React.ReactNode
  iconColor: string
  tasks: KanbanTask[]
}

interface KanbanColumnContentProps {
  parentRef: React.RefObject<HTMLDivElement | null>
  tasks: KanbanTask[]
  limit: number
  isExpanded: boolean
  onShowMore: () => void
  draggingCardId: string | null
  setDraggingCardId: (id: string | null) => void
  onTaskClick?: (task: KanbanTask) => void
}

function KanbanColumnContent({
  parentRef,
  tasks,
  limit,
  isExpanded,
  onShowMore,
  draggingCardId,
  setDraggingCardId,
  onTaskClick,
}: KanbanColumnContentProps) {
  const displayedTasks = isExpanded ? tasks : tasks.slice(0, limit)
  const hasMore = tasks.length > limit && !isExpanded

  const gapSize = 8 // gap-2 = 0.5rem = 8px
  // Increased estimate to accommodate actual card content (title, badges, padding, etc.)
  const estimatedCardHeight = 130

  const virtualizer = useVirtualizer({
    count: displayedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Add gap to each item except the last one
      const isLast = index === displayedTasks.length - 1
      return estimatedCardHeight + (isLast ? 0 : gapSize)
    },
    overscan: 5,
    measureElement: (element: Element, entry: ResizeObserverEntry | undefined) => {
      if (!entry) {
        return estimatedCardHeight + gapSize
      }
      const height = entry.target.getBoundingClientRect().height
      // Add gap to measured height except for the last item
      const index = Array.from(element.parentElement?.children || []).indexOf(element)
      const isLast = index === displayedTasks.length - 1
      return height + (isLast ? 0 : gapSize)
    },
  })

  const buttonHeight = 48

  return (
    <div ref={parentRef} className="flex flex-col overflow-y-auto flex-1 min-h-0 scrollbar-hide">
      <div
        style={{
          height: `${virtualizer.getTotalSize() + buttonHeight}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const task = displayedTasks[virtualItem.index]
          return (
            <div
              key={task.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              draggable
              onDragStart={(e) => {
                setDraggingCardId(String(task.id))
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragEnd={() => {
                setDraggingCardId(null)
              }}
              onClick={(e) => {
                // Don't trigger click if dragging
                if (draggingCardId !== String(task.id)) {
                  onTaskClick?.(task)
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className={`rounded-sm border bg-card p-3 flex items-start justify-between gap-3 hover:bg-accent hover:border-border transition-all cursor-grab active:cursor-grabbing ${draggingCardId === String(task.id)
                ? "opacity-50 scale-95 !border-2 !border-primary rotate-1"
                : "cursor-pointer"
                }`}
            >
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-sm font-medium line-clamp-2">{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.dueDateDisplay || task.dueDate}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-muted-foreground px-1.5 h-5">
                      <IconFlagFilled className={`h-3.5 w-3.5 ${task.priorityColor}`} />
                      <span>{task.priority}</span>
                    </Badge>
                    {typeof task.commentCount === 'number' && task.commentCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        <IconMessage className="h-3 w-3" />
                        <span>{task.commentCount}</span>
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {task.assignedTo && task.assignedTo.length > 0 ? (
                    <Avatar className="h-8 w-8">
                      {task.assignedTo[0].avatarUrl && (
                        <AvatarImage src={task.assignedTo[0].avatarUrl} alt={task.assignedTo[0].name || ""} />
                      )}
                      <AvatarFallback>
                        {task.assignedTo[0].name
                          ? task.assignedTo[0].name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                          : (task.assignedTo[0] as any).email?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className="h-8 w-8 border border-dashed border-muted-foreground/30">
                      <AvatarFallback className="bg-muted/50">
                        <IconUserOff className="h-4 w-4 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
            </div>
          )
        })}
        <div
          style={{
            position: 'absolute',
            top: `${virtualizer.getTotalSize()}px`,
            left: 0,
            right: 0,
          }}
          className="flex flex-col gap-1 pt-1 pb-2"
        >
          {hasMore ? (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={onShowMore}
            >
              <IconPlus className="h-4 w-4" />
              <span className="text-sm">Show more ({tasks.length - limit} remaining)</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <IconPlus className="h-4 w-4" />
              <span className="text-sm">Add task</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface DataViewKanbanProps {
  columns: KanbanColumn[]
  columnLimits: Record<string, number>
  expandedColumns: Set<string>
  collapsedColumns: Set<string>
  onColumnLimitChange: (columnId: string, limit: number) => void
  onColumnExpand: (columnId: string) => void
  onColumnCollapse: (columnId: string) => void
  draggingCardId: string | null
  setDraggingCardId: (id: string | null) => void
  className?: string
  onTaskClick?: (task: KanbanTask) => void
}

export function DataViewKanban({
  columns,
  columnLimits,
  expandedColumns,
  collapsedColumns,
  onColumnLimitChange,
  onColumnExpand,
  onColumnCollapse,
  draggingCardId,
  setDraggingCardId,
  className = "",
  onTaskClick,
}: DataViewKanbanProps) {
  const { currentWorkspace } = useWorkspace()

  // Check if user can delete task (requires ADMIN or OWNER role)
  // Backend requires ADMIN for task:delete, but OWNER bypasses all checks
  const canDeleteTask = () => {
    if (!currentWorkspace?.userRole) return false
    const role = currentWorkspace.userRole
    return role === 'OWNER' || role === 'ADMIN'
  }

  // Create refs for each column - use a Map to store refs
  const columnRefsMap = useMemo(() => {
    return new Map<string, React.RefObject<HTMLDivElement | null>>()
  }, [])

  // Initialize refs for columns that don't have them yet
  columns.forEach((col) => {
    if (!columnRefsMap.has(col.id)) {
      columnRefsMap.set(col.id, createRef<HTMLDivElement>())
    }
  })

  return (
    <div className={`w-full pt-2 pb-4 ${className}`}>
      <div className="flex flex-row gap-4 overflow-x-auto">
        {columns.map((column) => {
          const isCollapsed = collapsedColumns.has(column.id)
          const isExpanded = expandedColumns.has(column.id)
          const limit = columnLimits[column.id] || 20
          const parentRef = columnRefsMap.get(column.id) || { current: null }

          return (
            <div
              key={column.id}
              className="flex flex-col w-[320px] gap-2 flex-shrink-0 h-[calc(100vh-300px)]"
            >
              {/* Header */}
              <div className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
                {column.icon}
                <span className="text-sm font-medium">{column.label}</span>
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-xs group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground transition-colors"
                >
                  {column.tasks.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-accent"
                  onClick={() => onColumnCollapse(column.id)}
                >
                  <IconChevronDown
                    className={`h-4 w-4 transition-transform ${!isCollapsed ? 'rotate-180' : ''}`}
                  />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-accent"
                    >
                      <IconDots className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <IconEdit className="h-4 w-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <IconSettings className="h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      variant="destructive"
                      disabled={!canDeleteTask()}
                    >
                      <IconTrash className="h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Content */}
              {!isCollapsed && (
                <KanbanColumnContent
                  parentRef={parentRef}
                  tasks={column.tasks}
                  limit={limit}
                  isExpanded={isExpanded}
                  onShowMore={() => {
                    onColumnExpand(column.id)
                    onColumnLimitChange(column.id, column.tasks.length)
                  }}
                  draggingCardId={draggingCardId}
                  setDraggingCardId={setDraggingCardId}
                  onTaskClick={onTaskClick}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
