// Generic data view types
export type ViewMode = "table" | "kanban"

export type FilterTab = "all" | "todo" | "inProgress" | "overdue" | "completed"

export interface BaseTask {
  id: string | number
  taskNumber?: number
  title?: string // Optional for compatibility with TableTask
  description?: string | null
  priority: "High" | "Medium" | "Low"
  status: string
  dueDate: string
  assigneeUserId?: string | null
  assignedTo?: Array<{
    id: string
    name: string | null
    avatarUrl: string | null
  }>
  commentCount?: number
  checklistItems?: Array<{
    id: string
    title: string
    isCompleted: boolean
    sortOrder: number
  }>
  attachments?: Array<{
    id: string
    mediaId: string
    title: string | null
  }>
}

export interface TableTask extends BaseTask {
  header: string
  type: string
}

export interface KanbanTask extends BaseTask {
  priorityColor: string
  user: string
  userSeed: string
  dueDateDisplay?: string // Formatted display string for kanban cards (e.g., "in 5 days")
}

export interface SummaryStats {
  lowPriority: number
  mediumPriority: number
  highPriority: number
  totalTasks: number
  totalDone: number
  overdue: number
}

export interface DataViewProps<T extends BaseTask> {
  data: T[]
  viewMode: ViewMode
  filterTab: FilterTab
  onViewModeChange: (mode: ViewMode) => void
  onFilterChange: (filter: FilterTab) => void
  onLoadMore?: () => void
  hasMore?: boolean
  isLoading?: boolean
}
