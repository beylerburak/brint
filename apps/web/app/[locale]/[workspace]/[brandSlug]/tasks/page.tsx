"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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
  IconPlus,
} from "@tabler/icons-react"
import {
  DataViewToolbar,
  DataSummaryChart,
  DataViewTable,
  DataViewKanban,
  TaskDetailModal,
  ViewMode,
  FilterTab,
  TableTask,
  KanbanTask,
  SummaryStats,
  BaseTask,
} from "@/components/data-view"
import { useKanbanColumns } from "@/components/data-view/hooks/use-kanban-columns"
import { useWebSocket } from "@/hooks/use-websocket"

export default function BrandTasksPage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace } = useWorkspace()
  const t = useTranslations("tasks")

  // State
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brandInfo, setBrandInfo] = useState<{ name: string; slug: string; logoUrl?: string | null } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [filterTab, setFilterTab] = useState<FilterTab>("all")
  const [selectedTask, setSelectedTask] = useState<BaseTask | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)

  // Handle view mode change - set filter to "all" when switching to kanban
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === "kanban") {
      setFilterTab("all")
    }
  }, [])
  const [showSummary, setShowSummary] = useState<boolean>(true)
  const [searchValue, setSearchValue] = useState("")
  // Track locally updated tasks to ignore WebSocket events for them
  const locallyUpdatedTasksRef = useRef<Set<string>>(new Set())
  const [tasks, setTasks] = useState<Array<{
    id: string;
    taskNumber: number;
    title: string;
    description: string | null;
    status: {
      id: string;
      label: string;
      color: string | null;
      group: 'TODO' | 'IN_PROGRESS' | 'DONE';
    };
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assigneeUserId: string | null;
    dueDate: string | null;
    assignedTo?: Array<{ id: string; name: string | null; email: string; avatarUrl: string | null }>;
    checklistItems?: Array<{ id: string; title: string; isCompleted: boolean; sortOrder: number }>;
    createdAt: string;
    updatedAt: string;
  }>>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // Refs for preventing duplicate API calls
  const initFetchingRef = useRef(false)
  const initFetchedForRef = useRef<string | null>(null)

  // Create mode state
  const [isCreateMode, setIsCreateMode] = useState(false)

  // Infinite scroll state for table
  const [isLoadingMore, setIsLoadingMore] = useState(false)

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

  // Filter tasks by search value
  const filteredTasks = useMemo(() => {
    if (!searchValue.trim()) return tasks

    const searchLower = searchValue.toLowerCase().trim()
    return tasks.filter((task) =>
      task.title.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower)
    )
  }, [tasks, searchValue])

  // Transform API tasks to TableTask format
  const tasksData = useMemo(() => {
    return filteredTasks.map((task) => {
      const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', "Low" | "Medium" | "High"> = {
        LOW: "Low",
        MEDIUM: "Medium",
        HIGH: "High",
        CRITICAL: "High",
      }

      const statusMap: Record<'TODO' | 'IN_PROGRESS' | 'DONE', string> = {
        TODO: "Not Started",
        IN_PROGRESS: "In Progress",
        DONE: "Done",
      }

      return {
        id: task.id,
        taskNumber: task.taskNumber,
        title: task.title,
        description: task.description,
        header: task.title,
        type: "Task", // Default type, can be enhanced later
        priority: priorityMap[task.priority] || "Medium",
        status: statusMap[task.status.group] || task.status.label,
        dueDate: task.dueDate || new Date().toISOString(),
        assignedTo: (task as any).assignedTo || [], // Use assignedTo from API or empty array
        commentCount: (task as any)._count?.comments || 0,
      } as TableTask
    })
  }, [filteredTasks])

  // Transform API tasks to KanbanTask format
  const kanbanTasks = useMemo(() => {
    const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', "Low" | "Medium" | "High"> = {
      LOW: "Low",
      MEDIUM: "Medium",
      HIGH: "High",
      CRITICAL: "High",
    }

    const priorityColors = {
      Low: "text-green-500",
      Medium: "text-yellow-500",
      High: "text-red-500",
    }

    const todo: KanbanTask[] = []
    const inProgress: KanbanTask[] = []
    const overdue: KanbanTask[] = []
    const completed: KanbanTask[] = []

    const now = new Date()

    filteredTasks.forEach((task) => {
      const priority = priorityMap[task.priority] || "Medium"
      const priorityColor = priorityColors[priority]
      const dueDate = task.dueDate ? new Date(task.dueDate) : null
      const isOverdue = dueDate && dueDate < now && task.status.group !== 'DONE'

      const kanbanTask: KanbanTask = {
        id: task.id,
        taskNumber: task.taskNumber,
        title: task.title,
        description: task.description,
        priority,
        priorityColor,
        status: task.status.label,
        dueDate: task.dueDate || '', // Keep raw ISO date for modal
        dueDateDisplay: dueDate ? `in ${Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days` : "No due date",
        commentCount: (task as any)._count?.comments || 0,
        assignedTo: (task as any).assignedTo || [], // Use assignedTo from API or empty array
        user: task.assigneeUserId || "Unassigned",
        userSeed: task.assigneeUserId || "unassigned",
      }

      if (isOverdue) {
        overdue.push(kanbanTask)
      } else if (task.status.group === 'DONE') {
        completed.push(kanbanTask)
      } else if (task.status.group === 'IN_PROGRESS') {
        inProgress.push(kanbanTask)
      } else {
        todo.push(kanbanTask)
      }
    })

    return { todo, inProgress, overdue, completed }
  }, [filteredTasks])

  // Summary stats
  const summaryStats: SummaryStats = useMemo(() => {
    const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', "Low" | "Medium" | "High"> = {
      LOW: "Low",
      MEDIUM: "Medium",
      HIGH: "High",
      CRITICAL: "High",
    }

    const now = new Date()
    let lowPriority = 0
    let mediumPriority = 0
    let highPriority = 0
    let totalDone = 0
    let overdue = 0

    filteredTasks.forEach((task) => {
      const priority = priorityMap[task.priority] || "Medium"
      if (priority === "Low") lowPriority++
      else if (priority === "Medium") mediumPriority++
      else highPriority++

      if (task.status.group === 'DONE') totalDone++

      const dueDate = task.dueDate ? new Date(task.dueDate) : null
      if (dueDate && dueDate < now && task.status.group !== 'DONE') overdue++
    })

    return {
      lowPriority,
      mediumPriority,
      highPriority,
      totalTasks: filteredTasks.length,
      totalDone,
      overdue,
    }
  }, [filteredTasks])

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
  const loadMoreTableData = useCallback(async () => {
    if (isLoadingMore || !brandId || !currentWorkspace || pagination.page >= pagination.totalPages) return

    setIsLoadingMore(true)
    try {
      const response = await apiClient.listTasks({
        workspaceId: currentWorkspace.id,
        brandId,
        page: pagination.page + 1,
        limit: pagination.limit,
      })
      setTasks((prev) => [...prev, ...response.tasks])
      setPagination(response.pagination)
    } catch (error: any) {
      console.error("Failed to load more tasks:", error)
      toast.error("Failed to load more tasks")
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, brandId, currentWorkspace, pagination])

  // Initialize brand and load tasks
  useEffect(() => {
    async function init() {
      if (!currentWorkspace) return

      // Create a unique key for this fetch operation
      const fetchKey = `${currentWorkspace.id}:${brandSlug}`

      // Skip if already fetching or already fetched for this key
      if (initFetchingRef.current) {
        console.log('[Init] Skipping - already fetching')
        return
      }
      if (initFetchedForRef.current === fetchKey) {
        console.log('[Init] Skipping - already fetched for this key')
        return
      }

      initFetchingRef.current = true

      try {
        // Get brand ID
        const brandsResponse = await apiClient.listBrands(currentWorkspace.id)
        const brand = brandsResponse.brands.find((b) => b.slug === brandSlug)
        if (!brand) {
          toast.error("Brand not found")
          return
        }

        setBrandId(brand.id)
        setBrandInfo({
          name: brand.name,
          slug: brand.slug,
          logoUrl: brand.logoUrl || null,
        })

        // Load tasks
        setIsLoadingTasks(true)
        const tasksResponse = await apiClient.listTasks({
          workspaceId: currentWorkspace.id,
          brandId: brand.id,
          page: 1,
          limit: 50,
        })
        setTasks(tasksResponse.tasks)
        setPagination(tasksResponse.pagination)

        // Mark as fetched for this key
        initFetchedForRef.current = fetchKey
      } catch (error: any) {
        console.error("Failed to initialize:", error)
        toast.error("Failed to load page data")
      } finally {
        setIsLoadingTasks(false)
        initFetchingRef.current = false
      }
    }

    if (currentWorkspace && brandSlug) {
      init()
    }
  }, [currentWorkspace, brandSlug])

  // WebSocket connection for real-time updates
  useWebSocket({
    workspaceId: currentWorkspace?.id || "",
    brandId: brandId || undefined,
    enabled: !!currentWorkspace,
    onEvent: (event) => {
      switch (event.type) {
        case "task.created":
          // Add new task to the list
          setTasks((prev) => {
            // Check if task already exists (avoid duplicates)
            const exists = prev.some((t) => t.id === event.data.id)
            if (exists) return prev
            return [event.data, ...prev]
          })
          // Update pagination total
          setPagination((prev) => ({
            ...prev,
            total: prev.total + 1,
          }))
          break

        case "task.updated":
          console.log('[WebSocket] task.updated event:', event.data)

          // Ignore WebSocket events for tasks that were just updated locally
          if (locallyUpdatedTasksRef.current.has(String(event.data.id))) {
            console.log('[WebSocket] Ignoring WebSocket event for locally updated task:', event.data.id)
            break
          }

          // Update existing task - merge only changed fields to avoid overriding local updates
          setTasks((prev) => {
            const taskIndex = prev.findIndex((t) => String(t.id) === String(event.data.id))
            if (taskIndex === -1) {
              console.warn('[WebSocket] Task not found in state:', event.data.id)
              return prev
            }

            const updatedTasks = [...prev]
            const currentTask = updatedTasks[taskIndex]

            // Check if this is a checklist-only update (only checklistItems changed)
            // If checklistItems is present and other fields are not explicitly changed, preserve priority and attachments
            const hasChecklistUpdate = event.data.checklistItems !== undefined
            const hasOtherUpdates =
              event.data.title !== undefined ||
              event.data.description !== undefined ||
              event.data.status !== undefined ||
              event.data.dueDate !== undefined ||
              event.data.assignedTo !== undefined

            // If this is a checklist-only update (checklistItems changed but no other fields), 
            // don't update priority even if it's present in the event data
            const isChecklistOnlyUpdate = hasChecklistUpdate && !hasOtherUpdates

            // Merge only the fields that are present in the event data
            // For checklist-only updates, preserve priority and attachments
            updatedTasks[taskIndex] = {
              ...currentTask,
              ...(event.data.title !== undefined && { title: event.data.title }),
              ...(event.data.description !== undefined && { description: event.data.description }),
              ...(event.data.status !== undefined && {
                status: {
                  id: event.data.status.id,
                  label: event.data.status.label,
                  color: event.data.status.color,
                  group: event.data.status.group,
                }
              }),
              // Don't update priority if this is a checklist-only update
              // Backend might send wrong priority value in checklist update events
              ...(event.data.priority !== undefined && !isChecklistOnlyUpdate && { priority: event.data.priority }),
              ...(event.data.dueDate !== undefined && { dueDate: event.data.dueDate }),
              ...(event.data.assignedTo !== undefined && { assignedTo: event.data.assignedTo || [] }),
              ...(event.data.checklistItems !== undefined && { checklistItems: event.data.checklistItems || [] }),
            }

            console.log('[WebSocket] Task updated from WebSocket:', {
              taskId: event.data.id,
              oldTitle: currentTask.title,
              newTitle: updatedTasks[taskIndex].title,
            })

            return updatedTasks
          })

          // Update selected task if it's the one being updated
          if (selectedTask && String(selectedTask.id) === String(event.data.id)) {
            console.log('[WebSocket] Updating selected task from WebSocket')

            // Check if this is a checklist-only update
            const hasChecklistUpdate = event.data.checklistItems !== undefined
            const hasOtherUpdates =
              event.data.title !== undefined ||
              event.data.description !== undefined ||
              event.data.status !== undefined ||
              event.data.dueDate !== undefined ||
              event.data.assignedTo !== undefined

            // If this is a checklist-only update (checklistItems changed but no other fields), 
            // don't update priority even if it's present in the event data
            const isChecklistOnlyUpdate = hasChecklistUpdate && !hasOtherUpdates

            setSelectedTask((prev) => ({
              ...prev!,
              ...(event.data.title !== undefined && { title: event.data.title }),
              ...(event.data.description !== undefined && { description: event.data.description }),
              ...(event.data.status !== undefined && {
                status: event.data.status.label
              }),
              // Don't update priority if this is a checklist-only update
              // Backend might send wrong priority value in checklist update events
              ...(event.data.priority !== undefined && !isChecklistOnlyUpdate && { priority: event.data.priority }),
              ...(event.data.dueDate !== undefined && { dueDate: event.data.dueDate }),
              ...(event.data.assignedTo !== undefined && { assignedTo: event.data.assignedTo || [] }),
              ...(event.data.checklistItems !== undefined && { checklistItems: event.data.checklistItems || [] }),
            }))
          }
          break

        case "task.deleted":
          // Remove task from the list
          setTasks((prev) => prev.filter((task) => task.id !== event.data.id))
          // Close modal if deleted task is selected
          if (selectedTask && String(selectedTask.id) === event.data.id) {
            setIsTaskModalOpen(false)
            setSelectedTask(null)
          }
          // Update pagination total
          setPagination((prev) => ({
            ...prev,
            total: Math.max(0, prev.total - 1),
          }))
          break

        case "task.status.changed":
          // Task status changed - reload to get updated status info
          if (currentWorkspace && brandId) {
            apiClient
              .listTasks({
                workspaceId: currentWorkspace.id,
                brandId,
                page: 1,
                limit: 50,
              })
              .then((response) => {
                setTasks(response.tasks)
                setPagination(response.pagination)
              })
              .catch((error) => {
                console.error("Failed to refresh tasks after status change:", error)
              })
          }
          break
      }
    },
  })

  return (
    <div className="w-full flex flex-col min-h-0" style={{ height: "100vh" }}>
      {/* Header */}
      <div className="flex items-center px-6 pt-6 pb-0 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
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

        {/* Mobile Add Task Button */}
        <div className="sm:hidden ml-auto">
          <Button size="sm" onClick={() => {
            setSelectedTask(null)
            setIsCreateMode(true)
            setIsTaskModalOpen(true)
          }}>
            <IconPlus className="h-4 w-4" />
            {t("newTask")}
          </Button>
        </div>

        {/* Desktop Toolbar */}
        <div className="hidden sm:flex flex-1 min-w-0">
          <DataViewToolbar
            viewMode={viewMode}
            filterTab={filterTab}
            searchValue={searchValue}
            onViewModeChange={handleViewModeChange}
            onFilterChange={setFilterTab}
            onSearchChange={setSearchValue}
            onNewTask={() => {
              setSelectedTask(null)
              setIsCreateMode(true)
              setIsTaskModalOpen(true)
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
      </div>

      {/* Mobile Toolbar */}
      <div className="sm:hidden px-6 mt-3">
        <DataViewToolbar
          viewMode={viewMode}
          filterTab={filterTab}
          searchValue={searchValue}
          onViewModeChange={handleViewModeChange}
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
      <div className={`w-full sm:px-6 ${viewMode === "kanban" ? "px-6" : "px-0"} flex-1 min-h-0 flex flex-col`}>
        {isLoadingTasks ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading tasks...</div>
          </div>
        ) : viewMode === "table" ? (
          <DataViewTable
            data={tasksData}
            filterTab={filterTab}
            onLoadMore={loadMoreTableData}
            hasMore={pagination.page < pagination.totalPages}
            isLoading={isLoadingMore}
            onTaskClick={(task) => {
              // Just select the task and open modal - hook handles fetching
              setSelectedTask(task)
              setIsTaskModalOpen(true)
            }}
            onDeleteTask={async (taskId) => {
              if (!currentWorkspace) return

              try {
                await apiClient.deleteTask(currentWorkspace.id, String(taskId))
                
                // Remove task from list
                setTasks((prev) => prev.filter((task) => task.id !== String(taskId)))
                
                // Close modal if deleted task is selected
                if (selectedTask && String(selectedTask.id) === String(taskId)) {
                  setIsTaskModalOpen(false)
                  setSelectedTask(null)
                }
                
                // Update pagination total
                setPagination((prev) => ({
                  ...prev,
                  total: Math.max(0, prev.total - 1),
                }))
                
                toast.success("Task başarıyla silindi")
              } catch (error: any) {
                console.error("Failed to delete task:", error)
                toast.error("Task silinirken bir hata oluştu")
              }
            }}
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
            onTaskClick={(task: KanbanTask) => {
              // Just select the task and open modal - hook handles fetching
              setSelectedTask(task)
              setIsTaskModalOpen(true)
            }}
          />
        )}
      </div>

      {/* Task Detail Modal */}
      {currentWorkspace && (
        <TaskDetailModal
          task={selectedTask}
          open={isTaskModalOpen}
          onOpenChange={(open) => {
            setIsTaskModalOpen(open)
            if (!open) {
              // Reset create mode when modal closes
              setIsCreateMode(false)
            }
          }}
          workspaceId={currentWorkspace.id}
          brandId={brandId || undefined}
          brandSlug={brandInfo?.slug}
          brandName={brandInfo?.name}
          brandLogoUrl={brandInfo?.logoUrl}
          isCreateMode={isCreateMode}
          onTaskCreate={(newTask) => {
            // Add new task to list (prevent duplicates)
            setTasks((prev) => {
              // Check if task already exists
              const exists = prev.some(t => String(t.id) === String(newTask.id))
              if (exists) return prev

              return [{
                id: String(newTask.id),
                taskNumber: newTask.taskNumber || 0,
                title: newTask.title || '',
                description: newTask.description || null,
                priority: newTask.priority === 'High' ? 'HIGH' : newTask.priority === 'Low' ? 'LOW' : 'MEDIUM',
                status: { id: '', label: newTask.status, color: null, group: 'TODO' as const },
                dueDate: newTask.dueDate || null,
                assigneeUserId: null,
                assignedTo: [],
                checklistItems: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }, ...prev]
            })
            // Update selected task with created task info
            setSelectedTask(newTask as any)
            setIsCreateMode(false)
          }}
          onTaskUpdate={(taskId, updates) => {
            console.log('[TaskUpdate] Callback called:', { taskId, updates, currentTasksCount: tasks.length })

            // Mark this task as locally updated to ignore WebSocket events for it
            locallyUpdatedTasksRef.current.add(String(taskId))
            // Clear the flag after a short delay to allow WebSocket events from other users
            setTimeout(() => {
              locallyUpdatedTasksRef.current.delete(String(taskId))
            }, 1000)

            // Update local task state immediately
            setTasks((prevTasks) => {
              const taskIndex = prevTasks.findIndex((t) => String(t.id) === String(taskId))
              if (taskIndex === -1) {
                console.warn('[TaskUpdate] Task not found in state:', taskId)
                return prevTasks
              }

              const updatedTasks = [...prevTasks]
              updatedTasks[taskIndex] = {
                ...updatedTasks[taskIndex],
                ...(updates.title && { title: updates.title }),
                ...(updates.description !== undefined && { description: updates.description }),
              }

              console.log('[TaskUpdate] Task updated:', {
                taskId,
                oldTitle: prevTasks[taskIndex].title,
                newTitle: updatedTasks[taskIndex].title,
              })

              return updatedTasks
            })

            // Update selected task if it's the one being edited
            if (selectedTask && String(selectedTask.id) === String(taskId)) {
              console.log('[TaskUpdate] Updating selected task')
              setSelectedTask((prev) => ({
                ...prev!,
                ...(updates.title && { title: updates.title }),
                ...(updates.description !== undefined && { description: updates.description }),
              }))
            }
          }}
        />
      )}
    </div>
  )
}
