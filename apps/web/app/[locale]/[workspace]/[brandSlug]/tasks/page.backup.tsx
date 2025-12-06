"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { 
  Tabs, 
  TabsList, 
  TabsHighlight,
  TabsHighlightItem,
  TabsTrigger,
} from "@/components/animate-ui/primitives/animate/tabs"
import { IconPlus, IconDots, IconSearch, IconTable, IconLayoutKanban, IconFilter, IconFlag, IconFlagFilled, IconUser, IconListCheck, IconClock, IconAlertCircle, IconCheck, IconList, IconChevronDown, IconEdit, IconTrash, IconSettings, IconMessage } from "@tabler/icons-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

// Kanban Column Content Component with Virtualization
function KanbanColumnContent({
  parentRef,
  tasks,
  limit,
  isExpanded,
  onShowMore,
  draggingCardId,
  setDraggingCardId,
}: {
  parentRef: React.RefObject<HTMLDivElement | null>
  tasks: Array<{
    id: string
    title: string
    priority: "High" | "Medium" | "Low"
    priorityColor: string
    dueDate: string
    commentCount: number
    user: string
    userSeed: string
  }>
  limit: number
  isExpanded: boolean
  onShowMore: () => void
  draggingCardId: string | null
  setDraggingCardId: (id: string | null) => void
}) {
  const displayedTasks = isExpanded ? tasks : tasks.slice(0, limit)
  const hasMore = tasks.length > limit && !isExpanded

  const virtualizer = useVirtualizer({
    count: displayedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated card height (reduced for smaller gap)
    overscan: 5,
  })

  const buttonHeight = 48 // Approximate height of button + padding

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
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-0 mb-1"
            >
              <div
                draggable
                onDragStart={(e) => {
                  setDraggingCardId(task.id)
                  e.dataTransfer.effectAllowed = "move"
                }}
                onDragEnd={() => {
                  setDraggingCardId(null)
                }}
                className={`rounded-sm border bg-card p-3 flex items-start justify-between gap-3 hover:bg-accent hover:border-border transition-all cursor-grab active:cursor-grabbing ${
                  draggingCardId === task.id
                    ? "opacity-50 scale-95 !border-2 !border-primary rotate-1"
                    : "cursor-pointer"
                }`}
              >
                {/* Left side */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-sm font-medium line-clamp-2">{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.dueDate}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-muted-foreground px-1.5 h-5">
                      <IconFlagFilled className={`h-3.5 w-3.5 ${task.priorityColor}`} />
                      <span>{task.priority}</span>
                    </Badge>
                    {task.commentCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        <IconMessage className="h-3 w-3" />
                        <span>{task.commentCount}</span>
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Right side */}
                <div className="flex-shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${task.userSeed}`} />
                    <AvatarFallback>{task.user.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>
          )
        })}
        {/* Buttons at the bottom - positioned at the end of virtualization container */}
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

