"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
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
  IconCalendar,
  IconCalendarWeek,
  IconFilter,
  IconListCheck,
  IconClock,
  IconAlertCircle,
  IconCheck,
  IconList,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "@tabler/icons-react"
import { ViewMode, FilterTab } from "./types"
import { CalendarViewMode } from "./data-view-calendar"
import { format, addMonths, subMonths, addWeeks, subWeeks } from "date-fns"
import { useLocale } from "next-intl"
import { enUS, tr } from "date-fns/locale"

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
  // Calendar props
  calendarCurrentDate?: Date
  calendarViewMode?: CalendarViewMode
  onCalendarDateChange?: (date: Date) => void
  onCalendarViewModeChange?: (mode: CalendarViewMode) => void
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
  calendarCurrentDate,
  calendarViewMode = "monthly",
  onCalendarDateChange,
  onCalendarViewModeChange,
}: DataViewToolbarProps) {
  const t = useTranslations("calendar")
  const locale = useLocale()
  const dateLocale = locale === "tr" ? tr : enUS
  const isMobile = useIsMobile()
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Calendar navigation handlers
  const handleCalendarPrev = () => {
    if (!calendarCurrentDate || !onCalendarDateChange) return
    if (calendarViewMode === "monthly") {
      onCalendarDateChange(subMonths(calendarCurrentDate, 1))
    } else if (calendarViewMode === "weekly") {
      onCalendarDateChange(subWeeks(calendarCurrentDate, 1))
    }
  }

  const handleCalendarNext = () => {
    if (!calendarCurrentDate || !onCalendarDateChange) return
    if (calendarViewMode === "monthly") {
      onCalendarDateChange(addMonths(calendarCurrentDate, 1))
    } else if (calendarViewMode === "weekly") {
      onCalendarDateChange(addWeeks(calendarCurrentDate, 1))
    }
  }

  const handleCalendarToday = () => {
    if (!onCalendarDateChange) return
    onCalendarDateChange(new Date())
  }

  const getCalendarTitle = () => {
    if (!calendarCurrentDate) return ""
    if (calendarViewMode === "monthly") {
      return format(calendarCurrentDate, "MMMM yyyy", { locale: dateLocale })
    } else if (calendarViewMode === "weekly") {
      return `${t("views.weekly")} - ${format(calendarCurrentDate, "d MMM yyyy", { locale: dateLocale })}`
    } else {
      return t("views.agenda")
    }
  }

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
            <InputGroupButton
              size="sm"
              variant={viewMode === "calendar" ? "default" : "ghost"}
              onClick={() => onViewModeChange("calendar")}
            >
              <IconCalendar className="h-4 w-4" />
            </InputGroupButton>
          </InputGroup>

          {/* Calendar navigation - only show when calendar view is active and not in agenda mode */}
          {viewMode === "calendar" && calendarViewMode !== "agenda" && calendarCurrentDate && onCalendarDateChange && (
            <>
              <div className="h-6 w-px bg-border flex-shrink-0"></div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handleCalendarPrev}>
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleCalendarToday}>
                  {t("today")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCalendarNext}>
                  <IconChevronRight className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold">
                  {getCalendarTitle()}
                </div>
              </div>
            </>
          )}

          {/* Filter tabs - hidden on smaller screens, shown on xl+ */}
          {/* <Tabs value={filterTab} onValueChange={(value) => onFilterChange(value as FilterTab)} className="flex-1 min-w-0 hidden xl:block">
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
          </Tabs> */}

          {/* Filter tabs dropdown for smaller screens */}
          {/* <DropdownMenu>
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
          </DropdownMenu> */}
        </div>

        {/* Right side: Calendar view switcher (when calendar is active), Filter button and New Task */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Calendar view mode switcher - only show when calendar view is active */}
          {viewMode === "calendar" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {calendarViewMode === "monthly" && <IconCalendar className="h-4 w-4" />}
                  {calendarViewMode === "weekly" && <IconCalendarWeek className="h-4 w-4" />}
                  {calendarViewMode === "agenda" && <IconList className="h-4 w-4" />}
                  <span>{t(`views.${calendarViewMode}` as any)}</span>
                  <IconChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onCalendarViewModeChange?.("monthly")}>
                  <IconCalendar className="h-4 w-4 mr-2" />
                  <span>{t("views.monthly")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCalendarViewModeChange?.("weekly")}>
                  <IconCalendarWeek className="h-4 w-4 mr-2" />
                  <span>{t("views.weekly")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCalendarViewModeChange?.("agenda")}>
                  <IconList className="h-4 w-4 mr-2" />
                  <span>{t("views.agenda")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Filter button */}
          <Button variant="outline" size="sm" className="gap-2">
            <IconFilter className="h-4 w-4" />
            {filterLabels.filter}
          </Button>

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
        {/* <div className="flex items-center justify-between gap-0">
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
        </div> */}

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
              <InputGroupButton
                size="sm"
                variant={viewMode === "calendar" ? "default" : "ghost"}
                onClick={() => onViewModeChange("calendar")}
                className="flex-1"
              >
                <IconCalendar className="h-4 w-4" />
                <span className="text-sm">Calendar</span>
              </InputGroupButton>
            </InputGroup>

            {/* Calendar navigation - mobile - hide in agenda mode */}
            {viewMode === "calendar" && calendarViewMode !== "agenda" && calendarCurrentDate && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCalendarPrev} className="flex-1">
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCalendarToday} className="flex-1">
                    {t("today")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCalendarNext} className="flex-1">
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-semibold text-center">
                  {getCalendarTitle()}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2 justify-start">
                      {calendarViewMode === "monthly" && <IconCalendar className="h-4 w-4" />}
                      {calendarViewMode === "weekly" && <IconCalendarWeek className="h-4 w-4" />}
                      {calendarViewMode === "agenda" && <IconList className="h-4 w-4" />}
                      <span>{t(`views.${calendarViewMode}` as any)}</span>
                      <IconChevronDown className="h-4 w-4 ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-full">
                      <DropdownMenuItem onClick={() => onCalendarViewModeChange?.("monthly")}>
                        <IconCalendar className="h-4 w-4 mr-2" />
                        <span>{t("views.monthly")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCalendarViewModeChange?.("weekly")}>
                        <IconCalendarWeek className="h-4 w-4 mr-2" />
                        <span>{t("views.weekly")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCalendarViewModeChange?.("agenda")}>
                        <IconList className="h-4 w-4 mr-2" />
                        <span>{t("views.agenda")}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" className="gap-2 justify-start">
                <IconFilter className="h-4 w-4" />
                {filterLabels.filter}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
