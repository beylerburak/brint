"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  IconDots,
  IconListCheck,
  IconClock,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react"
import {
  DataViewToolbar,
  DataSummaryChart,
  DataViewTable,
  DataViewKanban,
  ViewMode,
  FilterTab,
  TableTask,
  KanbanTask,
  SummaryStats,
} from "@/components/data-view"
import { useKanbanColumns } from "@/components/data-view/hooks/use-kanban-columns"

// Generate dummy table tasks
function generateTableTasks(count: number, startId: number = 1): TableTask[] {
  const types = ["Feature", "Bug", "Improvement"]
  const priorities = ["High", "Medium", "Low"]
  const statuses = ["Not Started", "In Progress", "Done"]
  const users = [
    { id: "1", name: "Sarah Chen", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" },
    { id: "2", name: "Marcus Johnson", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus" },
    { id: "3", name: "Alex Rivera", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" },
    { id: "4", name: "Emma Wilson", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma" },
    { id: "5", name: "David Kim", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=David" },
    { id: "6", name: "Lisa Anderson", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa" },
    { id: "7", name: "James Taylor", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=James" },
    { id: "8", name: "Sophie Martinez", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie" },
  ]

  return Array.from({ length: count }, (_, i) => {
    const id = startId + i
    const assignedCount = Math.floor(Math.random() * 4)
    const assignedTo = users.slice(0, assignedCount)

    return {
      id,
      header: `Task ${id} - ${types[id % types.length]} Implementation`,
      type: types[id % types.length],
      priority: priorities[id % priorities.length] as "High" | "Medium" | "Low",
      status: statuses[id % statuses.length],
      dueDate: new Date(Date.now() + (id % 30 - 15) * 24 * 60 * 60 * 1000).toISOString(),
      assignedTo,
      commentCount: id % 8,
    }
  })
}

// Generate dummy kanban tasks
function generateKanbanTasks(status: string, count: number): KanbanTask[] {
  const priorities = ["High", "Medium", "Low"]
  const priorityColors = {
    High: "text-red-500",
    Medium: "text-yellow-500",
    Low: "text-green-500",
  }
  const users = ["Sarah", "Marcus", "Alex", "Emma", "David", "Lisa", "James", "Sophie"]

  return Array.from({ length: count }, (_, i) => ({
    id: `${status}-${i + 1}`,
    title: `Task ${i + 1} for ${status} - ${Math.random().toString(36).substring(7)}`,
    priority: priorities[i % 3] as "High" | "Medium" | "Low",
    priorityColor: priorityColors[priorities[i % 3] as keyof typeof priorityColors],
    dueDate: `in ${i + 1} days`,
    commentCount: i % 5,
    user: users[i % users.length],
    userSeed: users[i % users.length],
    status: status === "todo" ? "Not Started" : status === "completed" ? "Done" : "In Progress",
  }))
}

export default function BrandTasksPage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace } = useWorkspace()
  const t = useTranslations("tasks")

  // State
  const [brandId, setBrandId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [filterTab, setFilterTab] = useState<FilterTab>("all")
  const [showSummary, setShowSummary] = useState<boolean>(true)
  const [searchValue, setSearchValue] = useState("")

  // Infinite scroll state for table
  const [tableDataLimit, setTableDataLimit] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const totalTableItems = 500

  // Kanban columns hook
  const {
    columnLimits,
    expandedColumns,
    collapsedColumns,
    draggingCardId,
    setDraggingCardId,
    setColumnLimit,
    expandColumn,
    collapseColumn,
  } = useKanbanColumns({
    initialLimits: {
      todo: 20,
      inProgress: 20,
      overdue: 20,
      completed: 20,
    },
  })

  // Generate data
  const tasksData = useMemo(() => {
    return generateTableTasks(tableDataLimit)
  }, [tableDataLimit])

  const kanbanTasks = useMemo(
    () => ({
      todo: generateKanbanTasks("todo", 150),
      inProgress: generateKanbanTasks("inProgress", 120),
      overdue: generateKanbanTasks("overdue", 30),
      completed: generateKanbanTasks("completed", 200),
    }),
    []
  )

  // Summary stats
  const summaryStats: SummaryStats = useMemo(
    () => ({
      lowPriority: 24,
      mediumPriority: 12,
      highPriority: 8,
      totalTasks: 47,
      totalDone: 24,
      overdue: 3,
    }),
    []
  )

  // Kanban columns configuration
  const kanbanColumns = useMemo(
    () => [
      {
        id: "todo",
        label: "To Do",
        icon: <IconListCheck className="h-4 w-4 shrink-0 text-blue-500" />,
        iconColor: "text-blue-500",
        tasks: kanbanTasks.todo,
      },
      {
        id: "inProgress",
        label: "In Progress",
        icon: <IconClock className="h-4 w-4 shrink-0 text-yellow-500" />,
        iconColor: "text-yellow-500",
        tasks: kanbanTasks.inProgress,
      },
      {
        id: "overdue",
        label: "Overdue",
        icon: <IconAlertCircle className="h-4 w-4 shrink-0 text-red-500" />,
        iconColor: "text-red-500",
        tasks: kanbanTasks.overdue,
      },
      {
        id: "completed",
        label: "Completed",
        icon: <IconCheck className="h-4 w-4 shrink-0 text-green-500" />,
        iconColor: "text-green-500",
        tasks: kanbanTasks.completed,
      },
    ],
    [kanbanTasks]
  )

  // Load more data function
  const loadMoreTableData = useCallback(() => {
    if (isLoadingMore || tableDataLimit >= totalTableItems) return

    setIsLoadingMore(true)
    setTimeout(() => {
      setTableDataLimit((prev) => Math.min(prev + 50, totalTableItems))
      setIsLoadingMore(false)
    }, 500)
  }, [isLoadingMore, tableDataLimit, totalTableItems])

  // Initialize brand
  useEffect(() => {
    async function init() {
      try {
        const brand = await apiClient.getBrandBySlug({
          workspaceId: currentWorkspace!.id,
          slug: brandSlug,
        })
        if (brand) {
          setBrandId(brand.id)
        }
      } catch (error: any) {
        console.error("Failed to initialize:", error)
        toast.error("Failed to load page data")
      }
    }

    if (currentWorkspace && brandSlug) {
      init()
    }
  }, [currentWorkspace, brandSlug])

  return (
    <div className="w-full flex flex-col min-h-0" style={{ height: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-0 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <IconDots className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setShowSummary(!showSummary)}>
                {showSummary ? "Özeti gizle" : "Özeti göster"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Toolbar */}
        <DataViewToolbar
          viewMode={viewMode}
          filterTab={filterTab}
          searchValue={searchValue}
          onViewModeChange={setViewMode}
          onFilterChange={setFilterTab}
          onSearchChange={setSearchValue}
          onNewTask={() => {
            // Handle new task
          }}
          searchPlaceholder={t("toolbar.searchPlaceholder")}
          newTaskLabel={t("newTask")}
          filterLabels={{
            filter: t("toolbar.filter"),
            assignee: t("toolbar.assignee"),
            priority: t("toolbar.priority"),
          }}
          tabLabels={{
            todo: t("toolbar.tabs.todo"),
            inProgress: t("toolbar.tabs.inProgress"),
            overdue: t("toolbar.tabs.overdue"),
            completed: t("toolbar.tabs.completed"),
            all: t("toolbar.tabs.all"),
          }}
        />
      </div>

      {/* Summary Chart */}
      {showSummary && (
        <DataSummaryChart
          stats={summaryStats}
          className={viewMode === "table" ? "pb-0" : "pb-1"}
        />
      )}

      {/* Data View */}
      <div
        className={`w-full px-6 flex-1 min-h-0 flex flex-col ${
          viewMode === "table" ? "-mt-4" : ""
        }`}
      >
        {viewMode === "table" ? (
          <DataViewTable
            data={tasksData}
            filterTab={filterTab}
            onLoadMore={loadMoreTableData}
            hasMore={tableDataLimit < totalTableItems}
            isLoading={isLoadingMore}
          />
        ) : (
          <DataViewKanban
            columns={kanbanColumns}
            columnLimits={columnLimits}
            expandedColumns={expandedColumns}
            collapsedColumns={collapsedColumns}
            onColumnLimitChange={setColumnLimit}
            onColumnExpand={expandColumn}
            onColumnCollapse={collapseColumn}
            draggingCardId={draggingCardId}
            setDraggingCardId={setDraggingCardId}
          />
        )}
      </div>
    </div>
  )
}
