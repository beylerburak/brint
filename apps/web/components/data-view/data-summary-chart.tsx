"use client"

import { IconFlagFilled, IconList, IconCheck, IconAlertCircle } from "@tabler/icons-react"
import { SummaryStats } from "./types"
import { memo } from "react"
import { useTranslations } from "next-intl"

interface DataSummaryChartProps {
  stats: SummaryStats
  className?: string
}

export const DataSummaryChart = memo(function DataSummaryChart({
  stats,
  className = "",
}: DataSummaryChartProps) {
  const t = useTranslations("tasks")

  return (
    <div className={`w-full px-6 pt-4 pb-1 ${className}`}>
      <div className="flex flex-row gap-2 sm:gap-4 w-full">
        {/* Priority Stats */}
        <div className="w-full h-auto sm:h-[88px] rounded-xl border border-muted-foreground/15 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-0">
          <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("chart.lowPriority")}</span>
            </div>
            <div className="text-xl sm:text-2xl font-semibold">{stats.lowPriority}</div>
          </div>

          <div className="hidden sm:block h-12 w-px bg-border"></div>
          <div className="sm:hidden w-full h-px bg-border"></div>

          <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("chart.mediumPriority")}</span>
            </div>
            <div className="text-xl sm:text-2xl font-semibold">{stats.mediumPriority}</div>
          </div>

          <div className="hidden sm:block h-12 w-px bg-border"></div>
          <div className="sm:hidden w-full h-px bg-border"></div>

          <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("chart.highPriority")}</span>
            </div>
            <div className="text-xl sm:text-2xl font-semibold">{stats.highPriority}</div>
          </div>
        </div>

        {/* Task Stats */}
        <div className="w-full h-auto sm:h-[88px] rounded-xl border border-muted-foreground/15 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-0">
          <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <IconList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("chart.totalTasks")}</span>
            </div>
            <div className="text-xl sm:text-2xl font-semibold">{stats.totalTasks}</div>
          </div>

          <div className="hidden sm:block h-12 w-px bg-border"></div>
          <div className="sm:hidden w-full h-px bg-border"></div>

          <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <IconCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("chart.totalDone")}</span>
            </div>
            <div className="text-xl sm:text-2xl font-semibold">{stats.totalDone}</div>
          </div>

          <div className="hidden sm:block h-12 w-px bg-border"></div>
          <div className="sm:hidden w-full h-px bg-border"></div>

          <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <IconAlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("chart.overdue")}</span>
            </div>
            <div className="text-xl sm:text-2xl font-semibold">{stats.overdue}</div>
          </div>
        </div>
      </div>
    </div>
  )
})
