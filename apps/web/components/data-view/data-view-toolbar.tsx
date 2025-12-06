"use client"

import { useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupButton,
} from "@/components/ui/input-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tabs,
  TabsList,
  TabsHighlight,
  TabsHighlightItem,
  TabsTrigger,
} from "@/components/animate-ui/primitives/animate/tabs"
import {
  IconSearch,
  IconTable,
  IconLayoutKanban,
  IconFilter,
  IconFlag,
  IconUser,
  IconListCheck,
  IconClock,
  IconAlertCircle,
  IconCheck,
  IconList,
  IconChevronDown,
  IconPlus,
} from "@tabler/icons-react"
import { ViewMode, FilterTab } from "./types"

interface DataViewToolbarProps {
  viewMode: ViewMode
  filterTab: FilterTab
  searchValue?: string
  onViewModeChange: (mode: ViewMode) => void
  onFilterChange: (filter: FilterTab) => void
  onSearchChange?: (value: string) => void
  onNewTask?: () => void
  searchPlaceholder?: string
  newTaskLabel?: string
  filterLabels?: {
    filter: string
    assignee: string
    priority: string
  }
  tabLabels?: {
    todo: string
    inProgress: string
    overdue: string
    completed: string
    all: string
  }
  tabCounts?: {
    todo: number
    inProgress: number
    overdue: number
    completed: number
    all: number
  }
}

