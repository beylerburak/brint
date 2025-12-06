"use client"

import * as React from "react"
import { useRef, useCallback } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconArrowsSort,
  IconArrowUp,
  IconArrowDown,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconFlagFilled,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconMessage,
  IconPlus,
  IconTrendingUp,
  IconX,
} from "@tabler/icons-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Status, StatusIndicator, StatusLabel } from "@/components/kibo-ui/status"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { apiClient } from "@/lib/api-client"
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "@/components/data-table/data-table-action-bar"

export const schema = z.object({
  id: z.union([z.string(), z.number()]),
  taskNumber: z.number().optional(),
  header: z.string(),
  type: z.string(),
  priority: z.string(),
  status: z.string(),
  dueDate: z.string(),
  assignedTo: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })).optional(),
  commentCount: z.number().optional(),
})

// Utility function to format date based on user preferences
function formatDate(
  dateString: string,
  dateFormat: "DMY" | "MDY" | "YMD",
  timeFormat: "H24" | "H12"
): string {
  const date = new Date(dateString)

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()

  // Format time
  let timeStr = ""
  if (timeFormat === "H12") {
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    timeStr = `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
  } else {
    timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  }

  // Format date based on preference
  let dateStr = ""
  if (dateFormat === "DMY") {
    dateStr = `${day}/${month}/${year}`
  } else if (dateFormat === "MDY") {
    dateStr = `${month}/${day}/${year}`
  } else if (dateFormat === "YMD") {
    dateStr = `${year}/${month}/${day}`
  }

  return `${dateStr} ${timeStr}`
}

// Utility function to get relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000)

  const seconds = Math.abs(diffInSeconds)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  const isPast = diffInSeconds < 0
  const prefix = isPast ? "" : "in "
  const suffix = isPast ? " ago" : ""

  if (years > 0) {
    return `${prefix}${years} year${years > 1 ? "s" : ""}${suffix}`
  } else if (months > 0) {
    return `${prefix}${months} month${months > 1 ? "s" : ""}${suffix}`
  } else if (weeks > 0) {
    return `${prefix}${weeks} week${weeks > 1 ? "s" : ""}${suffix}`
  } else if (days > 0) {
    return `${prefix}${days} day${days > 1 ? "s" : ""}${suffix}`
  } else if (hours > 0) {
    return `${prefix}${hours} hour${hours > 1 ? "s" : ""}${suffix}`
  } else if (minutes > 0) {
    return `${prefix}${minutes} minute${minutes > 1 ? "s" : ""}${suffix}`
  } else if (seconds > 10) {
    return `${prefix}${seconds} second${seconds > 1 ? "s" : ""}${suffix}`
  } else {
    return isPast ? "just now" : "now"
  }
}

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string | number }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

// Sortable header component
function SortableHeader({ column, children }: { column: any; children: React.ReactNode }) {
  const canSort = column.getCanSort()
  const sortDirection = column.getIsSorted()

  if (!canSort) {
    return <>{children}</>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
          {children}
          {sortDirection === "asc" ? (
            <IconArrowUp className="h-3.5 w-3.5" />
          ) : sortDirection === "desc" ? (
            <IconArrowDown className="h-3.5 w-3.5" />
          ) : (
            <IconArrowsSort className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
          <IconArrowUp className="h-4 w-4 mr-2" />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
          <IconArrowDown className="h-4 w-4 mr-2" />
          Descending
        </DropdownMenuItem>
        {sortDirection && (
          <DropdownMenuItem onClick={() => column.clearSorting()}>
            <IconX className="h-4 w-4 mr-2" />
            Reset
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "taskNumber",
    header: ({ column }) => (
      <SortableHeader column={column}>#</SortableHeader>
    ),
    size: 60,
    maxSize: 80,
    cell: ({ row }) => {
      return (
        <div className="flex items-center justify-start">
          <span className="text-sm text-muted-foreground">
            {row.original.taskNumber ? `TAS-${row.original.taskNumber}` : '-'}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "header",
    header: ({ column }) => (
      <SortableHeader column={column}>Title</SortableHeader>
    ),
    minSize: 200,
    size: 400,
    maxSize: 600,
    cell: ({ row }) => {
      const commentCount = row.original.commentCount || 0
      return (
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="min-w-0 flex-1 max-w-[550px]">
            <TableCellViewer item={row.original} />
          </div>
          {commentCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-2 flex-shrink-0">
              <IconMessage className="h-3 w-3" />
              <span>{commentCount}</span>
            </Badge>
          )}
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: "assignedTo",
    header: ({ column }) => (
      <SortableHeader column={column}>Assigned to</SortableHeader>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.assignedTo?.length || 0
      const b = rowB.original.assignedTo?.length || 0
      return a - b
    },
    cell: ({ row }) => {
      const assignedUsers = row.original.assignedTo || []

      if (assignedUsers.length === 0) {
        return <span className="text-muted-foreground text-sm">Unassigned</span>
      }

      const firstUser = assignedUsers[0]
      const remainingCount = assignedUsers.length - 1

      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {firstUser.avatarUrl && (
                <AvatarImage src={firstUser.avatarUrl} alt={firstUser.name || ""} />
              )}
              <AvatarFallback className="text-xs">
                {firstUser.name
                  ? firstUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{firstUser.name || "Unknown"}</span>
          </div>
          {remainingCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              +{remainingCount}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <SortableHeader column={column}>Priority</SortableHeader>
    ),
    sortingFn: (rowA, rowB) => {
      const priorityOrder = { "High": 3, "Medium": 2, "Low": 1 }
      const a = priorityOrder[rowA.original.priority as keyof typeof priorityOrder] || 0
      const b = priorityOrder[rowB.original.priority as keyof typeof priorityOrder] || 0
      return a - b
    },
    cell: ({ row }) => {
      const priorityMap: Record<string, { label: string; color: string }> = {
        "Low": { label: "Low", color: "text-green-500" },
        "Medium": { label: "Medium", color: "text-yellow-500" },
        "High": { label: "High", color: "text-red-500" },
      }
      const priority = priorityMap[row.original.priority] || priorityMap["Low"]

      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          <IconFlagFilled className={`h-3.5 w-3.5 ${priority.color}`} />
          <span>{priority.label}</span>
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortableHeader column={column}>Status</SortableHeader>
    ),
    sortingFn: (rowA, rowB) => {
      const statusOrder = { "Not Started": 1, "In Progress": 2, "Done": 3 }
      const a = statusOrder[rowA.original.status as keyof typeof statusOrder] || 0
      const b = statusOrder[rowB.original.status as keyof typeof statusOrder] || 0
      return a - b
    },
    cell: ({ row, table }) => {
      const statusMap: Record<string, "online" | "offline" | "maintenance" | "degraded"> = {
        "Done": "online",
        "In Progress": "maintenance",
        "Not Started": "offline",
      }
      const status = statusMap[row.original.status] || "offline"
      const updateStatus = (table.options.meta as any)?.updateStatus

      const availableStatuses = ["Not Started", "In Progress", "Done"]

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <Status status={status}>
                <StatusIndicator />
                <StatusLabel>{row.original.status}</StatusLabel>
              </Status>
              <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableStatuses.map((statusOption) => (
              <DropdownMenuItem
                key={statusOption}
                onClick={() => updateStatus?.(row.original.id, statusOption)}
                className={row.original.status === statusOption ? "bg-muted" : ""}
              >
                <Status status={statusMap[statusOption] || "offline"}>
                  <StatusIndicator />
                  <StatusLabel>{statusOption}</StatusLabel>
                </Status>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <SortableHeader column={column}>Due Date</SortableHeader>
    ),
    sortingFn: (rowA, rowB) => {
      const a = new Date(rowA.original.dueDate).getTime()
      const b = new Date(rowB.original.dueDate).getTime()
      return a - b
    },
    cell: ({ row, table }) => {
      const userPrefs = (table.options.meta as any)?.userPrefs
      const dateFormat = userPrefs?.dateFormat || "DMY"
      const timeFormat = userPrefs?.timeFormat || "H24"

      const relativeTime = getRelativeTime(row.original.dueDate)
      const fullDate = formatDate(row.original.dueDate, dateFormat, timeFormat)

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              {relativeTime}
            </TooltipTrigger>
            <TooltipContent>
              <p>{fullDate}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function DraggableRow({
  row,
  onRowClick
}: {
  row: Row<z.infer<typeof schema>>
  onRowClick?: (row: z.infer<typeof schema>) => void
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger row click if clicking on interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('[role="checkbox"]') ||
      target.closest('[role="menu"]') ||
      target.closest('[data-slot="dropdown-menu"]')
    ) {
      return
    }
    onRowClick?.(row.original)
  }

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      onClick={handleClick}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 cursor-pointer"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({
  data: initialData,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  onRowClick,
}: {
  data: z.infer<typeof schema>[]
  onLoadMore?: () => void
  hasMore?: boolean
  isLoading?: boolean
  onRowClick?: (row: z.infer<typeof schema>) => void
}) {
  const [data, setData] = React.useState(() => initialData)

  // Update data when initialData prop changes
  React.useEffect(() => {
    setData(initialData)
    // Clear selection when data changes (e.g., filter changes)
    setRowSelection({})
  }, [initialData])

  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [userPrefs, setUserPrefs] = React.useState<{
    dateFormat: "DMY" | "MDY" | "YMD"
    timeFormat: "H24" | "H12"
  } | null>(null)

  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  // Fetch user preferences
  React.useEffect(() => {
    async function fetchUserPrefs() {
      try {
        const response = await apiClient.getMe()
        setUserPrefs({
          dateFormat: response.user.dateFormat,
          timeFormat: response.user.timeFormat,
        })
      } catch (error) {
        // Fallback to defaults if fetch fails
        setUserPrefs({
          dateFormat: "DMY",
          timeFormat: "H24",
        })
      }
    }
    fetchUserPrefs()
  }, [])

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const updateStatus = React.useCallback((taskId: string | number, newStatus: string) => {
    setData((prevData) =>
      prevData.map((item) =>
        item.id === taskId ? { ...item, status: newStatus } : item
      )
    )
  }, [])

  const tableMeta = React.useMemo(() => ({
    userPrefs: userPrefs || { dateFormat: "DMY", timeFormat: "H24" },
    updateStatus,
  }), [userPrefs, updateStatus])

  const table = useReactTable({
    data,
    columns,
    meta: tableMeta,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  // Infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  const isLoadingRef = useRef(false)

  // Infinite scroll handler with debounce
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !onLoadMore || isLoadingRef.current || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const threshold = 300 // Load more when 300px from bottom

    if (scrollHeight - scrollTop - clientHeight < threshold) {
      isLoadingRef.current = true
      onLoadMore()
      // Reset loading flag after a delay to prevent rapid firing
      setTimeout(() => {
        isLoadingRef.current = false
      }, 1000)
    }
  }, [onLoadMore, hasMore])

  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [handleScroll])

  // Update loading ref when isLoading prop changes
  React.useEffect(() => {
    if (!isLoading) {
      isLoadingRef.current = false
    }
  }, [isLoading])

  return (
    <div className="w-full py-6 flex flex-col min-h-0 flex-1">
      <div ref={scrollContainerRef} className="overflow-auto flex-1 min-h-0">
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          id={sortableId}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              {rows?.length ? (
                <SortableContext
                  items={dataIds}
                  strategy={verticalListSortingStrategy}
                >
                  {rows.map((row) => (
                    <DraggableRow key={row.id} row={row} onRowClick={onRowClick} />
                  ))}
                  {isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-12 text-center"
                      >
                        <IconLoader className="h-4 w-4 animate-spin inline-block mr-2" />
                        Loading more...
                      </TableCell>
                    </TableRow>
                  )}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
      <DataTableActionBar table={table}>
        <DataTableActionBarSelection table={table} />
        <DataTableActionBarAction tooltip="Delete selected">
          <IconDotsVertical className="h-3.5 w-3.5" />
          Delete
        </DataTableActionBarAction>
      </DataTableActionBar>
    </div>
  )
}

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  return (
    <span className="text-foreground truncate block w-full">
      {item.header}
    </span>
  )
}
