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
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns"
import { useLocale } from "next-intl"
import { enUS, tr } from "date-fns/locale"

interface DataViewToolbarProps {
  viewMode: ViewMode
  filterTab: FilterTab
  searchValue?: string
  onViewModeChange: (mode: ViewMode) => void
  onFilterChange: (filter: FilterTab) => void
  onSearchChange?: (value: string) => void
  onCreate?: () => void
  createLabel?: string
  searchPlaceholder?: string
  availableViewModes?: ViewMode[]
  showToolbar?: boolean
  isEmpty?: boolean // Hide view toggles when empty
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
  // Deprecated - use onCreate and createLabel instead
  onNewTask?: () => void
  newTaskLabel?: string
}

export function DataViewToolbar({
  viewMode,
  filterTab,
  searchValue = "",
  onViewModeChange,
  onFilterChange,
  onSearchChange,
  onCreate,
  createLabel,
  searchPlaceholder = "Search...",
  availableViewModes = ["table", "kanban", "calendar"],
  showToolbar = true,
  isEmpty = false,
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
  // Deprecated props - kept for backwards compatibility
  onNewTask,
  newTaskLabel,
}: DataViewToolbarProps) {
  // Use new props if provided, otherwise fall back to deprecated ones
  const handleCreate = onCreate || onNewTask
  const createButtonLabel = createLabel || newTaskLabel || "New"

  if (!showToolbar) {
    return null
  }
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
      // On mobile, move 3 days instead of 1 week
      if (isMobile) {
        onCalendarDateChange(subDays(calendarCurrentDate, 3))
      } else {
        onCalendarDateChange(subWeeks(calendarCurrentDate, 1))
      }
    }
  }

  const handleCalendarNext = () => {
    if (!calendarCurrentDate || !onCalendarDateChange) return
    if (calendarViewMode === "monthly") {
      onCalendarDateChange(addMonths(calendarCurrentDate, 1))
    } else if (calendarViewMode === "weekly") {
      // On mobile, move 3 days instead of 1 week
      if (isMobile) {
        onCalendarDateChange(addDays(calendarCurrentDate, 3))
      } else {
        onCalendarDateChange(addWeeks(calendarCurrentDate, 1))
      }
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
    <div className="relative w-full">
      {/* Desktop layout */}
      <div className="hidden sm:flex items-center gap-2 md:gap-4 w-full">
        {/* Left side: Search, View Toggle, Calendar Navigation */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          {/* Search input - always visible on desktop, hidden when empty */}
          {!isEmpty && onSearchChange && (
            <>
              <div className="w-32 md:w-40 relative flex-shrink-0 min-w-0">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="search"
                  placeholder={searchPlaceholder}
                  className="h-9 pl-9 text-sm truncate placeholder:truncate"
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                />
              </div>
              {/* Divider */}
              <div className="h-6 w-px bg-border flex-shrink-0"></div>
            </>
          )}

          {/* View toggle */}
          {!isEmpty && availableViewModes.length > 0 && (
            <InputGroup className="w-auto flex-shrink-0">
              {availableViewModes.includes("table") && (
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  onClick={() => onViewModeChange("table")}
                >
                  <IconTable className="h-4 w-4" />
                </InputGroupButton>
              )}
              {availableViewModes.includes("kanban") && (
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  onClick={() => onViewModeChange("kanban")}
                >
                  <IconLayoutKanban className="h-4 w-4" />
                </InputGroupButton>
              )}
              {availableViewModes.includes("calendar") && (
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "calendar" ? "default" : "ghost"}
                  onClick={() => onViewModeChange("calendar")}
                >
                  <IconCalendar className="h-4 w-4" />
                </InputGroupButton>
              )}
            </InputGroup>
          )}

          {/* Calendar navigation - only show when calendar view is active and not in agenda mode */}
          {viewMode === "calendar" && calendarViewMode !== "agenda" && calendarCurrentDate && onCalendarDateChange && (
            <>
              <div className="h-6 w-px bg-border flex-shrink-0 hidden lg:block"></div>
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 min-w-0">
                <Button variant="outline" size="sm" onClick={handleCalendarPrev} className="px-2">
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleCalendarToday} className="px-2 hidden lg:inline-flex">
                  {t("today")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCalendarNext} className="px-2">
                  <IconChevronRight className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold truncate hidden lg:block min-w-0">
                  {getCalendarTitle()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right side: Calendar view switcher (when calendar is active), Filter button and New Task */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 ml-auto">
          {/* Calendar view mode switcher - only show when calendar view is active */}
          {viewMode === "calendar" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 md:gap-2 px-2 md:px-3">
                  {calendarViewMode === "monthly" && <IconCalendar className="h-4 w-4" />}
                  {calendarViewMode === "weekly" && <IconCalendarWeek className="h-4 w-4" />}
                  {calendarViewMode === "agenda" && <IconList className="h-4 w-4" />}
                  <span className="hidden lg:inline">{t(`views.${calendarViewMode}` as any)}</span>
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

          {/* Filter button - hidden when empty */}
          {!isEmpty && (
            <Button variant="outline" size="sm" className="gap-1 md:gap-2 px-2 md:px-3">
              <IconFilter className="h-4 w-4" />
              <span className="hidden xl:inline">{filterLabels.filter}</span>
            </Button>
          )}

          {handleCreate && (
            <Button size="sm" className="flex-shrink-0 px-2 md:px-3" onClick={handleCreate}>
              <IconPlus className="h-4 w-4" />
              <span className="hidden lg:inline">{createButtonLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile layout - two divs: left and right */}
      <div className="sm:hidden flex items-center gap-1 w-full overflow-x-auto scrollbar-hide">
        {/* Left side: Search, View Toggle, Calendar Navigation */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {/* Search button - opens search on click, hidden when empty */}
          {!isEmpty && onSearchChange && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex-shrink-0 px-2"
            >
              <IconSearch className="h-4 w-4" />
            </Button>
          )}
          
          {/* View mode toggle - compact */}
          {!isEmpty && availableViewModes.length > 1 && (
            <InputGroup className="w-auto flex-shrink-0">
              {availableViewModes.includes("table") && (
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  onClick={() => onViewModeChange("table")}
                  className="px-1.5"
                >
                  <IconTable className="h-4 w-4" />
                </InputGroupButton>
              )}
              {availableViewModes.includes("kanban") && (
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  onClick={() => onViewModeChange("kanban")}
                  className="px-1.5"
                >
                  <IconLayoutKanban className="h-4 w-4" />
                </InputGroupButton>
              )}
              {availableViewModes.includes("calendar") && (
                <InputGroupButton
                  size="sm"
                  variant={viewMode === "calendar" ? "default" : "ghost"}
                  onClick={() => onViewModeChange("calendar")}
                  className="px-1.5"
                >
                  <IconCalendar className="h-4 w-4" />
                </InputGroupButton>
              )}
            </InputGroup>
          )}

          {/* Calendar navigation - compact for mobile, hide Today button */}
          {viewMode === "calendar" && calendarViewMode !== "agenda" && calendarCurrentDate && onCalendarDateChange && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleCalendarPrev} className="px-1.5">
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleCalendarNext} className="px-1.5">
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right side: Calendar view switcher (when calendar is active), Filter button and New Task */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Calendar view mode switcher - only show when calendar view is active, icon only on mobile */}
          {viewMode === "calendar" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-1.5">
                  {calendarViewMode === "monthly" && <IconCalendar className="h-4 w-4" />}
                  {calendarViewMode === "weekly" && <IconCalendarWeek className="h-4 w-4" />}
                  {calendarViewMode === "agenda" && <IconList className="h-4 w-4" />}
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

          {/* Filter button - icon only, hidden when empty */}
          {!isEmpty && (
            <Button variant="outline" size="sm" className="px-1.5 flex-shrink-0">
              <IconFilter className="h-4 w-4" />
            </Button>
          )}

          {/* Create button - hidden on mobile (mobile has its own create button elsewhere) */}
          {handleCreate && (
            <Button size="sm" className="hidden sm:flex flex-shrink-0 px-1.5" onClick={handleCreate}>
              <IconPlus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Expandable search - shown when search button is clicked, hidden when empty */}
        {!isEmpty && showMobileFilters && onSearchChange && (
          <div className="absolute top-full left-0 right-0 mt-2 px-4 z-50">
            <div className="w-full relative bg-background border rounded-lg shadow-lg p-2 min-w-0">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                className="h-9 pl-9 text-sm truncate placeholder:truncate"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