export function DataViewToolbar({
  viewMode,
  filterTab,
  searchValue = "",
  onViewModeChange,
  onFilterChange,
  onSearchChange,
  onNewTask,
  searchPlaceholder = "Search...",
  newTaskLabel = "New Task",
  filterLabels = {
    filter: "Filter",
    assignee: "Assignee",
    priority: "Priority",
  },
  tabLabels = {
    todo: "To Do",
    inProgress: "In Progress",
    overdue: "Overdue",
    completed: "Completed",
    all: "All",
  },
  tabCounts,
}: DataViewToolbarProps) {
  const isMobile = useIsMobile()
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden sm:flex items-center gap-4 flex-1 min-w-0">
        {/* Left side: Search, View Toggle, Tabs */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Search input */}
          <div className="w-40 relative flex-shrink-0">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              className="h-9 pl-9 text-sm"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border flex-shrink-0"></div>

          {/* View toggle */}
          <InputGroup className="w-auto flex-shrink-0">
            <InputGroupButton
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              onClick={() => onViewModeChange("table")}
            >
              <IconTable className="h-4 w-4" />
            </InputGroupButton>
            <InputGroupButton
              size="sm"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              onClick={() => onViewModeChange("kanban")}
            >
              <IconLayoutKanban className="h-4 w-4" />
            </InputGroupButton>
          </InputGroup>

          {/* Filter tabs - hidden on smaller screens, shown on xl+ */}
          <Tabs value={filterTab} onValueChange={(value) => onFilterChange(value as FilterTab)} className="flex-1 min-w-0 hidden xl:block">
            <div className="overflow-x-auto scrollbar-hide">
              <TabsList className="relative inline-flex items-center gap-1 rounded-lg bg-muted p-1 min-w-max">
                <TabsHighlight className="bg-background shadow-sm rounded-md">
                  <TabsHighlightItem value="todo">
                    <TabsTrigger
                      value="todo"
                      disabled={viewMode === "kanban"}
                      className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconListCheck className="h-4 w-4 shrink-0" />
                      <span>{tabLabels.todo}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="inProgress">
                    <TabsTrigger
                      value="inProgress"
                      disabled={viewMode === "kanban"}
                      className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconClock className="h-4 w-4 shrink-0" />
                      <span>{tabLabels.inProgress}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="overdue">
                    <TabsTrigger
                      value="overdue"
                      disabled={viewMode === "kanban"}
                      className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconAlertCircle className="h-4 w-4 shrink-0" />
                      <span>{tabLabels.overdue}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="completed">
                    <TabsTrigger
                      value="completed"
                      disabled={viewMode === "kanban"}
                      className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconCheck className="h-4 w-4 shrink-0" />
                      <span>{tabLabels.completed}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                  <TabsHighlightItem value="all">
                    <TabsTrigger value="all" className="relative z-10 inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground whitespace-nowrap">
                      <IconList className="h-4 w-4 shrink-0" />
                      <span>{tabLabels.all}</span>
                    </TabsTrigger>
                  </TabsHighlightItem>
                </TabsHighlight>
              </TabsList>
            </div>
          </Tabs>

          {/* Filter tabs dropdown for smaller screens */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="xl:hidden gap-2 flex-shrink-0">
                <IconList className="h-4 w-4" />
                <span className="hidden md:inline">
                  {filterTab === "all" ? tabLabels.all :
                    filterTab === "todo" ? tabLabels.todo :
                      filterTab === "inProgress" ? tabLabels.inProgress :
                        filterTab === "overdue" ? tabLabels.overdue :
                          tabLabels.completed}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onFilterChange("all")}>
                <IconList className="h-4 w-4" />
                <span>{tabLabels.all}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFilterChange("todo")}
                disabled={viewMode === "kanban"}
              >
                <IconListCheck className="h-4 w-4" />
                <span>{tabLabels.todo}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFilterChange("inProgress")}
                disabled={viewMode === "kanban"}
              >
                <IconClock className="h-4 w-4" />
                <span>{tabLabels.inProgress}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFilterChange("overdue")}
                disabled={viewMode === "kanban"}
              >
                <IconAlertCircle className="h-4 w-4" />
                <span>{tabLabels.overdue}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFilterChange("completed")}
                disabled={viewMode === "kanban"}
              >
                <IconCheck className="h-4 w-4" />
                <span>{tabLabels.completed}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side: Filter buttons and New Task */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filter buttons - visible on larger screens */}
          <div className="hidden lg:flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <IconFilter className="h-4 w-4" />
              {filterLabels.filter}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <IconUser className="h-4 w-4" />
              {filterLabels.assignee}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <IconFlag className="h-4 w-4" />
              {filterLabels.priority}
            </Button>
          </div>

          {/* Filter dropdown - visible on smaller screens */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden gap-2">
                <IconFilter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <IconFilter className="h-4 w-4" />
                <span>{filterLabels.filter}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconUser className="h-4 w-4" />
                <span>{filterLabels.assignee}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconFlag className="h-4 w-4" />
                <span>{filterLabels.priority}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onNewTask && (
            <Button size="sm" className="flex-shrink-0" onClick={onNewTask}>
              <IconPlus className="h-4 w-4" />
              <span className="hidden md:inline">{newTaskLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden flex flex-col gap-3">
        {/* Top row: Tabs + Chevron */}
        <div className="flex items-center justify-between gap-0">
          <Tabs value={filterTab} onValueChange={(value) => onFilterChange(value as FilterTab)} className="flex-1 min-w-0 w-full">
            <TabsList className="relative flex items-center gap-0 rounded-lg bg-muted p-1 w-full">
              <TabsHighlight className="bg-background shadow-sm rounded-md w-full flex">
                <TabsHighlightItem value="todo" className="flex-1 min-w-0">
                  <TabsTrigger
                    value="todo"
                    disabled={viewMode === "kanban"}
                    className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconListCheck className="h-4 w-4 shrink-0" />
                    {filterTab === "todo" && <span className="truncate">{tabLabels.todo}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>
                <TabsHighlightItem value="inProgress" className="flex-1 min-w-0">
                  <TabsTrigger
                    value="inProgress"
                    disabled={viewMode === "kanban"}
                    className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconClock className="h-4 w-4 shrink-0" />
                    {filterTab === "inProgress" && <span className="truncate">{tabLabels.inProgress}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>
                <TabsHighlightItem value="overdue" className="flex-1 min-w-0">
                  <TabsTrigger
                    value="overdue"
                    disabled={viewMode === "kanban"}
                    className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconAlertCircle className="h-4 w-4 shrink-0" />
                    {filterTab === "overdue" && <span className="truncate">{tabLabels.overdue}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>
                <TabsHighlightItem value="completed" className="flex-1 min-w-0">
                  <TabsTrigger
                    value="completed"
                    disabled={viewMode === "kanban"}
                    className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconCheck className="h-4 w-4 shrink-0" />
                    {filterTab === "completed" && <span className="truncate">{tabLabels.completed}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>
                <TabsHighlightItem value="all" className="flex-1 min-w-0">
                  <TabsTrigger value="all" className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground w-full min-w-0">
                    <IconList className="h-4 w-4 shrink-0" />
                    {filterTab === "all" && <span className="truncate">{tabLabels.all}</span>}
                  </TabsTrigger>
                </TabsHighlightItem>
              </TabsHighlight>
            </TabsList>
          </Tabs>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="h-9 px-0 flex-shrink-0"
          >
            <IconChevronDown className={`h-4 w-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Expandable filters */}
        {showMobileFilters && (
          <div className="flex flex-col gap-2">
            <div className="w-full relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                className="h-9 pl-9 text-sm"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>

            <InputGroup className="w-full">
              <InputGroupButton
                size="sm"
                variant={viewMode === "table" ? "default" : "ghost"}
                onClick={() => onViewModeChange("table")}
                className="flex-1"
              >
                <IconTable className="h-4 w-4" />
                <span className="text-sm">Table</span>
              </InputGroupButton>
              <InputGroupButton
                size="sm"
                variant={viewMode === "kanban" ? "default" : "ghost"}
                onClick={() => onViewModeChange("kanban")}
                className="flex-1"
              >
                <IconLayoutKanban className="h-4 w-4" />
                <span className="text-sm">Kanban</span>
              </InputGroupButton>
            </InputGroup>

            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" className="gap-2 justify-start">
                <IconFilter className="h-4 w-4" />
                {filterLabels.filter}
              </Button>
              <Button variant="outline" size="sm" className="gap-2 justify-start">
                <IconUser className="h-4 w-4" />
                {filterLabels.assignee}
              </Button>
              <Button variant="outline" size="sm" className="gap-2 justify-start">
                <IconFlag className="h-4 w-4" />
                {filterLabels.priority}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
