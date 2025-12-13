"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  IconListCheck,
  IconClock,
  IconAlertCircle,
  IconCheck,
  IconPlus,
} from "@tabler/icons-react"
import {
  DataViewPage,
  DataViewToolbar,
  DataViewTable,
  DataViewKanban,
  DataViewCalendar,
  ViewMode,
  FilterTab,
  TableTask,
  KanbanTask,
  SummaryStats,
  BaseTask,
  CalendarViewMode,
} from "@/components/data-view"
import { useKanbanColumns } from "@/components/data-view/hooks/use-kanban-columns"
import { TaskDetailModal } from "@/features/tasks/components/task-detail"
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
  const [calendarCurrentDate, setCalendarCurrentDate] = useState<Date>(new Date())
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>("monthly")

  // Handle view mode change - set filter to "all" when switching to kanban
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === "kanban") {
      setFilterTab("all")
    }
  }, [])
  const [showCompleted, setShowCompleted] = useState<boolean>(true)
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
  const [taskStatuses, setTaskStatuses] = useState<{
    TODO: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
    IN_PROGRESS: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
    DONE: Array<{ id: string; label: string; color: string | null; isDefault: boolean }>;
  } | null>(null)

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

  // Filter tasks by search value and showCompleted setting
  const filteredTasks = useMemo(() => {
    let result = tasks
    
    // Filter out completed tasks if showCompleted is false
    if (!showCompleted) {
      result = result.filter((task) => task.status.group !== 'DONE')
    }
    
    // Filter by search value
    if (searchValue.trim()) {
      const searchLower = searchValue.toLowerCase().trim()
      result = result.filter((task) =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower)
      )
    }
    
    return result
  }, [tasks, searchValue, showCompleted])

  // Transform API tasks to TableTask format
  const tasksData = useMemo(() => {
    return filteredTasks.map((task) => {
      const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', string> = {
        LOW: t("priority.Low"),
        MEDIUM: t("priority.Medium"),
        HIGH: t("priority.High"),
        CRITICAL: t("priority.High"),
      }

      const statusMap: Record<'TODO' | 'IN_PROGRESS' | 'DONE', string> = {
        TODO: t("status.Not Started"),
        IN_PROGRESS: t("status.In Progress"),
        DONE: t("status.Done"),
      }

      return {
        id: task.id,
        taskNumber: task.taskNumber,
        title: task.title,
        description: task.description,
        header: task.title,
        type: t("type.task"),
        priority: priorityMap[task.priority] || t("priority.Medium"),
        status: statusMap[task.status.group] || task.status.label,
        statusGroup: task.status.group, // Keep group for color mapping (language-independent)
        dueDate: task.dueDate || new Date().toISOString(),
        assignedTo: (task as any).assignedTo || [], // Use assignedTo from API or empty array
        commentCount: (task as any)._count?.comments || 0,
      } as TableTask
    })
  }, [filteredTasks, t])

  // Helper function to format relative time (same as table view)
  const getRelativeTime = useCallback((dateString: string): string => {
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
  }, [t])

  // Transform API tasks to KanbanTask format
  const kanbanTasks = useMemo(() => {
    const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', string> = {
      LOW: t("priority.Low"),
      MEDIUM: t("priority.Medium"),
      HIGH: t("priority.High"),
      CRITICAL: t("priority.High"),
    }

    const priorityColorMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', string> = {
      LOW: "text-green-500",
      MEDIUM: "text-yellow-500",
      HIGH: "text-red-500",
      CRITICAL: "text-red-500",
    }

    const todo: KanbanTask[] = []
    const inProgress: KanbanTask[] = []
    const overdue: KanbanTask[] = []
    const completed: KanbanTask[] = []

    const now = new Date()

    filteredTasks.forEach((task) => {
      const priority = priorityMap[task.priority] || t("priority.Medium")
      const priorityColor = priorityColorMap[task.priority] || "text-yellow-500"
      const dueDate = task.dueDate ? new Date(task.dueDate) : null
      const isOverdue = dueDate && dueDate < now && task.status.group !== 'DONE'

      // Format due date display using relative time (same as table view)
      const dueDateDisplay = task.dueDate 
        ? getRelativeTime(task.dueDate)
        : t("dueDate.noDueDate")

      const kanbanTask: KanbanTask = {
        id: task.id,
        taskNumber: task.taskNumber,
        title: task.title,
        description: task.description,
        priority: priority as "High" | "Medium" | "Low",
        priorityColor,
        status: task.status.label,
        statusGroup: task.status.group, // Keep group for color mapping (language-independent)
        dueDate: task.dueDate || '', // Keep raw ISO date for modal
        dueDateDisplay,
        commentCount: (task as any)._count?.comments || 0,
        assignedTo: (task as any).assignedTo || [], // Use assignedTo from API or empty array
        user: task.assigneeUserId || t("table.unassigned"),
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
  }, [filteredTasks, t, getRelativeTime])

  // Summary stats
  const summaryStats: SummaryStats = useMemo(() => {
    const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', string> = {
      LOW: t("priority.Low"),
      MEDIUM: t("priority.Medium"),
      HIGH: t("priority.High"),
      CRITICAL: t("priority.High"),
    }

    const now = new Date()
    let lowPriority = 0
    let mediumPriority = 0
    let highPriority = 0
    let totalDone = 0
    let overdue = 0

    const lowPriorityLabel = t("priority.Low")
    const mediumPriorityLabel = t("priority.Medium")
    const highPriorityLabel = t("priority.High")

    filteredTasks.forEach((task) => {
      const priority = priorityMap[task.priority] || mediumPriorityLabel
      if (priority === lowPriorityLabel) lowPriority++
      else if (priority === mediumPriorityLabel) mediumPriority++
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
  }, [filteredTasks, t])

  // Kanban columns configuration
  const kanbanColumns = useMemo(
    () => [
      {
        id: "todo",
        label: t("kanban.columns.todo"),
        icon: <IconListCheck className="h-4 w-4 shrink-0 text-blue-500" />,
        iconColor: "text-blue-500",
        tasks: kanbanTasks.todo,
      },
      {
        id: "inProgress",
        label: t("kanban.columns.inProgress"),
        icon: <IconClock className="h-4 w-4 shrink-0 text-yellow-500" />,
        iconColor: "text-yellow-500",
        tasks: kanbanTasks.inProgress,
      },
      {
        id: "overdue",
        label: t("kanban.columns.overdue"),
        icon: <IconAlertCircle className="h-4 w-4 shrink-0 text-red-500" />,
        iconColor: "text-red-500",
        tasks: kanbanTasks.overdue,
      },
      {
        id: "completed",
        label: t("kanban.columns.completed"),
        icon: <IconCheck className="h-4 w-4 shrink-0 text-green-500" />,
        iconColor: "text-green-500",
        tasks: kanbanTasks.completed,
      },
    ],
    [kanbanTasks, t]
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
      toast.error(t("errors.loadMore"))
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
          toast.error(t("errors.brandNotFound"))
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

        // Fetch task statuses
        const statusesResponse = await apiClient.listTaskStatuses(currentWorkspace.id, brand.id)
        setTaskStatuses(statusesResponse.statuses)

        // Mark as fetched for this key
        initFetchedForRef.current = fetchKey
      } catch (error: any) {
        console.error("Failed to initialize:", error)
        toast.error(t("errors.loadPageData"))
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

  // Handle status change from table view
  const handleStatusChange = useCallback(async (taskId: string | number, newStatus: string) => {
    if (!currentWorkspace) return

    try {
      // Find the task to get its current status ID if needed, or just use the label
      const task = tasks.find(t => String(t.id) === String(taskId))
      if (!task) return

      // Optimistic update
      setTasks(prev => prev.map(t => {
        if (String(t.id) === String(taskId)) {
          return {
            ...t,
            status: {
              ...t.status,
              label: newStatus
            }
          }
        }
        return t
      }))

      // Find status ID from label
      let statusId = ''
      if (taskStatuses) {
        // First, try to find by label directly (e.g., "Completed" from API)
        const allStatuses = [
          ...taskStatuses.TODO,
          ...taskStatuses.IN_PROGRESS,
          ...taskStatuses.DONE
        ]
        let statusObj = allStatuses.find(s => s.label === newStatus)
        
        // If not found by direct label, try translation key mapping
        if (!statusObj) {
          // Map UI labels back to groups
          const uiStatusToGroup: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
            [t("status.Not Started")]: "TODO",
            [t("status.In Progress")]: "IN_PROGRESS",
            [t("status.Done")]: "DONE",
            // English keys
            "Not Started": "TODO",
            "In Progress": "IN_PROGRESS",
            "Done": "DONE",
          }

          const targetGroup = uiStatusToGroup[newStatus]

          if (targetGroup) {
            // Find the default or first status in the target group
            const groupStatuses = taskStatuses[targetGroup]
            if (groupStatuses && groupStatuses.length > 0) {
              statusObj = groupStatuses.find((s: any) => s.isDefault) || groupStatuses[0]
            }
          }
        }
        
        if (statusObj) {
          statusId = statusObj.id
        }
      }

      // If we couldn't find the ID (e.g. statuses not loaded yet), we might fail
      // But let's try to proceed if we have an ID, or log error
      if (!statusId) {
        console.error("Could not find status ID for label:", newStatus)
        toast.error(t("errors.statusIdNotFound"))
        return
      }

      await apiClient.updateTask(currentWorkspace.id, String(taskId), {
        statusId: statusId
      })

      toast.success(t("success.updateStatus"))
    } catch (error) {
      console.error("Failed to update status:", error)
      toast.error(t("errors.updateStatus"))

      // Revert optimistic update (optional, or just reload)
      if (brandId) {
        const response = await apiClient.listTasks({
          workspaceId: currentWorkspace.id,
          brandId,
          page: pagination.page,
          limit: pagination.limit,
        })
        setTasks(response.tasks)
      }
    }
  }, [currentWorkspace, tasks, brandId, pagination, taskStatuses, t])

  return (
    <>
      <DataViewPage
      title={t("title")}
      summaryStats={summaryStats}
      viewMode={viewMode}
      shouldShowCompleted={showCompleted}
      onCompletedFilterChange={setShowCompleted}
      headerRight={
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
          calendarCurrentDate={calendarCurrentDate}
          calendarViewMode={calendarViewMode}
          onCalendarDateChange={setCalendarCurrentDate}
          onCalendarViewModeChange={setCalendarViewMode}
        />
      }
      headerRightMobile={
        <Button size="sm" onClick={() => {
          setSelectedTask(null)
          setIsCreateMode(true)
          setIsTaskModalOpen(true)
        }}>
          <IconPlus className="h-4 w-4" />
          {t("newTask")}
        </Button>
      }
      toolbar={
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
          calendarCurrentDate={calendarCurrentDate}
          calendarViewMode={calendarViewMode}
          onCalendarDateChange={setCalendarCurrentDate}
          onCalendarViewModeChange={setCalendarViewMode}
        />
      }
    >
      {isLoadingTasks ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t("loading")}</div>
        </div>
      ) : viewMode === "table" ? (
          <DataViewTable
            data={tasksData}
            filterTab={filterTab}
            onLoadMore={loadMoreTableData}
            hasMore={pagination.page < pagination.totalPages}
            isLoading={isLoadingMore}
            workspaceId={currentWorkspace?.id}
            brandId={brandId || undefined}
            taskStatuses={taskStatuses || undefined}
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

                toast.success(t("success.deleteTask"))
              } catch (error: any) {
                toast.error(t("errors.deleteTask"))
              }
            }}
            onStatusChange={handleStatusChange}
          />
        ) : viewMode === "calendar" ? (
          <DataViewCalendar
            tasks={filteredTasks.map((task): BaseTask => {
              const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', string> = {
                LOW: t("priority.Low"),
                MEDIUM: t("priority.Medium"),
                HIGH: t("priority.High"),
                CRITICAL: t("priority.High"),
              }

              const statusMap: Record<'TODO' | 'IN_PROGRESS' | 'DONE', string> = {
                TODO: t("status.Not Started"),
                IN_PROGRESS: t("status.In Progress"),
                DONE: t("status.Done"),
              }

              return {
                id: task.id,
                taskNumber: task.taskNumber,
                title: task.title,
                description: task.description,
                priority: (priorityMap[task.priority] || t("priority.Medium")) as "High" | "Medium" | "Low",
                status: statusMap[task.status.group] || task.status.label,
                statusGroup: task.status.group, // Keep group for color mapping (language-independent)
                dueDate: task.dueDate || new Date().toISOString(),
                assignedTo: (task as any).assignedTo || [],
                commentCount: (task as any)._count?.comments || 0,
              }
            })}
            currentDate={calendarCurrentDate}
            calendarViewMode={calendarViewMode}
            onDateChange={setCalendarCurrentDate}
            onCalendarViewModeChange={setCalendarViewMode}
            availableStatuses={taskStatuses ? [
              ...taskStatuses.TODO.map(s => ({ ...s, group: 'TODO' as const })),
              ...taskStatuses.IN_PROGRESS.map(s => ({ ...s, group: 'IN_PROGRESS' as const })),
              ...taskStatuses.DONE.map(s => ({ ...s, group: 'DONE' as const })),
            ] : undefined}
            onTaskClick={(task) => {
              // Find the original task from filteredTasks
              const originalTask = filteredTasks.find(t => String(t.id) === String(task.id))
              if (originalTask) {
                // Convert to BaseTask format for modal
                const priorityMap: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', string> = {
                  LOW: t("priority.Low"),
                  MEDIUM: t("priority.Medium"),
                  HIGH: t("priority.High"),
                  CRITICAL: t("priority.High"),
                }
                
                setSelectedTask({
                  id: originalTask.id,
                  taskNumber: originalTask.taskNumber,
                  title: originalTask.title,
                  description: originalTask.description,
                  priority: (priorityMap[originalTask.priority] || t("priority.Medium")) as "High" | "Medium" | "Low",
                  status: originalTask.status.label,
                  dueDate: originalTask.dueDate || new Date().toISOString(),
                  assignedTo: (originalTask as any).assignedTo || [],
                  commentCount: (originalTask as any)._count?.comments || 0,
                } as BaseTask)
                setIsTaskModalOpen(true)
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
      </DataViewPage>

      {/* Task Detail Modal */}
      {currentWorkspace && (
        <TaskDetailModal
          task={selectedTask}
          open={isTaskModalOpen}
          onOpenChange={(open) => {
            setIsTaskModalOpen(open)
            if (!open) {
              // Reset create mode and selected task when modal closes
              setIsCreateMode(false)
              setSelectedTask(null)
            }
          }}
          workspaceId={currentWorkspace.id}
          brandId={brandId || undefined}
          brandSlug={brandInfo?.slug}
          brandName={brandInfo?.name}
          brandLogoUrl={brandInfo?.logoUrl}
          taskStatuses={taskStatuses || undefined}
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

              toast.success(t("success.deleteTask"))
            } catch (error: any) {
              toast.error(t("errors.deleteTask"))
            }
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
              const currentTask = updatedTasks[taskIndex]
              
              // Only update properties that are explicitly provided in updates
              // This ensures other properties are preserved
              const updatedTask = { ...currentTask }
              
              if (updates.title !== undefined) {
                updatedTask.title = updates.title
              }
              if (updates.description !== undefined) {
                updatedTask.description = updates.description
              }
              if (updates.status !== undefined) {
                updatedTask.status = typeof updates.status === 'string'
                  ? { ...currentTask.status, label: updates.status }
                  : { ...currentTask.status, ...updates.status }
              }
              if (updates.priority !== undefined) {
                updatedTask.priority = updates.priority === 'High' ? 'HIGH' : updates.priority === 'Low' ? 'LOW' : 'MEDIUM'
              }
              if (updates.dueDate !== undefined) {
                updatedTask.dueDate = updates.dueDate
              }
              if (updates.assigneeUserId !== undefined) {
                updatedTask.assigneeUserId = updates.assigneeUserId
              }
              if (updates.assignedTo !== undefined) {
                updatedTask.assignedTo = updates.assignedTo
              }
              
              updatedTasks[taskIndex] = updatedTask

              console.log('[TaskUpdate] Task updated:', {
                taskId,
                oldTitle: prevTasks[taskIndex].title,
                newTitle: updatedTasks[taskIndex].title,
              })

              return updatedTasks
            })

            // Update selected task if it's the one being edited
            // Only update properties that are explicitly provided in updates
            if (selectedTask && String(selectedTask.id) === String(taskId)) {
              console.log('[TaskUpdate] Updating selected task')
              setSelectedTask((prev) => {
                if (!prev) return prev
                
                const updated: typeof prev = { ...prev }
                
                // Only update properties that are explicitly provided
                if (updates.title !== undefined) {
                  updated.title = updates.title
                }
                if (updates.description !== undefined) {
                  updated.description = updates.description
                }
                if (updates.status !== undefined) {
                  const baseStatus = prev.status && typeof prev.status === 'object' ? prev.status : { id: '', label: '', color: null, group: 'TODO' as const };
                  updated.status = typeof updates.status === 'string'
                    ? { ...baseStatus, label: updates.status }
                    : { ...baseStatus, ...updates.status }
                }
                if (updates.priority !== undefined) {
                  // Keep UI format (High/Medium/Low) for KanbanTask
                  updated.priority = updates.priority as "High" | "Medium" | "Low";
                }
                if (updates.dueDate !== undefined) {
                  updated.dueDate = updates.dueDate || ''
                }
                if (updates.assigneeUserId !== undefined) {
                  updated.assigneeUserId = updates.assigneeUserId
                }
                if (updates.assignedTo !== undefined) {
                  updated.assignedTo = updates.assignedTo
                }
                
                return updated
              })
            }
          }}
        />
      )}
    </>
  )
}
