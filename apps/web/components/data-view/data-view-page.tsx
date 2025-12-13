"use client"

import { useState, ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconDots } from "@tabler/icons-react"
import { DataSummaryChart, SummaryStats, ViewMode } from "./"

interface DataViewPageProps {
  title: string
  summaryStats?: SummaryStats
  viewMode: ViewMode
  shouldShowCompleted?: boolean
  onCompletedFilterChange?: (showCompleted: boolean) => void
  onSummaryVisibilityChange?: (showSummary: boolean) => void
  headerRight?: ReactNode // For toolbar or other header actions (desktop)
  headerRightMobile?: ReactNode // For mobile-specific header actions
  toolbar?: ReactNode // For toolbar below header (mobile)
  children: ReactNode
  summaryClassName?: string
}

export function DataViewPage({
  title,
  summaryStats,
  viewMode,
  shouldShowCompleted: initialShowCompleted = true,
  onCompletedFilterChange,
  onSummaryVisibilityChange,
  headerRight,
  headerRightMobile,
  toolbar,
  children,
  summaryClassName,
}: DataViewPageProps) {
  const t = useTranslations("tasks")
  const [showSummary, setShowSummary] = useState<boolean>(true)
  const [showCompleted, setShowCompleted] = useState<boolean>(initialShowCompleted)

  const handleSummaryToggle = () => {
    const newValue = !showSummary
    setShowSummary(newValue)
    onSummaryVisibilityChange?.(newValue)
  }

  const handleCompletedToggle = () => {
    const newValue = !showCompleted
    setShowCompleted(newValue)
    onCompletedFilterChange?.(newValue)
  }

  // Determine summary chart className based on view mode
  const getSummaryClassName = () => {
    if (summaryClassName) return summaryClassName
    if (viewMode === "table") return "pb-0"
    if (viewMode === "calendar") return "pb-4"
    return "pb-1"
  }

  // Determine data view container className
  const getDataViewClassName = () => {
    const baseClasses = `w-full sm:px-6 ${viewMode === "kanban" || viewMode === "calendar" ? "px-6" : "px-0"} ${viewMode === "calendar" && !showSummary ? "pt-6" : ""} flex-1 min-h-0 flex flex-col`
    return baseClasses
  }

  return (
    <div className="w-full flex flex-col min-h-0" style={{ height: "100vh" }}>
      {/* Header */}
      <div className="flex items-center px-6 pt-6 pb-0 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <IconDots className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {summaryStats && (
                <DropdownMenuItem onClick={handleSummaryToggle}>
                  {showSummary ? t("summary.hide") : t("summary.show")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleCompletedToggle}>
                {showCompleted ? t("completed.hide") : t("completed.show")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile header right actions */}
        {headerRightMobile && (
          <div className="sm:hidden ml-auto">
            {headerRightMobile}
          </div>
        )}

        {/* Desktop header right (toolbar) */}
        {headerRight && (
          <div className="hidden sm:flex flex-1 min-w-0">
            {headerRight}
          </div>
        )}
      </div>

      {/* Mobile Toolbar */}
      {toolbar && (
        <div className="sm:hidden px-6 mt-3">
          {toolbar}
        </div>
      )}

      {/* Summary Chart */}
      {showSummary && summaryStats && (
        <DataSummaryChart stats={summaryStats} className={getSummaryClassName()} />
      )}

      {/* Data View */}
      <div className={getDataViewClassName()}>
        {children}
      </div>
    </div>
  )
}

