"use client"

import { useMemo, useCallback } from "react"
import { useTranslations, useLocale } from "next-intl"
import { BaseTask } from "./types"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfDay,
  parseISO,
} from "date-fns"
import { enUS, tr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconFlagFilled } from "@tabler/icons-react"
import { Status, StatusIndicator, StatusLabel } from "@/components/kibo-ui/status"
import * as React from "react"

export type CalendarViewMode = "monthly" | "weekly" | "agenda"

interface DataViewCalendarProps {
  tasks: BaseTask[]
  onTaskClick?: (task: BaseTask) => void
  className?: string
  currentDate: Date
  calendarViewMode: CalendarViewMode
  onDateChange: (date: Date) => void
  onCalendarViewModeChange: (mode: CalendarViewMode) => void
  availableStatuses?: Array<{ id: string; label: string; color: string | null; isDefault: boolean; group?: 'TODO' | 'IN_PROGRESS' | 'DONE' }>
}

export function DataViewCalendar({
  tasks,
  onTaskClick,
  className,
  currentDate,
  calendarViewMode,
  onDateChange,
  onCalendarViewModeChange,
  availableStatuses,
}: DataViewCalendarProps) {
  // Use controlled state (props are required)
  const locale = useLocale()
  const dateLocale = locale === "tr" ? tr : enUS
  const date = currentDate
  const viewMode = calendarViewMode

  // Group tasks by due date (date only, ignore time)
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, BaseTask[]> = {}
    
    tasks.forEach((task) => {
      if (task.dueDate) {
        const dueDate = startOfDay(parseISO(task.dueDate))
        const dateKey = format(dueDate, "yyyy-MM-dd")
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(task)
      }
    })
    
    // Sort tasks within each date by priority and time
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        const priorityOrder: Record<string, number> = {
          Critical: 4,
          High: 3,
          Medium: 2,
          Low: 1,
        }
        const aPriority = priorityOrder[a.priority] || 0
        const bPriority = priorityOrder[b.priority] || 0
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority
        }
        
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        }
        
        return 0
      })
    })
    
    return grouped
  }, [tasks])

  // Get tasks for a specific date
  const getTasksForDate = useCallback((date: Date): BaseTask[] => {
    const dateKey = format(startOfDay(date), "yyyy-MM-dd")
    return tasksByDate[dateKey] || []
  }, [tasksByDate])


  // Monthly View
  const MonthlyView = () => {
    const t = useTranslations("calendar")
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }) // Monday
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    
    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    const weekDays = [
      t("weekdays.monday"),
      t("weekdays.tuesday"),
      t("weekdays.wednesday"),
      t("weekdays.thursday"),
      t("weekdays.friday"),
      t("weekdays.saturday"),
      t("weekdays.sunday"),
    ]

    return (
      <div className="flex flex-col">
        {/* Calendar Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                {weekDays.map((day) => (
                  <th
                    key={day}
                    className="bg-muted/50 p-2 text-center text-sm font-medium text-muted-foreground border-b border-border"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIdx) => {
                const isLastWeek = weekIdx === weeks.length - 1
                return (
                  <tr key={weekIdx}>
                    {week.map((day, dayIdx) => {
                      const dayTasks = getTasksForDate(day)
                      const isToday = isSameDay(day, new Date())
                      const isCurrentMonth = isSameMonth(day, date)
                      const isLastColumn = dayIdx === 6

                      return (
                        <td
                          key={`${weekIdx}-${dayIdx}`}
                          className={cn(
                            "bg-background align-top border-r border-b border-border",
                            !isCurrentMonth && "opacity-40",
                            isLastColumn && "border-r-0", // Last column, no right border
                            isLastWeek && "border-b-0" // Last row, no bottom border
                          )}
                        >
                        <div className="p-2 flex flex-col min-h-[160px]">
                          <div className="flex items-center justify-between mb-2 flex-shrink-0">
                            <span
                              className={cn(
                                "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                isToday && "bg-primary text-primary-foreground font-semibold"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            {dayTasks.length > 0 && (
                              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                                {dayTasks.length}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            {dayTasks.map((task) => {
                              const dueTime = task.dueDate ? format(parseISO(task.dueDate), "HH:mm") : null
                              
                              // Get status color from API
                              const taskStatusGroup = (task as any).statusGroup as 'TODO' | 'IN_PROGRESS' | 'DONE' | undefined
                              let statusColor: string | undefined = undefined
                              
                              if (availableStatuses && availableStatuses.length > 0) {
                                if (taskStatusGroup) {
                                  const foundStatus = availableStatuses.find(s => s.group === taskStatusGroup)
                                  if (foundStatus?.color) {
                                    statusColor = foundStatus.color
                                  }
                                }
                                if (!statusColor) {
                                  const foundStatus = availableStatuses.find(s => s.label === task.status)
                                  if (foundStatus?.color) {
                                    statusColor = foundStatus.color
                                  }
                                }
                              }
                              
                              // Convert hex color to rgba for background with opacity
                              const getBackgroundStyle = (color?: string): React.CSSProperties | undefined => {
                                if (!color) return undefined
                                // Convert hex to rgb
                                const hex = color.replace('#', '')
                                const r = parseInt(hex.substring(0, 2), 16)
                                const g = parseInt(hex.substring(2, 4), 16)
                                const b = parseInt(hex.substring(4, 6), 16)
                                return {
                                  backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
                                  borderLeftColor: color,
                                  borderLeftWidth: '2px',
                                  borderLeftStyle: 'solid' as const,
                                }
                              }
                              
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => onTaskClick?.(task)}
                                  className={cn(
                                    "w-full text-left p-1.5 rounded text-xs hover:bg-accent transition-colors truncate border-l-2",
                                    !statusColor && "bg-muted/50 border-border"
                                  )}
                                  style={statusColor ? getBackgroundStyle(statusColor) : undefined}
                                  title={task.title || "Untitled Task"}
                                >
                                  {dueTime && <span className="text-[10px] opacity-70">{dueTime} </span>}
                                  <span className="truncate">{task.title || "Untitled Task"}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </td>
                    )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Weekly View
  const WeeklyView = () => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 }) // Monday
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 grid grid-cols-7 gap-px border rounded-lg overflow-hidden bg-border">
          {weekDays.map((day) => {
            const dayTasks = getTasksForDate(day)
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={format(day, "yyyy-MM-dd")}
                className="bg-background min-h-[400px] p-3 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {format(day, "EEE", { locale: dateLocale })}
                    </div>
                    <div
                      className={cn(
                        "text-xl font-semibold w-8 h-8 flex items-center justify-center rounded-full",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                  {dayTasks.length > 0 && (
                    <Badge variant="secondary">{dayTasks.length}</Badge>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {dayTasks.map((task) => {
                    const dueTime = task.dueDate ? format(parseISO(task.dueDate), "HH:mm") : null
                    
                    // Get status color from API
                    const taskStatusGroup = (task as any).statusGroup as 'TODO' | 'IN_PROGRESS' | 'DONE' | undefined
                    let statusColor: string | undefined = undefined
                    
                    if (availableStatuses && availableStatuses.length > 0) {
                      if (taskStatusGroup) {
                        const foundStatus = availableStatuses.find(s => s.group === taskStatusGroup)
                        if (foundStatus?.color) {
                          statusColor = foundStatus.color
                        }
                      }
                      if (!statusColor) {
                        const foundStatus = availableStatuses.find(s => s.label === task.status)
                        if (foundStatus?.color) {
                          statusColor = foundStatus.color
                        }
                      }
                    }
                    
                    // Convert hex color to rgba for background with opacity
                    const getBackgroundStyle = (color?: string): React.CSSProperties | undefined => {
                      if (!color) return undefined
                      // Convert hex to rgb
                      const hex = color.replace('#', '')
                      const r = parseInt(hex.substring(0, 2), 16)
                      const g = parseInt(hex.substring(2, 4), 16)
                      const b = parseInt(hex.substring(4, 6), 16)
                      return {
                        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
                      }
                    }
                    
                    return (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick?.(task)}
                        className={cn(
                          "w-full text-left p-2 rounded-sm hover:bg-accent transition-colors",
                          !statusColor && "bg-muted/50"
                        )}
                        style={statusColor ? getBackgroundStyle(statusColor) : undefined}
                      >
                        {dueTime && (
                          <div className="text-xs text-muted-foreground mb-1">{dueTime}</div>
                        )}
                        <div className="font-medium text-sm truncate">{task.title || "Untitled Task"}</div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {task.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 min-w-0">
                          {/* Priority badge - same style as kanban card */}
                          {(() => {
                            // Map priority to color (same as kanban)
                            const priorityColorMap: Record<string, string> = {
                              "High": "text-red-500",
                              "Medium": "text-yellow-500",
                              "Low": "text-green-500",
                            }
                            const priorityColor = priorityColorMap[task.priority] || "text-yellow-500"
                            
                            return (
                              <Badge variant="outline" className="text-muted-foreground px-1.5 h-5 flex-shrink-0">
                                <IconFlagFilled className={`h-3.5 w-3.5 ${priorityColor}`} />
                                <span className="truncate">{task.priority}</span>
                              </Badge>
                            )
                          })()}
                          
                          {/* Status badge - same style as kanban card (using Status component) */}
                          {task.status && (() => {
                            // Get status color from API
                            const taskStatusGroup = (task as any).statusGroup as 'TODO' | 'IN_PROGRESS' | 'DONE' | undefined
                            let statusColor: string | undefined = undefined
                            let status: "online" | "offline" | "maintenance" | "degraded" = "offline"
                            
                            if (availableStatuses && availableStatuses.length > 0) {
                              if (taskStatusGroup) {
                                const foundStatus = availableStatuses.find(s => s.group === taskStatusGroup)
                                if (foundStatus?.color) {
                                  statusColor = foundStatus.color
                                }
                              }
                              if (!statusColor) {
                                const foundStatus = availableStatuses.find(s => s.label === task.status)
                                if (foundStatus?.color) {
                                  statusColor = foundStatus.color
                                }
                              }
                            }
                            
                            // Fallback status type if no color
                            if (!statusColor) {
                              const statusGroupMap: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
                                "Not Started": "TODO",
                                "In Progress": "IN_PROGRESS",
                                "Done": "DONE",
                              }
                              const group = statusGroupMap[task.status]
                              if (group === 'DONE') status = "online"
                              else if (group === 'IN_PROGRESS') status = "maintenance"
                              else status = "degraded"
                            }
                            
                            return (
                              <Status status={status} className="min-w-0">
                                <StatusIndicator color={statusColor} className="flex-shrink-0" />
                                <StatusLabel className="truncate min-w-0">{task.status}</StatusLabel>
                              </Status>
                            )
                          })()}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Agenda View
  const AgendaView = () => {
    const t = useTranslations("calendar")
    // Get all dates with tasks, sorted
    const allDates = useMemo(() => {
      const dates = Object.keys(tasksByDate)
        .map((key) => parseISO(key))
        .sort((a, b) => a.getTime() - b.getTime())
        .filter((date) => date >= startOfDay(new Date())) // Only future dates

      return dates
    }, [tasksByDate])

    return (
      <div className="flex-1 overflow-y-auto space-y-6">
        {allDates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t("agenda.noUpcomingTasks")}
          </div>
        ) : (
          allDates.map((date) => {
            const dayTasks = getTasksForDate(date)
            const isToday = isSameDay(date, new Date())

            return (
              <div key={format(date, "yyyy-MM-dd")} className="space-y-2">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      "text-lg font-semibold",
                      isToday && "text-primary"
                    )}
                  >
                    {format(date, "EEEE, d MMMM", { locale: dateLocale })}
                  </div>
                  {isToday && (
                    <Badge variant="default" className="text-xs">{t("today")}</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {dayTasks.length} {dayTasks.length !== 1 ? t("agenda.tasks") : t("agenda.task")}
                  </Badge>
                </div>
                <div className="space-y-4 pl-4 border-l-2 border-border">
                  {dayTasks.map((task) => {
                    const dueTime = task.dueDate ? format(parseISO(task.dueDate), "HH:mm") : null
                    return (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick?.(task)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 min-w-0">
                              {task.taskNumber && (
                                <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                                  TAS-{task.taskNumber}
                                </span>
                              )}
                              {/* Priority badge - same style as kanban card */}
                              {(() => {
                                // Map priority to color (same as kanban)
                                const priorityColorMap: Record<string, string> = {
                                  "High": "text-red-500",
                                  "Medium": "text-yellow-500",
                                  "Low": "text-green-500",
                                }
                                const priorityColor = priorityColorMap[task.priority] || "text-yellow-500"
                                
                                return (
                                  <Badge variant="outline" className="text-muted-foreground px-1.5 h-5 flex-shrink-0">
                                    <IconFlagFilled className={`h-3.5 w-3.5 ${priorityColor}`} />
                                    <span className="truncate">{task.priority}</span>
                                  </Badge>
                                )
                              })()}
                              
                              {/* Status badge - same style as kanban card (using Status component) */}
                              {task.status && (() => {
                                // Get status color from API
                                const taskStatusGroup = (task as any).statusGroup as 'TODO' | 'IN_PROGRESS' | 'DONE' | undefined
                                let statusColor: string | undefined = undefined
                                let status: "online" | "offline" | "maintenance" | "degraded" = "offline"
                                
                                if (availableStatuses && availableStatuses.length > 0) {
                                  if (taskStatusGroup) {
                                    const foundStatus = availableStatuses.find(s => s.group === taskStatusGroup)
                                    if (foundStatus?.color) {
                                      statusColor = foundStatus.color
                                    }
                                  }
                                  if (!statusColor) {
                                    const foundStatus = availableStatuses.find(s => s.label === task.status)
                                    if (foundStatus?.color) {
                                      statusColor = foundStatus.color
                                    }
                                  }
                                }
                                
                                // Fallback status type if no color
                                if (!statusColor) {
                                  const statusGroupMap: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
                                    "Not Started": "TODO",
                                    "In Progress": "IN_PROGRESS",
                                    "Done": "DONE",
                                  }
                                  const group = statusGroupMap[task.status]
                                  if (group === 'DONE') status = "online"
                                  else if (group === 'IN_PROGRESS') status = "maintenance"
                                  else status = "degraded"
                                }
                                
                                return (
                                  <Status status={status} className="min-w-0">
                                    <StatusIndicator color={statusColor} className="flex-shrink-0" />
                                    <StatusLabel className="truncate min-w-0">{task.status}</StatusLabel>
                                  </Status>
                                )
                              })()}
                            </div>
                            <h4 className="font-medium truncate">{task.title || "Untitled Task"}</h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                          {dueTime && (
                            <div className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                              {dueTime}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  const isMonthly = viewMode === "monthly"

  return (
    <div className={cn("flex flex-col", !isMonthly && "h-full", className)}>
      {/* Calendar content */}
      <div className={cn(!isMonthly && "flex-1 min-h-0")}>
        {viewMode === "monthly" && <MonthlyView />}
        {viewMode === "weekly" && <WeeklyView />}
        {viewMode === "agenda" && <AgendaView />}
      </div>
    </div>
  )
}
