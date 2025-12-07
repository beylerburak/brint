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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiClient } from "@/lib/api-client"
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "@/components/data-table/data-table-action-bar"
import { useTranslations } from "next-intl"

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
function getRelativeTime(dateString: string, t: (key: string) => string): string {
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
  const inText = t("table.time.in")
  const agoText = t("table.time.ago")
  
  // Check if "in" text is "içinde" (Turkish) - it should come after the number
  const isTurkishFormat = inText === "içinde"
  
  const formatTime = (count: number, unit: string) => {
    if (isPast) {
      return `${count} ${unit} ${agoText}`
    } else {
      if (isTurkishFormat) {
        // Turkish: "2 hafta içinde"
        return `${count} ${unit} ${inText}`
      } else {
        // English: "in 2 weeks"
        return `${inText} ${count} ${unit}`
      }
    }
  }

  if (years > 0) {
    const unit = years > 1 ? t("table.time.years") : t("table.time.year")
    return formatTime(years, unit)
  } else if (months > 0) {
    const unit = months > 1 ? t("table.time.months") : t("table.time.month")
    return formatTime(months, unit)
  } else if (weeks > 0) {
    const unit = weeks > 1 ? t("table.time.weeks") : t("table.time.week")
    return formatTime(weeks, unit)
  } else if (days > 0) {
    const unit = days > 1 ? t("table.time.days") : t("table.time.day")
    return formatTime(days, unit)
  } else if (hours > 0) {
    const unit = hours > 1 ? t("table.time.hours") : t("table.time.hour")
    return formatTime(hours, unit)
  } else if (minutes > 0) {
    const unit = minutes > 1 ? t("table.time.minutes") : t("table.time.minute")
    return formatTime(minutes, unit)
  } else if (seconds > 10) {
    const unit = seconds > 1 ? t("table.time.seconds") : t("table.time.second")
    return formatTime(seconds, unit)
  } else {
    return isPast ? t("table.time.justNow") : t("table.time.now")
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

// Actions cell component with delete dialog
function ActionsCell({ row, table }: { row: Row<z.infer<typeof schema>>; table: any }) {
  const onDeleteTask = (table.options.meta as any)?.onDeleteTask
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)

  const handleDelete = () => {
    if (onDeleteTask) {
      onDeleteTask(row.original.id)
    }
    setIsDeleteDialogOpen(false)
  }

  return (
    <>
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
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Task'ı sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu task'ı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Create columns function that uses translations
function createColumns(t: (key: string) => string, availableStatuses?: Array<{ id: string; label: string; color: string | null; isDefault: boolean; group?: 'TODO' | 'IN_PROGRESS' | 'DONE' }>): ColumnDef<z.infer<typeof schema>>[] {
  return [
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
      <SortableHeader column={column}>{t("table.columns.title")}</SortableHeader>
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
      <SortableHeader column={column}>{t("table.columns.assignedTo")}</SortableHeader>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.assignedTo?.length || 0
      const b = rowB.original.assignedTo?.length || 0
      return a - b
    },
    cell: ({ row }) => {
      const assignedUsers = row.original.assignedTo || []

      if (assignedUsers.length === 0) {
        return <span className="text-muted-foreground text-sm">{t("table.unassigned")}</span>
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
            <span className="text-sm">{firstUser.name || t("table.unknown")}</span>
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
      <SortableHeader column={column}>{t("table.columns.priority")}</SortableHeader>
    ),
    sortingFn: (rowA, rowB) => {
      // Support both translated and original priority values
      const priorityOrder: Record<string, number> = { 
        [t("priority.High")]: 3, 
        [t("priority.Medium")]: 2, 
        [t("priority.Low")]: 1,
        "High": 3, 
        "Medium": 2, 
        "Low": 1 
      }
      const a = priorityOrder[rowA.original.priority] || 0
      const b = priorityOrder[rowB.original.priority] || 0
      return a - b
    },
    cell: ({ row }) => {
      const priorityMap: Record<string, { label: string; color: string }> = {
        "Low": { label: t("priority.Low"), color: "text-green-500" },
        "Medium": { label: t("priority.Medium"), color: "text-yellow-500" },
        "High": { label: t("priority.High"), color: "text-red-500" },
        // API values
        "LOW": { label: t("priority.Low"), color: "text-green-500" },
        "MEDIUM": { label: t("priority.Medium"), color: "text-yellow-500" },
        "HIGH": { label: t("priority.High"), color: "text-red-500" },
        // Translated values (fallback)
        [t("priority.Low")]: { label: t("priority.Low"), color: "text-green-500" },
        [t("priority.Medium")]: { label: t("priority.Medium"), color: "text-yellow-500" },
        [t("priority.High")]: { label: t("priority.High"), color: "text-red-500" },
      }
      // Check if priority is already translated or use original
      const originalPriority = row.original.priority
      const priority = priorityMap[originalPriority] || { label: originalPriority, color: "text-yellow-500" }

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
      <SortableHeader column={column}>{t("table.columns.status")}</SortableHeader>
    ),
    sortingFn: (rowA, rowB) => {
      // Support both translated and original status values
      const statusOrder: Record<string, number> = {
        [t("status.Not Started")]: 1,
        [t("status.In Progress")]: 2,
        [t("status.Done")]: 3,
        "Not Started": 1,
        "In Progress": 2,
        "Done": 3
      }
      const a = statusOrder[rowA.original.status] || 0
      const b = statusOrder[rowB.original.status] || 0
      return a - b
    },
    cell: ({ row, table }) => {
      // Create reverse mapping for status display
      const statusDisplayMap: Record<string, "online" | "offline" | "maintenance" | "degraded"> = {
        [t("status.Done")]: "online",
        [t("status.In Progress")]: "maintenance",
        [t("status.Not Started")]: "offline",
        // Also support English keys for backwards compatibility
        "Done": "online",
        "In Progress": "maintenance",
        "Not Started": "offline",
      }
      
      // Get status for display - row.original.status might be a translation key or actual label
      const rawStatus = row.original.status
      
      // If status is a translation key (e.g., "Done"), find the actual label from API statuses
      let currentStatusDisplay = rawStatus
      const isUsingApiStatuses = availableStatuses && availableStatuses.length > 0
      
      if (isUsingApiStatuses) {
        // Check if rawStatus is a translation key (one of the standard statuses)
        const standardStatuses = ["Not Started", "In Progress", "Done", t("status.Not Started"), t("status.In Progress"), t("status.Done")]
        const isTranslationKey = standardStatuses.includes(rawStatus)
        
        if (isTranslationKey) {
          // Map translation key to status group and find the actual label
          const statusGroupMap: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
            "Not Started": "TODO",
            "In Progress": "IN_PROGRESS",
            "Done": "DONE",
            // Also check translated versions
            [t("status.Not Started")]: "TODO",
            [t("status.In Progress")]: "IN_PROGRESS",
            [t("status.Done")]: "DONE",
          }
          const targetGroup = statusGroupMap[rawStatus]
          if (targetGroup) {
            const groupStatuses = availableStatuses.filter(s => s.group === targetGroup)
            if (groupStatuses.length > 0) {
              // Use default status if available, otherwise first one
              currentStatusDisplay = groupStatuses.find(s => s.isDefault)?.label || groupStatuses[0].label
            }
          } else {
            // Try to find by label directly
            const foundStatus = availableStatuses.find(s => s.label === rawStatus)
            if (foundStatus) {
              currentStatusDisplay = foundStatus.label
            }
          }
        } else {
          // rawStatus is already the actual label (e.g., "Completed")
          currentStatusDisplay = rawStatus
        }
      }
      
      // Determine status color - prefer group-based mapping if available
      let status: "online" | "offline" | "maintenance" | "degraded" = "offline"
      if (isUsingApiStatuses) {
        const foundStatus = availableStatuses.find(s => s.label === currentStatusDisplay)
        if (foundStatus?.group) {
          const groupColorMap: Record<'TODO' | 'IN_PROGRESS' | 'DONE', "online" | "offline" | "maintenance" | "degraded"> = {
            TODO: "offline",
            IN_PROGRESS: "maintenance",
            DONE: "online",
          }
          status = groupColorMap[foundStatus.group]
        } else {
          // Try to map from display text (supports both English and translated values)
          status = statusDisplayMap[currentStatusDisplay] || statusDisplayMap[rawStatus] || "offline"
        }
      } else {
        // Fallback: use statusDisplayMap which includes translations
        status = statusDisplayMap[currentStatusDisplay] || statusDisplayMap[rawStatus] || "offline"
      }

      // Use API statuses if available, otherwise fall back to hardcoded statuses
      const statusesToUse = availableStatuses && availableStatuses.length > 0
        ? availableStatuses
        : [
            { label: t("status.Not Started"), group: 'TODO' as const },
            { label: t("status.In Progress"), group: 'IN_PROGRESS' as const },
            { label: t("status.Done"), group: 'DONE' as const },
          ]

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <Status status={status}>
                <StatusIndicator />
                <StatusLabel>{currentStatusDisplay}</StatusLabel>
              </Status>
              <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {statusesToUse.map((statusOption) => {
              const statusLabel = typeof statusOption === 'string' 
                ? statusOption 
                : statusOption.label
              const statusGroup = typeof statusOption === 'string' 
                ? undefined 
                : statusOption.group
              
              // Determine status color
              const getStatusColor = (group?: 'TODO' | 'IN_PROGRESS' | 'DONE'): "online" | "offline" | "maintenance" | "degraded" => {
                if (group) {
                  const groupColorMap: Record<'TODO' | 'IN_PROGRESS' | 'DONE', "online" | "offline" | "maintenance" | "degraded"> = {
                    TODO: "offline",
                    IN_PROGRESS: "maintenance",
                    DONE: "online",
                  }
                  return groupColorMap[group]
                }
                return statusDisplayMap[statusLabel] || "offline"
              }
              
              const statusColor = getStatusColor(statusGroup)
              
              return (
                <DropdownMenuItem
                  key={statusLabel}
                  onClick={() => {
                    const onStatusChange = (table.options.meta as any)?.onStatusChange
                    // Send the actual status label to API (e.g., "Completed" instead of "Done")
                    onStatusChange?.(row.original.id, statusLabel)
                  }}
                  className={currentStatusDisplay === statusLabel ? "bg-muted" : ""}
                >
                  <Status status={statusColor}>
                    <StatusIndicator />
                    <StatusLabel>{statusLabel}</StatusLabel>
                  </Status>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <SortableHeader column={column}>{t("table.columns.dueDate")}</SortableHeader>
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

      const relativeTime = getRelativeTime(row.original.dueDate, t)
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
    cell: ({ row, table }) => <ActionsCell row={row} table={table} />,
  },
  ]
}

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
  onDeleteTask,
  onStatusChange,
  workspaceId,
  brandId,
  ...props
}: {
  data: z.infer<typeof schema>[]
  onLoadMore?: () => void
  hasMore?: boolean
  isLoading?: boolean
  onRowClick?: (row: z.infer<typeof schema>) => void
  onDeleteTask?: (taskId: string | number) => void
  onStatusChange?: (taskId: string | number, newStatus: string) => void
  workspaceId?: string
  brandId?: string
}) {
  const t = useTranslations("tasks")
  const [data, setData] = React.useState(() => initialData)
  const [availableStatuses, setAvailableStatuses] = React.useState<Array<{ id: string; label: string; color: string | null; isDefault: boolean; group?: 'TODO' | 'IN_PROGRESS' | 'DONE' }>>([])
  
  // Fetch available statuses from API
  React.useEffect(() => {
    async function fetchStatuses() {
      if (!workspaceId) return
      try {
        const response = await apiClient.listTaskStatuses(workspaceId, brandId)
        const statusesWithGroup = [
          ...response.statuses.TODO.map(s => ({ ...s, group: 'TODO' as const })),
          ...response.statuses.IN_PROGRESS.map(s => ({ ...s, group: 'IN_PROGRESS' as const })),
          ...response.statuses.DONE.map(s => ({ ...s, group: 'DONE' as const })),
        ]
        setAvailableStatuses(statusesWithGroup)
      } catch (error) {
        console.error("Failed to fetch task statuses:", error)
        // Keep empty array, will fall back to hardcoded statuses
      }
    }
    fetchStatuses()
  }, [workspaceId, brandId])
  
  const columns = React.useMemo(() => createColumns(t, availableStatuses), [t, availableStatuses])

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
    onDeleteTask,
    onStatusChange: (taskId: string | number, newStatus: string) => {
      // Also update local state for immediate feedback
      updateStatus(taskId, newStatus)
      // Call external handler
      onStatusChange?.(taskId, newStatus)
    }
  }), [userPrefs, updateStatus, onDeleteTask, onStatusChange])

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