export default function BrandTasksPage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string
  const { currentWorkspace } = useWorkspace()
  const isMobile = useIsMobile()
  const t = useTranslations('tasks')

  // State
  const [brandId, setBrandId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("overview")
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table")
  const [filterTab, setFilterTab] = useState<string>("all")
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  
  // Kanban column limits and expanded state
  const [columnLimits, setColumnLimits] = useState({
    todo: 20,
    inProgress: 20,
    overdue: 20,
    completed: 20,
  })
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set())
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())
  const [showSummary, setShowSummary] = useState<boolean>(true)
  
  // Refs for virtualization
  const todoParentRef = useRef<HTMLDivElement>(null)
  const inProgressParentRef = useRef<HTMLDivElement>(null)
  const overdueParentRef = useRef<HTMLDivElement>(null)
  const completedParentRef = useRef<HTMLDivElement>(null)
  
  // Dummy data for badge counts
  const taskCounts = {
    todo: 12,
    inProgress: 8,
    overdue: 3,
    completed: 24,
    all: 47,
  }

  // Generate dummy kanban tasks (hundreds of tasks for testing)
  const generateKanbanTasks = (status: string, count: number) => {
    const priorities = ["High", "Medium", "Low"]
    const priorityColors = { High: "text-red-500", Medium: "text-yellow-500", Low: "text-green-500" }
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
    }))
  }

  // Kanban tasks data
  const kanbanTasks = useMemo(() => ({
    todo: generateKanbanTasks("todo", 150),
    inProgress: generateKanbanTasks("inProgress", 120),
    overdue: generateKanbanTasks("overdue", 30),
    completed: generateKanbanTasks("completed", 200),
  }), [])

  // Infinite scroll state for table
  const [tableDataLimit, setTableDataLimit] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const totalTableItems = 500 // Total items available

  // Generate dummy table tasks
  const generateTableTasks = (count: number, startId: number = 1) => {
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
        priority: priorities[id % priorities.length],
        status: statuses[id % statuses.length],
        dueDate: new Date(Date.now() + (id % 30 - 15) * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo,
        commentCount: id % 8,
      }
    })
  }

  // Dummy data for tasks table - with infinite scroll support
  const tasksData = useMemo(() => {
    return generateTableTasks(tableDataLimit)
  }, [tableDataLimit])

  // Load more data function
  const loadMoreTableData = useCallback(() => {
    if (isLoadingMore || tableDataLimit >= totalTableItems) return
    
    setIsLoadingMore(true)
    // Simulate API call delay
    setTimeout(() => {
      setTableDataLimit(prev => Math.min(prev + 50, totalTableItems))
      setIsLoadingMore(false)
    }, 500)
  }, [isLoadingMore, tableDataLimit, totalTableItems])

  // Initialize
  useEffect(() => {
    async function init() {
      if (!currentWorkspace) return

      try {
        // Get brand ID
        const brandsResponse = await apiClient.listBrands(currentWorkspace.id)
        const brand = brandsResponse.brands.find(b => b.slug === brandSlug)
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
    <div className="w-full flex flex-col min-h-0" style={{ height: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-0 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
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

        {/* Toolbar - Desktop layout */}
        <div className="hidden sm:flex items-center gap-4 flex-1 min-w-0">
          {/* Search input */}
          <div className="w-40 relative flex-shrink-0">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder={t('toolbar.searchPlaceholder')}
              className="h-9 pl-9 text-sm"
            />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border"></div>

          {/* Input group with view buttons */}
          <InputGroup className="w-auto">
            <InputGroupButton
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              onClick={() => setViewMode("table")}
            >
              <IconTable className="h-4 w-4" />
            </InputGroupButton>
            <InputGroupButton
              size="sm"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              onClick={() => setViewMode("kanban")}
            >
              <IconLayoutKanban className="h-4 w-4" />
            </InputGroupButton>
          </InputGroup>

          {/* Filter tabs */}
          <Tabs value={filterTab} onValueChange={setFilterTab} className="flex-1 min-w-0">
            <div className="overflow-x-auto scrollbar-hide">
              <TabsList className="relative inline-flex items-center gap-1 rounded-lg bg-muted p-1 min-w-max">
                <TabsHighlight className="bg-background shadow-sm rounded-md">
                  <TabsHighlightItem value="todo">
                    <TabsTrigger value="todo" className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap">
                      <IconListCheck className="h-4 w-4 shrink-0" />
                      <span>{t('toolbar.tabs.todo')}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="inProgress">
                    <TabsTrigger value="inProgress" className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap">
                      <IconClock className="h-4 w-4 shrink-0" />
                      <span>{t('toolbar.tabs.inProgress')}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="overdue">
                    <TabsTrigger value="overdue" className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap">
                      <IconAlertCircle className="h-4 w-4 shrink-0" />
                      <span>{t('toolbar.tabs.overdue')}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="completed">
                    <TabsTrigger value="completed" className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap">
                      <IconCheck className="h-4 w-4 shrink-0" />
                      <span>{t('toolbar.tabs.completed')}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="all">
                    <TabsTrigger value="all" className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap">
                      <IconList className="h-4 w-4 shrink-0" />
                      <span>{t('toolbar.tabs.all')}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                </TabsHighlight>
              </TabsList>
            </div>
          </Tabs>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-2">
              <IconFilter className="h-4 w-4" />
              {t('toolbar.filter')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <IconUser className="h-4 w-4" />
              {t('toolbar.assignee')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <IconFlag className="h-4 w-4" />
              {t('toolbar.priority')}
            </Button>
            <Button size="sm" className="flex-shrink-0">
              <IconPlus className="h-4 w-4" />
              {t('newTask')}
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar - Mobile layout */}
      <div className="px-3 sm:px-6 py-3 relative sm:hidden">
        {/* Mobile layout */}
        <div className="sm:hidden flex flex-col px-4 gap-3">
          {/* Top row: Tabs + Chevron */}
          <div className="flex items-center justify-between gap-0">
            {/* Filter tabs - left side */}
            <Tabs value={filterTab} onValueChange={setFilterTab} className="flex-1 min-w-0 w-full">
              <TabsList className="relative flex items-center gap-0 rounded-lg bg-muted p-1 w-full">
                <TabsHighlight className="bg-background shadow-sm rounded-md w-full flex">
                  <TabsHighlightItem value="todo" className="flex-1 min-w-0">
                    <TabsTrigger value="todo" className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0">
                      <IconListCheck className="h-4 w-4 shrink-0" />
                      {filterTab === "todo" && <span className="truncate">{t('toolbar.tabs.todo')}</span>}
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="inProgress" className="flex-1 min-w-0">
                    <TabsTrigger value="inProgress" className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0">
                      <IconClock className="h-4 w-4 shrink-0" />
                      {filterTab === "inProgress" && <span className="truncate">{t('toolbar.tabs.inProgress')}</span>}
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="overdue" className="flex-1 min-w-0">
                    <TabsTrigger value="overdue" className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0">
                      <IconAlertCircle className="h-4 w-4 shrink-0" />
                      {filterTab === "overdue" && <span className="truncate">{t('toolbar.tabs.overdue')}</span>}
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="completed" className="flex-1 min-w-0">
                    <TabsTrigger value="completed" className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0">
                      <IconCheck className="h-4 w-4 shrink-0" />
                      {filterTab === "completed" && <span className="truncate">{t('toolbar.tabs.completed')}</span>}
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="all" className="flex-1 min-w-0">
                    <TabsTrigger value="all" className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0">
                      <IconList className="h-4 w-4 shrink-0" />
                      {filterTab === "all" && <span className="truncate">{t('toolbar.tabs.all')}</span>}
                    </TabsTrigger>
                  </TabsHighlightItem>
                </TabsHighlight>
              </TabsList>
            </Tabs>

            {/* Chevron button - right side */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="h-9 px-2 flex-shrink-0"
            >
              <IconChevronDown className={`h-4 w-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Expandable filters */}
          {showMobileFilters && (
            <div className="flex flex-col gap-2">
              {/* Search input */}
              <div className="w-full relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder={t('toolbar.searchPlaceholder')}
                  className="h-9 pl-9 text-sm"
                />
              </div>

              {/* View buttons */}
              <InputGroup className="w-full">
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  onClick={() => setViewMode("table")}
                  className="flex-1"
                >
                  <IconTable className="h-4 w-4" />
                  <span className="text-sm">{t('toolbar.viewTable')}</span>
                </InputGroupButton>
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  onClick={() => setViewMode("kanban")}
                  className="flex-1"
                >
                  <IconLayoutKanban className="h-4 w-4" />
                  <span className="text-sm">{t('toolbar.viewKanban')}</span>
                </InputGroupButton>
              </InputGroup>

              {/* Filter buttons */}
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="gap-2 justify-start">
                  <IconFilter className="h-4 w-4" />
                  {t('toolbar.filter')}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 justify-start">
                  <IconUser className="h-4 w-4" />
                  {t('toolbar.assignee')}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 justify-start">
                  <IconFlag className="h-4 w-4" />
                  {t('toolbar.priority')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar altındaki div */}
      {showSummary && (
        <div className={`w-full px-7 sm:px-6 pt-4 ${viewMode === "table" ? "pb-0" : "pb-1"}`}>
        <div className="flex flex-row gap-2 sm:gap-4 w-full">
          <div className="w-full h-auto sm:h-[88px] rounded-xl border border-muted-foreground/15 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-0">
            {/* Item 1 */}
            <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Low Priority</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold">24</div>
            </div>
            
            {/* Divider */}
            <div className="hidden sm:block h-12 w-px bg-border"></div>
            <div className="sm:hidden w-full h-px bg-border"></div>
            
            {/* Item 2 */}
            <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Medium Priority</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold">12</div>
            </div>
            
            {/* Divider */}
            <div className="hidden sm:block h-12 w-px bg-border"></div>
            <div className="sm:hidden w-full h-px bg-border"></div>
            
            {/* Item 3 */}
            <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">High Priority</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold">8</div>
            </div>
          </div>
          <div className="w-full h-auto sm:h-[88px] rounded-xl border border-muted-foreground/15 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-0">
            {/* Item 1 */}
            <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <IconList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Task</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold">47</div>
            </div>
            
            {/* Divider */}
            <div className="hidden sm:block h-12 w-px bg-border"></div>
            <div className="sm:hidden w-full h-px bg-border"></div>
            
            {/* Item 2 */}
            <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <IconCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Task Done</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold">24</div>
            </div>
            
            {/* Divider */}
            <div className="hidden sm:block h-12 w-px bg-border"></div>
            <div className="sm:hidden w-full h-px bg-border"></div>
            
            {/* Item 3 */}
            <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <IconAlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Overdue</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold">3</div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Data Table or Kanban */}
      <div className={`w-full px-6 flex-1 min-h-0 flex flex-col ${viewMode === "table" ? "-mt-4" : ""}`}>
        {viewMode === "table" ? (
          <DataTable 
            data={tasksData.filter((task) => {
              const now = new Date()
              const dueDate = new Date(task.dueDate)
              
              switch (filterTab) {
                case "todo":
                  return task.status === "Not Started"
                case "inProgress":
                  return task.status === "In Progress"
                case "overdue":
                  return dueDate < now && task.status !== "Done"
                case "completed":
                  return task.status === "Done"
                case "all":
                default:
                  return true
              }
            })}
            onLoadMore={loadMoreTableData}
            hasMore={tableDataLimit < totalTableItems}
            isLoading={isLoadingMore}
          />
        ) : (
          <div className="w-full pt-2 pb-4">
            {/* Kanban view */}
            <div className="flex flex-row gap-4 overflow-x-auto">
              {/* To Do Column */}
              <div className="flex flex-col w-[320px] gap-2 flex-shrink-0 h-[calc(100vh-300px)]">
                {/* Header */}
                <div className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
                  <IconListCheck className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="text-sm font-medium">To Do</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground transition-colors">
                    {kanbanTasks.todo.length}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-accent"
                    onClick={() => {
                      setCollapsedColumns(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has("todo")) {
                          newSet.delete("todo")
                        } else {
                          newSet.add("todo")
                        }
                        return newSet
                      })
                    }}
                  >
                    <IconChevronDown className={`h-4 w-4 transition-transform ${!collapsedColumns.has("todo") ? 'rotate-180' : ''}`} />
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
                      <DropdownMenuItem variant="destructive">
                        <IconTrash className="h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Content */}
                {!collapsedColumns.has("todo") && (
                  <KanbanColumnContent
                    parentRef={todoParentRef}
                    tasks={kanbanTasks.todo}
                    limit={columnLimits.todo}
                    isExpanded={expandedColumns.has("todo")}
                    onShowMore={() => {
                      setExpandedColumns(prev => new Set(prev).add("todo"))
                      setColumnLimits(prev => ({ ...prev, todo: kanbanTasks.todo.length }))
                    }}
                    draggingCardId={draggingCardId}
                    setDraggingCardId={setDraggingCardId}
                  />
                )}
              </div>

              {/* In Progress Column */}
              <div className="flex flex-col w-[320px] gap-2 flex-shrink-0 h-[calc(100vh-300px)]">
                {/* Header */}
                <div className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
                  <IconClock className="h-4 w-4 shrink-0 text-yellow-500" />
                  <span className="text-sm font-medium">In Progress</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground transition-colors">
                    {kanbanTasks.inProgress.length}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-accent"
                    onClick={() => {
                      setCollapsedColumns(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has("inProgress")) {
                          newSet.delete("inProgress")
                        } else {
                          newSet.add("inProgress")
                        }
                        return newSet
                      })
                    }}
                  >
                    <IconChevronDown className={`h-4 w-4 transition-transform ${!collapsedColumns.has("inProgress") ? 'rotate-180' : ''}`} />
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
                      <DropdownMenuItem variant="destructive">
                        <IconTrash className="h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Content */}
                {!collapsedColumns.has("inProgress") && (
                  <KanbanColumnContent
                    parentRef={inProgressParentRef}
                    tasks={kanbanTasks.inProgress}
                    limit={columnLimits.inProgress}
                    isExpanded={expandedColumns.has("inProgress")}
                    onShowMore={() => {
                      setExpandedColumns(prev => new Set(prev).add("inProgress"))
                      setColumnLimits(prev => ({ ...prev, inProgress: kanbanTasks.inProgress.length }))
                    }}
                    draggingCardId={draggingCardId}
                    setDraggingCardId={setDraggingCardId}
                  />
                )}
              </div>

              {/* Overdue Column */}
              <div className="flex flex-col w-[320px] gap-2 flex-shrink-0 h-[calc(100vh-300px)]">
                {/* Header */}
                <div className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
                  <IconAlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="text-sm font-medium">Overdue</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground transition-colors">
                    {kanbanTasks.overdue.length}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-accent"
                    onClick={() => {
                      setCollapsedColumns(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has("overdue")) {
                          newSet.delete("overdue")
                        } else {
                          newSet.add("overdue")
                        }
                        return newSet
                      })
                    }}
                  >
                    <IconChevronDown className={`h-4 w-4 transition-transform ${!collapsedColumns.has("overdue") ? 'rotate-180' : ''}`} />
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
                      <DropdownMenuItem variant="destructive">
                        <IconTrash className="h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Content */}
                {!collapsedColumns.has("overdue") && (
                  <KanbanColumnContent
                    parentRef={overdueParentRef}
                    tasks={kanbanTasks.overdue}
                    limit={columnLimits.overdue}
                    isExpanded={expandedColumns.has("overdue")}
                    onShowMore={() => {
                      setExpandedColumns(prev => new Set(prev).add("overdue"))
                      setColumnLimits(prev => ({ ...prev, overdue: kanbanTasks.overdue.length }))
                    }}
                    draggingCardId={draggingCardId}
                    setDraggingCardId={setDraggingCardId}
                  />
                )}
              </div>

              {/* Completed Column */}
              <div className="flex flex-col w-[320px] gap-2 flex-shrink-0 h-[calc(100vh-300px)]">
                {/* Header */}
                <div className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
                  <IconCheck className="h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-sm font-medium">Completed</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground transition-colors">
                    {kanbanTasks.completed.length}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-accent"
                    onClick={() => {
                      setCollapsedColumns(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has("completed")) {
                          newSet.delete("completed")
                        } else {
                          newSet.add("completed")
                        }
                        return newSet
                      })
                    }}
                  >
                    <IconChevronDown className={`h-4 w-4 transition-transform ${!collapsedColumns.has("completed") ? 'rotate-180' : ''}`} />
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
                      <DropdownMenuItem variant="destructive">
                        <IconTrash className="h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Content */}
                {!collapsedColumns.has("completed") && (
                  <KanbanColumnContent
                    parentRef={completedParentRef}
                    tasks={kanbanTasks.completed}
                    limit={columnLimits.completed}
                    isExpanded={expandedColumns.has("completed")}
                    onShowMore={() => {
                      setExpandedColumns(prev => new Set(prev).add("completed"))
                      setColumnLimits(prev => ({ ...prev, completed: kanbanTasks.completed.length }))
                    }}
                    draggingCardId={draggingCardId}
                    setDraggingCardId={setDraggingCardId}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {/* <div className="px-6 pt-2 relative">
        <div className="relative flex items-center gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-1 py-2 border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconChartBar className="h-4 w-4" />
              <span className="text-sm font-medium">{t('tabs.overview')}</span>
            </button>
            <button
              onClick={() => setActiveTab("backlog")}
              className={`flex items-center gap-2 px-1 py-2 border-b-2 transition-colors ${
                activeTab === "backlog"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconListCheck className="h-4 w-4" />
              <span className="text-sm font-medium">{t('tabs.backlog')}</span>
            </button>
            <button
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-2 px-1 py-2 border-b-2 transition-colors ${
                activeTab === "list"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconList className="h-4 w-4" />
              <span className="text-sm font-medium">{t('tabs.list')}</span>
            </button>
            <button
              onClick={() => setActiveTab("kanban")}
              className={`flex items-center gap-2 px-1 py-2 border-b-2 transition-colors ${
                activeTab === "kanban"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconLayoutKanban className="h-4 w-4" />
              <span className="text-sm font-medium">{t('tabs.kanban')}</span>
            </button>
            <button
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-2 px-1 py-2 border-b-2 transition-colors ${
                activeTab === "calendar"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconCalendar className="h-4 w-4" />
              <span className="text-sm font-medium">{t('tabs.calendar')}</span>
            </button>
        </div>
        <div className="absolute left-6 right-6 bottom-0 border-b"></div>
      </div> */}
    </div>
  )
}
